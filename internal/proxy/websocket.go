package proxy

import (
	"encoding/binary"
	"fmt"
	"io"
	"time"
)

// RFC 6455 Opcode constants.
const (
	WSOpcodeContinuation = 0x0
	WSOpcodeText         = 0x1
	WSOpcodeBinary       = 0x2
	WSOpcodeClose        = 0x8
	WSOpcodePing         = 0x9
	WSOpcodePong         = 0xA
)

// WSFrame represents an RFC 6455 WebSocket frame parsed for inspection.
type WSFrame struct {
	ID        string    `json:"id"`
	RequestID string    `json:"requestId"`
	Opcode    int       `json:"opcode"`
	OpcodeStr string    `json:"opcodeStr"`
	Direction string    `json:"direction"` // "send" (client->server) or "receive" (server->client)
	Payload   []byte    `json:"payload"`
	Text      string    `json:"text,omitempty"`
	Length    int       `json:"length"`
	IsMasked  bool      `json:"isMasked"`
	Timestamp time.Time `json:"timestamp"`
}

// OpcodeToString returns a human-readable opcode name.
func OpcodeToString(opcode int) string {
	switch opcode {
	case WSOpcodeContinuation:
		return "Continuation"
	case WSOpcodeText:
		return "Text"
	case WSOpcodeBinary:
		return "Binary"
	case WSOpcodeClose:
		return "Close"
	case WSOpcodePing:
		return "Ping"
	case WSOpcodePong:
		return "Pong"
	default:
		return fmt.Sprintf("Unknown(%d)", opcode)
	}
}

// UnmaskPayload unmasks WebSocket payload bytes in-place using the 4-byte masking key.
func UnmaskPayload(payload []byte, maskKey []byte) []byte {
	if len(maskKey) != 4 || len(payload) == 0 {
		return payload
	}
	unmasked := make([]byte, len(payload))
	for i := range payload {
		unmasked[i] = payload[i] ^ maskKey[i%4]
	}
	return unmasked
}

// WriteCloseFrame sends a minimal RFC 6455 close frame to the destination.
func WriteCloseFrame(dst io.Writer, code uint16, reason string) error {
	payload := make([]byte, 2+len(reason))
	binary.BigEndian.PutUint16(payload, code)
	copy(payload[2:], reason)

	frame := make([]byte, 2+len(payload))
	frame[0] = 0x88 // FIN + Close opcode
	frame[1] = byte(len(payload))
	copy(frame[2:], payload)

	_, err := dst.Write(frame)
	return err
}
