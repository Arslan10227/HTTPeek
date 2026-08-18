package main

import (
	"fmt"
	"os/exec"
	"strings"

	"httpeek/pkg/cert"
	"httpeek/pkg/proxy"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// GetConnectedMobileDevices returns a list of active Android/iOS devices paired with desktop.
func (a *App) GetConnectedMobileDevices() []proxy.MobileDeviceInfo {
	if a.server != nil && a.server.MobileAPI() != nil {
		return a.server.MobileAPI().GetConnectedDevices()
	}
	return []proxy.MobileDeviceInfo{}
}

// DisconnectMobileDevice disconnects a target mobile device.
func (a *App) DisconnectMobileDevice(deviceID string) {
	if a.server != nil && a.server.MobileAPI() != nil {
		a.server.MobileAPI().DisconnectDevice(deviceID)
	}
}

// SendRemoteMobileCommand sends a remote instruction (e.g. remote:vpn_start, remote:vpn_stop, remote:traffic_clear) to a mobile companion.
func (a *App) SendRemoteMobileCommand(deviceID, command string, data any) error {
	if a.server != nil && a.server.MobileAPI() != nil {
		return a.server.MobileAPI().SendRemoteCommand(deviceID, command, data)
	}
	return nil
}

// SyncRulesToMobile broadcasts all active desktop rules (Rewrite, Mock, Whitelist, Blacklist) to mobile companions.
func (a *App) SyncRulesToMobile(deviceID string) error {
	rules := a.GetAllRules()
	if a.server != nil && a.server.MobileAPI() != nil {
		return a.server.MobileAPI().SendRemoteCommand(deviceID, "rules:sync", rules)
	}
	return nil
}

// ReverseADBPort executes `adb reverse tcp:PORT tcp:PORT` for 1-click USB tethering without Wi-Fi dependencies.
func (a *App) ReverseADBPort(serial string, port int) map[string]any {
	if port <= 0 {
		port = 9099
		if a.server != nil {
			port = a.server.Port()
		}
	}

	installer := cert.NewAndroidADBInstaller(a.certMgr.CA())
	if !installer.ADBAvailable() {
		return map[string]any{
			"success": false,
			"error":   "ADB binary not found in system PATH",
		}
	}

	args := []string{}
	if serial != "" {
		args = append(args, "-s", serial)
	}
	args = append(args, "reverse", fmt.Sprintf("tcp:%d", port), fmt.Sprintf("tcp:%d", port))

	out, err := exec.Command("adb", args...).CombinedOutput()
	if err != nil {
		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("%v (%s)", err, strings.TrimSpace(string(out))),
		}
	}

	return map[string]any{
		"success": true,
		"port":    port,
		"serial":  serial,
		"message": fmt.Sprintf("Reverse tunnel active: tcp:%d -> tcp:%d", port, port),
	}
}

// WireMobileEvents registers real-time device change callbacks with Wails runtime.
func (a *App) wireMobileEvents() {
	if a.server != nil && a.server.MobileAPI() != nil {
		a.server.MobileAPI().SetOnDeviceChange(func(devices []proxy.MobileDeviceInfo) {
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "mobile:devices_changed", devices)
			}
		})
	}
}
