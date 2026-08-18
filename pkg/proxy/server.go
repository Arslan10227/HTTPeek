package proxy

import (
	"context"
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"httpeek/pkg/cert"
	"httpeek/pkg/logger"
)

// ServerConfig defines options for starting the proxy server.
type ServerConfig struct {
	Port                 int           `json:"port"`
	EnableSSL            bool          `json:"enableSsl"`
	EnableSOCKS5         bool          `json:"enableSocks5"`
	EnableSystemProxy    bool          `json:"enableSystemProxy"`
	ReadTimeout          time.Duration `json:"readTimeout"`
	WriteTimeout         time.Duration `json:"writeTimeout"`
	StorageDir           string        `json:"storageDir"`
	MaxRequestBodyBytes  int64         `json:"maxRequestBodyBytes"`
	MaxResponseBodyBytes int64         `json:"maxResponseBodyBytes"`
	MaxConnections       int           `json:"maxConnections"`
	UpstreamProxy        string        `json:"upstreamProxy,omitempty"` // http://user:pass@host:port or socks5://...
}

// DefaultServerConfig returns standard defaults.
func DefaultServerConfig() ServerConfig {
	return ServerConfig{
		Port:                 9099,
		EnableSSL:            true,
		EnableSOCKS5:         true,
		EnableSystemProxy:    false,
		ReadTimeout:          60 * time.Second,
		WriteTimeout:         60 * time.Second,
		MaxRequestBodyBytes:  16 * 1024 * 1024,
		MaxResponseBodyBytes: 16 * 1024 * 1024,
		MaxConnections:       1000,
	}
}

// Server is the core HTTP/HTTPS/WebSocket/SOCKS5 intercepting proxy server.
type Server struct {
	cfg          ServerConfig
	listener     net.Listener
	certManager  *cert.CertificateManager
	interceptor  Interceptor
	handler      *Handler
	discovery    *DiscoveryBroadcaster
	listeners    []EventListener
	listenersMu  sync.RWMutex
	mobileBridge MobileAPIBridge
	running      atomic.Bool
	activeConns  atomic.Int64
	ctx          context.Context
	cancel       context.CancelFunc
	wg           sync.WaitGroup
}

// NewServer initializes a new Server instance.
func NewServer(cfg ServerConfig, certMgr *cert.CertificateManager) *Server {
	ctx, cancel := context.WithCancel(context.Background())
	s := &Server{
		cfg:         cfg,
		certManager: certMgr,
		ctx:         ctx,
		cancel:      cancel,
		discovery:   NewDiscoveryBroadcaster(cfg.Port),
	}
	s.handler = NewHandler(s)
	return s
}

// SetInterceptor sets the interceptor chain for traffic mutation.
func (s *Server) SetInterceptor(i Interceptor) {
	s.interceptor = i
}

// Interceptor returns the active interceptor chain.
func (s *Server) Interceptor() Interceptor {
	return s.interceptor
}

// Start binds the TCP port and begins accepting connections.
func (s *Server) Start() error {
	if s.running.Load() {
		return fmt.Errorf("server is already running on port %d", s.cfg.Port)
	}

	addr := fmt.Sprintf(":%d", s.cfg.Port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		logger.Error("Proxy", fmt.Sprintf("Failed to bind proxy listener on port %d: %v", s.cfg.Port, err))
		return fmt.Errorf("bind port %d failed: %w", s.cfg.Port, err)
	}

	s.listener = ln
	s.running.Store(true)

	if s.discovery != nil {
		s.discovery.port = s.cfg.Port
		s.discovery.Start()
	}

	logger.Info("Proxy", fmt.Sprintf("Proxy server started on %s (SSL: %v, SOCKS5: %v)", addr, s.cfg.EnableSSL, s.cfg.EnableSOCKS5))

	s.wg.Add(1)
	go s.acceptLoop()

	return nil
}

// Stop gracefully shuts down the server.
func (s *Server) Stop() error {
	if !s.running.Load() {
		return nil
	}

	s.running.Store(false)
	s.cancel()

	if s.discovery != nil {
		s.discovery.Stop()
	}

	var err error
	if s.listener != nil {
		err = s.listener.Close()
	}

	logger.Info("Proxy", "Proxy server stopped")

	s.wg.Wait()
	return err
}

// Restart stops and restarts the server with current or updated config.
func (s *Server) Restart(newCfg *ServerConfig) error {
	_ = s.Stop()
	if newCfg != nil {
		s.cfg = *newCfg
	}
	s.ctx, s.cancel = context.WithCancel(context.Background())
	return s.Start()
}

