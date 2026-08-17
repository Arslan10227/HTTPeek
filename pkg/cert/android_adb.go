package cert

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// AndroidADBInstaller pushes the Root CA to Android devices using multiple fallback techniques.
type AndroidADBInstaller struct {
	ca *CA
}

// NewAndroidADBInstaller creates an installer for the provided CA.
func NewAndroidADBInstaller(ca *CA) *AndroidADBInstaller {
	return &AndroidADBInstaller{ca: ca}
}

// ADBAvailable reports whether the adb binary is on PATH.
func (a *AndroidADBInstaller) ADBAvailable() bool {
	_, err := exec.LookPath("adb")
	return err == nil
}

func (a *AndroidADBInstaller) adbArgs(serial string, args ...string) []string {
	if serial != "" {
		return append([]string{"-s", serial}, args...)
	}
	return args
}

func (a *AndroidADBInstaller) runADB(serial string, args ...string) (string, error) {
	cmd := exec.Command("adb", a.adbArgs(serial, args...)...)
	hideExec(cmd)
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

// ListDevices returns connected ADB devices with basic metadata.
func (a *AndroidADBInstaller) ListDevices() ([]ADBDeviceInfo, error) {
	if !a.ADBAvailable() {
		return nil, fmt.Errorf("adb not found in PATH")
	}

	out, err := a.runADB("", "devices", "-l")
	if err != nil {
		return nil, err
	}

	var devices []ADBDeviceInfo
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "List of devices") {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}
		serial, state := parts[0], parts[1]
		if state != "device" {
			continue
		}

		model := ""
		for _, part := range parts[2:] {
			if strings.HasPrefix(part, "model:") {
				model = strings.TrimPrefix(part, "model:")
				model = strings.ReplaceAll(model, "_", " ")
				break
			}
		}

		rooted := a.isDeviceRooted(serial)
		devices = append(devices, ADBDeviceInfo{
			Serial: serial,
			State:  state,
			Model:  model,
			Rooted: rooted,
		})
	}

	return devices, nil
}

func (a *AndroidADBInstaller) isDeviceRooted(serial string) bool {
	out, err := a.runADB(serial, "shell", "su", "-c", "id")
	if err != nil {
		return false
	}
	return strings.Contains(out, "uid=0")
}

func (a *AndroidADBInstaller) addStep(steps *[]InstallStepResult, method, status, message string) {
	*steps = append(*steps, InstallStepResult{
		Method:  method,
		Status:  status,
		Message: message,
	})
}

