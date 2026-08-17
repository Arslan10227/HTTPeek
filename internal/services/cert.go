package services

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"httpeek/pkg/cert"
)

// CertService wraps certificate and trust operations.
type CertService struct {
	certMgr *cert.CertificateManager
	trust   *cert.TrustInstaller
}

// NewCertService creates a cert service.
func NewCertService(certMgr *cert.CertificateManager, trust *cert.TrustInstaller) *CertService {
	return &CertService{certMgr: certMgr, trust: trust}
}

// IsInstalled checks whether the root CA is trusted by the OS.
func (s *CertService) IsInstalled() bool {
	if s.trust == nil {
		return false
	}
	return s.trust.IsInstalled()
}

// Details returns metadata about the generated root CA.
func (s *CertService) Details() map[string]any {
	if s.certMgr == nil || s.certMgr.CA() == nil {
		return map[string]any{"exists": false}
	}
	caCert := s.certMgr.CA().Certificate
	fingerprint := sha256.Sum256(caCert.Raw)
	return map[string]any{
		"exists":             true,
		"subject":            caCert.Subject.CommonName,
		"issuer":             caCert.Issuer.CommonName,
		"validFrom":          caCert.NotBefore.Format("2006-01-02"),
		"validTo":            caCert.NotAfter.Format("2006-01-02"),
		"fingerprint":        hex.EncodeToString(fingerprint[:]),
		"installed":          s.IsInstalled(),
		"androidSubjectHash": cert.AndroidSubjectHashOld(caCert),
		"androidCertFile":    cert.AndroidSystemCertName(caCert),
	}
}

// ExportPEM returns the root CA certificate PEM.
func (s *CertService) ExportPEM() string {
	if s.certMgr == nil || s.certMgr.CA() == nil {
		return ""
	}
	return string(s.certMgr.CA().CertPEM)
}

// Install installs the root CA into the OS trust store.
func (s *CertService) Install() error {
	if s.trust == nil {
		return fmt.Errorf("trust installer not initialized")
	}
	return s.trust.Install()
}

// Uninstall removes the root CA from the OS trust store.
func (s *CertService) Uninstall() error {
	if s.trust == nil {
		return fmt.Errorf("trust installer not initialized")
	}
	return s.trust.Uninstall()
}

// Manager returns the underlying certificate manager.
func (s *CertService) Manager() *cert.CertificateManager {
	return s.certMgr
}
