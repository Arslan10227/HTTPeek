//go:build linux

package system

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func detectLaunchableAppsPlatform() []LaunchableApp {
	apps := []LaunchableApp{
		{ID: "chrome", Name: "Google Chrome", Icon: "chrome", Category: "browser", Description: "Web browser by Google"},
		{ID: "chromium", Name: "Chromium", Icon: "chromium", Category: "browser", Description: "Open-source web browser"},
		{ID: "edge", Name: "Microsoft Edge", Icon: "edge", Category: "browser", Description: "Web browser by Microsoft"},
		{ID: "firefox", Name: "Mozilla Firefox", Icon: "firefox", Category: "browser", Description: "Web browser by Mozilla"},
		{ID: "terminal", Name: "Terminal", Icon: "terminal", Category: "terminal", Description: "Linux terminal shell"},
		{ID: "node", Name: "Node.js", Icon: "node", Category: "runtime", Description: "JavaScript runtime"},
		{ID: "python", Name: "Python", Icon: "python", Category: "runtime", Description: "Python interpreter"},
	}

	for i := range apps {
		apps[i].Path = detectAppPathLinux(apps[i].ID)
		apps[i].Found = apps[i].Path != ""
	}

	return apps
}

func detectAppPathLinux(appID string) string {
	switch appID {
	case "chrome":
		for _, name := range []string{"google-chrome", "google-chrome-stable"} {
			if p, err := exec.LookPath(name); err == nil {
				return p
			}
		}
	case "chromium":
		for _, name := range []string{"chromium", "chromium-browser"} {
			if p, err := exec.LookPath(name); err == nil {
				return p
			}
		}
	case "edge":
		for _, name := range []string{"microsoft-edge", "microsoft-edge-stable"} {
			if p, err := exec.LookPath(name); err == nil {
				return p
			}
		}
	case "firefox":
		if p, err := exec.LookPath("firefox"); err == nil {
			return p
		}
	case "terminal":
		for _, name := range []string{"xterm", "gnome-terminal", "konsole", "xfce4-terminal", "alacritty", "kitty"} {
			if p, err := exec.LookPath(name); err == nil {
				return p
			}
		}
	case "node":
		if p, err := exec.LookPath("node"); err == nil {
			return p
		}
	case "python":
		if p, err := exec.LookPath("python3"); err == nil {
			return p
		}
		if p, err := exec.LookPath("python"); err == nil {
			return p
		}
	}
	return ""
}

func launchAppPlatform(appID, customPath, proxyHost string, proxyPort int, caCertPath string) LaunchResult {
	proxyURL := fmt.Sprintf("http://%s:%d", proxyHost, proxyPort)
	proxyEnv := map[string]string{
		"HTTP_PROXY":  proxyURL,
		"HTTPS_PROXY": proxyURL,
		"http_proxy":  proxyURL,
		"https_proxy": proxyURL,
		"NO_PROXY":    "localhost,127.0.0.1",
	}

	var path string
	var args []string
	env := make(map[string]string)
	for k, v := range proxyEnv {
		env[k] = v
	}

	switch appID {
	case "chrome", "edge", "chromium":
		path = customPath
		if path == "" {
			path = detectAppPathLinux(appID)
		}
		if path == "" {
			return LaunchResult{Success: false, Error: fmt.Sprintf("%s not found", appID), AppID: appID}
		}
		args = []string{"--proxy-server=" + proxyURL, "--proxy-bypass-list=localhost;127.0.0.1"}
	case "firefox":
		path = customPath
		if path == "" {
			path = detectAppPathLinux("firefox")
		}
		if path == "" {
			return LaunchResult{Success: false, Error: "firefox not found", AppID: appID}
		}
	case "terminal":
		path = customPath
		if path == "" {
			path = detectAppPathLinux("terminal")
		}
		if path == "" {
			return LaunchResult{Success: false, Error: "terminal not found", AppID: appID}
		}
	case "node":
		path = customPath
		if path == "" {
			path = detectAppPathLinux("node")
		}
		if path == "" {
			return LaunchResult{Success: false, Error: "node not found", AppID: appID}
		}
		if caCertPath != "" && fileExists(caCertPath) {
			env["NODE_EXTRA_CA_CERTS"] = caCertPath
		}
	case "python":
		path = customPath
		if path == "" {
			path = detectAppPathLinux("python")
		}
		if path == "" {
			return LaunchResult{Success: false, Error: "python not found", AppID: appID}
		}
		if caCertPath != "" && fileExists(caCertPath) {
			env["REQUESTS_CA_BUNDLE"] = caCertPath
			env["SSL_CERT_FILE"] = caCertPath
		}
	case "custom":
		if customPath == "" {
			return LaunchResult{Success: false, Error: "no executable path provided", AppID: appID}
		}
		if !fileExists(customPath) {
			return LaunchResult{Success: false, Error: fmt.Sprintf("executable not found: %s", customPath), AppID: appID}
		}
		path = customPath
	default:
		return LaunchResult{Success: false, Error: fmt.Sprintf("unknown app: %s", appID), AppID: appID}
	}

	cmd := exec.Command(path, args...)
	cmd.Env = append(os.Environ(), envToSliceLinux(env)...)
	if err := cmd.Start(); err != nil {
		return LaunchResult{Success: false, Error: fmt.Sprintf("launch failed: %v", err), AppID: appID}
	}
	pid := cmd.Process.Pid
	_ = cmd.Process.Release()

	return LaunchResult{
		Success:     true,
		PID:         pid,
		AppID:       appID,
		AppName:     getAppDisplayName(appID),
		ProcessName: filepath.Base(path),
	}
}

