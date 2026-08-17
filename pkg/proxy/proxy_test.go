package proxy

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
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
