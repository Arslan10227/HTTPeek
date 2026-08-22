package main

import (
	"encoding/base64"
	"fmt"
	"os"

	"httpeek/pkg/grpc"
)

// DecodeGrpcPayload parses 5-byte length-prefixed gRPC/gRPC-Web stream frames and decodes protobuf wire data.
func (a *App) DecodeGrpcPayload(base64Payload string) ([]*grpc.GrpcMessage, error) {
	if base64Payload == "" {
		return nil, nil
	}

	data, err := base64.StdEncoding.DecodeString(base64Payload)
	if err != nil {
		return nil, fmt.Errorf("invalid base64 payload: %w", err)
	}

	return grpc.ParseGrpcFrames(data)
}

// LoadProtoDescriptor loads a .desc or .proto file descriptor from disk.
func (a *App) LoadProtoDescriptor(filePath string) (map[string]any, error) {
	if filePath == "" {
		return map[string]any{"success": false, "error": "file path is empty"}, fmt.Errorf("file path empty")
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return map[string]any{"success": false, "error": err.Error()}, err
	}

	return map[string]any{
		"success":  true,
		"filePath": filePath,
		"fileSize": len(data),
		"message":  fmt.Sprintf("Loaded descriptor (%d bytes)", len(data)),
	}, nil
}
