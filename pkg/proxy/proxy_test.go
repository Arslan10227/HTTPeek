package proxy

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"httpeek/pkg/cert"
)

type testListener struct {
	requests  []*HttpRequest
	responses []*HttpResponse
	sseEvents []*SSEEvent
}

func (tl *testListener) OnRequest(ctx *Context, req *HttpRequest) {
	tl.requests = append(tl.requests, req)
}

func (tl *testListener) OnResponse(ctx *Context, resp *HttpResponse) {
	tl.responses = append(tl.responses, resp)
}

func (tl *testListener) OnWsFrame(ctx *Context, frame *WsFrame) {}
func (tl *testListener) OnSSEEvent(ctx *Context, event *SSEEvent) {
	tl.sseEvents = append(tl.sseEvents, event)
}
func (tl *testListener) OnError(ctx *Context, req *HttpRequest, err error) {}

func TestProxyServerLifecycleAndHTTPIntercept(t *testing.T) {
	// 1. Setup backend target server
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Custom-Header", "HTTPeek-Test")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","message":"hello from backend"}`))
	}))
	defer backend.Close()

	// 2. Setup CA & Certificate Manager
	ca, err := cert.GenerateCA(cert.DefaultConfig())
	if err != nil {
		t.Fatalf("GenerateCA failed: %v", err)
	}
	certMgr, err := cert.NewCertificateManager(ca)
	if err != nil {
		t.Fatalf("NewCertificateManager failed: %v", err)
	}

	// 3. Start HTTPeek Proxy Server
	cfg := DefaultServerConfig()
	cfg.Port = 19099
	server := NewServer(cfg, certMgr)

	listener := &testListener{}
	server.AddListener(listener)

	if err := server.Start(); err != nil {
		t.Fatalf("Server.Start failed: %v", err)
	}
	defer server.Stop()

	// Wait for server to bind
	time.Sleep(50 * time.Millisecond)

	// 4. Send request through the proxy
	proxyURL, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", cfg.Port))
	client := &http.Client{
		Transport: &http.Transport{
			Proxy: http.ProxyURL(proxyURL),
		},
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get(backend.URL + "/api/v1/test?query=foo")
	if err != nil {
		t.Fatalf("Client GET through proxy failed: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("ReadAll body failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	if string(body) != `{"status":"ok","message":"hello from backend"}` {
		t.Errorf("Unexpected body: %s", string(body))
	}

	// 5. Verify listener captured the traffic
	time.Sleep(50 * time.Millisecond)
	if len(listener.requests) != 1 {
		t.Fatalf("Expected 1 captured request, got %d", len(listener.requests))
	}
	if len(listener.responses) != 1 {
		t.Fatalf("Expected 1 captured response, got %d", len(listener.responses))
	}

	req := listener.requests[0]
	if req.Method != MethodGet || req.Path != "/api/v1/test" {
		t.Errorf("Captured request mismatch: %s %s", req.Method, req.Path)
	}

	res := listener.responses[0]
	if res.StatusCode != 200 {
		t.Errorf("Captured response status mismatch: %d", res.StatusCode)
	}
}

func TestInternalRequestAcceptsLANPairingHost(t *testing.T) {
	cfg := DefaultServerConfig()
	cfg.Port = 19101
	handler := NewHandler(NewServer(cfg, nil))
	req := httptest.NewRequest(http.MethodGet, "http://192.168.1.25:19101/ws/events", nil)
	req.Host = "192.168.1.25:19101"
	if !handler.isInternalRequest(req) {
		t.Fatal("expected LAN pairing WebSocket request to be treated as internal")
	}
}

func TestReadLimitedBody(t *testing.T) {
	body, err := readLimitedBody(strings.NewReader("12345"), 5)
	if err != nil {
		t.Fatalf("readLimitedBody exact limit: %v", err)
	}
	if string(body) != "12345" {
		t.Fatalf("unexpected body: %q", body)
	}

	_, err = readLimitedBody(strings.NewReader("123456"), 5)
	if !errors.Is(err, ErrBodyTooLarge) {
		t.Fatalf("expected ErrBodyTooLarge, got %v", err)
	}
}

func TestDefaultServerBodyLimits(t *testing.T) {
	cfg := DefaultServerConfig()
	if cfg.MaxRequestBodyBytes <= 0 || cfg.MaxResponseBodyBytes <= 0 {
		t.Fatalf("expected positive body limits, got request=%d response=%d", cfg.MaxRequestBodyBytes, cfg.MaxResponseBodyBytes)
	}
}

// startEchoServer starts a TCP echo server and returns its address.
func startEchoServer(t *testing.T) net.Listener {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("echo listen: %v", err)
	}
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				_, _ = io.Copy(c, c)
			}(conn)
		}
	}()
	t.Cleanup(func() { _ = ln.Close() })
	return ln
}

// TestConnectTunnelPassthrough exercises the raw CONNECT tunnel path
// (SSL disabled forces passthrough). This is a regression test for the
// buffer pool type-assertion panic in passthroughTunnelWithRemote and for
// preservation of bytes buffered after the CONNECT request line.
func TestConnectTunnelPassthrough(t *testing.T) {
	backend := startEchoServer(t)

	cfg := DefaultServerConfig()
	cfg.Port = 19102
	cfg.EnableSSL = false
	server := NewServer(cfg, nil)
	if err := server.Start(); err != nil {
		t.Fatalf("server start: %v", err)
	}
	defer server.Stop()

	conn, err := net.Dial("tcp", "127.0.0.1:19102")
	if err != nil {
		t.Fatalf("proxy dial: %v", err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(3 * time.Second))

	// Send CONNECT and immediately pipeline the payload bytes (no waiting
	// for the 200 reply) to prove buffered bytes survive the tunnel.
	payload := []byte("hello-through-tunnel")
	backendAddr := backend.Addr().String()
	connectReq := fmt.Sprintf("CONNECT %s HTTP/1.1\r\nHost: %s\r\n\r\n", backendAddr, backendAddr)
	if _, err := conn.Write([]byte(connectReq)); err != nil {
		t.Fatalf("CONNECT write: %v", err)
	}
	if _, err := conn.Write(payload); err != nil {
		t.Fatalf("payload write: %v", err)
	}

	reply := make([]byte, 0, 64)
	buf := make([]byte, 512)
	for !strings.Contains(string(reply), "\r\n\r\n") {
		n, err := conn.Read(buf)
		if err != nil {
			t.Fatalf("read CONNECT reply: %v", err)
		}
		reply = append(reply, buf[:n]...)
	}
	if !strings.HasPrefix(string(reply), "HTTP/1.1 200") {
		t.Fatalf("unexpected CONNECT reply: %q", reply)
	}

	// Read the echoed payload (may already be partially in reply buffer).
	all := string(reply)
	for !strings.Contains(all, string(payload)) {
		n, err := conn.Read(buf)
		if err != nil {
			t.Fatalf("read echo: %v", err)
		}
		all += string(buf[:n])
	}
	if !strings.HasSuffix(all, string(payload)) {
		t.Fatalf("echoed payload mismatch: %q", all)
	}
}

// TestSocks5TunnelPassthrough exercises the SOCKS5 raw-tunnel path, which
// previously panicked in passthroughTunnelWithRemote.
func TestSocks5TunnelPassthrough(t *testing.T) {
	backend := startEchoServer(t)
	backendHost, backendPortStr, err := net.SplitHostPort(backend.Addr().String())
	if err != nil {
		t.Fatalf("backend addr: %v", err)
	}
	backendPort, _ := strconv.Atoi(backendPortStr)
	ip := net.ParseIP(backendHost).To4()
	if ip == nil {
		t.Fatalf("backend not an IPv4 literal: %s", backendHost)
	}

	cfg := DefaultServerConfig()
	cfg.Port = 19103
	server := NewServer(cfg, nil)
	if err := server.Start(); err != nil {
		t.Fatalf("server start: %v", err)
	}
	defer server.Stop()

	conn, err := net.Dial("tcp", "127.0.0.1:19103")
	if err != nil {
		t.Fatalf("proxy dial: %v", err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(3 * time.Second))

	if _, err := conn.Write([]byte{0x05, 0x01, 0x00}); err != nil {
		t.Fatalf("SOCKS greeting: %v", err)
	}
	greeting := make([]byte, 2)
	if _, err := io.ReadFull(conn, greeting); err != nil {
		t.Fatalf("SOCKS greeting response: %v", err)
	}
	if greeting[1] != 0x00 {
		t.Fatalf("expected no-auth, got method %d", greeting[1])
	}

	req := []byte{0x05, 0x01, 0x00, 0x01, ip[0], ip[1], ip[2], ip[3], byte(backendPort >> 8), byte(backendPort & 0xFF)}
	if _, err := conn.Write(req); err != nil {
		t.Fatalf("SOCKS connect request: %v", err)
	}
	response := make([]byte, 10)
	if _, err := io.ReadFull(conn, response); err != nil {
		t.Fatalf("SOCKS connect response: %v", err)
	}
	if response[1] != 0x00 {
		t.Fatalf("expected SOCKS success, got 0x%02x", response[1])
	}

	payload := []byte("socks-echo-check")
	if _, err := conn.Write(payload); err != nil {
		t.Fatalf("payload write: %v", err)
	}
	echo := make([]byte, len(payload))
	if _, err := io.ReadFull(conn, echo); err != nil {
		t.Fatalf("read echo: %v", err)
	}
	if string(echo) != string(payload) {
		t.Fatalf("echo mismatch: %q", echo)
	}
}

// TestHostHeaderPreservedWithPort verifies the upstream Host header keeps the
// non-default port so virtual hosts routed by Host:port keep working.
func TestHostHeaderPreservedWithPort(t *testing.T) {
	var gotHost string
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHost = r.Host
		w.WriteHeader(http.StatusNoContent)
	}))
	defer backend.Close()

	cfg := DefaultServerConfig()
	cfg.Port = 19104
	server := NewServer(cfg, nil)
	if err := server.Start(); err != nil {
		t.Fatalf("server start: %v", err)
	}
	defer server.Stop()
	time.Sleep(30 * time.Millisecond)

	proxyURL, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", cfg.Port))
	client := &http.Client{
		Transport: &http.Transport{Proxy: http.ProxyURL(proxyURL)},
		Timeout:   5 * time.Second,
	}
	resp, err := client.Get(backend.URL)
	if err != nil {
		t.Fatalf("GET through proxy: %v", err)
	}
	defer resp.Body.Close()

	want := strings.TrimPrefix(backend.URL, "http://")
	if gotHost != want {
		t.Fatalf("upstream Host = %q, want %q (port must be preserved)", gotHost, want)
	}
}

// TestPlainHTTPWebSocketUpgrade verifies ws:// upgrades are relayed through
// the plain-HTTP path instead of being rejected by the HTTP transport.
func TestPlainHTTPWebSocketUpgrade(t *testing.T) {
	const wsKey = "dGhlIHNhbXBsZSBub25jZQ=="
	const expectedAccept = "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=" // RFC 6455 example

	upstream, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("upstream listen: %v", err)
	}
	defer upstream.Close()
	go func() {
		for {
			conn, err := upstream.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				_ = c.SetDeadline(time.Now().Add(5 * time.Second))
				br := bufio.NewReader(c)
				// Read handshake request.
				for {
					line, err := br.ReadString('\n')
					if err != nil {
						return
					}
					if line == "\r\n" || line == "\n" {
						break
					}
				}
				_, _ = c.Write([]byte("HTTP/1.1 101 Switching Protocols\r\n" +
					"Upgrade: websocket\r\n" +
					"Connection: Upgrade\r\n" +
					"Sec-WebSocket-Accept: " + expectedAccept + "\r\n\r\n"))
				// Send one unmasked text frame: "hello-ws"
				_, _ = c.Write([]byte{0x81, 0x08})
				_, _ = c.Write([]byte("hello-ws"))
			}(conn)
		}
	}()

	cfg := DefaultServerConfig()
	cfg.Port = 19105
	server := NewServer(cfg, nil)
	if err := server.Start(); err != nil {
		t.Fatalf("server start: %v", err)
	}
	defer server.Stop()
	time.Sleep(30 * time.Millisecond)

	conn, err := net.Dial("tcp", "127.0.0.1:19105")
	if err != nil {
		t.Fatalf("proxy dial: %v", err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(5 * time.Second))

	host := upstream.Addr().String()
	req := "GET /chat HTTP/1.1\r\n" +
		"Host: " + host + "\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Key: " + wsKey + "\r\n" +
		"Sec-WebSocket-Version: 13\r\n\r\n"
	if _, err := conn.Write([]byte(req)); err != nil {
		t.Fatalf("handshake write: %v", err)
	}

	br := bufio.NewReader(conn)
	resp, err := http.ReadResponse(br, nil)
	if err != nil {
		t.Fatalf("read response: %v", err)
	}
	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Fatalf("expected 101, got %d", resp.StatusCode)
	}
	if resp.Header.Get("Sec-WebSocket-Accept") != expectedAccept {
		t.Fatalf("unexpected accept: %q", resp.Header.Get("Sec-WebSocket-Accept"))
	}

	// Read the upstream text frame relayed to the client (same buffered
	// reader — the frame may have arrived with the 101 response).
	header := make([]byte, 2)
	if _, err := io.ReadFull(br, header); err != nil {
		raw, _ := io.ReadAll(br)
		t.Fatalf("read frame header: %v; remaining bytes: %q", err, raw)
	}
	if header[0] != 0x81 || header[1] != 0x08 {
		t.Fatalf("unexpected frame header: %x %x", header[0], header[1])
	}
	payload := make([]byte, 8)
	if _, err := io.ReadFull(br, payload); err != nil {
		raw, _ := io.ReadAll(br)
		t.Fatalf("read frame payload: %v; remaining bytes: %q", err, raw)
	}
	if string(payload) != "hello-ws" {
		t.Fatalf("unexpected payload: %q", payload)
	}
}

// TestSSEStreamFraming verifies SSE responses use the client protocol status
// line, chunked framing with a terminal zero chunk, and capture event IDs.
func TestSSEStreamFraming(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("data: hello\n\n"))
		_, _ = w.Write([]byte("event: ping\ndata: world\nid: 42\n\n"))
	}))
	defer backend.Close()

	cfg := DefaultServerConfig()
	cfg.Port = 19106
	server := NewServer(cfg, nil)
	listener := &testListener{}
	server.AddListener(listener)
	if err := server.Start(); err != nil {
		t.Fatalf("server start: %v", err)
	}
	defer server.Stop()
	time.Sleep(30 * time.Millisecond)

	conn, err := net.Dial("tcp", "127.0.0.1:19106")
	if err != nil {
		t.Fatalf("proxy dial: %v", err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(5 * time.Second))

	host := strings.TrimPrefix(backend.URL, "http://")
	req := "GET /events HTTP/1.1\r\nHost: " + host + "\r\nConnection: close\r\n\r\n"
	if _, err := conn.Write([]byte(req)); err != nil {
		t.Fatalf("request write: %v", err)
	}

	raw, err := io.ReadAll(conn)
	if err != nil {
		t.Fatalf("read stream: %v", err)
	}
	text := string(raw)
	if !strings.HasPrefix(text, "HTTP/1.1 200") {
		t.Fatalf("status line should use client protocol: %q", text[:40])
	}
	if !strings.Contains(text, "data: hello") || !strings.Contains(text, "event: ping") {
		t.Fatalf("missing SSE events in stream: %q", text)
	}
	if !strings.HasSuffix(text, "0\r\n\r\n") {
		t.Fatalf("stream missing terminal zero chunk: %q", text[len(text)-20:])
	}

	// Listener should capture both events, with the wire "id:" preserved.
	deadline := time.Now().Add(2 * time.Second)
	for len(listener.sseEvents) < 2 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if len(listener.sseEvents) != 2 {
		t.Fatalf("expected 2 SSE events, got %d", len(listener.sseEvents))
	}
	if listener.sseEvents[1].Event != "ping" || listener.sseEvents[1].Data != "world" {
		t.Fatalf("unexpected event: %+v", listener.sseEvents[1])
	}
	if listener.sseEvents[1].EventID != "42" {
		t.Fatalf("wire id: not preserved: %+v", listener.sseEvents[1])
	}
}

// TestHTTP10ResponseHeader verifies HTTP/1.0 clients receive Connection: close.
func TestHTTP10ResponseHeader(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	defer backend.Close()

	cfg := DefaultServerConfig()
	cfg.Port = 19107
	server := NewServer(cfg, nil)
	if err := server.Start(); err != nil {
		t.Fatalf("server start: %v", err)
	}
	defer server.Stop()
	time.Sleep(30 * time.Millisecond)

	conn, err := net.Dial("tcp", "127.0.0.1:19107")
	if err != nil {
		t.Fatalf("proxy dial: %v", err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(5 * time.Second))

	host := strings.TrimPrefix(backend.URL, "http://")
	req := "GET / HTTP/1.0\r\nHost: " + host + "\r\n\r\n"
	if _, err := conn.Write([]byte(req)); err != nil {
		t.Fatalf("request write: %v", err)
	}
	resp, err := http.ReadResponse(bufio.NewReader(conn), nil)
	if err != nil {
		t.Fatalf("read response: %v", err)
	}
	if got := resp.Header.Get("Connection"); got != "close" {
		t.Fatalf("expected Connection: close for HTTP/1.0 client, got %q", got)
	}
}

// mutatingInterceptor rewrites response bodies for metadata-normalization tests.
type mutatingInterceptor struct{}

func (mutatingInterceptor) Priority() int { return 1 }
func (mutatingInterceptor) PreConnect(ctx *Context, hp *HostPort) error {
	return nil
}
func (mutatingInterceptor) OnRequest(ctx *Context, req *HttpRequest) (*HttpRequest, error) {
	return req, nil
}
func (mutatingInterceptor) Execute(ctx *Context, req *HttpRequest) (*HttpResponse, error) {
	return nil, nil
}
func (mutatingInterceptor) OnResponse(ctx *Context, resp *HttpResponse) (*HttpResponse, error) {
	resp.Body = []byte("mutated")
	resp.BodyString = "mutated"
	resp.Headers.Set("Content-Type", "text/x-mutated")
	return resp, nil
}
func (mutatingInterceptor) OnError(ctx *Context, req *HttpRequest, err error) {}

// TestResponseMetadataNormalizedAfterInterceptor verifies BodySize,
// ContentType, and IsBinary are re-derived after interceptor mutation.
func TestResponseMetadataNormalizedAfterInterceptor(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		_, _ = w.Write([]byte("0123456789"))
	}))
	defer backend.Close()

	cfg := DefaultServerConfig()
	cfg.Port = 19108
	server := NewServer(cfg, nil)
	chain := &interceptorChain{interceptors: []Interceptor{mutatingInterceptor{}}}
	server.SetInterceptor(chain)
	listener := &testListener{}
	server.AddListener(listener)
	if err := server.Start(); err != nil {
		t.Fatalf("server start: %v", err)
	}
	defer server.Stop()
	time.Sleep(30 * time.Millisecond)

	proxyURL, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", cfg.Port))
	client := &http.Client{
		Transport: &http.Transport{Proxy: http.ProxyURL(proxyURL)},
		Timeout:   5 * time.Second,
	}
	resp, err := client.Get(backend.URL)
	if err != nil {
		t.Fatalf("GET through proxy: %v", err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if string(body) != "mutated" {
		t.Fatalf("client received %q, want %q", body, "mutated")
	}

	deadline := time.Now().Add(2 * time.Second)
	for len(listener.responses) < 1 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if len(listener.responses) != 1 {
		t.Fatalf("expected 1 captured response, got %d", len(listener.responses))
	}
	got := listener.responses[0]
	if got.BodySize != int64(len("mutated")) {
		t.Errorf("BodySize = %d, want %d", got.BodySize, len("mutated"))
	}
	if got.ContentType != "text/x-mutated" {
		t.Errorf("ContentType = %q, want %q", got.ContentType, "text/x-mutated")
	}
	if got.IsBinary {
		t.Errorf("IsBinary should be false for text/x-mutated")
	}
}

// interceptorChain is a minimal single-item chain for tests.
type interceptorChain struct {
	interceptors []Interceptor
}

func (c *interceptorChain) Priority() int { return 0 }

func (c *interceptorChain) PreConnect(ctx *Context, hp *HostPort) error {
	for _, i := range c.interceptors {
		if err := i.PreConnect(ctx, hp); err != nil {
			return err
		}
	}
	return nil
}
func (c *interceptorChain) OnRequest(ctx *Context, req *HttpRequest) (*HttpRequest, error) {
	current := req
	for _, i := range c.interceptors {
		mod, err := i.OnRequest(ctx, current)
		if err != nil || mod == nil {
			return mod, err
		}
		current = mod
	}
	return current, nil
}
func (c *interceptorChain) Execute(ctx *Context, req *HttpRequest) (*HttpResponse, error) {
	for _, i := range c.interceptors {
		if resp, err := i.Execute(ctx, req); err != nil || resp != nil {
			return resp, err
		}
	}
	return nil, nil
}
func (c *interceptorChain) OnResponse(ctx *Context, resp *HttpResponse) (*HttpResponse, error) {
	current := resp
	for _, i := range c.interceptors {
		mod, err := i.OnResponse(ctx, current)
		if err != nil || mod == nil {
			return mod, err
		}
		current = mod
	}
	return current, nil
}
func (c *interceptorChain) OnError(ctx *Context, req *HttpRequest, err error) {
	for _, i := range c.interceptors {
		i.OnError(ctx, req, err)
	}
}

func TestSOCKS5ReportsConnectionFailure(t *testing.T) {
	cfg := DefaultServerConfig()
	cfg.Port = 19100
	server := NewServer(cfg, nil)
	if err := server.Start(); err != nil {
		t.Fatalf("server start: %v", err)
	}
	defer server.Stop()

	conn, err := net.Dial("tcp", "127.0.0.1:19100")
	if err != nil {
		t.Fatalf("proxy dial: %v", err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(2 * time.Second))

	if _, err := conn.Write([]byte{0x05, 0x01, 0x00}); err != nil {
		t.Fatalf("SOCKS greeting: %v", err)
	}
	greeting := make([]byte, 2)
	if _, err := io.ReadFull(conn, greeting); err != nil {
		t.Fatalf("SOCKS greeting response: %v", err)
	}

	request := []byte{0x05, 0x01, 0x00, 0x01, 127, 0, 0, 1, 0x01, 0x01}
	if _, err := conn.Write(request); err != nil {
		t.Fatalf("SOCKS connect request: %v", err)
	}
	response := make([]byte, 10)
	if _, err := io.ReadFull(conn, response); err != nil {
		t.Fatalf("SOCKS connect response: %v", err)
	}
	if response[1] == 0x00 {
		t.Fatal("expected SOCKS connection failure, got success")
	}
}
