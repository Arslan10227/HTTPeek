package cert

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"

	"testing"
	"time"
)

func TestAndroidSubjectHashOld(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}

	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			CommonName: "HTTPeek Test Root CA",
		},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}

	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}

	cert, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}

	hash := AndroidSubjectHashOld(cert)
	if len(hash) != 8 {
		t.Fatalf("expected 8-char hash, got %q", hash)
	}

	name := AndroidSystemCertName(cert)
	if name != hash+".0" {
		t.Fatalf("expected %s.0, got %s", hash, name)
	}

	pemBlock := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	if len(pemBlock) == 0 {
		t.Fatal("expected pem block")
	}
}

func TestAndroidADBInstallerNotAvailableWithoutADB(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "HTTPeek Test Root CA"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
		KeyUsage:     x509.KeyUsageCertSign,
		IsCA:         true,
	}
	der, _ := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	certParsed, _ := x509.ParseCertificate(der)

	ca := &CA{
		Certificate: certParsed,
		CertPEM:     pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}),
	}

	inst := NewAndroidADBInstaller(ca)
	result := inst.Install("", "127.0.0.1", 9099)
	if result.ADBAvailable && len(result.Steps) == 0 {
		t.Fatal("expected step results when adb unavailable or no devices")
	}
}
