package grpc

import (
	"bytes"
	"encoding/binary"
	"testing"
)

func TestParseGrpcFrames(t *testing.T) {
	// Build a valid 5-byte length-prefixed frame with wire payload
	// Field 1: Varint 42 (tag = (1 << 3) | 0 = 0x08, val = 42 = 0x2a)
	// Field 2: String "Hello gRPC" (tag = (2 << 3) | 2 = 0x12, len = 10, "Hello gRPC")
	var protoPayload bytes.Buffer
	protoPayload.Write([]byte{0x08, 0x2a}) // field 1 = 42
	strVal := []byte("Hello gRPC")
	protoPayload.WriteByte(0x12)
	protoPayload.WriteByte(byte(len(strVal)))
	protoPayload.Write(strVal)

	rawBody := protoPayload.Bytes()

	// 5-byte header: flag=0, length=len(rawBody)
	var grpcFrame bytes.Buffer
	grpcFrame.WriteByte(0x00) // uncompressed
	_ = binary.Write(&grpcFrame, binary.BigEndian, uint32(len(rawBody)))
	grpcFrame.Write(rawBody)

	// Add a trailer frame (flag=0x80)
	trailerText := "grpc-status: 0\r\ngrpc-message: OK\r\n"
	grpcFrame.WriteByte(0x80)
	_ = binary.Write(&grpcFrame, binary.BigEndian, uint32(len(trailerText)))
	grpcFrame.WriteString(trailerText)

	messages, err := ParseGrpcFrames(grpcFrame.Bytes())
	if err != nil {
		t.Fatalf("ParseGrpcFrames failed: %v", err)
	}

	if len(messages) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(messages))
	}

	msg1 := messages[0]
	if msg1.IsTrailer {
		t.Errorf("message 1 should not be trailer")
	}
	if msg1.DecodedJSON == nil {
		t.Fatalf("expected decoded JSON for message 1")
	}

	if val, ok := msg1.DecodedJSON["field_1"]; !ok || val != uint64(42) {
		t.Errorf("expected field_1 == 42, got %v", val)
	}
	if val, ok := msg1.DecodedJSON["field_2"]; !ok || val != "Hello gRPC" {
		t.Errorf("expected field_2 == 'Hello gRPC', got %v", val)
	}

	msg2 := messages[1]
	if !msg2.IsTrailer {
		t.Errorf("message 2 should be trailer")
	}
	if msg2.TrailerText != trailerText {
		t.Errorf("expected trailer text %q, got %q", trailerText, msg2.TrailerText)
	}
}

func TestDecodeProtobufWire(t *testing.T) {
	// Nested message: field 1 = string, field 3 = nested { field 1 = 100 }
	var nestedBuf bytes.Buffer
	nestedBuf.Write([]byte{0x08, 0x64}) // nested field 1 = 100

	var rootBuf bytes.Buffer
	rootBuf.Write([]byte{0x0a, 0x04, 't', 'e', 's', 't'}) // field 1 = "test"
	rootBuf.WriteByte(0x1a)                                 // field 3 (wire type 2)
	rootBuf.WriteByte(byte(nestedBuf.Len()))
	rootBuf.Write(nestedBuf.Bytes())

	decoded, err := DecodeProtobufWire(rootBuf.Bytes())
	if err != nil {
		t.Fatalf("DecodeProtobufWire failed: %v", err)
	}

	if decoded["field_1"] != "test" {
		t.Errorf("expected field_1='test', got %v", decoded["field_1"])
	}

	nested, ok := decoded["field_3"].(map[string]any)
	if !ok {
		t.Fatalf("expected field_3 to be map, got %T", decoded["field_3"])
	}
	if nested["field_1"] != uint64(100) {
		t.Errorf("expected nested field_1=100, got %v", nested["field_1"])
	}
}
