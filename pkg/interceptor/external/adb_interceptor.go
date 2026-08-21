package external

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"httpeek/pkg/interceptor"
	"httpeek/pkg/logger"
	"httpeek/pkg/platform/helpers"
	"httpeek/pkg/storage"
)

// ADBDevice represents an Android device discovered via ADB.
type ADBDevice struct {
	Serial string `json:"serial"`
	State  string `json:"state"`
	Model  string `json:"model"`
}

// ADBInterceptor manages Android device network interception via ADB commands.
type ADBInterceptor struct {
	interceptor.BaseInterceptor
	repo      *storage.ExternalInterceptorRepo
	activeDev map[string]string // serial -> runID
	mu        sync.Mutex
}

// NewADBInterceptor creates a new ADBInterceptor.
func NewADBInterceptor(repo *storage.ExternalInterceptorRepo) *ADBInterceptor {
	base := interceptor.NewBaseInterceptor("ADBInterceptor", 65, true)
	return &ADBInterceptor{
		BaseInterceptor: base,
		repo:            repo,
		activeDev:       make(map[string]string),
	}
}

// runADB executes an ADB command with window suppression and full error logging.
func (a *ADBInterceptor) runADB(ctx context.Context, serial string, args ...string) (string, error) {
	adbBin := helpers.GetADBPath("")
	fullArgs := []string{}
	if serial != "" {
		fullArgs = append(fullArgs, "-s", serial)
	}
	fullArgs = append(fullArgs, args...)

	cmd := helpers.Command(ctx, adbBin, fullArgs...)
	out, err := cmd.CombinedOutput()
	trimmedOut := strings.TrimSpace(string(out))

	if err != nil {
		logger.Error("ADB", fmt.Sprintf("Command failed: %s %s -> err: %v (out: %s)", adbBin, strings.Join(fullArgs, " "), err, trimmedOut))
		return trimmedOut, fmt.Errorf("adb %s: %w (%s)", strings.Join(args, " "), err, trimmedOut)
	}

	logger.Info("ADB", fmt.Sprintf("Command succeeded: %s %s -> %s", adbBin, strings.Join(fullArgs, " "), trimmedOut))
	return trimmedOut, nil
}

// ListDevices returns all connected ADB devices.
func (a *ADBInterceptor) ListDevices(ctx context.Context) ([]ADBDevice, error) {
	out, err := a.runADB(ctx, "", "devices", "-l")
	if err != nil {
		return nil, fmt.Errorf("adb devices failed: %w", err)
	}

	var devices []ADBDevice
	lines := strings.Split(out, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "List of devices") || strings.HasPrefix(line, "*") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 2 {
			serial := fields[0]
			state := fields[1]
			model := ""
			for _, f := range fields[2:] {
				if strings.HasPrefix(f, "model:") {
					model = strings.TrimPrefix(f, "model:")
					model = strings.ReplaceAll(model, "_", " ")
				}
			}
			devices = append(devices, ADBDevice{
				Serial: serial,
				State:  state,
				Model:  model,
			})
		}
	}
	return devices, nil
}

// getPreferredHostLANIP returns a usable LAN IPv4 address of the desktop.
func getPreferredHostLANIP() string {
	ifaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range ifaces {
			if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
				continue
			}
			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}
			for _, addr := range addrs {
				var ip net.IP
				switch v := addr.(type) {
				case *net.IPNet:
					ip = v.IP
				case *net.IPAddr:
					ip = v.IP
				}
				if ip == nil || ip.IsLoopback() {
					continue
				}
				ip = ip.To4()
				if ip != nil && !ip.IsLinkLocalUnicast() {
					return ip.String()
				}
			}
		}
	}
	return "127.0.0.1"
}

