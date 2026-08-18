package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"httpeek/pkg/logger"
	"httpeek/pkg/proxy"
	"httpeek/pkg/system"
)

// GetStatus returns the current proxy runtime state.
func (a *App) GetStatus() map[string]any {
	a.mu.RLock()
	defer a.mu.RUnlock()

	running := false
	port := 9099
	ssl := true
	sysProxy := false

	if a.server != nil {
		running = a.server.IsRunning()
		cfg := a.server.Config()
		port = cfg.Port
		ssl = cfg.EnableSSL
		sysProxy = cfg.EnableSystemProxy
	}

	// Also check live OS system proxy status
	if osSysProxy, _, err := system.GetSystemProxy(); err == nil {
		sysProxy = sysProxy || osSysProxy
	}

	caInstalled := a.CheckCAInstalled()

	return map[string]any{
		"running":            running,
		"port":               port,
		"enableSsl":          ssl,
		"sslEnabled":         ssl,
		"systemProxy":        sysProxy,
		"systemProxyEnabled": sysProxy,
		"caInstalled":        caInstalled,
		"isCaInstalled":      caInstalled,
	}
}

// GetProxyStatus is an alias for GetStatus.
func (a *App) GetProxyStatus() map[string]any {
	return a.GetStatus()
}

// StartProxy starts the proxy server on the given port.
// When traffic capture is started, system proxy is automatically activated.
func (a *App) StartProxy(port int, enableSSL, enableSystemProxy bool) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if port <= 0 {
		if a.server != nil && a.server.Port() > 0 {
			port = a.server.Port()
		} else {
			port = 9099
		}
	}

	cfg := proxy.DefaultServerConfig()
	if a.server != nil {
		cfg = a.server.Config()
	}
	cfg.StorageDir = a.dataDir
	cfg.Port = port
	cfg.EnableSSL = enableSSL
	cfg.EnableSystemProxy = enableSystemProxy

	if a.server != nil && a.server.IsRunning() {
		_ = a.server.Stop()
	}

	a.server = proxy.NewServer(cfg, a.certMgr)
	a.server.SetInterceptor(a.chain)
	a.server.AddListener(&appEventListener{app: a})
	a.wireServices()
	a.attachMobileBridge()

	if err := a.server.Start(); err != nil {
		logger.Error("App", fmt.Sprintf("Failed to start proxy on port %d: %v", port, err))
		return err
	}

	logger.Info("App", fmt.Sprintf("Proxy capture successfully started on port %d (SSL: %v)", port, enableSSL))

	// Automatically activate system proxy when traffic capture starts
	if enableSystemProxy {
		if err := system.SetSystemProxy(true, "127.0.0.1", port, ""); err != nil {
			logger.Warn("App", fmt.Sprintf("Auto-enabling system proxy returned: %v", err))
		} else {
			logger.Info("App", fmt.Sprintf("System proxy automatically activated on 127.0.0.1:%d", port))
		}
	}

	return nil
}

// StopProxy stops the active proxy server and automatically deactivates system proxy.
func (a *App) StopProxy() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	// Automatically deactivate system proxy when traffic capture stops
	_ = system.SetSystemProxy(false, "", 0, "")
	logger.Info("App", "System proxy automatically deactivated")

	if a.server == nil || !a.server.IsRunning() {
		return nil
	}

	err := a.server.Stop()
	logger.Info("App", "Proxy capture stopped")
	return err
}

// Start begins proxy capture with current settings and auto-activates system proxy.
func (a *App) Start() error {
	return a.StartProxy(0, true, true)
}

// Stop stops the proxy server.
func (a *App) Stop() error {
	return a.StopProxy()
}

// SetPort is an alias for SetProxyPort.
func (a *App) SetPort(port int) error {
	return a.SetProxyPort(port)
}

