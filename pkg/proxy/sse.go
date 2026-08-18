package proxy

import (
	"bufio"
	"bytes"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

func (h *Handler) streamSSEResponse(ctx *Context, clientConn net.Conn, resp *http.Response, initialBody []byte) error {
	removeHopByHopHeaders(resp.Header)
	resp.Header.Del("Content-Length")
	resp.Header.Set("Transfer-Encoding", "chunked")

	// Use the client's request protocol for the downstream status line, never
	// the upstream transport's protocol (which may be HTTP/2.0).
	clientProto := "HTTP/1.1"
	if ctx != nil && ctx.CurrentRequest != nil && ctx.CurrentRequest.Protocol != "" {
		clientProto = ctx.CurrentRequest.Protocol
	}
	statusLine := fmt.Sprintf("%s %d %s\r\n", clientProto, resp.StatusCode, http.StatusText(resp.StatusCode))
	if _, err := clientConn.Write([]byte(statusLine)); err != nil {
		return err
	}
	if err := resp.Header.Write(clientConn); err != nil {
		return err
	}
	if _, err := clientConn.Write([]byte("\r\n")); err != nil {
		return err
	}

	reader := bufio.NewReader(resp.Body)
	if len(initialBody) > 0 {
		reader = bufio.NewReader(ioMultiReader(bytes.NewReader(initialBody), resp.Body))
	}

	var currentEvent SSEEvent
	currentEvent.RequestID = ctx.CurrentRequest.ID

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			// Flush any trailing partial line, then terminate the chunked body.
			if len(line) > 0 {
				chunkHeader := fmt.Sprintf("%x\r\n", len(line))
				_, _ = clientConn.Write([]byte(chunkHeader + line + "\r\n"))
			}
			_, _ = clientConn.Write([]byte("0\r\n\r\n"))
			return err
		}

		// Write chunk to client
		chunkHeader := fmt.Sprintf("%x\r\n", len(line))
		if _, err := clientConn.Write([]byte(chunkHeader + line + "\r\n")); err != nil {
			return err
		}

		trimmed := strings.TrimRight(line, "\r\n")
		if trimmed == "" {
			// Dispatch completed SSE event. Copy so listeners do not share a
			// mutable pointer to the accumulator.
			if currentEvent.Data != "" || currentEvent.Event != "" {
				evt := currentEvent
				evt.ID = uuid.NewString()
				evt.Timestamp = time.Now()
				h.server.DispatchSSEEvent(ctx, &evt)
				currentEvent = SSEEvent{RequestID: ctx.CurrentRequest.ID}
			}
			continue
		}

		if strings.HasPrefix(trimmed, "event:") {
			currentEvent.Event = strings.TrimSpace(strings.TrimPrefix(trimmed, "event:"))
		} else if strings.HasPrefix(trimmed, "data:") {
			data := strings.TrimPrefix(trimmed, "data:")
			if strings.HasPrefix(data, " ") {
				data = data[1:]
			}
			if currentEvent.Data != "" {
				currentEvent.Data += "\n"
			}
			currentEvent.Data += data
		} else if strings.HasPrefix(trimmed, "id:") {
			currentEvent.EventID = strings.TrimSpace(strings.TrimPrefix(trimmed, "id:"))
		} else if strings.HasPrefix(trimmed, "retry:") {
			r, _ := strconv.Atoi(strings.TrimSpace(strings.TrimPrefix(trimmed, "retry:")))
			currentEvent.Retry = r
		}
	}
}

type multiReader struct {
	readers []ioReader
	current int
}

type ioReader interface {
	Read(p []byte) (n int, err error)
}

func ioMultiReader(readers ...ioReader) ioReader {
	return &multiReader{readers: readers}
}

func (mr *multiReader) Read(p []byte) (n int, err error) {
	for mr.current < len(mr.readers) {
		n, err = mr.readers[mr.current].Read(p)
		if n > 0 || err == nil {
			if err != nil && err.Error() == "EOF" {
				mr.current++
				err = nil
			}
			return n, err
		}
		mr.current++
	}
	return 0, fmt.Errorf("EOF")
}
