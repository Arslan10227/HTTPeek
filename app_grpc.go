package main

import (
	"encoding/base64"
	"fmt"

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
