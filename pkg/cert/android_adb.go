package cert

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"httpeek/pkg/adb"
	"httpeek/pkg/logger"
	"httpeek/pkg/platform/helpers"
)

// AndroidADBInstaller pushes the Root CA to Android devices using multiple fallback techniques.
type AndroidADBInstaller struct {
	ca      *CA
	dataDir string
}

// NewAndroidADBInstaller creates an installer for the provided CA.
// If dataDir is non-empty, ADB resolution also checks the auto-downloaded
// platform-tools cache under <dataDir>/tools/platform-tools.
func NewAndroidADBInstaller(ca *CA) *AndroidADBInstaller {
	return &AndroidADBInstaller{ca: ca}
}

// SetDataDir configures the data directory used for ADB auto-download caching.
// Must be called before ADBAvailable/runADB if auto-downloaded ADB is desired.
func (a *AndroidADBInstaller) SetDataDir(dataDir string) {
	a.dataDir = dataDir
}

// adbBinary resolves the adb executable path via bundled assets, PATH, common SDK locations,
// and the cached auto-download. Returns "" if not found.
func (a *AndroidADBInstaller) adbBinary() string {
	if p := helpers.GetADBPath(a.dataDir); p != "" {
		if _, err := os.Stat(p); err == nil {
			return p
		}
		if _, err := exec.LookPath(p); err == nil {
			return p
		}
	}
	if p, err := adb.ResolvePath(a.dataDir); err == nil {
		return p
	}
	return ""
}

// ADBAvailable reports whether the adb binary can be resolved via PATH, common
// SDK locations, or a previously auto-downloaded copy.
func (a *AndroidADBInstaller) ADBAvailable() bool {
	return a.adbBinary() != ""
}

func (a *AndroidADBInstaller) adbArgs(serial string, args ...string) []string {
	if serial != "" {
		return append([]string{"-s", serial}, args...)
	}
	return args
}

func (a *AndroidADBInstaller) runADB(serial string, args ...string) (string, error) {
	bin := a.adbBinary()
	if bin == "" {
		logger.Error("ADB", "ADB binary not found on PATH or in assets")
		return "", fmt.Errorf("adb not found (not on PATH, not in SDK locations, not in cache)")
	}
	cmdArgs := a.adbArgs(serial, args...)
	cmd := exec.Command(bin, cmdArgs...)
	helpers.HideExec(cmd)
	out, err := cmd.CombinedOutput()
	trimmedOut := strings.TrimSpace(string(out))
	if err != nil {
		logger.Warn("ADB", fmt.Sprintf("runADB: %s %s -> err: %v (%s)", bin, strings.Join(cmdArgs, " "), err, trimmedOut))
	}
	return trimmedOut, err
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

// ListInstalledApps returns all third-party and user-installed applications on the Android device.
func (a *AndroidADBInstaller) ListInstalledApps(serial string) ([]AndroidAppInfo, error) {
	// First attempt frida-ps if available
	if apps, err := a.listAppsViaFrida(serial, true); err == nil && len(apps) > 0 {
		return apps, nil
	}

	// Fallback to ADB package manager
	out, err := a.runADB(serial, "shell", "pm", "list", "packages", "-3")
	if err != nil {
		out, err = a.runADB(serial, "shell", "pm", "list", "packages")
		if err != nil {
			return nil, err
		}
	}

	var apps []AndroidAppInfo
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "package:") {
			continue
		}
		pkg := strings.TrimPrefix(line, "package:")
		if pkg == "" {
			continue
		}

		name := pkg
		parts := strings.Split(pkg, ".")
		if len(parts) > 0 {
			last := parts[len(parts)-1]
			if len(last) > 1 {
				name = strings.ToUpper(last[:1]) + last[1:]
			}
		}

		apps = append(apps, AndroidAppInfo{
			Package:   pkg,
			Name:      name,
			PID:       0,
			IsRunning: false,
			IsSystem:  false,
		})
	}

	return apps, nil
}

