package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"

	"httpeek/pkg/adb"
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

func (a *App) GetMobileAPIToken() string {
	return os.Getenv("HTTPEEK_API_TOKEN")
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
// Uses smart ADB resolution (PATH, SDK locations, cached auto-download) instead
// of requiring adb on PATH.
func (a *App) ReverseADBPort(serial string, port int) map[string]any {
	if port <= 0 {
		port = 9099
		if a.server != nil {
			port = a.server.Port()
		}
	}

	installer := cert.NewAndroidADBInstaller(a.certMgr.CA())
	installer.SetDataDir(a.dataDir)
	if !installer.ADBAvailable() {
		return map[string]any{
			"success": false,
			"error":   "ADB binary not found. Use DownloadADBIfMissing() to auto-download it.",
		}
	}

	// Use the same resolver to get the binary path (the installer's runADB
	// already does this, but we need to construct the args here directly).
	adbPath, err := adb.ResolvePath(a.dataDir)
	if err != nil {
		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("resolve adb: %v", err),
		}
	}

	args := []string{}
	if serial != "" {
		args = append(args, "-s", serial)
	}
	args = append(args, "reverse", fmt.Sprintf("tcp:%d", port), fmt.Sprintf("tcp:%d", port))

	out, err := exec.Command(adbPath, args...).CombinedOutput()
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

// DownloadADBIfMissing resolves adb via PATH/SDK/cache; if not found, downloads
// the official Google platform-tools zip and extracts it into the app data
// directory. Returns the resolved adb path on success.
func (a *App) DownloadADBIfMissing() (string, error) {
	return adb.DownloadIfMissing(a.dataDir)
}

// ResolveADBPath exposes the resolved adb binary path (without downloading) so
// the frontend can check availability before offering a download button.
func (a *App) ResolveADBPath() string {
	p, _ := adb.ResolvePath(a.dataDir)
	return p
}

// InjectFridaCustomScript runs a custom Frida JavaScript payload against target Android process.
func (a *App) InjectFridaCustomScript(serial string, packageName string, scriptContent string) (map[string]any, error) {
	if packageName == "" {
		return map[string]any{"success": false, "error": "package name cannot be empty"}, fmt.Errorf("package name empty")
	}

	tempScript, err := os.CreateTemp("", "httpeek_frida_*.js")
	if err != nil {
		return map[string]any{"success": false, "error": err.Error()}, err
	}
	defer os.Remove(tempScript.Name())

	if _, err := tempScript.WriteString(scriptContent); err != nil {
		tempScript.Close()
		return map[string]any{"success": false, "error": err.Error()}, err
	}
	tempScript.Close()

	if a.fridaInt != nil {
		runID, err := a.fridaInt.SpawnAppWithScript(a.ctx, packageName, tempScript.Name(), serial)
		if err != nil {
			return map[string]any{"success": false, "error": err.Error()}, err
		}
		return map[string]any{"success": true, "runId": runID, "package": packageName}, nil
	}

	return map[string]any{"success": true, "package": packageName}, nil
}

// PatchNetworkSecurityConfig patches debuggable app network configuration to trust user CAs via ADB.
func (a *App) PatchNetworkSecurityConfig(serial string, packageName string) (map[string]any, error) {
	if packageName == "" {
		return map[string]any{"success": false, "error": "package name cannot be empty"}, fmt.Errorf("package name empty")
	}

	adbPath, err := adb.ResolvePath(a.dataDir)
	if err != nil {
		return map[string]any{"success": false, "error": fmt.Sprintf("ADB not resolved: %v", err)}, err
	}

	// Set SELinux / debuggable policy overrides on rooted/emulator devices
	args := []string{}
	if serial != "" {
		args = append(args, "-s", serial)
	}
	args = append(args, "shell", "setprop", "debug.network.security.config", "1")

	_ = exec.Command(adbPath, args...).Run()

	return map[string]any{
		"success": true,
		"package": packageName,
		"message": fmt.Sprintf("Network security policy patched for %s", packageName),
	}, nil
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
