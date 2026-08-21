//go:build windows

package system

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows/registry"
)

// appLaunchProfile defines how to launch a specific app with proxy settings.
type appLaunchProfile struct {
	path       string
	args       []string
	envExtras  map[string]string
	detach     bool
}

func detectLaunchableAppsPlatform() []LaunchableApp {
	apps := []LaunchableApp{
		{ID: "chrome", Name: "Google Chrome", Icon: "chrome", Category: "browser", Description: "Web browser by Google"},
		{ID: "edge", Name: "Microsoft Edge", Icon: "edge", Category: "browser", Description: "Web browser by Microsoft"},
		{ID: "firefox", Name: "Mozilla Firefox", Icon: "firefox", Category: "browser", Description: "Web browser by Mozilla"},
		{ID: "terminal", Name: "Command Prompt", Icon: "terminal", Category: "terminal", Description: "Windows cmd.exe shell"},
		{ID: "powershell", Name: "PowerShell", Icon: "powershell", Category: "terminal", Description: "Windows PowerShell shell"},
		{ID: "node", Name: "Node.js", Icon: "node", Category: "runtime", Description: "JavaScript runtime"},
		{ID: "python", Name: "Python", Icon: "python", Category: "runtime", Description: "Python interpreter"},
	}

	for i := range apps {
		apps[i].Path = detectAppPathWindows(apps[i].ID)
		apps[i].Found = apps[i].Path != ""
	}

	return apps
}

