package proxy

import (
	"bufio"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"httpeek/pkg/cert"
)

func TestMobileDeviceChangeSnapshot(t *testing.T) {
	manager := NewMobileAPIManager(NewServer(DefaultServerConfig(), nil))
	changes := make(chan []MobileDeviceInfo, 1)
	manager.SetOnDeviceChange(func(devices []MobileDeviceInfo) {
		changes <- devices
	})
	manager.mu.Lock()
	manager.devices["connection-1"] = &MobileDeviceInfo{DeviceID: "device-1", DeviceName: "Test Android"}
	manager.mu.Unlock()

	manager.notifyDeviceChange()
	select {
	case devices := <-changes:
		if len(devices) != 1 || devices[0].DeviceID != "device-1" {
			t.Fatalf("unexpected device snapshot: %+v", devices)
		}
	case <-time.After(time.Second):
		t.Fatal("device change callback was not invoked")
	}
}

func TestMobileAPIAuthRequiredWhenTokenSet(t *testing.T) {
	t.Setenv("HTTPEEK_API_TOKEN", "secret-token")

	ca, err := cert.GenerateCA(cert.DefaultConfig())
	if err != nil {
		t.Fatalf("GenerateCA: %v", err)
	}
	certMgr, err := cert.NewCertificateManager(ca)
	if err != nil {
		t.Fatalf("NewCertificateManager: %v", err)
	}

	cfg := DefaultServerConfig()
	cfg.Port = 19098
	srv := NewServer(cfg, certMgr)
	if err := srv.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer srv.Stop()
	time.Sleep(30 * time.Millisecond)

	conn, err := net.Dial("tcp", "127.0.0.1:19098")
	if err != nil {
		t.Fatalf("Dial: %v", err)
	}
	defer conn.Close()

	req := "GET /api/status HTTP/1.1\r\nHost: 127.0.0.1:19098\r\nConnection: close\r\n\r\n"
	if _, err := conn.Write([]byte(req)); err != nil {
		t.Fatalf("Write: %v", err)
	}

	resp, err := http.ReadResponse(bufio.NewReader(conn), nil)
	if err != nil {
		t.Fatalf("ReadResponse: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", resp.StatusCode)
	}
}

func TestValidSessionID(t *testing.T) {
	valid := []string{"abc", "ABC-123_xyz", "deadbeef-dead-beef-dead-deadbeefdead"}
	for _, id := range valid {
		if !validSessionID(id) {
			t.Errorf("expected %q to be valid", id)
		}
	}
	invalid := []string{"", "../etc/passwd", "a/b", "a b", strings.Repeat("x", 65), "a\x00b", "session\u2028id"}
	for _, id := range invalid {
		if validSessionID(id) {
			t.Errorf("expected %q to be invalid", id)
		}
	}
}

func TestRateLimiter(t *testing.T) {
	rl := newRateLimiter(3, time.Minute)
	ip := "192.168.1.10"
	for i := 0; i < 3; i++ {
		if !rl.allow(ip) {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}
	if rl.allow(ip) {
		t.Fatal("4th request should be rejected")
	}
	// A different client is not affected.
	if !rl.allow("192.168.1.11") {
		t.Fatal("different client should be allowed")
	}
	// Window expiry resets the budget.
	rl.mu.Lock()
	rl.clients[ip].reset = time.Now().Add(-time.Second)
	rl.mu.Unlock()
	if !rl.allow(ip) {
		t.Fatal("request after window expiry should be allowed")
	}
}

func TestValidLogLevel(t *testing.T) {
	for _, lvl := range []string{"debug", "INFO", "Warn", "error", "FATAL"} {
		if !validLogLevel(lvl) {
			t.Errorf("expected %q to be a valid level", lvl)
		}
	}
	for _, lvl := range []string{"", "verbose", "fatal\nX-Injected: 1", "INFO; DROP TABLE logs"} {
		if validLogLevel(lvl) {
			t.Errorf("expected %q to be rejected", lvl)
		}
	}
}

func TestTruncateString(t *testing.T) {
	if got := truncateString("hello", 3); got != "hel" {
		t.Errorf("expected truncation, got %q", got)
	}
	if got := truncateString("hi", 10); got != "hi" {
		t.Errorf("expected passthrough, got %q", got)
	}
}

func TestLocalOriginValidation(t *testing.T) {
	cases := []struct {
		origin string
		allow  bool
	}{
		{"http://localhost:5173", true},
		{"http://127.0.0.1:5173", true},
		{"http://192.168.1.20:5173", true},
		{"http://172.16.0.10:5173", true},
		{"http://172.32.0.10:5173", false},
		{"http://127.evil.example:5173", false},
		{"https://localhost.evil:5173", false},
		{"https://example.com", false},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/api/status", nil)
		req.Header.Set("Origin", tc.origin)
		if got := isLocalOrigin(req); got != tc.allow {
			t.Errorf("origin %q: got %v, want %v", tc.origin, got, tc.allow)
		}
	}
}

func TestMobileAPIProxyStartStop(t *testing.T) {
	ca, err := cert.GenerateCA(cert.DefaultConfig())
	if err != nil {
		t.Fatalf("GenerateCA: %v", err)
	}
	certMgr, err := cert.NewCertificateManager(ca)
	if err != nil {
		t.Fatalf("NewCertificateManager: %v", err)
	}

	cfg := DefaultServerConfig()
	cfg.Port = 19097
	srv := NewServer(cfg, certMgr)
	// Server created but not started — mobile API still reachable once started via handler
	if err := srv.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer srv.Stop()
	time.Sleep(30 * time.Millisecond)

	body := `{"port":19097,"enableSSL":true,"enableSystemProxy":false}`
	reqStr := "POST /api/proxy/stop HTTP/1.1\r\n" +
		"Host: 127.0.0.1:19097\r\n" +
		"Content-Type: application/json\r\n" +
		"Content-Length: " + strconv.Itoa(len(body)) + "\r\n" +
		"Connection: close\r\n\r\n" + body

	conn, err := net.Dial("tcp", "127.0.0.1:19097")
	if err != nil {
		t.Fatalf("Dial: %v", err)
	}
	defer conn.Close()

	if _, err := conn.Write([]byte(reqStr)); err != nil {
		t.Fatalf("Write: %v", err)
	}

	raw, _ := bufio.NewReader(conn).ReadString('\n')
	if !strings.Contains(raw, "200") {
		t.Fatalf("expected 200 from proxy/stop, got: %s", raw)
	}
}
