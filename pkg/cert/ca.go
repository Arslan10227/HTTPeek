package cert

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// CA represents a Root Certificate Authority for MITM TLS interception.
type CA struct {
	mu           sync.RWMutex
	Certificate  *x509.Certificate
	PrivateKey   *rsa.PrivateKey
	CertPEM      []byte
	KeyPEM       []byte
	SubjectRaw   []byte
	ValidityDays int
}

// Config contains options for CA initialization.
type Config struct {
	CommonName   string
	Organization string
	OrgUnit      string
	Country      string
	State        string
	Locality     string
	ValidityDays int
	StorageDir   string
}

// DefaultConfig returns default CA configuration.
func DefaultConfig() Config {
	return Config{
		CommonName:   "HTTPeek Root CA",
		Organization: "HTTPeek",
		OrgUnit:      "HTTPeek Network Engine",
		Country:      "US",
		State:        "California",
		Locality:     "San Francisco",
		ValidityDays: 3650, // 10 years
		StorageDir:   "",
	}
}

// NewCA creates or loads a Certificate Authority.
func NewCA(cfg Config) (*CA, error) {
	if cfg.StorageDir != "" {
		certPath := filepath.Join(cfg.StorageDir, "ca.crt")
		keyPath := filepath.Join(cfg.StorageDir, "ca.key")

		if fileExists(certPath) && fileExists(keyPath) {
			return LoadCA(certPath, keyPath)
		}
	}

	ca, err := GenerateCA(cfg)
	if err != nil {
		return nil, fmt.Errorf("generate CA failed: %w", err)
	}

	if cfg.StorageDir != "" {
		if err := os.MkdirAll(cfg.StorageDir, 0700); err != nil {
			return nil, fmt.Errorf("create CA dir failed: %w", err)
		}
		if err := ca.Save(cfg.StorageDir); err != nil {
			return nil, fmt.Errorf("save CA failed: %w", err)
		}
	}

	return ca, nil
}

// GenerateCA mints a new self-signed Root CA certificate and private key.
func GenerateCA(cfg Config) (*CA, error) {
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, fmt.Errorf("generate RSA key failed: %w", err)
	}

	serialNumberLimit := new(big.Int).Lsh(big.NewInt(1), 128)
	serialNumber, err := rand.Int(rand.Reader, serialNumberLimit)
	if err != nil {
		return nil, fmt.Errorf("generate serial number failed: %w", err)
	}

	now := time.Now().Add(-1 * time.Hour)
	validity := time.Duration(cfg.ValidityDays) * 24 * time.Hour
	if cfg.ValidityDays <= 0 {
		validity = 3650 * 24 * time.Hour
	}

	template := &x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			CommonName:         cfg.CommonName,
			Organization:       []string{cfg.Organization},
			OrganizationalUnit: []string{cfg.OrgUnit},
			Country:            []string{cfg.Country},
			Province:           []string{cfg.State},
			Locality:           []string{cfg.Locality},
		},
		NotBefore:             now,
		NotAfter:              now.Add(validity),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
		IsCA:                  true,
		MaxPathLen:            1,
		MaxPathLenZero:        false,
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, template, template, &privKey.PublicKey, privKey)
	if err != nil {
		return nil, fmt.Errorf("create CA cert failed: %w", err)
	}

	cert, err := x509.ParseCertificate(derBytes)
	if err != nil {
		return nil, fmt.Errorf("parse created CA cert failed: %w", err)
	}

	certPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: derBytes,
	})

	keyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privKey),
	})

	return &CA{
		Certificate:  cert,
		PrivateKey:   privKey,
		CertPEM:      certPEM,
		KeyPEM:       keyPEM,
		SubjectRaw:   cert.RawSubject,
		ValidityDays: cfg.ValidityDays,
	}, nil
}

// LoadCA loads a Root CA certificate and private key from disk files.
func LoadCA(certPath, keyPath string) (*CA, error) {
	certPEM, err := os.ReadFile(certPath)
	if err != nil {
		return nil, fmt.Errorf("read CA cert file failed: %w", err)
	}

	rawKeyData, err := os.ReadFile(keyPath)
	if err != nil {
		return nil, fmt.Errorf("read CA key file failed: %w", err)
	}

	// Decrypt master key via KeyStorage (DPAPI / AES-GCM or plaintext legacy)
	ks := NewKeyStorage()
	keyPEM, err := ks.DecryptKey(rawKeyData)
	if err != nil {
		return nil, fmt.Errorf("decrypt CA master key failed: %w", err)
	}

	certBlock, _ := pem.Decode(certPEM)
	if certBlock == nil {
		return nil, errors.New("failed to decode CA cert PEM")
	}

	cert, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse CA cert failed: %w", err)
	}

	keyBlock, _ := pem.Decode(keyPEM)
	if keyBlock == nil {
		return nil, errors.New("failed to decode CA key PEM")
	}

	var privKey *rsa.PrivateKey
	if keyBlock.Type == "RSA PRIVATE KEY" {
		privKey, err = x509.ParsePKCS1PrivateKey(keyBlock.Bytes)
	} else if keyBlock.Type == "PRIVATE KEY" {
		parsedKey, parseErr := x509.ParsePKCS8PrivateKey(keyBlock.Bytes)
		if parseErr != nil {
			return nil, fmt.Errorf("parse PKCS8 private key failed: %w", parseErr)
		}
		var ok bool
		privKey, ok = parsedKey.(*rsa.PrivateKey)
		if !ok {
			return nil, errors.New("CA private key must be RSA")
		}
	} else {
		return nil, fmt.Errorf("unsupported key type: %s", keyBlock.Type)
	}
	if err != nil {
		return nil, fmt.Errorf("parse CA private key failed: %w", err)
	}

	ca := &CA{
		Certificate: cert,
		PrivateKey:  privKey,
		CertPEM:     certPEM,
		KeyPEM:      keyPEM,
		SubjectRaw:  cert.RawSubject,
	}

	// Auto-upgrade legacy plaintext ca.key to encrypted storage
	if len(rawKeyData) > 10 && string(rawKeyData[:10]) == "-----BEGIN" {
		_ = ca.Save(filepath.Dir(keyPath))
	}

	return ca, nil
}

// Save writes the CA cert and encrypted key to disk in the given directory.
func (ca *CA) Save(dir string) error {
	ca.mu.RLock()
	defer ca.mu.RUnlock()

	certPath := filepath.Join(dir, "ca.crt")
	keyPath := filepath.Join(dir, "ca.key")

	if err := os.WriteFile(certPath, ca.CertPEM, 0644); err != nil {
		return fmt.Errorf("write ca.crt failed: %w", err)
	}

	// Encrypt master key using KeyStorage (DPAPI / AES-GCM)
	ks := NewKeyStorage()
	encryptedKey, err := ks.EncryptKey(ca.KeyPEM)
	if err != nil {
		// Fallback to keyPEM if encryption fails
		encryptedKey = ca.KeyPEM
	}

	if err := os.WriteFile(keyPath, encryptedKey, 0600); err != nil {
		return fmt.Errorf("write ca.key failed: %w", err)
	}
	return nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
