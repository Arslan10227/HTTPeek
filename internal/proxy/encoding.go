package proxy

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"compress/zlib"
	"fmt"
	"io"
	"strings"

	"github.com/andybalholm/brotli"
	"github.com/klauspost/compress/zstd"
)

// DecompressBody decompresses payload data based on Content-Encoding header.
// Supported encodings: gzip, deflate, br, zstd.
// If encoding is identity, empty, or unrecognized, the raw bytes are returned unmodified.
func DecompressBody(contentEncoding string, data []byte) ([]byte, error) {
	if len(data) == 0 {
		return data, nil
	}

	encoding := strings.ToLower(strings.TrimSpace(contentEncoding))
	switch encoding {
	case "gzip", "x-gzip":
		gz, err := gzip.NewReader(bytes.NewReader(data))
		if err != nil {
			return data, fmt.Errorf("gzip reader error: %w", err)
		}
		defer gz.Close()
		return io.ReadAll(gz)

	case "deflate":
		// Deflate can be either raw flate or zlib-wrapped. Try zlib first, fallback to flate.
		zr, err := zlib.NewReader(bytes.NewReader(data))
		if err == nil {
			defer zr.Close()
			decompressed, readErr := io.ReadAll(zr)
			if readErr == nil {
				return decompressed, nil
			}
		}
		fr := flate.NewReader(bytes.NewReader(data))
		defer fr.Close()
		decompressed, err := io.ReadAll(fr)
		if err == nil {
			return decompressed, nil
		}
		return data, nil

	case "br":
		brReader := brotli.NewReader(bytes.NewReader(data))
		return io.ReadAll(brReader)

	case "zstd":
		decoder, err := zstd.NewReader(bytes.NewReader(data))
		if err != nil {
			return data, fmt.Errorf("zstd reader error: %w", err)
		}
		defer decoder.Close()
		return io.ReadAll(decoder)

	default:
		return data, nil
	}
}

// CompressBody compresses payload data according to the target encoding.
// Supported encodings: gzip, deflate, br, zstd.
func CompressBody(contentEncoding string, data []byte) ([]byte, error) {
	if len(data) == 0 {
		return data, nil
	}

	encoding := strings.ToLower(strings.TrimSpace(contentEncoding))
	switch encoding {
	case "gzip", "x-gzip":
		var buf bytes.Buffer
		gw := gzip.NewWriter(&buf)
		if _, err := gw.Write(data); err != nil {
			return nil, err
		}
		if err := gw.Close(); err != nil {
			return nil, err
		}
		return buf.Bytes(), nil

	case "deflate":
		var buf bytes.Buffer
		zw := zlib.NewWriter(&buf)
		if _, err := zw.Write(data); err != nil {
			return nil, err
		}
		if err := zw.Close(); err != nil {
			return nil, err
		}
		return buf.Bytes(), nil

	case "br":
		var buf bytes.Buffer
		bw := brotli.NewWriter(&buf)
		if _, err := bw.Write(data); err != nil {
			return nil, err
		}
		if err := bw.Close(); err != nil {
			return nil, err
		}
		return buf.Bytes(), nil

	case "zstd":
		var buf bytes.Buffer
		zw, err := zstd.NewWriter(&buf)
		if err != nil {
			return nil, err
		}
		if _, err := zw.Write(data); err != nil {
			_ = zw.Close()
			return nil, err
		}
		if err := zw.Close(); err != nil {
			return nil, err
		}
		return buf.Bytes(), nil

	default:
		return data, nil
	}
}