// IsRunning returns true if the server is actively listening.
func (s *Server) IsRunning() bool {
	return s.running.Load()
}

// Port returns the bound port.
func (s *Server) Port() int {
	return s.cfg.Port
}

// Config returns a copy of the current server config.
func (s *Server) Config() ServerConfig {
	return s.cfg
}

// CertManager returns the certificate manager.
func (s *Server) CertManager() *cert.CertificateManager {
	return s.certManager
}

// MobileAPI returns the MobileAPIManager instance.
func (s *Server) MobileAPI() *MobileAPIManager {
	if s.handler != nil {
		return s.handler.mobileAPI
	}
	return nil
}

// SetMobileAPIBridge registers app-level handlers for mobile REST endpoints.
func (s *Server) SetMobileAPIBridge(b MobileAPIBridge) {
	s.mobileBridge = b
}

// MobileAPIBridge returns the registered mobile API bridge.
func (s *Server) MobileAPIBridge() MobileAPIBridge {
	return s.mobileBridge
}

// AddListener registers an event listener for real-time proxy traffic.
func (s *Server) AddListener(l EventListener) {
	s.listenersMu.Lock()
	defer s.listenersMu.Unlock()
	s.listeners = append(s.listeners, l)
}

// RemoveListener unregisters an event listener.
func (s *Server) RemoveListener(l EventListener) {
	s.listenersMu.Lock()
	defer s.listenersMu.Unlock()
	for i, item := range s.listeners {
		if item == l {
			s.listeners = append(s.listeners[:i], s.listeners[i+1:]...)
			return
		}
	}
}

// BroadcastRequest dispatches an incoming request to all server listeners.
func (s *Server) BroadcastRequest(req *HttpRequest) {
	s.DispatchRequest(nil, req)
}

// BroadcastResponse dispatches an incoming response to all server listeners.
func (s *Server) BroadcastResponse(resp *HttpResponse) {
	s.DispatchResponse(nil, resp)
}

// DispatchRequest broadcasts an onRequest event.
func (s *Server) DispatchRequest(ctx *Context, req *HttpRequest) {
	s.listenersMu.RLock()
	defer s.listenersMu.RUnlock()
	for _, l := range s.listeners {
		l.OnRequest(ctx, req)
	}
}

// DispatchResponse broadcasts an onResponse event.
func (s *Server) DispatchResponse(ctx *Context, resp *HttpResponse) {
	s.listenersMu.RLock()
	defer s.listenersMu.RUnlock()
	for _, l := range s.listeners {
		l.OnResponse(ctx, resp)
	}
}

// DispatchWsFrame broadcasts an onWsFrame event.
func (s *Server) DispatchWsFrame(ctx *Context, frame *WsFrame) {
	s.listenersMu.RLock()
	defer s.listenersMu.RUnlock()
	for _, l := range s.listeners {
		l.OnWsFrame(ctx, frame)
	}
}

// DispatchSSEEvent broadcasts an onSSEEvent event.
func (s *Server) DispatchSSEEvent(ctx *Context, event *SSEEvent) {
	s.listenersMu.RLock()
	defer s.listenersMu.RUnlock()
	for _, l := range s.listeners {
		l.OnSSEEvent(ctx, event)
	}
}

// DispatchError broadcasts an onError event.
func (s *Server) DispatchError(ctx *Context, req *HttpRequest, err error) {
	s.listenersMu.RLock()
	defer s.listenersMu.RUnlock()
	for _, l := range s.listeners {
		l.OnError(ctx, req, err)
	}
}

func (s *Server) acceptLoop() {
	defer s.wg.Done()

	for {
		conn, err := s.listener.Accept()
		if err != nil {
			if !s.running.Load() {
				return
			}
			time.Sleep(10 * time.Millisecond)
			continue
		}

		go s.handleConnection(conn)
	}
}

func (s *Server) handleConnection(clientConn net.Conn) {
	defer clientConn.Close()

	if max := s.Config().MaxConnections; max > 0 {
		if s.activeConns.Add(1) > int64(max) {
			s.activeConns.Add(-1)
			return
		}
		defer s.activeConns.Add(-1)
	}

	ctx := NewContext(s.ctx, clientConn)
	defer ctx.Cancel()

	if s.handler != nil {
		s.handler.HandleConnection(ctx, clientConn)
	}
}