// ListRunningApps returns all currently running processes/apps on the Android device.
func (a *AndroidADBInstaller) ListRunningApps(serial string) ([]AndroidAppInfo, error) {
	// First attempt frida-ps if available
	if apps, err := a.listAppsViaFrida(serial, false); err == nil && len(apps) > 0 {
		return apps, nil
	}

	// Fallback to ADB ps -A
	out, err := a.runADB(serial, "shell", "ps", "-A")
	if err != nil {
		out, err = a.runADB(serial, "shell", "ps")
		if err != nil {
			return nil, err
		}
	}

	var apps []AndroidAppInfo
	seen := make(map[string]bool)
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "USER") || strings.HasPrefix(line, "PID") {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 8 {
			continue
		}
		// In ps -A: PID is typically parts[1], NAME is the last column
		pidStr := parts[1]
		cmd := parts[len(parts)-1]

		// Filter for application-like packages (contain at least one dot and typical android package characters)
		if !strings.Contains(cmd, ".") || strings.HasPrefix(cmd, "[") || strings.HasPrefix(cmd, "/") || strings.Contains(cmd, "system_server") {
			continue
		}
		if seen[cmd] {
			continue
		}
		seen[cmd] = true

		pid, _ := strconv.Atoi(pidStr)
		name := cmd
		pParts := strings.Split(cmd, ".")
		if len(pParts) > 0 {
			last := pParts[len(pParts)-1]
			if len(last) > 1 {
				name = strings.ToUpper(last[:1]) + last[1:]
			}
		}

		apps = append(apps, AndroidAppInfo{
			Package:   cmd,
			Name:      name,
			PID:       pid,
			IsRunning: true,
			IsSystem:  strings.HasPrefix(cmd, "com.android.") || strings.HasPrefix(cmd, "com.google.android."),
		})
	}

	return apps, nil
}

func (a *AndroidADBInstaller) listAppsViaFrida(serial string, installedOnly bool) ([]AndroidAppInfo, error) {
	fridaBin := helpers.GetFridaPsPath()
	if _, err := os.Stat(fridaBin); err != nil {
		if _, err := exec.LookPath(fridaBin); err != nil {
			return nil, err
		}
	}

	args := []string{}
	if serial != "" {
		args = append(args, "-D", serial)
	} else {
		args = append(args, "-U")
	}

	if installedOnly {
		args = append(args, "-ai")
	} else {
		args = append(args, "-a")
	}

	cmd := exec.Command(fridaBin, args...)
	hideExec(cmd)
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var apps []AndroidAppInfo
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "PID") || strings.HasPrefix(line, "-") {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 3 {
			continue
		}

		pidStr := parts[0]
		pkg := parts[len(parts)-1]
		name := strings.Join(parts[1:len(parts)-1], " ")

		pid := 0
		if pidStr != "-" {
			pid, _ = strconv.Atoi(pidStr)
		}

		apps = append(apps, AndroidAppInfo{
			Package:   pkg,
			Name:      name,
			PID:       pid,
			IsRunning: pid > 0,
			IsSystem:  false,
		})
	}

	return apps, nil
}

// GetDeviceABI returns the primary CPU architecture of the Android device.
func (a *AndroidADBInstaller) GetDeviceABI(serial string) (string, error) {
	out, err := a.runADB(serial, "shell", "getprop", "ro.product.cpu.abi")
	if err != nil {
		return "", err
	}
	abi := strings.TrimSpace(out)
	switch {
	case strings.Contains(abi, "arm64"):
		return "arm64", nil
	case strings.Contains(abi, "armeabi") || strings.Contains(abi, "arm"):
		return "arm", nil
	case strings.Contains(abi, "x86_64"):
		return "x86_64", nil
	case strings.Contains(abi, "x86"):
		return "x86", nil
	default:
		return "arm64", nil
	}
}

// DeployAndStartFridaServer pushes the bundled frida-server matching the device architecture
// to /data/local/tmp and starts it on the device.
func (a *AndroidADBInstaller) DeployAndStartFridaServer(serial string) error {
	arch, err := a.GetDeviceABI(serial)
	if err != nil {
		arch = "arm64"
	}

	assetsDir := helpers.GetAssetsDir()
	serverBinary := filepath.Join(assetsDir, "frida", fmt.Sprintf("frida-server-%s", arch))
	if _, err := os.Stat(serverBinary); err != nil {
		return fmt.Errorf("bundled frida-server for %s not found at %s", arch, serverBinary)
	}

	remotePath := "/data/local/tmp/httpeek-frida-server"

	// 1. Check if already running
	checkOut, _ := a.runADB(serial, "shell", "pidof", "httpeek-frida-server")
	if strings.TrimSpace(checkOut) != "" {
		_ = a.forwardFridaPort(serial)
		return nil
	}

	// 2. Push frida-server binary
	if _, err := a.runADB(serial, "push", serverBinary, remotePath); err != nil {
		return fmt.Errorf("failed to push frida-server to device: %w", err)
	}

	// 3. Set executable permissions
	if _, err := a.runADB(serial, "shell", "chmod", "755", remotePath); err != nil {
		return fmt.Errorf("failed to set chmod 755 on frida-server: %w", err)
	}

	// 4. Push SSL unpinning script to device
	scriptPath := helpers.GetFridaScriptPath()
	if _, err := os.Stat(scriptPath); err == nil {
		_, _ = a.runADB(serial, "push", scriptPath, "/data/local/tmp/ssl_unpinning.js")
	}

	// 5. Start frida-server as background daemon
	if a.isDeviceRooted(serial) {
		_, _ = a.runADB(serial, "shell", "su", "-c", remotePath+" -D &")
	} else {
		_, _ = a.runADB(serial, "shell", remotePath+" -D &")
	}

	// 6. Forward Frida port 27042
	_ = a.forwardFridaPort(serial)

	return nil
}

