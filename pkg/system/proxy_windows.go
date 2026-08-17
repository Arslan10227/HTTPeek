package system

import (
	"fmt"
	"syscall"

	"golang.org/x/sys/windows/registry"
)

const internetSettingsPath = `Software\Microsoft\Windows\CurrentVersion\Internet Settings`

var (
	wininet               = syscall.NewLazyDLL("wininet.dll")
	procInternetSetOption = wininet.NewProc("InternetSetOptionW")
)

const (
	INTERNET_OPTION_SETTINGS_CHANGED = 39
	INTERNET_OPTION_REFRESH          = 42
)

func refreshWindowsProxySettings() {
	if procInternetSetOption != nil {
		_, _, _ = procInternetSetOption.Call(0, uintptr(INTERNET_OPTION_SETTINGS_CHANGED), 0, 0)
		_, _, _ = procInternetSetOption.Call(0, uintptr(INTERNET_OPTION_REFRESH), 0, 0)
	}
}

// SetWindowsSystemProxy enables or disables the Windows system proxy in the registry and flushes WinINet.
func SetWindowsSystemProxy(enable bool, host string, port int, bypassDomains string) error {
	key, err := registry.OpenKey(registry.CURRENT_USER, internetSettingsPath, registry.SET_VALUE|registry.QUERY_VALUE)
	if err != nil {
		return fmt.Errorf("open registry key failed: %w", err)
	}
	defer key.Close()

	if enable {
		proxyServer := fmt.Sprintf("%s:%d", host, port)
		if err := key.SetDWordValue("ProxyEnable", 1); err != nil {
			return fmt.Errorf("set ProxyEnable failed: %w", err)
		}
		if err := key.SetStringValue("ProxyServer", proxyServer); err != nil {
			return fmt.Errorf("set ProxyServer failed: %w", err)
		}
		if bypassDomains != "" {
			if err := key.SetStringValue("ProxyOverride", bypassDomains); err != nil {
				return fmt.Errorf("set ProxyOverride failed: %w", err)
			}
		} else {
			_ = key.SetStringValue("ProxyOverride", "<local>")
		}
	} else {
		if err := key.SetDWordValue("ProxyEnable", 0); err != nil {
			return fmt.Errorf("disable ProxyEnable failed: %w", err)
		}
	}

	// Immediately notify WinINet and running browsers of the proxy change
	refreshWindowsProxySettings()

	return nil
}

func setPlatformSystemProxy(enable bool, host string, port int, bypassDomains string) error {
	return SetWindowsSystemProxy(enable, host, port, bypassDomains)
}

func getPlatformSystemProxy() (bool, string, error) {
	return GetWindowsSystemProxy()
}

// GetWindowsSystemProxy reads the current proxy status from Windows registry.
func GetWindowsSystemProxy() (bool, string, error) {
	key, err := registry.OpenKey(registry.CURRENT_USER, internetSettingsPath, registry.QUERY_VALUE)
	if err != nil {
		return false, "", err
	}
	defer key.Close()

	enable, _, err := key.GetIntegerValue("ProxyEnable")
	if err != nil {
		return false, "", err
	}

	server, _, _ := key.GetStringValue("ProxyServer")
	return enable == 1, server, nil
}
