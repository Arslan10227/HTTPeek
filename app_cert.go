package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"

	"httpeek/pkg/cert"
)

// CheckCAInstalled checks whether Root CA is installed in the OS trust store.
func (a *App) CheckCAInstalled() bool {
	if a.certSvc != nil {
		return a.certSvc.IsInstalled()
	}
	if a.trust == nil {
		return false
	}
	return a.trust.IsInstalled()
}

// IsCAInstalled is an alias for CheckCAInstalled.
func (a *App) IsCAInstalled() bool {
	return a.CheckCAInstalled()
}

// InstallRootCA installs the Root CA into the operating system trust store.
func (a *App) InstallRootCA() error {
	if a.trust == nil {
		return fmt.Errorf("trust installer not initialized")
	}
	return a.trust.Install()
}

// UninstallRootCA removes Root CA from OS trust store.
func (a *App) UninstallRootCA() error {
	if a.trust == nil {
		return fmt.Errorf("trust installer not initialized")
	}
	return a.trust.Uninstall()
}

// GetCADetails returns information about the generated Root CA.
func (a *App) GetCADetails() map[string]any {
	if a.certSvc != nil {
		return a.certSvc.Details()
	}
	if a.certMgr == nil || a.certMgr.CA() == nil {
		return map[string]any{"exists": false, "installed": false}
	}
	caCert := a.certMgr.CA().Certificate
	fingerprint := sha256.Sum256(caCert.Raw)
	isInstalled := a.CheckCAInstalled()

	return map[string]any{
		"exists":             true,
		"subject":            caCert.Subject.CommonName,
		"issuer":             caCert.Issuer.CommonName,
		"validFrom":          caCert.NotBefore.Format("2006-01-02"),
		"validTo":            caCert.NotAfter.Format("2006-01-02"),
		"fingerprint":        hex.EncodeToString(fingerprint[:]),
		"installed":          isInstalled,
		"isInstalled":        isInstalled,
		"androidSubjectHash": cert.AndroidSubjectHashOld(caCert),
		"androidCertFile":    cert.AndroidSystemCertName(caCert),
	}
}

// ExportRootCA returns the Root CA certificate in PEM format.
func (a *App) ExportRootCA() string {
	if a.certMgr == nil || a.certMgr.CA() == nil {
		return ""
	}
	return string(a.certMgr.CA().CertPEM)
}

// InstallAndroidRootCA attempts multiple fallback techniques to install the Root CA on a connected Android device.
func (a *App) InstallAndroidRootCA(deviceSerial string) cert.AndroidInstallResult {
	if a.certMgr == nil || a.certMgr.CA() == nil {
		return cert.AndroidInstallResult{
			Steps: []cert.InstallStepResult{{
				Method:  "init",
				Status:  "failed",
				Message: "Root CA is not initialized",
			}},
		}
	}

	host := "127.0.0.1"
	port := 9099
	if a.server != nil {
		port = a.server.Port()
	}
	ips := a.GetLocalIPs()
	for _, ip := range ips {
		if ip != "127.0.0.1" {
			host = ip
			break
		}
	}
	if host == "127.0.0.1" && len(ips) > 0 {
		host = ips[0]
	}

	inst := cert.NewAndroidADBInstaller(a.certMgr.CA())
	inst.SetDataDir(a.dataDir)
	return inst.Install(deviceSerial, host, port)
}

// InstallCertToAndroid is an alias for InstallAndroidRootCA.
func (a *App) InstallCertToAndroid(deviceSerial string) cert.AndroidInstallResult {
	return a.InstallAndroidRootCA(deviceSerial)
}

// ListADBDevices returns Android devices connected via ADB.
func (a *App) ListADBDevices() []cert.ADBDeviceInfo {
	if a.certMgr == nil || a.certMgr.CA() == nil {
		return []cert.ADBDeviceInfo{}
	}
	inst := cert.NewAndroidADBInstaller(a.certMgr.CA())
	inst.SetDataDir(a.dataDir)
	devices, err := inst.ListDevices()
	if err != nil {
		return []cert.ADBDeviceInfo{}
	}
	return devices
}

// GetLocalIPs returns list of local IPv4 network interfaces for mobile configuration.
func (a *App) GetLocalIPs() []string {
	var ips []string
	ifaces, err := net.Interfaces()
	if err != nil {
		return []string{"127.0.0.1"}
	}

	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip != nil && ip.To4() != nil && !ip.IsLoopback() {
				ips = append(ips, ip.String())
			}
		}
	}
	if len(ips) == 0 {
		ips = append(ips, "127.0.0.1")
	}
	return ips
}
