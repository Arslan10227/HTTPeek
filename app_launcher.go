package main

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"

	"httpeek/pkg/cert"
	"httpeek/pkg/interceptor/external"
	"httpeek/pkg/logger"
	"httpeek/pkg/platform/helpers"
	"httpeek/pkg/storage"
	"httpeek/pkg/system"
)


// DetectLaunchableApps scans the system for interceptable applications.
func (a *App) DetectLaunchableApps() []system.LaunchableApp {
	return system.DetectLaunchableApps()
}

// startProxyForIsolatedCapture starts the proxy server if not already running,
// WITHOUT enabling OS-wide system proxy. Used by per-app launch and Java global
// proxy flows so only the target process's own proxy config routes through
// HTTPeek — not every application on the machine.
func (a *App) startProxyForIsolatedCapture() error {
	if a.server != nil && a.server.IsRunning() {
		return nil
	}
	// enableSSL=true, enableSystemProxy=false — never touch OS-wide proxy here.
	return a.StartProxy(0, true, false)
}

// LaunchAndIntercept launches an app with proxy settings auto-configured.
// If the proxy is not running, it starts it first (without enabling OS-wide
// system proxy, so only the launched app routes through HTTPeek).
// If the CA is not installed, it returns an error prompting the user to install it.
func (a *App) LaunchAndIntercept(appID string) system.LaunchResult {
	// 1. Ensure proxy is running (isolated — no system-wide proxy)
	if a.server == nil || !a.server.IsRunning() {
		if err := a.startProxyForIsolatedCapture(); err != nil {
			return system.LaunchResult{
				Success: false,
				Error:   fmt.Sprintf("failed to start proxy: %v", err),
				AppID:   appID,
			}
		}
	}

	// 2. Get proxy port
	port := 9099
	if a.server != nil {
		port = a.server.Config().Port
	}

	// 3. Check CA is installed
	if !a.CheckCAInstalled() {
		return system.LaunchResult{
			Success: false,
			Error:   "Root CA is not installed. Please install it first in Settings > SSL Certificate.",
			AppID:   appID,
		}
	}

	// 4. Get CA cert path
	caCertPath := filepath.Join(a.dataDir, "certs", "ca.crt")

	// 5. Launch the app
	result := system.LaunchApp(appID, "", "127.0.0.1", port, caCertPath)
	if result.Success {
		logger.Info("Launcher", fmt.Sprintf("Launched %s (PID %d) with proxy 127.0.0.1:%d", appID, result.PID, port))
	}
	return result
}

// LaunchCustomApp launches a custom executable path with proxy settings.
// The proxy is started without enabling OS-wide system proxy so only this
// launched app routes through HTTPeek.
func (a *App) LaunchCustomApp(executablePath string) system.LaunchResult {
	if executablePath == "" {
		return system.LaunchResult{Success: false, Error: "no executable path provided"}
	}

	// Ensure proxy is running (isolated — no system-wide proxy)
	if a.server == nil || !a.server.IsRunning() {
		if err := a.startProxyForIsolatedCapture(); err != nil {
			return system.LaunchResult{
				Success: false,
				Error:   fmt.Sprintf("failed to start proxy: %v", err),
			}
		}
	}

	port := 9099
	if a.server != nil {
		port = a.server.Config().Port
	}

	caCertPath := filepath.Join(a.dataDir, "certs", "ca.crt")
	result := system.LaunchApp("custom", executablePath, "127.0.0.1", port, caCertPath)
	if result.Success {
		logger.Info("Launcher", fmt.Sprintf("Launched custom app %s (PID %d) with proxy 127.0.0.1:%d", executablePath, result.PID, port))
	}
	return result
}

