package proxy

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"compress/zlib"
	"io"
	"strings"
	"unicode/utf8"

	"github.com/andybalholm/brotli"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
)

// DecodeBody decompress and decodes request/response payload bytes based on Content-Encoding and Content-Type.
func DecodeBody(rawBytes []byte, contentEncoding, contentType string) ([]byte, string) {
	if len(rawBytes) == 0 {
		return rawBytes, ""
	}

	decodedBytes := rawBytes
	encoding := strings.ToLower(strings.TrimSpace(contentEncoding))

	// 1. Decompress content encodings
	switch {
	case strings.Contains(encoding, "gzip"):
		if gzReader, err := gzip.NewReader(bytes.NewReader(rawBytes)); err == nil {
			if uncompressed, err := io.ReadAll(gzReader); err == nil {
				decodedBytes = uncompressed
			}
			_ = gzReader.Close()
		}
	case strings.Contains(encoding, "deflate"):
		if zReader, err := zlib.NewReader(bytes.NewReader(rawBytes)); err == nil {
			if uncompressed, err := io.ReadAll(zReader); err == nil {
				decodedBytes = uncompressed
			}
			_ = zReader.Close()
		} else {
			// Try raw flate
			fReader := flate.NewReader(bytes.NewReader(rawBytes))
			if uncompressed, err := io.ReadAll(fReader); err == nil {
				decodedBytes = uncompressed
			}
			_ = fReader.Close()
		}
	case strings.Contains(encoding, "br"):
		brReader := brotli.NewReader(bytes.NewReader(rawBytes))
		if uncompressed, err := io.ReadAll(brReader); err == nil {
			decodedBytes = uncompressed
		}
	}

	// 2. Character Set Decoding (UTF-8, GBK, GB2312, etc.)
	ct := strings.ToLower(contentType)
	if strings.Contains(ct, "gbk") || strings.Contains(ct, "gb2312") {
		reader := transform.NewReader(bytes.NewReader(decodedBytes), simplifiedchinese.GBK.NewDecoder())
		if utf8Bytes, err := io.ReadAll(reader); err == nil {
			return decodedBytes, string(utf8Bytes)
		}
	}

	// Check if valid UTF-8
	if utf8.Valid(decodedBytes) {
		return decodedBytes, string(decodedBytes)
	}

	// Binary content fallback
	return decodedBytes, string(decodedBytes)
}