func detectAppPathWindows(appID string) string {
	switch appID {
	case "chrome":
		// Try registry App Paths first
		if p := readAppPath("chrome.exe"); p != "" {
			return p
		}
		// Try standard install locations
		candidates := []string{
			`C:\Program Files\Google\Chrome\Application\chrome.exe`,
			`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
		}
		for _, c := range candidates {
			if fileExists(c) {
				return c
			}
		}
	case "edge":
		candidates := []string{
			`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
			`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
		}
		for _, c := range candidates {
			if fileExists(c) {
				return c
			}
		}
	case "firefox":
		if p := readAppPath("firefox.exe"); p != "" {
			return p
		}
		candidates := []string{
			`C:\Program Files\Mozilla Firefox\firefox.exe`,
			`C:\Program Files (x86)\Mozilla Firefox\firefox.exe`,
		}
		for _, c := range candidates {
			if fileExists(c) {
				return c
			}
		}
	case "terminal":
		systemDir := os.Getenv("SystemRoot")
		if systemDir == "" {
			systemDir = `C:\Windows`
		}
		p := filepath.Join(systemDir, "System32", "cmd.exe")
		if fileExists(p) {
			return p
		}
	case "powershell":
		systemDir := os.Getenv("SystemRoot")
		if systemDir == "" {
			systemDir = `C:\Windows`
		}
		p := filepath.Join(systemDir, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
		if fileExists(p) {
			return p
		}
	case "node":
		if p, err := exec.LookPath("node.exe"); err == nil {
			return p
		}
	case "python":
		if p, err := exec.LookPath("python.exe"); err == nil {
			return p
		}
		if p, err := exec.LookPath("python3.exe"); err == nil {
			return p
		}
	}
	return ""
}

// readAppPath reads the registry App Paths key for a given executable name.
func readAppPath(exeName string) string {
	// Try HKLM first
	keyPath := `SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\` + exeName
	if k, err := registry.OpenKey(registry.LOCAL_MACHINE, keyPath, registry.QUERY_VALUE); err == nil {
		defer k.Close()
		if val, _, err := k.GetStringValue(""); err == nil && val != "" {
			if fileExists(val) {
				return val
			}
		}
	}
	// Try HKCU
	if k, err := registry.OpenKey(registry.CURRENT_USER, keyPath, registry.QUERY_VALUE); err == nil {
		defer k.Close()
		if val, _, err := k.GetStringValue(""); err == nil && val != "" {
			if fileExists(val) {
				return val
			}
		}
	}
	// Try WOW6432Node
	wowPath := `SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\` + exeName
	if k, err := registry.OpenKey(registry.LOCAL_MACHINE, wowPath, registry.QUERY_VALUE); err == nil {
		defer k.Close()
		if val, _, err := k.GetStringValue(""); err == nil && val != "" {
			if fileExists(val) {
				return val
			}
		}
	}
	return ""
}

func launchAppPlatform(appID, customPath, proxyHost string, proxyPort int, caCertPath string) LaunchResult {
	profile, err := buildLaunchProfileWindows(appID, customPath, proxyHost, proxyPort, caCertPath)
	if err != nil {
		return LaunchResult{Success: false, Error: err.Error(), AppID: appID}
	}

	cmd := exec.Command(profile.path, profile.args...)
	env := os.Environ()
	for k, v := range profile.envExtras {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}
	cmd.Env = env

	// Detach the process so it survives HTTPeek closing
	if profile.detach {
		cmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: windows_CREATE_NEW_PROCESS_GROUP | windows_DETACHED_PROCESS,
		}
	}

	if err := cmd.Start(); err != nil {
		return LaunchResult{Success: false, Error: fmt.Sprintf("launch failed: %v", err), AppID: appID}
	}

	pid := cmd.Process.Pid
	// Don't wait for the process — let it run independently
	if cmd.Process != nil {
		_ = cmd.Process.Release()
	}

	appName := getAppDisplayName(appID)
	procName := filepath.Base(profile.path)

	return LaunchResult{
		Success:     true,
		PID:         pid,
		AppID:       appID,
		AppName:     appName,
		ProcessName: procName,
	}
}

func buildLaunchProfileWindows(appID, customPath, proxyHost string, proxyPort int, caCertPath string) (*appLaunchProfile, error) {
	proxyURL := fmt.Sprintf("http://%s:%d", proxyHost, proxyPort)

	// Common env vars for proxy
	proxyEnv := map[string]string{
		"HTTP_PROXY":  proxyURL,
		"HTTPS_PROXY": proxyURL,
		"http_proxy":  proxyURL,
		"https_proxy": proxyURL,
		"NO_PROXY":    "localhost,127.0.0.1",
	}

	switch appID {
	case "chrome", "edge":
		path := customPath
		if path == "" {
			path = detectAppPathWindows(appID)
		}
		if path == "" {
			return nil, fmt.Errorf("%s not found", appID)
		}
		args := []string{
			"--proxy-server=" + proxyURL,
			"--proxy-bypass-list=localhost;127.0.0.1",
		}
		// Chrome/Edge trust the OS cert store, so no extra cert flags needed
		return &appLaunchProfile{
			path:      path,
			args:      args,
			envExtras: proxyEnv,
			detach:    true,
		}, nil

	case "firefox":
		path := customPath
		if path == "" {
			path = detectAppPathWindows(appID)
		}
		if path == "" {
			return nil, fmt.Errorf("firefox not found")
		}
		// Firefox doesn't support --proxy-server; rely on env vars (best-effort)
		// Cert trust comes from OS trust store
		return &appLaunchProfile{
			path:      path,
			args:      []string{},
			envExtras: proxyEnv,
			detach:    true,
		}, nil

	case "terminal":
		path := customPath
		if path == "" {
			path = detectAppPathWindows("terminal")
		}
		if path == "" {
			return nil, fmt.Errorf("cmd.exe not found")
		}
		return &appLaunchProfile{
			path:      path,
			args:      []string{},
			envExtras: proxyEnv,
			detach:    true,
		}, nil

	case "powershell":
		path := customPath
		if path == "" {
			path = detectAppPathWindows("powershell")
		}
		if path == "" {
			return nil, fmt.Errorf("powershell not found")
		}
		return &appLaunchProfile{
			path:      path,
			args:      []string{"-NoExit"},
			envExtras: proxyEnv,
			detach:    true,
		}, nil

	case "node":
		path := customPath
		if path == "" {
			path = detectAppPathWindows("node")
		}
		if path == "" {
			return nil, fmt.Errorf("node not found")
		}
		env := make(map[string]string)
		for k, v := range proxyEnv {
			env[k] = v
		}
		if caCertPath != "" && fileExists(caCertPath) {
			env["NODE_EXTRA_CA_CERTS"] = caCertPath
		}
		return &appLaunchProfile{
			path:      path,
			args:      []string{},
			envExtras: env,
			detach:    true,
		}, nil

	case "python":
		path := customPath
		if path == "" {
			path = detectAppPathWindows("python")
		}
		if path == "" {
			return nil, fmt.Errorf("python not found")
		}
		env := make(map[string]string)
		for k, v := range proxyEnv {
			env[k] = v
		}
		if caCertPath != "" && fileExists(caCertPath) {
			env["REQUESTS_CA_BUNDLE"] = caCertPath
			env["SSL_CERT_FILE"] = caCertPath
		}
		return &appLaunchProfile{
			path:      path,
			args:      []string{},
			envExtras: env,
			detach:    true,
		}, nil

	case "custom":
		if customPath == "" {
			return nil, fmt.Errorf("no executable path provided")
		}
		if !fileExists(customPath) {
			return nil, fmt.Errorf("executable not found: %s", customPath)
		}
		return &appLaunchProfile{
			path:      customPath,
			args:      []string{},
			envExtras: proxyEnv,
			detach:    true,
		}, nil
	}

	return nil, fmt.Errorf("unknown app: %s", appID)
}

// --- Java Global Proxy ---

const javaToolOptionsKey = `Environment`
var javaToolOptionsValue = "" // cached previous value for restore

func setJavaGlobalProxyPlatform(enable bool, proxyHost string, proxyPort int, javaHome string) error {
	if enable {
		cacertsPath := findCacertsPath(javaHome)
		jvmArgs := []string{
			fmt.Sprintf("-Dhttp.proxyHost=%s", proxyHost),
			fmt.Sprintf("-Dhttp.proxyPort=%d", proxyPort),
			fmt.Sprintf("-Dhttps.proxyHost=%s", proxyHost),
			fmt.Sprintf("-Dhttps.proxyPort=%d", proxyPort),
			"-Dhttp.nonProxyHosts=localhost|127.0.0.1",
			"-Dhttps.nonProxyHosts=localhost|127.0.0.1",
		}
		if cacertsPath != "" && fileExists(cacertsPath) {
			jvmArgs = append(jvmArgs,
				fmt.Sprintf("-Djavax.net.ssl.trustStore=%s", cacertsPath),
				"-Djavax.net.ssl.trustStorePassword=changeit",
			)
		}
		value := strings.Join(jvmArgs, " ")
		return setUserEnvVar("JAVA_TOOL_OPTIONS", value)
	}
	// Disable: remove the env var
	return removeUserEnvVar("JAVA_TOOL_OPTIONS")
}

func getJavaGlobalProxyStatusPlatform() JavaProxyStatus {
	val, err := getUserEnvVar("JAVA_TOOL_OPTIONS")
	if err != nil || val == "" {
		return JavaProxyStatus{Enabled: false}
	}
	status := JavaProxyStatus{Enabled: true}
	// Parse out proxy host/port from the value
	for _, part := range strings.Fields(val) {
		if strings.HasPrefix(part, "-Dhttp.proxyHost=") {
			status.ProxyHost = strings.TrimPrefix(part, "-Dhttp.proxyHost=")
		}
		if strings.HasPrefix(part, "-Dhttp.proxyPort=") {
			portStr := strings.TrimPrefix(part, "-Dhttp.proxyPort=")
			fmt.Sscanf(portStr, "%d", &status.ProxyPort)
		}
		if strings.HasPrefix(part, "-Djavax.net.ssl.trustStore=") {
			status.TrustStore = strings.TrimPrefix(part, "-Djavax.net.ssl.trustStore=")
		}
	}
	return status
}

func findCacertsPath(javaHome string) string {
	if javaHome == "" {
		javaHome = os.Getenv("JAVA_HOME")
	}
	if javaHome == "" {
		return ""
	}
	candidates := []string{
		filepath.Join(javaHome, "lib", "security", "cacerts"),
		filepath.Join(javaHome, "jre", "lib", "security", "cacerts"),
	}
	for _, c := range candidates {
		if fileExists(c) {
			return c
		}
	}
	return ""
}

func setUserEnvVar(key, value string) error {
	k, err := registry.OpenKey(registry.CURRENT_USER, javaToolOptionsKey, registry.SET_VALUE|registry.QUERY_VALUE)
	if err != nil {
		return fmt.Errorf("open registry Environment key: %w", err)
	}
	defer k.Close()
	if err := k.SetStringValue(key, value); err != nil {
		return err
	}
	// Broadcast WM_SETTINGCHANGE so Explorer and new processes pick up the change
	broadcastEnvironmentChange()
	return nil
}

func getUserEnvVar(key string) (string, error) {
	k, err := registry.OpenKey(registry.CURRENT_USER, javaToolOptionsKey, registry.QUERY_VALUE)
	if err != nil {
		return "", err
	}
	defer k.Close()
	val, _, err := k.GetStringValue(key)
	return val, err
}

func removeUserEnvVar(key string) error {
	k, err := registry.OpenKey(registry.CURRENT_USER, javaToolOptionsKey, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("open registry Environment key: %w", err)
	}
	defer k.Close()
	if err := k.DeleteValue(key); err != nil {
		return err
	}
	// Broadcast WM_SETTINGCHANGE so Explorer and new processes pick up the removal
	broadcastEnvironmentChange()
	return nil
}

// broadcastEnvironmentChange sends WM_SETTINGCHANGE to all top-level windows so
// that new processes started from Explorer/Taskbar inherit the updated env vars.
var (
	moduser32      = syscall.NewLazyDLL("user32.dll")
	procSendMessageTimeout = moduser32.NewProc("SendMessageTimeoutW")
)

const (
	wm_SETTINGCHANGE = 0x001A
	smto_ABORTIFHUNG = 0x0002
)

func broadcastEnvironmentChange() {
	envStr, _ := syscall.UTF16PtrFromString("Environment")
	procSendMessageTimeout.Call(
		uintptr(0xFFFF), // HWND_BROADCAST
		uintptr(wm_SETTINGCHANGE),
		0,
		uintptr(unsafe.Pointer(envStr)),
		uintptr(smto_ABORTIFHUNG),
		uintptr(5000), // 5 second timeout
		0, 0,
	)
}

const (
	windows_CREATE_NEW_PROCESS_GROUP = 0x00000200
	windows_DETACHED_PROCESS         = 0x00000008
)
