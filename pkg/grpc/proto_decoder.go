package grpc

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"strings"
	"unicode/utf8"
)

// GrpcStatusMap maps numeric gRPC status codes to human-readable text.
var GrpcStatusMap = map[int]string{
	0:  "OK",
	1:  "CANCELLED",
	2:  "UNKNOWN",
	3:  "INVALID_ARGUMENT",
	4:  "DEADLINE_EXCEEDED",
	5:  "NOT_FOUND",
	6:  "ALREADY_EXISTS",
	7:  "PERMISSION_DENIED",
	8:  "RESOURCE_EXHAUSTED",
	9:  "FAILED_PRECONDITION",
	10: "ABORTED",
	11: "OUT_OF_RANGE",
	12: "UNIMPLEMENTED",
	13: "INTERNAL",
	14: "UNAVAILABLE",
	15: "DATA_LOSS",
	16: "UNAUTHENTICATED",
}

// GrpcMessage represents a decoded gRPC frame.
type GrpcMessage struct {
	IsTrailer   bool           `json:"isTrailer,omitempty"`
	Compressed  bool           `json:"compressed"`
	Length      uint32         `json:"length"`
	RawBytes    []byte         `json:"-"`
	DecodedJSON map[string]any `json:"decodedJson,omitempty"`
	RawHex      string         `json:"rawHex,omitempty"`
	TrailerText string         `json:"trailerText,omitempty"`
}

// IsGrpcContentType checks if Content-Type matches gRPC or gRPC-Web.
func IsGrpcContentType(ct string) bool {
	ct = strings.ToLower(ct)
	return strings.Contains(ct, "application/grpc") ||
		strings.Contains(ct, "application/grpc-web")
}

// ParseGrpcFrames parses 5-byte length-prefixed gRPC/gRPC-Web stream frames.
func ParseGrpcFrames(data []byte) ([]*GrpcMessage, error) {
	var messages []*GrpcMessage
	reader := bytes.NewReader(data)

	for reader.Len() >= 5 {
		var flag uint8
		var length uint32

		if err := binary.Read(reader, binary.BigEndian, &flag); err != nil {
			break
		}
		if err := binary.Read(reader, binary.BigEndian, &length); err != nil {
			break
		}

		isTrailer := (flag & 0x80) != 0
		compressed := (flag & 0x01) != 0

		if int64(length) > int64(reader.Len()) {
			// Incomplete frame, take remaining
			payload := make([]byte, reader.Len())
			_, _ = reader.Read(payload)
			msg := &GrpcMessage{
				IsTrailer:  isTrailer,
				Compressed: compressed,
				Length:     length,
				RawBytes:   payload,
				RawHex:     fmt.Sprintf("%x", payload),
			}
			messages = append(messages, msg)
			break
		}

		payload := make([]byte, length)
		if _, err := io.ReadFull(reader, payload); err != nil {
			break
		}

		// Handle decompression if compressed flag is set
		uncompressed := payload
		if compressed && !isTrailer {
			if gz, err := gzip.NewReader(bytes.NewReader(payload)); err == nil {
				if decompressed, err := io.ReadAll(gz); err == nil {
					uncompressed = decompressed
				}
				_ = gz.Close()
			}
		}

		msg := &GrpcMessage{
			IsTrailer:  isTrailer,
			Compressed: compressed,
			Length:     length,
			RawBytes:   uncompressed,
			RawHex:     fmt.Sprintf("%x", uncompressed),
		}

		if isTrailer {
			msg.TrailerText = string(uncompressed)
		} else {
			decoded, err := DecodeProtobufWire(uncompressed)
			if err == nil && len(decoded) > 0 {
				msg.DecodedJSON = decoded
			}
		}

		messages = append(messages, msg)
	}

	return messages, nil
}

// DecodeProtobufWire performs a schema-less recursive parse of Protobuf wire format.
func DecodeProtobufWire(data []byte) (map[string]any, error) {
	result := make(map[string]any)
	reader := bytes.NewReader(data)

	for reader.Len() > 0 {
		tag, err := binary.ReadUvarint(reader)
		if err != nil {
			break
		}

		fieldNum := tag >> 3
		wireType := tag & 0x7

		if fieldNum == 0 {
			break
		}
		fieldKey := fmt.Sprintf("field_%d", fieldNum)

		switch wireType {
		case 0: // Varint
			val, err := binary.ReadUvarint(reader)
			if err != nil {
				return result, err
			}
			appendOrSet(result, fieldKey, val)

		case 1: // 64-bit (fixed64, double)
			var val uint64
			if err := binary.Read(reader, binary.LittleEndian, &val); err != nil {
				return result, err
			}
			floatVal := math.Float64frombits(val)
			appendOrSet(result, fieldKey, map[string]any{
				"uint64": val,
				"float":  floatVal,
			})

		case 2: // Length-delimited (string, bytes, embedded message, packed repeated)
			length, err := binary.ReadUvarint(reader)
			if err != nil {
				return result, err
			}
			if int64(length) > int64(reader.Len()) {
				return result, fmt.Errorf("length overflow")
			}
			payload := make([]byte, length)
			if _, err := io.ReadFull(reader, payload); err != nil {
				return result, err
			}

			// 1. If payload is clean printable UTF-8 text, decode as string
			if utf8.Valid(payload) && isAllPrintableText(payload) {
				appendOrSet(result, fieldKey, string(payload))
			} else if nested, err := DecodeProtobufWire(payload); err == nil && len(nested) > 0 {
				// 2. Try decoding as embedded nested protobuf message
				appendOrSet(result, fieldKey, nested)
			} else {
				// 3. Fallback to base64 raw binary
				appendOrSet(result, fieldKey, base64.StdEncoding.EncodeToString(payload))
			}

		case 5: // 32-bit (fixed32, float)
			var val uint32
			if err := binary.Read(reader, binary.LittleEndian, &val); err != nil {
				return result, err
			}
			floatVal := math.Float32frombits(val)
			appendOrSet(result, fieldKey, map[string]any{
				"uint32": val,
				"float":  floatVal,
			})

		default:
			// Unknown / unsupported wire type (3: start group, 4: end group deprecated)
			return result, nil
		}
	}

	return result, nil
}

func appendOrSet(m map[string]any, key string, val any) {
	if existing, found := m[key]; found {
		if slice, isSlice := existing.([]any); isSlice {
			m[key] = append(slice, val)
		} else {
			m[key] = []any{existing, val}
		}
	} else {
		m[key] = val
	}
}

func isAllPrintableText(b []byte) bool {
	if len(b) == 0 {
		return false
	}
	for _, c := range b {
		// Printable ASCII (0x20 - 0x7E) + common whitespace (0x09 \t, 0x0A \n, 0x0D \r)
		if c < 0x20 && c != 0x09 && c != 0x0A && c != 0x0D {
			return false
		}
	}
	return true
}

func isPrintableASCIIorUTF8(b []byte) bool {
	for _, c := range b {
		if c < 0x09 || (c > 0x0D && c < 0x20) {
			return false
		}
	}
	return true
}
