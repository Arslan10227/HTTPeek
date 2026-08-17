package services

import (
	"fmt"
	"sync"

	"httpeek/pkg/cert"
	"httpeek/pkg/proxy"
	"httpeek/pkg/system"
)

// ProxyService manages proxy server lifecycle.
type ProxyService struct {
	mu      sync.RWMutex
	server  *proxy.Server
	certMgr *cert.CertificateManager
	chain   proxy.Interceptor
}

// NewProxyService creates a proxy service.
func NewProxyService(server *proxy.Server, certMgr *cert.CertificateManager, chain proxy.Interceptor) *ProxyService {
	return &ProxyService{server: server, certMgr: certMgr, chain: chain}
}

// SetServer updates the active server reference (after restart).
func (s *ProxyService) SetServer(server *proxy.Server) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.server = server
}

// Start starts or restarts the proxy on the given port.
func (s *ProxyService) Start(port int, enableSSL, enableSystemProxy bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	cfg := s.server.Config()
	cfg.Port = port
	cfg.EnableSSL = enableSSL
	cfg.EnableSystemProxy = enableSystemProxy

	if s.server.IsRunning() {
		_ = s.server.Stop()
	}

	s.server = proxy.NewServer(cfg, s.certMgr)
	s.server.SetInterceptor(s.chain)

	if err := s.server.Start(); err != nil {
		return err
	}

	if enableSystemProxy {
		_ = system.SetSystemProxy(true, "127.0.0.1", port, "")
	}
	return nil
}

// Stop stops the proxy and disables system proxy if enabled.
func (s *ProxyService) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.server.Config().EnableSystemProxy {
		_ = system.SetSystemProxy(false, "", 0, "")
	}
	return s.server.Stop()
}

// Status returns current proxy runtime state.
func (s *ProxyService) Status() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	running := s.server.IsRunning()
	cfg := s.server.Config()
	sysProxy := cfg.EnableSystemProxy
	if running {
		if enabled, _, err := system.GetSystemProxy(); err == nil {
			sysProxy = enabled
		}
	}

	return map[string]any{
		"running":     running,
		"port":        cfg.Port,
		"enableSsl":   cfg.EnableSSL,
		"systemProxy": sysProxy,
	}
}

// SetSystemProxy toggles OS-level proxy settings.
func (s *ProxyService) SetSystemProxy(enable bool) error {
	s.mu.RLock()
	port := s.server.Port()
	s.mu.RUnlock()
	return system.SetSystemProxy(enable, "127.0.0.1", port, "")
}

// Server returns the underlying proxy server.
func (s *ProxyService) Server() *proxy.Server {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.server
}

// Restart recreates server with updated config.
func (s *ProxyService) Restart(cfg proxy.ServerConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.server.Restart(&cfg); err != nil {
		return err
	}
	if cfg.EnableSystemProxy {
		return system.SetSystemProxy(true, "127.0.0.1", cfg.Port, "")
	}
	return nil
}

// EnsureRunning validates server is bound.
func (s *ProxyService) EnsureRunning() error {
	if !s.server.IsRunning() {
		return fmt.Errorf("proxy is not running")
	}
	return nil
}