// SetProxyPort updates the proxy listening port and restarts server if currently running.
func (a *App) SetProxyPort(port int) error {
	if port < 1 || port > 65535 {
		return fmt.Errorf("invalid port %d: must be between 1 and 65535", port)
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	isRunning := a.server != nil && a.server.IsRunning()
	ssl := true
	sysProxy := false
	if a.server != nil {
		ssl = a.server.Config().EnableSSL
		sysProxy = a.server.Config().EnableSystemProxy
		if isRunning {
			_ = a.server.Stop()
		}
	}

	cfg := proxy.DefaultServerConfig()
	cfg.StorageDir = a.dataDir
	cfg.Port = port
	cfg.EnableSSL = ssl
	cfg.EnableSystemProxy = sysProxy

	a.server = proxy.NewServer(cfg, a.certMgr)
	a.server.SetInterceptor(a.chain)
	a.server.AddListener(&appEventListener{app: a})
	a.wireServices()
	a.attachMobileBridge()

	if isRunning {
		if err := a.server.Start(); err != nil {
			logger.Error("App", fmt.Sprintf("Failed to restart proxy on new port %d: %v", port, err))
			return err
		}
		if sysProxy {
			_ = system.SetSystemProxy(true, "127.0.0.1", port, "")
		}
		logger.Info("App", fmt.Sprintf("Proxy restarted on new port %d", port))
	} else {
		logger.Info("App", fmt.Sprintf("Proxy port configured to %d", port))
	}

	return nil
}

// SetSSLEnabled toggles HTTPS / SSL decryption mode.
func (a *App) SetSSLEnabled(enabled bool) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.server == nil {
		return fmt.Errorf("proxy server not initialized")
	}

	cfg := a.server.Config()
	if cfg.EnableSSL == enabled {
		return nil
	}
	cfg.EnableSSL = enabled

	if a.server.IsRunning() {
		if err := a.server.Restart(&cfg); err != nil {
			logger.Error("App", fmt.Sprintf("Failed to restart proxy after SSL toggle: %v", err))
			return err
		}
	}
	logger.Info("App", fmt.Sprintf("HTTPS SSL decryption set to %v", enabled))
	return nil
}

// SetSystemProxy toggles system proxy configuration.
func (a *App) SetSystemProxy(enable bool) error {
	port := 9099
	if a.server != nil {
		port = a.server.Port()
	}
	logger.Info("App", fmt.Sprintf("Setting system proxy enable=%v port=%d", enable, port))
	return system.SetSystemProxy(enable, "127.0.0.1", port, "")
}

// SetExternalProxy configures an upstream proxy for traffic chaining.
func (a *App) SetExternalProxy(cfg map[string]any) error {
	host, _ := cfg["host"].(string)
	portVal := cfg["port"]
	enabled, _ := cfg["enabled"].(bool)
	proto, _ := cfg["protocol"].(string)
	if proto == "" {
		proto = "http"
	}

	var port int
	switch v := portVal.(type) {
	case float64:
		port = int(v)
	case int:
		port = v
	}

	if a.server != nil {
		serverCfg := a.server.Config()
		if enabled && host != "" && port > 0 {
			if !strings.HasPrefix(host, "http://") && !strings.HasPrefix(host, "https://") && !strings.HasPrefix(host, "socks5://") {
				serverCfg.UpstreamProxy = fmt.Sprintf("%s://%s:%d", proto, host, port)
			} else {
				serverCfg.UpstreamProxy = fmt.Sprintf("%s:%d", host, port)
			}
		} else {
			serverCfg.UpstreamProxy = ""
		}
		_ = a.server.Restart(&serverCfg)
	}
	logger.Info("App", fmt.Sprintf("External proxy configured: enabled=%v host=%s port=%d", enabled, host, port))
	return nil
}

// ResumeBreakpoint resumes a paused request or response from the GUI.
func (a *App) ResumeBreakpoint(requestID string, isResponse bool, modifiedJSON string) error {
	if a.breakInt == nil {
		return fmt.Errorf("breakpoint interceptor not initialized")
	}
	if isResponse {
		if modifiedJSON != "" && modifiedJSON != "{}" && modifiedJSON != "null" {
			var resp proxy.HttpResponse
			if err := json.Unmarshal([]byte(modifiedJSON), &resp); err == nil {
				if resp.BodyString != "" && len(resp.Body) == 0 {
					resp.Body = []byte(resp.BodyString)
				}
				a.breakInt.ResumeResponse(requestID, &resp)
				return nil
			}
		}
		a.breakInt.ResumeUnmodifiedResponse(requestID)
	} else {
		if modifiedJSON != "" && modifiedJSON != "{}" && modifiedJSON != "null" {
			var req proxy.HttpRequest
			if err := json.Unmarshal([]byte(modifiedJSON), &req); err == nil {
				if req.BodyString != "" && len(req.Body) == 0 {
					req.Body = []byte(req.BodyString)
				}
				a.breakInt.ResumeRequest(requestID, &req)
				return nil
			}
		}
		a.breakInt.ResumeUnmodifiedRequest(requestID)
	}
	return nil
}

// AbortBreakpoint aborts a paused request or response.
func (a *App) AbortBreakpoint(requestID string, isResponse bool) error {
	if a.breakInt == nil {
		return fmt.Errorf("breakpoint interceptor not initialized")
	}
	if isResponse {
		a.breakInt.AbortResponse(requestID)
	} else {
		a.breakInt.AbortRequest(requestID)
	}
	return nil
}
