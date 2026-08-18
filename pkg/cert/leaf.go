package cert

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"fmt"
	"math/big"
	"net"
	"strings"
	"sync"
	"time"
)

// subjectKeyIDFromPublicKey derives a standard RFC 5280 subject key
// identifier (SHA-1 of the subject public key info) for a certificate.
func subjectKeyIDFromPublicKey(pub *rsa.PublicKey) ([]byte, error) {
	der, err := x509.MarshalPKIXPublicKey(pub)
	if err != nil {
		return nil, err
	}
	sum := sha1.Sum(der)
	return sum[:], nil
}

// CertificateManager handles on-the-fly certificate generation for MITM TLS interception.
type CertificateManager struct {
	ca             *CA
	cache          *CertCache
	serverKey      *rsa.PrivateKey
	remoteCertMap  map[string]*x509.Certificate
	remoteCertLock sync.RWMutex
}

// NewCertificateManager creates a new manager with the given CA.
func NewCertificateManager(ca *CA) (*CertificateManager, error) {
	serverKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, fmt.Errorf("generate server RSA key failed: %w", err)
	}

	return &CertificateManager{
		ca:            ca,
		cache:         NewCertCache(30 * time.Minute),
		serverKey:     serverKey,
		remoteCertMap: make(map[string]*x509.Certificate),
	}, nil
}

// GetCertificate returns a cached or dynamically generated TLS certificate for the host.
func (m *CertificateManager) GetCertificate(host string) (*tls.Certificate, error) {
	// Strip port if present
	if idx := strings.IndexByte(host, ':'); idx != -1 {
		host = host[:idx]
	}

	if cert, ok := m.cache.Get(host); ok {
		return cert, nil
	}

	m.remoteCertLock.RLock()
	remoteCert := m.remoteCertMap[host]
	m.remoteCertLock.RUnlock()

	tlsCert, err := m.GenerateLeafCert(host, remoteCert)
	if err != nil {
		return nil, err
	}

	m.cache.Set(host, tlsCert)
	return tlsCert, nil
}

// RegisterRemoteCert registers a remote server's peer certificate for high-fidelity cloning.
func (m *CertificateManager) RegisterRemoteCert(host string, remoteCert *x509.Certificate) {
	if remoteCert == nil {
		return
	}
	if idx := strings.IndexByte(host, ':'); idx != -1 {
		host = host[:idx]
	}

	m.remoteCertLock.Lock()
	m.remoteCertMap[host] = remoteCert
	m.remoteCertLock.Unlock()

	// Invalidate cache to force regeneration with cloned remote properties
	m.cache.Set(host, nil)
}

// GenerateLeafCert generates a domain certificate signed by the CA.
func (m *CertificateManager) GenerateLeafCert(host string, remoteCert *x509.Certificate) (*tls.Certificate, error) {
	serialNumberLimit := new(big.Int).Lsh(big.NewInt(1), 128)
	serialNumber, err := rand.Int(rand.Reader, serialNumberLimit)
	if err != nil {
		return nil, fmt.Errorf("generate serial number failed: %w", err)
	}

	now := time.Now().Add(-1 * time.Hour)
	notAfter := now.Add(825 * 24 * time.Hour) // Max 825 days for browser compatibility

	var dnsNames []string
	var ipAddresses []net.IP

	if ip := net.ParseIP(host); ip != nil {
		ipAddresses = append(ipAddresses, ip)
	} else {
		dnsNames = append(dnsNames, host)
		// Add wildcard if subdomains might be requested
		if strings.Count(host, ".") >= 2 && !strings.HasPrefix(host, "*.") {
			parts := strings.SplitN(host, ".", 2)
			if len(parts) == 2 {
				dnsNames = append(dnsNames, "*."+parts[1])
			}
		}
	}

	subject := pkix.Name{
		CommonName:         host,
		Organization:       []string{"HTTPeek Proxy"},
		OrganizationalUnit: []string{"HTTPeek Mitm Engine"},
		Country:            []string{"US"},
	}

	// Clone remote certificate properties if available
	if remoteCert != nil {
		if len(remoteCert.DNSNames) > 0 {
			for _, name := range remoteCert.DNSNames {
				if !containsString(dnsNames, name) {
					dnsNames = append(dnsNames, name)
				}
			}
		}
		if len(remoteCert.IPAddresses) > 0 {
			ipAddresses = append(ipAddresses, remoteCert.IPAddresses...)
		}
		if !remoteCert.NotBefore.IsZero() {
			now = remoteCert.NotBefore
		}
		if !remoteCert.NotAfter.IsZero() {
			notAfter = remoteCert.NotAfter
		}
		if remoteCert.Subject.CommonName != "" {
			subject = remoteCert.Subject
		}
	}

	// Go auto-fills AuthorityKeyId from the parent CA's SubjectKeyId, but it
	// does not derive a SubjectKeyId for the leaf, so compute it explicitly.
	leafSKID, err := subjectKeyIDFromPublicKey(&m.serverKey.PublicKey)
	if err != nil {
		return nil, fmt.Errorf("compute leaf subject key id failed: %w", err)
	}

	template := &x509.Certificate{
		SerialNumber:          serialNumber,
		Subject:               subject,
		SubjectKeyId:          leafSKID,
		NotBefore:             now,
		NotAfter:              notAfter,
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
		BasicConstraintsValid: true,
		IsCA:                  false,
		DNSNames:              dnsNames,
		IPAddresses:           ipAddresses,
	}

	derBytes, err := x509.CreateCertificate(
		rand.Reader,
		template,
		m.ca.Certificate,
		&m.serverKey.PublicKey,
		m.ca.PrivateKey,
	)
	if err != nil {
		return nil, fmt.Errorf("create leaf certificate failed: %w", err)
	}

	tlsCert := &tls.Certificate{
		Certificate: [][]byte{derBytes, m.ca.Certificate.Raw},
		PrivateKey:  m.serverKey,
	}

	return tlsCert, nil
}

// CA returns the underlying Certificate Authority.
func (m *CertificateManager) CA() *CA {
	return m.ca
}

// TLSConfig returns a ready-to-use *tls.Config for MITM server handshakes.
func (m *CertificateManager) TLSConfig() *tls.Config {
	return &tls.Config{
		GetCertificate: func(info *tls.ClientHelloInfo) (*tls.Certificate, error) {
			serverName := info.ServerName
			if serverName == "" {
				serverName = "localhost"
			}
			return m.GetCertificate(serverName)
		},
		NextProtos: []string{"http/1.1"},
	}
}

func containsString(slice []string, val string) bool {
	for _, item := range slice {
		if strings.EqualFold(item, val) {
			return true
		}
	}
	return false
}
