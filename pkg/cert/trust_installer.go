package cert

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// TrustInstaller installs or removes the Root CA from operating system trust stores.
type TrustInstaller struct {
	ca *CA
}

// NewTrustInstaller creates an installer for the provided CA.
func NewTrustInstaller(ca *CA) *TrustInstaller {
	return &TrustInstaller{ca: ca}
}

// IsInstalled checks whether the Root CA is currently installed in the OS trust store.
func (ti *TrustInstaller) IsInstalled() bool {
	if ti == nil || ti.ca == nil || ti.ca.Certificate == nil {
		return false
	}
	cn := ti.ca.Certificate.Subject.CommonName
	switch runtime.GOOS {
	case "windows":
		// Check user store first
		cmdUser := exec.Command("certutil", "-user", "-verifystore", "ROOT", cn)
		hideExec(cmdUser)
		outUser, errUser := cmdUser.CombinedOutput()
		if errUser == nil && (strings.Contains(string(outUser), cn) || strings.Contains(string(outUser), "CertUtil: -verifystore command completed successfully")) {
			return true
		}
		// Check machine store fallback
		cmdMach := exec.Command("certutil", "-verifystore", "ROOT", cn)
		hideExec(cmdMach)
		outMach, errMach := cmdMach.CombinedOutput()
		return errMach == nil && strings.Contains(string(outMach), cn)
	case "darwin":
		cmd := exec.Command("security", "find-certificate", "-c", cn, "/Library/Keychains/System.keychain")
		err := cmd.Run()
		return err == nil
	case "linux":
		destPath := "/usr/local/share/ca-certificates/proxypin-ca.crt"
		_, err := os.Stat(destPath)
		return err == nil
	default:
		return false
	}
}

// Install installs the Root CA into the current operating system trust store.
func (ti *TrustInstaller) Install() error {
	tmpFile, err := os.CreateTemp("", "httpeek-ca-*.crt")
	if err != nil {
		return fmt.Errorf("create temp cert file failed: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write(ti.ca.CertPEM); err != nil {
		tmpFile.Close()
		return fmt.Errorf("write temp cert failed: %w", err)
	}
	tmpFile.Close()

	switch runtime.GOOS {
	case "windows":
		return ti.installWindows(tmpFile.Name())
	case "darwin":
		return ti.installDarwin(tmpFile.Name())
	case "linux":
		return ti.installLinux(tmpFile.Name())
	default:
		return fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}
}

// Uninstall removes the Root CA from the operating system trust store.
func (ti *TrustInstaller) Uninstall() error {
	switch runtime.GOOS {
	case "windows":
		return ti.uninstallWindows()
	case "darwin":
		return ti.uninstallDarwin()
	case "linux":
		return ti.uninstallLinux()
	default:
		return fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}
}

func (ti *TrustInstaller) installWindows(certPath string) error {
	// Use -user store so no administrator privilege is required and Chrome/Edge trust it immediately
	cmd := exec.Command("certutil", "-user", "-addstore", "-f", "ROOT", certPath)
	hideExec(cmd)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("certutil addstore failed: %s (%w)", string(out), err)
	}
	return nil
}

func (ti *TrustInstaller) uninstallWindows() error {
	cn := ti.ca.Certificate.Subject.CommonName
	cmd := exec.Command("certutil", "-user", "-delstore", "ROOT", cn)
	hideExec(cmd)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("certutil delstore failed: %s (%w)", string(out), err)
	}
	return nil
}

func (ti *TrustInstaller) installDarwin(certPath string) error {
	cmd := exec.Command("security", "add-trusted-cert", "-d", "-r", "trustRoot", "-k", "/Library/Keychains/System.keychain", certPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("security add-trusted-cert failed: %s (%w)", string(out), err)
	}
	return nil
}

func (ti *TrustInstaller) uninstallDarwin() error {
	cn := ti.ca.Certificate.Subject.CommonName
	cmd := exec.Command("security", "delete-certificate", "-c", cn, "/Library/Keychains/System.keychain")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("security delete-certificate failed: %s (%w)", string(out), err)
	}
	return nil
}

func (ti *TrustInstaller) installLinux(certPath string) error {
	destDir := "/usr/local/share/ca-certificates"
	if _, err := os.Stat(destDir); err != nil {
		destDir = "/etc/ca-certificates/trust-source/anchors"
	}

	destPath := filepath.Join(destDir, "httpeek-ca.crt")
	data, err := os.ReadFile(certPath)
	if err != nil {
		return err
	}
	if err := os.WriteFile(destPath, data, 0644); err != nil {
		return fmt.Errorf("write to %s failed (root required): %w", destPath, err)
	}

	cmd := exec.Command("update-ca-certificates")
	if _, err := exec.LookPath("update-ca-certificates"); err != nil {
		cmd = exec.Command("update-ca-trust")
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("update-ca-certificates failed: %s (%w)", string(out), err)
	}
	return nil
}

func (ti *TrustInstaller) uninstallLinux() error {
	paths := []string{
		"/usr/local/share/ca-certificates/httpeek-ca.crt",
		"/etc/ca-certificates/trust-source/anchors/httpeek-ca.crt",
	}
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			os.Remove(p)
		}
	}

	cmd := exec.Command("update-ca-certificates")
	if _, err := exec.LookPath("update-ca-certificates"); err != nil {
		cmd = exec.Command("update-ca-trust")
	}
	_ = cmd.Run()
	return nil
}