// StartInterception sets up reverse port forwarding and global proxy on the target device with multi-tier fallback.
func (a *ADBInterceptor) StartInterception(ctx context.Context, serial string, proxyPort int) (string, error) {
	logger.Info("ADB", fmt.Sprintf("Starting ADB interception on device %s (Proxy Port: %d)", serial, proxyPort))

	var proxyHostPort string
	reversePortArg := fmt.Sprintf("tcp:%d", proxyPort)

	// --- Tier 1: Try ADB Reverse Port-Forward (localhost loopback) ---
	_, revErr := a.runADB(ctx, serial, "reverse", reversePortArg, reversePortArg)
	if revErr == nil {
		proxyHostPort = fmt.Sprintf("127.0.0.1:%d", proxyPort)
		logger.Info("ADB", fmt.Sprintf("ADB reverse succeeded: reverse %s -> %s on device %s", reversePortArg, proxyHostPort, serial))
	} else {
		// --- Tier 2: Fallback to Desktop LAN IP for Wi-Fi / Legacy Devices ---
		hostIP := getPreferredHostLANIP()
		proxyHostPort = fmt.Sprintf("%s:%d", hostIP, proxyPort)
		logger.Warn("ADB", fmt.Sprintf("ADB reverse failed (%v); falling back to Host LAN IP: %s", revErr, proxyHostPort))
	}

	// Set Android global HTTP proxy
	_, proxyErr := a.runADB(ctx, serial, "shell", "settings", "put", "global", "http_proxy", proxyHostPort)
	if proxyErr != nil {
		// Retry with su if rooted
		_, suErr := a.runADB(ctx, serial, "shell", "su", "-c", fmt.Sprintf("settings put global http_proxy %s", proxyHostPort))
		if suErr != nil {
			return "", fmt.Errorf("failed to configure Android global proxy: %w", proxyErr)
		}
	}

	// --- Tier 3: Reject UDP 443 (QUIC) so apps instantly fall back to TCP HTTP/1.1 or HTTP/2 without timeout ---
	_, _ = a.runADB(ctx, serial, "shell", "su", "-c", "'iptables -I OUTPUT -p udp --dport 443 -j REJECT 2>/dev/null || true'")

	// --- Tier 4: Show on-device notification ---
	_, _ = a.runADB(ctx, serial, "shell", "cmd", "notification", "post", "-S", "bigtext", "-t", "HTTPeek Interception Active", "httpeek", fmt.Sprintf("Traffic routing to HTTPeek Proxy on port %d", proxyPort))

	// Auto-Push SSL CA Certificate to Downloads
	scriptPath := helpers.GetFridaScriptPath()
	if scriptPath != "" {
		_, _ = a.runADB(ctx, serial, "push", scriptPath, "/data/local/tmp/ssl_unpinning.js")
	}

	runID := fmt.Sprintf("adb-%s-%d", serial, time.Now().UnixNano())

	a.mu.Lock()
	a.activeDev[serial] = runID
	a.mu.Unlock()

	if a.repo != nil {
		configJSON, _ := json.Marshal(map[string]any{
			"serial":    serial,
			"proxyPort": proxyPort,
			"proxyHost": proxyHostPort,
		})
		_ = a.repo.CreateRun(runID, a.Name(), 0, string(configJSON))
	}

	logger.Info("ADB", fmt.Sprintf("Interception active for %s with proxy %s (RunID: %s)", serial, proxyHostPort, runID))
	return runID, nil
}

// StopInterception restores device proxy settings and removes reverse port forward.
func (a *ADBInterceptor) StopInterception(ctx context.Context, serial string, proxyPort int) error {
	logger.Info("ADB", fmt.Sprintf("Stopping ADB interception on device %s", serial))

	// 1. Clear global proxy via settings put and delete
	_, _ = a.runADB(ctx, serial, "shell", "settings", "put", "global", "http_proxy", ":0")
	_, _ = a.runADB(ctx, serial, "shell", "settings", "delete", "global", "http_proxy")
	_, _ = a.runADB(ctx, serial, "shell", "settings", "delete", "global", "global_http_proxy_host")
	_, _ = a.runADB(ctx, serial, "shell", "settings", "delete", "global", "global_http_proxy_port")

	// 2. Remove reverse port forward
	reversePortArg := fmt.Sprintf("tcp:%d", proxyPort)
	_, _ = a.runADB(ctx, serial, "reverse", "--remove", reversePortArg)

	// 3. Clear iptables QUIC block rule
	_, _ = a.runADB(ctx, serial, "shell", "su", "-c", "'iptables -D OUTPUT -p udp --dport 443 -j REJECT 2>/dev/null || true'")

	// 4. Cancel on-device notification
	_, _ = a.runADB(ctx, serial, "shell", "cmd", "notification", "cancel", "httpeek")

	a.mu.Lock()
	runID := a.activeDev[serial]
	delete(a.activeDev, serial)
	a.mu.Unlock()

	if runID != "" && a.repo != nil {
		_ = a.repo.FinishRun(runID, "stopped")
	}

	logger.Info("ADB", fmt.Sprintf("Interception successfully stopped on device %s", serial))
	return nil
}
