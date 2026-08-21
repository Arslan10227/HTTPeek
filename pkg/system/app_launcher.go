package system

import "os"

// fileExists checks if a file exists at the given path.
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// LaunchableApp represents an application that can be launched and intercepted.
type LaunchableApp struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Icon        string `json:"icon"`
	Path        string `json:"path"`
	Found       bool   `json:"found"`
	Category    string `json:"category"`
	Description string `json:"description"`
}

// LaunchResult contains the outcome of a launch attempt.
type LaunchResult struct {
	Success   bool   `json:"success"`
	PID       int    `json:"pid,omitempty"`
	Error     string `json:"error,omitempty"`
	AppID     string `json:"appId"`
	AppName   string `json:"appName"`
	ProcessName string `json:"processName,omitempty"`
}

// JavaProxyStatus represents the current state of the global Java JVM proxy.
type JavaProxyStatus struct {
	Enabled      bool   `json:"enabled"`
	TrustStore   string `json:"trustStore,omitempty"`
	JavaHome     string `json:"javaHome,omitempty"`
	ProxyHost    string `json:"proxyHost,omitempty"`
	ProxyPort    int    `json:"proxyPort,omitempty"`
}

// LaunchApp launches an application with proxy settings auto-configured.
// proxyHost is typically "127.0.0.1", proxyPort is the proxy server port,
// and caCertPath is the filesystem path to the CA certificate PEM file.
func LaunchApp(appID, customPath, proxyHost string, proxyPort int, caCertPath string) LaunchResult {
	return launchAppPlatform(appID, customPath, proxyHost, proxyPort, caCertPath)
}

// DetectLaunchableApps scans the system for interceptable applications.
func DetectLaunchableApps() []LaunchableApp {
	return detectLaunchableAppsPlatform()
}

// SetJavaGlobalProxy enables or disables global JVM proxy settings.
// javaHome is the JAVA_HOME path (used to locate cacerts trustStore).
func SetJavaGlobalProxy(enable bool, proxyHost string, proxyPort int, javaHome string) error {
	return setJavaGlobalProxyPlatform(enable, proxyHost, proxyPort, javaHome)
}

// GetJavaGlobalProxyStatus returns whether global JVM proxy is active.
func GetJavaGlobalProxyStatus() JavaProxyStatus {
	return getJavaGlobalProxyStatusPlatform()
}

// getAppDisplayName returns a human-friendly name for an app ID.
func getAppDisplayName(appID string) string {
	switch appID {
	case "chrome":
		return "Google Chrome"
	case "edge":
		return "Microsoft Edge"
	case "firefox":
		return "Mozilla Firefox"
	case "safari":
		return "Safari"
	case "chromium":
		return "Chromium"
	case "terminal":
		return "Terminal"
	case "powershell":
		return "PowerShell"
	case "node":
		return "Node.js"
	case "python":
		return "Python"
	case "custom":
		return "Custom App"
	}
	return appID
}