// InjectScriptOnDevice executes an SSL unpinning injection directly on the Android device using bundled frida-inject.
func (a *AndroidADBInstaller) InjectScriptOnDevice(serial string, target string, isPid bool, scriptPath string) (string, error) {
	arch, err := a.GetDeviceABI(serial)
	if err != nil {
		arch = "arm64"
	}

	assetsDir := helpers.GetAssetsDir()
	injectBinary := filepath.Join(assetsDir, "frida", fmt.Sprintf("frida-inject-%s", arch))
	if _, err := os.Stat(injectBinary); err != nil {
		return "", fmt.Errorf("frida-inject binary for %s not found at %s", arch, injectBinary)
	}

	remoteInjector := "/data/local/tmp/httpeek-frida-inject"
	remoteScript := "/data/local/tmp/ssl_unpinning.js"

	// 1. Push injector binary
	if _, err := a.runADB(serial, "push", injectBinary, remoteInjector); err != nil {
		return "", fmt.Errorf("failed to push frida-inject: %w", err)
	}
	_, _ = a.runADB(serial, "shell", "chmod", "755", remoteInjector)

	// 2. Push script
	if scriptPath == "" {
		scriptPath = helpers.GetFridaScriptPath()
	}
	if _, err := os.Stat(scriptPath); err == nil {
		_, _ = a.runADB(serial, "push", scriptPath, remoteScript)
	}

	// 3. Launch target and inject
	var injectCmd string
	if isPid {
		injectCmd = fmt.Sprintf("%s -p %s -s %s -e", remoteInjector, target, remoteScript)
	} else {
		// Launch package intent if not running, then inject
		_ = a.LaunchAppPackage(serial, target)
		injectCmd = fmt.Sprintf("%s -n %s -s %s -e", remoteInjector, target, remoteScript)
	}

	logger.Info("ADB", fmt.Sprintf("Executing on-device injection on %s: %s", serial, injectCmd))

	var out string
	if a.isDeviceRooted(serial) {
		out, err = a.runADB(serial, "shell", "su", "-c", fmt.Sprintf("'%s &'", injectCmd))
	} else {
		out, err = a.runADB(serial, "shell", fmt.Sprintf("%s &", injectCmd))
	}

	if err != nil {
		logger.Warn("ADB", fmt.Sprintf("On-device injection warning: %v (%s)", err, out))
	}

	// Show on-device notification
	_, _ = a.runADB(serial, "shell", "cmd", "notification", "post", "-S", "bigtext", "-t", "HTTPeek Frida Hook Active", "httpeek", fmt.Sprintf("SSL Pinning Hooked for %s", target))
	// Reject QUIC UDP 443 so app falls back to TCP HTTP
	_, _ = a.runADB(serial, "shell", "su", "-c", "'iptables -I OUTPUT -p udp --dport 443 -j REJECT 2>/dev/null || true'")

	runID := fmt.Sprintf("frida-native-%s-%d", target, time.Now().UnixNano())
	return runID, nil
}

// LaunchAppPackage attempts to launch an app via monkey or am.
func (a *AndroidADBInstaller) LaunchAppPackage(serial string, pkg string) error {
	_, err := a.runADB(serial, "shell", "monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1")
	return err
}