// SetJavaGlobalProxy enables or disables global JVM proxy settings via JAVA_TOOL_OPTIONS.
// When enabling, it auto-starts the proxy if not running, auto-installs the CA into
// Java cacerts if not already installed, and sets JAVA_TOOL_OPTIONS for all Java apps.
func (a *App) SetJavaGlobalProxy(enable bool) error {
	if enable {
		// 1. Ensure proxy is running (isolated — no system-wide proxy, so only
		//    Java apps with JAVA_TOOL_OPTIONS route through HTTPeek)
		if a.server == nil || !a.server.IsRunning() {
			if err := a.startProxyForIsolatedCapture(); err != nil {
				return fmt.Errorf("failed to start proxy: %w", err)
			}
		}

		// 2. Ensure CA is installed in OS trust store
		if !a.CheckCAInstalled() {
			if err := a.InstallRootCA(); err != nil {
				return fmt.Errorf("failed to install Root CA: %w", err)
			}
		}
	}

	port := 9099
	if a.server != nil {
		port = a.server.Config().Port
	}

	// Find a Java installation to get the cacerts path
	javaHome := ""
	if a.javaMgr != nil {
		installs := a.javaMgr.DetectInstallations()
		if len(installs) > 0 {
			javaHome = installs[0].Path

			// 3. Auto-install CA into Java cacerts if not already installed
			if enable {
				for _, inst := range installs {
					if !inst.IsInstalled {
						logger.Info("Launcher", fmt.Sprintf("Auto-installing CA into Java cacerts: %s", inst.Path))
						if err := a.javaMgr.InstallCert(inst); err != nil {
							logger.Warn("Launcher", fmt.Sprintf("auto-install CA to %s failed: %v", inst.Path, err))
						}
					}
				}
			}
		}
	}

	if err := system.SetJavaGlobalProxy(enable, "127.0.0.1", port, javaHome); err != nil {
		return fmt.Errorf("set java global proxy: %w", err)
	}

	logger.Info("Launcher", fmt.Sprintf("Java global proxy %s (port %d, javaHome=%s)", boolToStr(enable), port, javaHome))
	return nil
}

// GetJavaGlobalProxyStatus returns whether global JVM proxy is currently active.
func (a *App) GetJavaGlobalProxyStatus() system.JavaProxyStatus {
	return system.GetJavaGlobalProxyStatus()
}

// GetLaunchableAppCAs returns Java installations for the launch panel to display
// trust store status. This reuses the existing Java detection logic.
func (a *App) GetLaunchableAppCAs() []cert.JavaInstallation {
	if a.javaMgr == nil {
		if a.certMgr != nil && a.certMgr.CA() != nil {
			a.javaMgr = cert.NewJavaManager(a.certMgr.CA())
		} else {
			return nil
		}
	}
	return a.javaMgr.DetectInstallations()
}

func boolToStr(b bool) string {
	if b {
		return "enabled"
	}
	return "disabled"
}

// --- External Interceptor Methods ---

