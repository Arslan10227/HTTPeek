//go:build !windows

package system

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

func setPlatformSystemProxy(enable bool, host string, port int, bypassDomains string) error {
	switch runtime.GOOS {
	case "darwin":
		return setDarwinSystemProxy(enable, host, port)
	case "linux":
		return setLinuxSystemProxy(enable, host, port)
	default:
		return fmt.Errorf("system proxy not supported on %s", runtime.GOOS)
	}
}

func getPlatformSystemProxy() (bool, string, error) {
	switch runtime.GOOS {
	case "darwin":
		out, err := exec.Command("networksetup", "-getwebproxy", "Wi-Fi").CombinedOutput()
		if err != nil {
			return false, "", err
		}
		enabled := strings.Contains(string(out), "Enabled: Yes")
		server := ""
		for _, line := range strings.Split(string(out), "\n") {
			if strings.HasPrefix(line, "Server:") {
				server = strings.TrimSpace(strings.TrimPrefix(line, "Server:"))
			}
		}
		return enabled, server, nil
	case "linux":
		out, err := exec.Command("gsettings", "get", "org.gnome.system.proxy", "mode").CombinedOutput()
		if err != nil {
			return false, "", err
		}
		mode := strings.Trim(strings.TrimSpace(string(out)), "'")
		return mode == "manual", "", nil
	default:
		return false, "", fmt.Errorf("system proxy status not supported on %s", runtime.GOOS)
	}
}

func setDarwinSystemProxy(enable bool, host string, port int) error {
	services := []string{"Wi-Fi", "Ethernet"}
	proxy := fmt.Sprintf("%s:%d", host, port)
	for _, svc := range services {
		if enable {
			_ = exec.Command("networksetup", "-setwebproxy", svc, host, fmt.Sprintf("%d", port)).Run()
			_ = exec.Command("networksetup", "-setsecurewebproxy", svc, host, fmt.Sprintf("%d", port)).Run()
			_ = exec.Command("networksetup", "-setwebproxystate", svc, "on").Run()
			_ = exec.Command("networksetup", "-setsecurewebproxystate", svc, "on").Run()
		} else {
			_ = exec.Command("networksetup", "-setwebproxystate", svc, "off").Run()
			_ = exec.Command("networksetup", "-setsecurewebproxystate", svc, "off").Run()
		}
		_ = proxy // silence unused in disable path
	}
	return nil
}

func setLinuxSystemProxy(enable bool, host string, port int) error {
	if enable {
		if err := exec.Command("gsettings", "set", "org.gnome.system.proxy", "mode", "manual").Run(); err != nil {
			return err
		}
		_ = exec.Command("gsettings", "set", "org.gnome.system.proxy.http", "host", host).Run()
		_ = exec.Command("gsettings", "set", "org.gnome.system.proxy.http", "port", fmt.Sprintf("%d", port)).Run()
		_ = exec.Command("gsettings", "set", "org.gnome.system.proxy.https", "host", host).Run()
		_ = exec.Command("gsettings", "set", "org.gnome.system.proxy.https", "port", fmt.Sprintf("%d", port)).Run()
		return nil
	}
	return exec.Command("gsettings", "set", "org.gnome.system.proxy", "mode", "none").Run()
}
