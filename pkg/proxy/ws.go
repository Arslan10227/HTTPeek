package proxy

import (
	"bufio"
	"crypto/tls"
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Opcode definitions according to RFC 6455.
const (
	OpcodeContinuation = 0x0
	OpcodeText         = 0x1
	OpcodeBinary       = 0x2
	OpcodeClose        = 0x8
	OpcodePing         = 0x9
	OpcodePong         = 0xA
)

// maxWebSocketFrameSize bounds a single WebSocket frame payload to prevent
// memory exhaustion from untrusted length fields.
const maxWebSocketFrameSize = 16 * 1024 * 1024

// writeWSCloseFrame sends a minimal RFC 6455 close frame (payload ≤ 125).
func writeWSCloseFrame(dst io.Writer, code uint16, reason string) {
	payload := make([]byte, 2+len(reason))
	binary.BigEndian.PutUint16(payload, code)
	copy(payload[2:], reason)
	_, _ = dst.Write([]byte{0x88, byte(len(payload))})
	_, _ = dst.Write(payload)
}

func opcodeName(op int) string {
	switch op {
	case OpcodeContinuation:
		return "Continuation"
	case OpcodeText:
		return "Text"
	case OpcodeBinary:
		return "Binary"
	case OpcodeClose:
		return "Close"
	case OpcodePing:
		return "Ping"
	case OpcodePong:
		return "Pong"
	default:
		return fmt.Sprintf("Unknown(%d)", op)
	}
}

func (h *Handler) handleWebSocketUpgrade(ctx *Context, clientConn net.Conn, req *http.Request, isTLS bool) {
	targetHost := req.Host
	if !strings.Contains(targetHost, ":") {
		if isTLS {
			targetHost += ":443"
		} else {
			targetHost += ":80"
		}
	}

	var serverConn net.Conn
	var err error

	if isTLS {
		serverConn, err = tls.Dial("tcp", targetHost, &tls.Config{
			InsecureSkipVerify: true,
			ServerName:         req.URL.Hostname(),
		})
	} else {
		serverConn, err = net.DialTimeout("tcp", targetHost, 10*time.Second)
	}

	if err != nil {
		h.server.DispatchError(ctx, nil, fmt.Errorf("connect upstream WS failed: %w", err))
		return
	}
	defer serverConn.Close()

	ctx.ServerConn = serverConn

	// Forward the client handshake request to upstream server
	if err := req.Write(serverConn); err != nil {
		h.server.DispatchError(ctx, nil, err)
		return
	}

	// Read upstream response handshake
	serverReader := bufio.NewReader(serverConn)
	resp, err := http.ReadResponse(serverReader, req)
	if err != nil {
		h.server.DispatchError(ctx, nil, err)
		return
	}

	// Write upstream response back to client
	if err := resp.Write(clientConn); err != nil {
		return
	}

	if resp.StatusCode != http.StatusSwitchingProtocols {
		return
	}

	reqID := uuid.NewString()
	startTime := time.Now()

	host := req.URL.Hostname()
	if host == "" {
		host = req.Host
		if idx := strings.IndexByte(host, ':'); idx != -1 {
			host = host[:idx]
		}
	}
	port := 80
	if isTLS {
		port = 443
	}
	if req.URL.Port() != "" {
		if p, err := strconv.Atoi(req.URL.Port()); err == nil {
			port = p
		}
	}

	fullURL := req.URL.String()
	if !strings.HasPrefix(fullURL, "ws://") && !strings.HasPrefix(fullURL, "wss://") &&
		!strings.HasPrefix(fullURL, "http://") && !strings.HasPrefix(fullURL, "https://") {
		scheme := "ws://"
		if isTLS {
			scheme = "wss://"
		}
		fullURL = scheme + req.Host + req.URL.RequestURI()
	}

	httpReq := &HttpRequest{
		ID:          reqID,
		ExchangeID:  reqID,
		Protocol:    req.Proto,
		Method:      HttpMethod(req.Method),
		URL:         fullURL,
		Path:        req.URL.Path,
		Query:       req.URL.Query(),
		Headers:     req.Header.Clone(),
		Body:        []byte("[WebSocket Handshake]"),
		BodyString:  "[WebSocket Handshake]",
		BodyText:    "[WebSocket Handshake]",
		RemoteAddr:  req.Host,
		ClientAddr:  clientConn.RemoteAddr().String(),
		HostPort:    HostPort{Host: host, Port: port, SSL: isTLS},
		StartTime:   startTime,
		IsWebSocket: true,
		rawRequest:  req,
		Context:     make(map[string]any),
	}
	ctx.CurrentRequest = httpReq

	httpResp := &HttpResponse{
		ID:          reqID,
		StatusCode:  resp.StatusCode,
		StatusText:  resp.Status,
		Protocol:    resp.Proto,
		Headers:     resp.Header.Clone(),
		Body:        []byte("[WebSocket Connected]"),
		BodyString:  "[WebSocket Connected]",
		BodyText:    "[WebSocket Connected]",
		BodySize:    0,
		ContentType: "websocket/stream",
		StartTime:   startTime,
		EndTime:     time.Now(),
		DurationMs:  time.Since(startTime).Milliseconds(),
		rawResponse: resp,
		Request:     httpReq,
	}
	httpReq.Response = httpResp

	h.server.DispatchRequest(ctx, httpReq)
	h.server.DispatchResponse(ctx, httpResp)

	// Bidirectional WS frame interception goroutines
	errChan := make(chan error, 2)

	// Client -> Server (Sending)
	go func() {
		errChan <- h.interceptWSFrames(ctx, reqID, clientConn, serverConn, "send")
	}()

	// Server -> Client (Receiving)
	go func() {
		errChan <- h.interceptWSFrames(ctx, reqID, serverReader, clientConn, "receive")
	}()

	<-errChan
}

func (h *Handler) interceptWSFrames(ctx *Context, reqID string, src io.Reader, dst io.Writer, direction string) error {
	header := make([]byte, 2)

	for {
		if _, err := io.ReadFull(src, header); err != nil {
			return err
		}

		// RSV bits must be zero unless an extension negotiated them.
		if header[0]&0x70 != 0 {
			writeWSCloseFrame(dst, 1002, "RSV bits set")
			return fmt.Errorf("WebSocket frame with RSV bits set")
		}

		opcode := int(header[0] & 0x0F)
		masked := (header[1] & 0x80) != 0
		payloadLen := int64(header[1] & 0x7F)

		var ext []byte
		if payloadLen == 126 {
			ext = make([]byte, 2)
			if _, err := io.ReadFull(src, ext); err != nil {
				return err
			}
			payloadLen = int64(binary.BigEndian.Uint16(ext))
		} else if payloadLen == 127 {
			ext = make([]byte, 8)
			if _, err := io.ReadFull(src, ext); err != nil {
				return err
			}
			length := binary.BigEndian.Uint64(ext)
			if length > uint64(^uint64(0)>>1) {
				writeWSCloseFrame(dst, 1009, "frame too large")
				return fmt.Errorf("WebSocket frame length overflows int64: %d", length)
			}
			payloadLen = int64(length)
		}

		if payloadLen < 0 || payloadLen > maxWebSocketFrameSize {
			writeWSCloseFrame(dst, 1009, "frame too large")
			return fmt.Errorf("WebSocket frame too large: %d bytes", payloadLen)
		}

		// Control frames must not be fragmented and carry at most 125 bytes.
		if opcode >= 0x8 && (header[0]&0x80 == 0 || payloadLen > 125) {
			writeWSCloseFrame(dst, 1002, "invalid control frame")
			return fmt.Errorf("invalid WebSocket control frame")
		}

		var maskKey []byte
		if masked {
			maskKey = make([]byte, 4)
			if _, err := io.ReadFull(src, maskKey); err != nil {
				return err
			}
		}

		payload := make([]byte, payloadLen)
		if _, err := io.ReadFull(src, payload); err != nil {
			return err
		}

		// Unmask payload for inspection
		unmaskedPayload := make([]byte, len(payload))
		copy(unmaskedPayload, payload)
		if masked {
			for i := range unmaskedPayload {
				unmaskedPayload[i] ^= maskKey[i%4]
			}
		}

		text := ""
		if opcode == OpcodeText && len(unmaskedPayload) < 1024*1024 {
			text = string(unmaskedPayload)
		}

		dispatchedPayload := unmaskedPayload
		const maxDisplayPayload = 64 * 1024
		if len(dispatchedPayload) > maxDisplayPayload {
			dispatchedPayload = dispatchedPayload[:maxDisplayPayload]
		}

		frame := &WsFrame{
			ID:         uuid.NewString(),
			RequestID:  reqID,
			Opcode:     opcode,
			OpcodeName: opcodeName(opcode),
			Direction:  direction,
			Payload:    dispatchedPayload,
			Text:       text,
			Length:     len(unmaskedPayload),
			Timestamp:  time.Now(),
		}

		go h.server.DispatchWsFrame(ctx, frame)

		// Forward the exact raw frame bytes to destination
		if _, err := dst.Write(header); err != nil {
			return err
		}
		if len(ext) > 0 {
			if _, err := dst.Write(ext); err != nil {
				return err
			}
		}
		if masked {
			if _, err := dst.Write(maskKey); err != nil {
				return err
			}
		}
		if _, err := dst.Write(payload); err != nil {
			return err
		}
	}
}
