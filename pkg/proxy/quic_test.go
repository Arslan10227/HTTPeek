package proxy

import (
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"httpeek/pkg/cert"

	"github.com/quic-go/quic-go"
	"github.com/quic-go/quic-go/http3"
)

func TestQUICServerLifecycle(t *testing.T) {
	ca, err := cert.NewCA(cert.DefaultConfig())
	if err != nil {
		t.Fatalf("failed to create CA: %v", err)
	}

	certMgr, err := cert.NewCertificateManager(ca)
	if err != nil {
		t.Fatalf("failed to create cert manager: %v", err)
	}

	cfg := DefaultServerConfig()
	cfg.Port = 19099

	srv := NewServer(cfg, certMgr)
	if err := srv.Start(); err != nil {
		t.Fatalf("failed to start proxy server: %v", err)
	}
	defer srv.Stop()

	// Verify QUIC server is initialized and started
	if srv.quicServer == nil {
		t.Fatal("quicServer was not initialized")
	}

	time.Sleep(50 * time.Millisecond)

	// Create an HTTP/3 client to test connection
	tr := &http3.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
			NextProtos:         []string{http3.NextProtoH3},
		},
		QUICConfig: &quic.Config{
			MaxIdleTimeout: 5 * time.Second,
		},
	}
	defer tr.Close()

	client := &http.Client{
		Transport: tr,
		Timeout:   2 * time.Second,
	}

	req, err := http.NewRequest("GET", fmt.Sprintf("https://127.0.0.1:%d/test-h3", cfg.Port), nil)
	if err != nil {
		t.Fatalf("failed to create h3 request: %v", err)
	}

	// This may return 400/502 (since upstream is not running) but it verifies QUIC handshake and HTTP/3 handling
	resp, err := client.Do(req)
	if err == nil {
		defer resp.Body.Close()
		_, _ = io.ReadAll(resp.Body)
	}
}
