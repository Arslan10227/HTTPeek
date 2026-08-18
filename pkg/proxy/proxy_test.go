package proxy

import (
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
}

func (tl *testListener) OnRequest(ctx *Context, req *HttpRequest) {
	tl.requests = append(tl.requests, req)
}

func (tl *testListener) OnResponse(ctx *Context, resp *HttpResponse) {
	tl.responses = append(tl.responses, resp)
}

func (tl *testListener) OnWsFrame(ctx *Context, frame *WsFrame)            {}
func (tl *testListener) OnSSEEvent(ctx *Context, event *SSEEvent)          {}
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