// ListJVMTargets scans the system for running attachable JVM processes.
func (a *App) ListJVMTargets() ([]external.JVMTarget, error) {
	if a.jvmInt == nil {
		if a.externalInterceptorRepo != nil {
			a.jvmInt = external.NewJVMInterceptor(a.externalInterceptorRepo, helpers.GetJVMAgentJarPath())
		} else {
			return nil, fmt.Errorf("external interceptor repo not initialized")
		}
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return a.jvmInt.ListTargets(ctx)
}

// AttachJVM attaches the HTTPeek JVM agent to a running Java process by PID.
func (a *App) AttachJVM(pid int, nonProxyHosts string) error {
	_ = a.startProxyForIsolatedCapture()
	port := 9099
	if a.server != nil {
		port = a.server.Config().Port
	}
	caCertPath := filepath.Join(a.dataDir, "certs", "ca.crt")

	if a.jvmInt == nil {
		a.jvmInt = external.NewJVMInterceptor(a.externalInterceptorRepo, helpers.GetJVMAgentJarPath())
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return a.jvmInt.Attach(ctx, pid, "127.0.0.1", port, caCertPath, nonProxyHosts)
}

// LaunchJVMApp launches a Java application JAR with the HTTPeek agent preloaded.
func (a *App) LaunchJVMApp(jarPath string, args []string, nonProxyHosts string) (string, error) {
	_ = a.startProxyForIsolatedCapture()
	port := 9099
	if a.server != nil {
		port = a.server.Config().Port
	}
	caCertPath := filepath.Join(a.dataDir, "certs", "ca.crt")

	if a.jvmInt == nil {
		a.jvmInt = external.NewJVMInterceptor(a.externalInterceptorRepo, helpers.GetJVMAgentJarPath())
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return a.jvmInt.LaunchApplication(ctx, jarPath, args, "127.0.0.1", port, caCertPath, nonProxyHosts)
}

// LaunchTerminal starts an interactive terminal configured with all proxy environment variables.
func (a *App) LaunchTerminal(shellType string, nonProxyHosts string) (string, error) {
	_ = a.startProxyForIsolatedCapture()
	port := 9099
	if a.server != nil {
		port = a.server.Config().Port
	}
	caCertPath := filepath.Join(a.dataDir, "certs", "ca.crt")

	if a.termInt == nil {
		a.termInt = external.NewTerminalInterceptor(a.externalInterceptorRepo)
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return a.termInt.LaunchTerminal(ctx, shellType, "127.0.0.1", port, caCertPath, nonProxyHosts)
}

// LaunchBrowserInterceptor spawns an isolated browser window targeting HTTPeek.
func (a *App) LaunchBrowserInterceptor(browserPath string, bType string, url string) (string, error) {
	_ = a.startProxyForIsolatedCapture()
	port := 9099
	if a.server != nil {
		port = a.server.Config().Port
	}
	caCertPath := filepath.Join(a.dataDir, "certs", "ca.crt")

	if a.browserInt == nil {
		a.browserInt = external.NewBrowserInterceptor(a.externalInterceptorRepo)
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return a.browserInt.LaunchBrowser(ctx, browserPath, external.BrowserType(bType), url, "127.0.0.1", port, caCertPath)
}

// LaunchElectronApp launches an Electron binary with proxy flags.
func (a *App) LaunchElectronApp(appPath string, args []string) (string, error) {
	_ = a.startProxyForIsolatedCapture()
	port := 9099
	if a.server != nil {
		port = a.server.Config().Port
	}
	caCertPath := filepath.Join(a.dataDir, "certs", "ca.crt")

	if a.electronInt == nil {
		a.electronInt = external.NewElectronInterceptor(a.externalInterceptorRepo)
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return a.electronInt.LaunchElectronApp(ctx, appPath, args, "127.0.0.1", port, caCertPath)
}

// StartADBInterception configures reverse port-forwarding and device proxy for Android.
func (a *App) StartADBInterception(serial string) (string, error) {
	logger.Info("AppLauncher", fmt.Sprintf("StartADBInterception called for device serial: %s", serial))
	_ = a.startProxyForIsolatedCapture()
	port := 9099
	if a.server != nil {
		port = a.server.Config().Port
	}
	if a.adbInt == nil {
		a.adbInt = external.NewADBInterceptor(a.externalInterceptorRepo)
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	// Auto-install Root CA certificate to Android device
	if a.certMgr != nil && a.certMgr.CA() != nil {
		inst := cert.NewAndroidADBInstaller(a.certMgr.CA())
		inst.SetDataDir(a.dataDir)
		go func() {
			certRes := inst.Install(serial, "127.0.0.1", port)
			logger.Info("AppLauncher", fmt.Sprintf("Auto Root CA install result for %s: %d steps executed", serial, len(certRes.Steps)))
		}()
	}

	runID, err := a.adbInt.StartInterception(ctx, serial, port)
	if err != nil {
		logger.Error("AppLauncher", fmt.Sprintf("StartADBInterception failed for %s: %v", serial, err))
		return "", err
	}
	logger.Info("AppLauncher", fmt.Sprintf("StartADBInterception succeeded for %s (RunID: %s)", serial, runID))
	return runID, nil
}

// StopADBInterception clears Android device global proxy and port forward.
func (a *App) StopADBInterception(serial string) error {
	logger.Info("AppLauncher", fmt.Sprintf("StopADBInterception called for device serial: %s", serial))
	port := 9099
	if a.server != nil {
		port = a.server.Config().Port
	}
	if a.adbInt == nil {
		a.adbInt = external.NewADBInterceptor(a.externalInterceptorRepo)
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	err := a.adbInt.StopInterception(ctx, serial, port)
	if err != nil {
		logger.Error("AppLauncher", fmt.Sprintf("StopADBInterception failed for %s: %v", serial, err))
		return err
	}
	logger.Info("AppLauncher", fmt.Sprintf("StopADBInterception succeeded for %s", serial))
	return nil
}

// LaunchFrida starts a Frida script injection on a mobile or desktop process.
func (a *App) LaunchFrida(app string, scriptPath string, deviceSerial string) (string, error) {
	logger.Info("AppLauncher", fmt.Sprintf("LaunchFrida called for app: %s, device: %s, script: %s", app, deviceSerial, scriptPath))
	_ = a.startProxyForIsolatedCapture()
	if scriptPath == "" {
		scriptPath = helpers.GetFridaScriptPath()
	}

	port := 9099
	if a.server != nil {
		port = a.server.Config().Port
	}

	// When targeting an Android device, first configure ADB reverse proxy so that
	// traffic from the device actually reaches HTTPeek while Frida does SSL unpinning.
	if deviceSerial != "" {
		if a.adbInt == nil {
			a.adbInt = external.NewADBInterceptor(a.externalInterceptorRepo)
		}
		adbCtx := a.ctx
		if adbCtx == nil {
			adbCtx = context.Background()
		}
		if _, adbErr := a.adbInt.StartInterception(adbCtx, deviceSerial, port); adbErr != nil {
			logger.Warn("AppLauncher", fmt.Sprintf("ADB proxy setup for Frida session failed (non-fatal): %v", adbErr))
		} else {
			logger.Info("AppLauncher", fmt.Sprintf("ADB reverse proxy configured for Frida session on %s", deviceSerial))
		}
	}

	// Strategy 1: On-device native injection via ADB (100% standalone, 0 host dependencies)
	if deviceSerial != "" && a.certMgr != nil && a.certMgr.CA() != nil {
		inst := cert.NewAndroidADBInstaller(a.certMgr.CA())
		inst.SetDataDir(a.dataDir)
		runID, err := inst.InjectScriptOnDevice(deviceSerial, app, false, scriptPath)
		if err == nil && runID != "" {
			logger.Info("AppLauncher", fmt.Sprintf("On-device Frida injection succeeded for %s (RunID: %s)", app, runID))
			if a.externalInterceptorRepo != nil {
				configJSON, _ := json.Marshal(map[string]any{
					"app":    app,
					"script": scriptPath,
					"device": deviceSerial,
					"mode":   "on-device-inject",
				})
				_ = a.externalInterceptorRepo.CreateRun(runID, "FridaInterceptor", 0, string(configJSON))
			}
			return runID, nil
		}
		logger.Warn("AppLauncher", fmt.Sprintf("On-device injection fell back: %v", err))
		_ = inst.DeployAndStartFridaServer(deviceSerial)
	}

	// Strategy 2: Fallback to host Frida CLI
	if a.fridaInt == nil {
		a.fridaInt = external.NewFridaInterceptor(a.externalInterceptorRepo)
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	runID, err := a.fridaInt.SpawnAppWithScript(ctx, app, scriptPath, deviceSerial)
	if err != nil {
		logger.Error("AppLauncher", fmt.Sprintf("LaunchFrida failed for %s: %v", app, err))
		return "", err
	}
	logger.Info("AppLauncher", fmt.Sprintf("LaunchFrida succeeded for %s (RunID: %s)", app, runID))
	return runID, nil
}

// StopFrida terminates a running Frida process.
// Handles both host-CLI runs (frida-...) and on-device native runs (frida-native-...).
func (a *App) StopFrida(runID string) error {
	logger.Info("AppLauncher", fmt.Sprintf("StopFrida called for RunID: %s", runID))

	// Native on-device injection: kill the background process on the Android device.
	if strings.HasPrefix(runID, "frida-native-") {
		// Retrieve device serial and app target from stored run config.
		if a.externalInterceptorRepo != nil {
			runs, _ := a.externalInterceptorRepo.ListRuns(200)
			for _, r := range runs {
				if r.ID == runID && r.Config.Valid {
					var cfg map[string]any
					if err := json.Unmarshal([]byte(r.Config.String), &cfg); err == nil {
						serial, _ := cfg["device"].(string)
						app, _ := cfg["app"].(string)
						if serial != "" && a.certMgr != nil && a.certMgr.CA() != nil {
							inst := cert.NewAndroidADBInstaller(a.certMgr.CA())
							inst.SetDataDir(a.dataDir)
							inst.KillOnDeviceFrida(serial, app)
						}
						// Also clean up ADB proxy
						if serial != "" {
							port := 9099
							if a.server != nil {
								port = a.server.Config().Port
							}
							if a.adbInt == nil {
								a.adbInt = external.NewADBInterceptor(a.externalInterceptorRepo)
							}
							adbCtx := a.ctx
							if adbCtx == nil {
								adbCtx = context.Background()
							}
							_ = a.adbInt.StopInterception(adbCtx, serial, port)
						}
					}
				}
			}
		}
		// Mark run as stopped in DB
		if a.externalInterceptorRepo != nil {
			_ = a.externalInterceptorRepo.FinishRun(runID, "stopped")
		}
		return nil
	}

	// Host-side Frida CLI process
	if a.fridaInt == nil {
		return fmt.Errorf("frida interceptor not initialized")
	}
	return a.fridaInt.StopScript(runID)
}

// ListAndroidInstalledApps returns third-party and user-installed apps on connected Android device.
func (a *App) ListAndroidInstalledApps(serial string) ([]cert.AndroidAppInfo, error) {
	logger.Info("AppLauncher", fmt.Sprintf("ListAndroidInstalledApps called for device: %s", serial))
	if a.certMgr == nil || a.certMgr.CA() == nil {
		return []cert.AndroidAppInfo{}, nil
	}
	inst := cert.NewAndroidADBInstaller(a.certMgr.CA())
	inst.SetDataDir(a.dataDir)
	apps, err := inst.ListInstalledApps(serial)
	if err != nil {
		logger.Error("AppLauncher", fmt.Sprintf("ListInstalledApps failed for %s: %v", serial, err))
		return nil, err
	}
	logger.Info("AppLauncher", fmt.Sprintf("Found %d installed apps on %s", len(apps), serial))
	return apps, nil
}

// ListAndroidRunningApps returns running processes and apps on connected Android device.
func (a *App) ListAndroidRunningApps(serial string) ([]cert.AndroidAppInfo, error) {
	logger.Info("AppLauncher", fmt.Sprintf("ListAndroidRunningApps called for device: %s", serial))
	if a.certMgr == nil || a.certMgr.CA() == nil {
		return []cert.AndroidAppInfo{}, nil
	}
	inst := cert.NewAndroidADBInstaller(a.certMgr.CA())
	inst.SetDataDir(a.dataDir)
	apps, err := inst.ListRunningApps(serial)
	if err != nil {
		logger.Error("AppLauncher", fmt.Sprintf("ListRunningApps failed for %s: %v", serial, err))
		return nil, err
	}
	logger.Info("AppLauncher", fmt.Sprintf("Found %d running apps on %s", len(apps), serial))
	return apps, nil
}

// DeployFridaServer pushes and starts the matching bundled frida-server on Android.
func (a *App) DeployFridaServer(deviceSerial string) error {
	logger.Info("AppLauncher", fmt.Sprintf("DeployFridaServer called for device: %s", deviceSerial))
	if a.certMgr == nil || a.certMgr.CA() == nil {
		return fmt.Errorf("certificate manager not initialized")
	}
	inst := cert.NewAndroidADBInstaller(a.certMgr.CA())
	inst.SetDataDir(a.dataDir)
	err := inst.DeployAndStartFridaServer(deviceSerial)
	if err != nil {
		logger.Error("AppLauncher", fmt.Sprintf("DeployFridaServer failed for %s: %v", deviceSerial, err))
		return err
	}
	logger.Info("AppLauncher", fmt.Sprintf("DeployFridaServer succeeded for %s", deviceSerial))
	return nil
}

// LaunchFridaAttach hooks into an already running app or process on Android or desktop.
func (a *App) LaunchFridaAttach(targetAppOrPid string, scriptPath string, deviceSerial string) (string, error) {
	logger.Info("AppLauncher", fmt.Sprintf("LaunchFridaAttach called for target: %s, device: %s, script: %s", targetAppOrPid, deviceSerial, scriptPath))
	_ = a.startProxyForIsolatedCapture()
	if scriptPath == "" {
		scriptPath = helpers.GetFridaScriptPath()
	}

	// Strategy 1: On-device native attach via ADB
	if deviceSerial != "" && a.certMgr != nil && a.certMgr.CA() != nil {
		inst := cert.NewAndroidADBInstaller(a.certMgr.CA())
		inst.SetDataDir(a.dataDir)
		isPid := false
		if _, numErr := strconv.Atoi(targetAppOrPid); numErr == nil {
			isPid = true
		}
		runID, err := inst.InjectScriptOnDevice(deviceSerial, targetAppOrPid, isPid, scriptPath)
		if err == nil && runID != "" {
			logger.Info("AppLauncher", fmt.Sprintf("On-device Frida attach succeeded for %s (RunID: %s)", targetAppOrPid, runID))
			if a.externalInterceptorRepo != nil {
				configJSON, _ := json.Marshal(map[string]any{
					"target": targetAppOrPid,
					"script": scriptPath,
					"device": deviceSerial,
					"mode":   "on-device-attach",
				})
				_ = a.externalInterceptorRepo.CreateRun(runID, "FridaInterceptor", 0, string(configJSON))
			}
			return runID, nil
		}
		logger.Warn("AppLauncher", fmt.Sprintf("On-device attach fell back: %v", err))
		_ = inst.DeployAndStartFridaServer(deviceSerial)
	}

	// Strategy 2: Fallback to host Frida CLI
	if a.fridaInt == nil {
		a.fridaInt = external.NewFridaInterceptor(a.externalInterceptorRepo)
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	runID, err := a.fridaInt.AttachAppWithScript(ctx, targetAppOrPid, scriptPath, deviceSerial)
	if err != nil {
		logger.Error("AppLauncher", fmt.Sprintf("LaunchFridaAttach failed for %s: %v", targetAppOrPid, err))
		return "", err
	}
	logger.Info("AppLauncher", fmt.Sprintf("LaunchFridaAttach succeeded for %s (RunID: %s)", targetAppOrPid, runID))
	return runID, nil
}

// ListExternalRuns returns recent external interceptor execution records.
func (a *App) ListExternalRuns() ([]storage.ExternalInterceptorRun, error) {
	if a.externalInterceptorRepo == nil {
		return nil, nil
	}
	return a.externalInterceptorRepo.ListRuns(50)
}

// ListActiveExternalRuns returns only interceptor runs that are currently active (not stopped).
// The frontend polling loop calls this to avoid rehydrating stale past-session entries.
func (a *App) ListActiveExternalRuns() ([]storage.ExternalInterceptorRun, error) {
	if a.externalInterceptorRepo == nil {
		return nil, nil
	}
	return a.externalInterceptorRepo.ListActiveRuns()
}
