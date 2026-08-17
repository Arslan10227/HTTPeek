package proxy

import (
	"bufio"
	"net"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"httpeek/pkg/cert"
)

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
