package cert

import (
	"crypto/md5"
	"crypto/sha1"
	"crypto/x509"
	"encoding/binary"
	"fmt"
)

// AndroidSubjectHashOld returns the OpenSSL subject_hash_old filename prefix for Android system CA store.
func AndroidSubjectHashOld(cert *x509.Certificate) string {
	sum := md5.Sum(cert.RawSubject)
	v := binary.LittleEndian.Uint32(sum[:4])
	return fmt.Sprintf("%08x", v)
}

// AndroidSubjectHashNew returns the OpenSSL subject_hash (new) calculated with SHA-1.
func AndroidSubjectHashNew(cert *x509.Certificate) string {
	sum := sha1.Sum(cert.RawSubject)
	v := binary.LittleEndian.Uint32(sum[:4])
	return fmt.Sprintf("%08x", v)
}

// AndroidSystemCertName returns the filename used under /system/etc/security/cacerts/.
func AndroidSystemCertName(cert *x509.Certificate) string {
	return AndroidSubjectHashOld(cert) + ".0"
}

// InstallStepResult describes one certificate install attempt.
type InstallStepResult struct {
	Method  string `json:"method"`
	Status  string `json:"status"` // unavailable, skipped, running, success, failed
	Message string `json:"message"`
}

// ADBDeviceInfo describes a connected Android device via ADB.
type ADBDeviceInfo struct {
	Serial string `json:"serial"`
	State  string `json:"state"`
	Model  string `json:"model"`
	Rooted bool   `json:"rooted"`
}

// AndroidInstallResult aggregates all fallback install attempts from desktop via ADB.
type AndroidInstallResult struct {
	Success      bool                `json:"success"`
	ADBAvailable bool                `json:"adbAvailable"`
	DeviceSerial string              `json:"deviceSerial"`
	Rooted       bool                `json:"rooted"`
	SubjectHash  string              `json:"subjectHash"`
	CertFileName string              `json:"certFileName"`
	Steps        []InstallStepResult `json:"steps"`
}