// Install attempts multiple fallback techniques to install the Root CA on an Android device.
func (a *AndroidADBInstaller) Install(deviceSerial, host string, port int) AndroidInstallResult {
	result := AndroidInstallResult{
		SubjectHash:  AndroidSubjectHashOld(a.ca.Certificate),
		CertFileName: AndroidSystemCertName(a.ca.Certificate),
		Steps:        []InstallStepResult{},
	}

	if !a.ADBAvailable() {
		a.addStep(&result.Steps, "adb", "unavailable", "ADB not found. Install Android platform-tools and ensure adb is on PATH.")
		return result
	}
	result.ADBAvailable = true

	devices, err := a.ListDevices()
	if err != nil {
		a.addStep(&result.Steps, "device_detect", "failed", err.Error())
		return result
	}
	if len(devices) == 0 {
		a.addStep(&result.Steps, "device_detect", "failed", "No authorized Android devices found. Enable USB debugging and accept the RSA prompt.")
		return result
	}

	selected := devices[0]
	if deviceSerial != "" {
		found := false
		for _, d := range devices {
			if d.Serial == deviceSerial {
				selected = d
				found = true
				break
			}
		}
		if !found {
			a.addStep(&result.Steps, "device_detect", "failed", fmt.Sprintf("Device %s not found among connected devices", deviceSerial))
			return result
		}
	}

	result.DeviceSerial = selected.Serial
	result.Rooted = selected.Rooted
	a.addStep(&result.Steps, "device_detect", "success", fmt.Sprintf("Using device %s (%s)", selected.Serial, selected.Model))

	tmpFile, err := os.CreateTemp("", "httpeek-android-ca-*.crt")
	if err != nil {
		a.addStep(&result.Steps, "prepare_cert", "failed", err.Error())
		return result
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write(a.ca.CertPEM); err != nil {
		tmpFile.Close()
		a.addStep(&result.Steps, "prepare_cert", "failed", err.Error())
		return result
	}
	tmpFile.Close()
	a.addStep(&result.Steps, "prepare_cert", "success", "Root CA exported to temporary file")

	certName := result.CertFileName
	remoteTmp := "/data/local/tmp/" + certName
	remoteDownload := "/sdcard/Download/httpeek-" + certName
	systemPath := "/system/etc/security/cacerts/" + certName

	if selected.Rooted {
		a.addStep(&result.Steps, "root_check", "success", "Device appears rooted (su available)")
		if a.installRootedSystemStore(selected.Serial, tmpFile.Name(), remoteTmp, systemPath, &result) {
			result.Success = true
			return result
		}
	} else {
		a.addStep(&result.Steps, "root_check", "skipped", "Device is not rooted — skipping system store install")
	}

	if a.pushToDownloads(selected.Serial, tmpFile.Name(), remoteDownload, &result) {
		result.Success = true
	}

	if host == "" {
		host = "127.0.0.1"
	}
	caURL := fmt.Sprintf("http://%s:%d/ssl", host, port)
	if a.openCAUrl(selected.Serial, caURL, &result) {
		result.Success = true
	}

	if a.openCertFile(selected.Serial, remoteDownload, &result) {
		result.Success = true
	}

	if !result.Success {
		a.addStep(&result.Steps, "summary", "failed", "Automatic install did not complete. Use QR pairing in the HTTPeek Android app or install the certificate manually from Downloads.")
	} else {
		a.addStep(&result.Steps, "summary", "success", "At least one install path succeeded. Confirm trust on the device if prompted.")
	}

	return result
}

func (a *AndroidADBInstaller) installRootedSystemStore(serial, localPath, remoteTmp, systemPath string, result *AndroidInstallResult) bool {
	if _, err := a.runADB(serial, "push", localPath, remoteTmp); err != nil {
		a.addStep(&result.Steps, "rooted_push", "failed", err.Error())
		return false
	}
	a.addStep(&result.Steps, "rooted_push", "success", "Certificate pushed to device temp storage")

	script := fmt.Sprintf(
		"mount -o rw,remount /system 2>/dev/null || mount -o rw,remount / 2>/dev/null; "+
			"cp %s %s && chmod 644 %s && chown root:root %s && "+
			"mount -o ro,remount /system 2>/dev/null || true",
		remoteTmp, systemPath, systemPath, systemPath,
	)
	out, err := a.runADB(serial, "shell", "su", "-c", script)
	if err != nil {
		a.addStep(&result.Steps, "rooted_system_store", "failed", fmt.Sprintf("%v (%s)", err, out))
		return false
	}

	verifyOut, verifyErr := a.runADB(serial, "shell", "su", "-c", "ls -l "+systemPath)
	if verifyErr != nil || !strings.Contains(verifyOut, certBaseName(systemPath)) {
		a.addStep(&result.Steps, "rooted_system_store", "failed", "System store copy could not be verified")
		return false
	}

	a.addStep(&result.Steps, "rooted_system_store", "success", "Installed into /system/etc/security/cacerts (rooted device)")
	return true
}

func certBaseName(path string) string {
	return filepath.Base(path)
}

func (a *AndroidADBInstaller) pushToDownloads(serial, localPath, remotePath string, result *AndroidInstallResult) bool {
	if _, err := a.runADB(serial, "push", localPath, remotePath); err != nil {
		a.addStep(&result.Steps, "push_downloads", "failed", err.Error())
		return false
	}
	a.addStep(&result.Steps, "push_downloads", "success", fmt.Sprintf("Saved to %s — open Settings > Security > Install certificate > CA certificate", remotePath))
	return true
}

func (a *AndroidADBInstaller) openCAUrl(serial, caURL string, result *AndroidInstallResult) bool {
	_, err := a.runADB(serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", caURL)
	if err != nil {
		a.addStep(&result.Steps, "open_ca_url", "failed", err.Error())
		return false
	}
	a.addStep(&result.Steps, "open_ca_url", "success", fmt.Sprintf("Opened %s on device browser", caURL))
	return true
}

func (a *AndroidADBInstaller) openCertFile(serial, remotePath string, result *AndroidInstallResult) bool {
	escaped := strings.ReplaceAll(remotePath, " ", "\\ ")
	_, err := a.runADB(serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "file://"+escaped, "-t", "application/x-x509-ca-cert")
	if err != nil {
		a.addStep(&result.Steps, "open_cert_file", "failed", err.Error())
		return false
	}
	a.addStep(&result.Steps, "open_cert_file", "success", "Launched certificate installer intent on device")
	return true
}
