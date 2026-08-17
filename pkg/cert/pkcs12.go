package cert

import (
	"crypto/rand"
	"crypto/x509"
	"fmt"
	"os"

	"software.sslmate.com/src/go-pkcs12"
)

// ExportPKCS12 exports the CA certificate and private key as a password-protected .p12 / .pfx archive.
func (ca *CA) ExportPKCS12(password string) ([]byte, error) {
	ca.mu.RLock()
	defer ca.mu.RUnlock()

	p12Data, err := pkcs12.Encode(rand.Reader, ca.PrivateKey, ca.Certificate, []*x509.Certificate{}, password)
	if err != nil {
		return nil, fmt.Errorf("encode PKCS12 failed: %w", err)
	}
	return p12Data, nil
}

// ExportPKCS12ToFile writes the .p12 archive to a file path.
func (ca *CA) ExportPKCS12ToFile(filePath, password string) error {
	data, err := ca.ExportPKCS12(password)
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, data, 0600)
}
