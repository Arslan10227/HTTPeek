package system

import "runtime"

// SetSystemProxy enables or disables the OS system proxy (cross-platform).
func SetSystemProxy(enable bool, host string, port int, bypassDomains string) error {
	return setPlatformSystemProxy(enable, host, port, bypassDomains)
}

// GetSystemProxy reads whether the system proxy is enabled.
func GetSystemProxy() (bool, string, error) {
	return getPlatformSystemProxy()
}

// Platform returns the current OS identifier.
func Platform() string {
	return runtime.GOOS
}