// KillOnDeviceFrida kills the background frida-inject process and the target app on the Android device,
// restores iptables, and dismisses the on-device HTTPeek notification.
func (a *AndroidADBInstaller) KillOnDeviceFrida(serial, target string) {
	logger.Info("ADB", fmt.Sprintf("KillOnDeviceFrida: killing frida-inject and %s on %s", target, serial))

	// Kill the frida-inject daemon running in background
	_, _ = a.runADB(serial, "shell", "su", "-c", "'pkill -f httpeek-frida-inject 2>/dev/null || true'")
	_, _ = a.runADB(serial, "shell", "pkill", "-f", "httpeek-frida-inject")

	// Kill the target app process so it restarts cleanly next time
	if target != "" {
		_, _ = a.runADB(serial, "shell", "am", "force-stop", target)
	}

	// Restore iptables — remove the QUIC block rule
	_, _ = a.runADB(serial, "shell", "su", "-c", "'iptables -D OUTPUT -p udp --dport 443 -j REJECT 2>/dev/null || true'")

	// Dismiss the HTTPeek on-device notification.
	// Android 13+ uses cmd notification cancel <tag> <id>; older versions use the service call.
	_, _ = a.runADB(serial, "shell", "cmd", "notification", "cancel", "httpeek", "0")
	// Fallback for older Android versions
	_, _ = a.runADB(serial, "shell", "service", "call", "notification", "1")
}

func (a *AndroidADBInstaller) forwardFridaPort(serial string) error {
	_, err := a.runADB(serial, "forward", "tcp:27042", "tcp:27042")
	return err
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

	// Modern universal Android System CA injection (works across Android 7 through 15, APEX & read-only system)
	tmpfsCmd := fmt.Sprintf(
		"mkdir -p -m 700 /data/local/tmp/cacerts-backup && " +
			"cp -a /system/etc/security/cacerts/* /data/local/tmp/cacerts-backup/ 2>/dev/null && " +
			"mount -t tmpfs tmpfs /system/etc/security/cacerts 2>/dev/null && " +
			"cp -a /data/local/tmp/cacerts-backup/* /system/etc/security/cacerts/ 2>/dev/null && " +
			"cp %s %s && " +
			"chmod 644 /system/etc/security/cacerts/* 2>/dev/null && " +
			"chown root:root /system/etc/security/cacerts/* 2>/dev/null && " +
			"chcon u:object_r:system_file:s0 /system/etc/security/cacerts/* 2>/dev/null && " +
			"rm -rf /data/local/tmp/cacerts-backup",
		remoteTmp, systemPath,
	)

	out, err := a.runADB(serial, "shell", "su", "-c", fmt.Sprintf("'%s'", tmpfsCmd))
	if err != nil {
		logger.Warn("ADB", fmt.Sprintf("Tmpfs system store install fallback: %v (%s)", err, out))
		// Fallback: standard remount
		remountCmd := fmt.Sprintf("mount -o rw,remount / 2>/dev/null || mount -o rw,remount /system 2>/dev/null; cp %s %s && chmod 644 %s && chown root:root %s", remoteTmp, systemPath, systemPath, systemPath)
		_, _ = a.runADB(serial, "shell", "su", "-c", fmt.Sprintf("'%s'", remountCmd))
	}

	// Verify certificate is present in system store
	verifyOut, verifyErr := a.runADB(serial, "shell", "su", "-c", fmt.Sprintf("'ls -l %s'", systemPath))
	if verifyErr != nil || !strings.Contains(verifyOut, filepath.Base(systemPath)) {
		// Fallback check
		checkOut, checkErr := a.runADB(serial, "shell", "su", "-c", fmt.Sprintf("'test -f %s && echo EXISTS'", systemPath))
		if checkErr != nil || !strings.Contains(checkOut, "EXISTS") {
			a.addStep(&result.Steps, "rooted_system_store", "failed", fmt.Sprintf("System store copy could not be verified: %s", verifyOut))
			return false
		}
	}

	a.addStep(&result.Steps, "rooted_system_store", "success", "Installed into /system/etc/security/cacerts (system store active)")
	return true
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
	_, err := a.runADB(serial, "shell", "am", "start", "-a", "android.credentials.INSTALL", "-t", "application/x-x509-ca-cert", "-d", "file://"+escaped)
	if err != nil {
		_, err = a.runADB(serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "file://"+escaped, "-t", "application/x-x509-ca-cert")
	}
	if err != nil {
		a.addStep(&result.Steps, "open_cert_file", "failed", err.Error())
		return false
	}
	a.addStep(&result.Steps, "open_cert_file", "success", "Launched certificate installer intent on device")
	return true
}
