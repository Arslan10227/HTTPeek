package cert

import (
	"crypto/tls"
	"testing"
	"time"
)

func TestCAGenerationAndLeafMinting(t *testing.T) {
	cfg := DefaultConfig()
	cfg.CommonName = "HTTPeek Test CA"

	ca, err := GenerateCA(cfg)
	if err != nil {
		t.Fatalf("GenerateCA failed: %v", err)
	}

	if ca.Certificate == nil || ca.PrivateKey == nil {
		t.Fatal("CA certificate or private key is nil")
	}

	mgr, err := NewCertificateManager(ca)
	if err != nil {
		t.Fatalf("NewCertificateManager failed: %v", err)
	}

	// Test 1: Mint leaf cert for a domain
	cert, err := mgr.GetCertificate("api.github.com")
	if err != nil {
		t.Fatalf("GetCertificate failed: %v", err)
	}
	if cert == nil || len(cert.Certificate) == 0 {
		t.Fatal("Leaf cert is empty")
	}

	// Test 2: Verify caching works
	certCached, err := mgr.GetCertificate("api.github.com")
	if err != nil {
		t.Fatalf("GetCertificate cached failed: %v", err)
	}
	if cert != certCached {
		t.Fatal("Expected cached certificate pointer to match")
	}

	// Test 3: Mint leaf cert for IP address
	ipCert, err := mgr.GetCertificate("127.0.0.1")
	if err != nil {
		t.Fatalf("GetCertificate for IP failed: %v", err)
	}
	if ipCert == nil {
		t.Fatal("IP leaf cert is nil")
	}

	// Test 4: Export PKCS12
	p12Bytes, err := ca.ExportPKCS12("secret123")
	if err != nil {
		t.Fatalf("ExportPKCS12 failed: %v", err)
	}
	if len(p12Bytes) == 0 {
		t.Fatal("PKCS12 bytes is empty")
	}
}

func TestCertCacheTTL(t *testing.T) {
	cache := NewCertCache(50 * time.Millisecond)
	dummyCert := &tls.Certificate{}

	cache.Set("example.com", dummyCert)
	if c, ok := cache.Get("example.com"); !ok || c != dummyCert {
		t.Fatal("Expected item in cache")
	}

	time.Sleep(60 * time.Millisecond)
	if _, ok := cache.Get("example.com"); ok {
		t.Fatal("Expected item to be expired from cache")
	}
}