func envToSliceLinux(env map[string]string) []string {
	out := make([]string, 0, len(env))
	for k, v := range env {
		out = append(out, fmt.Sprintf("%s=%s", k, v))
	}
	return out
}

// --- Java Global Proxy ---

func setJavaGlobalProxyPlatform(enable bool, proxyHost string, proxyPort int, javaHome string) error {
	if enable {
		cacertsPath := findCacertsPathLinux(javaHome)
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
		// Set in current process env (affects child processes launched from HTTPeek)
		os.Setenv("JAVA_TOOL_OPTIONS", value)
		// Also write to profile file so Java apps launched from Terminal inherit it
		return writeJavaToolOptionsToProfile(value)
	}
	// Disable: remove from current env and profile
	os.Unsetenv("JAVA_TOOL_OPTIONS")
	return removeJavaToolOptionsFromProfile()
}

const javaToolOptionsMarker = "# HTTPEEK_JAVA_TOOL_OPTIONS_BEGIN"
const javaToolOptionsEndMarker = "# HTTPEEK_JAVA_TOOL_OPTIONS_END"

func writeJavaToolOptionsToProfile(value string) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	envFile := filepath.Join(home, ".httpeek_java_env")
	content := fmt.Sprintf("%s\nexport JAVA_TOOL_OPTIONS=\"%s\"\n%s\n", javaToolOptionsMarker, value, javaToolOptionsEndMarker)
	return os.WriteFile(envFile, []byte(content), 0644)
}

func removeJavaToolOptionsFromProfile() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	envFile := filepath.Join(home, ".httpeek_java_env")
	if fileExists(envFile) {
		return os.Remove(envFile)
	}
	return nil
}

func getJavaGlobalProxyStatusPlatform() JavaProxyStatus {
	// Check env var first (set in current process)
	val := os.Getenv("JAVA_TOOL_OPTIONS")
	if val == "" {
		// Check profile file
		home, _ := os.UserHomeDir()
		envFile := filepath.Join(home, ".httpeek_java_env")
		if data, err := os.ReadFile(envFile); err == nil {
			lines := strings.Split(string(data), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "export JAVA_TOOL_OPTIONS=") {
					val = strings.Trim(strings.TrimPrefix(line, "export JAVA_TOOL_OPTIONS="), "\"")
					break
				}
			}
		}
	}
	if val == "" {
		return JavaProxyStatus{Enabled: false}
	}
	status := JavaProxyStatus{Enabled: true}
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

func findCacertsPathLinux(javaHome string) string {
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
