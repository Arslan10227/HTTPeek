package cert

import (
	"crypto/x509"
	"testing"
)

// TestLeafCertificateExtensions verifies leaf certificates carry the standard
// SubjectKeyId and AuthorityKeyId extensions required for clean chain
// verification by clients and TLS libraries.
func TestLeafCertificateExtensions(t *testing.T) {
	ca, err := GenerateCA(DefaultConfig())
	if err != nil {
		t.Fatalf("GenerateCA: %v", err)
	}
	mgr, err := NewCertificateManager(ca)
	if err != nil {
		t.Fatalf("NewCertificateManager: %v", err)
	}
	leaf, err := mgr.GenerateLeafCert("example.com", nil)
	if err != nil {
		t.Fatalf("GenerateLeafCert: %v", err)
	}
	leafCert, err := x509.ParseCertificate(leaf.Certificate[0])
	if err != nil {
		t.Fatalf("parse leaf: %v", err)
	}

	if len(ca.Certificate.SubjectKeyId) == 0 {
		t.Error("CA SubjectKeyId missing")
	}
	if len(leafCert.SubjectKeyId) == 0 {
		t.Error("leaf SubjectKeyId missing")
	}
	if len(leafCert.AuthorityKeyId) == 0 {
		t.Error("leaf AuthorityKeyId missing")
	}
	if len(leafCert.AuthorityKeyId) > 0 && len(ca.Certificate.SubjectKeyId) > 0 &&
		string(leafCert.AuthorityKeyId) != string(ca.Certificate.SubjectKeyId) {
		t.Errorf("leaf AKID does not match CA SKID: %x vs %x", leafCert.AuthorityKeyId, ca.Certificate.SubjectKeyId)
	}

	if err := leafCert.VerifyHostname("example.com"); err != nil {
		t.Errorf("VerifyHostname: %v", err)
	}
}
