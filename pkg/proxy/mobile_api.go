package proxy

import (
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"httpeek/pkg/cert"
	"httpeek/pkg/logger"
)

// MobileDeviceInfo represents an active mobile connection.
type MobileDeviceInfo struct {
	DeviceID    string    `json:"deviceId"`
	DeviceName  string    `json:"deviceName"`
	OSVersion   string    `json:"osVersion"`
	IsRooted    bool      `json:"isRooted"`
	RemoteIP    string    `json:"remoteIp"`
	ConnectedAt time.Time `json:"connectedAt"`
	LastPing    time.Time `json:"lastPing"`
	PacketCount int64     `json:"packetCount"`
}

// rateEntry tracks request counts within a fixed window for one client.
type rateEntry struct {
	count int
	reset time.Time
}

// rateLimiter is a simple per-client fixed-window limiter.
type rateLimiter struct {
	mu        sync.Mutex
	window    time.Duration
	limit     int
	clients   map[string]*rateEntry
	lastSweep time.Time
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{
		window:    window,
		limit:     limit,
		clients:   make(map[string]*rateEntry),
		lastSweep: time.Now(),
	}
}

func (rl *rateLimiter) allow(client string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()

	// Opportunistically drop expired entries at most once per window.
	if now.Sub(rl.lastSweep) >= rl.window {
		for k, e := range rl.clients {
			if now.After(e.reset) {
				delete(rl.clients, k)
			}
		}
		rl.lastSweep = now
	}

	e, ok := rl.clients[client]
	if !ok || now.After(e.reset) {
		rl.clients[client] = &rateEntry{count: 1, reset: now.Add(rl.window)}
		return true
	}
	e.count++
	return e.count <= rl.limit
}

// remoteIP extracts the host part of a RemoteAddr string.
func remoteIP(addr string) string {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return addr
	}
	return host
}

// sessionIDPattern bounds accepted session identifiers.
var sessionIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

func validSessionID(id string) bool {
	return sessionIDPattern.MatchString(id)
}

// validLogLevel restricts client-supplied log levels to the known set.
func validLogLevel(lvl string) bool {
	switch strings.ToUpper(strings.TrimSpace(lvl)) {
	case "TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL":
		return true
	}
	return false
}

// truncateString caps a client-supplied string at max runes.
func truncateString(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// MobileAPIManager handles embedded REST endpoints and WebSocket event streams for mobile clients.
type MobileAPIManager struct {
	server         *Server
	wsConns        map[string]net.Conn
	devices        map[string]*MobileDeviceInfo
	onDeviceChange func([]MobileDeviceInfo)
	apiLimiter     *rateLimiter
	mu             sync.RWMutex
}

// NewMobileAPIManager initializes a mobile API manager.
func NewMobileAPIManager(s *Server) *MobileAPIManager {
	m := &MobileAPIManager{
		server:     s,
		wsConns:    make(map[string]net.Conn),
		devices:    make(map[string]*MobileDeviceInfo),
		apiLimiter: newRateLimiter(300, time.Minute),
	}

	// Hook server event listener to broadcast to all connected mobile WebSockets
	s.AddListener(&mobileAPIEventListener{mgr: m})
	return m
}

// SetOnDeviceChange registers a callback invoked when mobile devices connect or disconnect.
func (m *MobileAPIManager) SetOnDeviceChange(fn func([]MobileDeviceInfo)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.onDeviceChange = fn
}

// GetConnectedDevices returns a list of currently connected mobile devices.
func (m *MobileAPIManager) GetConnectedDevices() []MobileDeviceInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	res := make([]MobileDeviceInfo, 0, len(m.devices))
	for _, d := range m.devices {
		res = append(res, *d)
	}
	return res
}

// DisconnectDevice closes the connection for a specific device.
func (m *MobileAPIManager) DisconnectDevice(deviceID string) {
	m.mu.Lock()
	for connID, dev := range m.devices {
		if dev.DeviceID == deviceID || dev.RemoteIP == deviceID {
			if conn, ok := m.wsConns[connID]; ok {
				_ = conn.Close()
				delete(m.wsConns, connID)
			}
			delete(m.devices, connID)
		}
	}
	m.mu.Unlock()
	m.notifyDeviceChange()
}

func (m *MobileAPIManager) notifyDeviceChange() {
	m.mu.RLock()
	callback := m.onDeviceChange
	res := make([]MobileDeviceInfo, 0, len(m.devices))
	for _, d := range m.devices {
		res = append(res, *d)
	}
	m.mu.RUnlock()
	if callback != nil {
		go callback(res)
	}
}

type mobileAPIEventListener struct {
	mgr *MobileAPIManager
}

func (l *mobileAPIEventListener) OnRequest(ctx *Context, req *HttpRequest) {
	l.mgr.BroadcastEvent("proxy:request", req)
}

func (l *mobileAPIEventListener) OnResponse(ctx *Context, resp *HttpResponse) {
	l.mgr.BroadcastEvent("proxy:response", resp)
}

func (l *mobileAPIEventListener) OnWsFrame(ctx *Context, frame *WsFrame) {
	l.mgr.BroadcastEvent("proxy:ws_frame", frame)
}

func (l *mobileAPIEventListener) OnSSEEvent(ctx *Context, event *SSEEvent) {
	l.mgr.BroadcastEvent("proxy:sse_event", event)
}

func (l *mobileAPIEventListener) OnError(ctx *Context, req *HttpRequest, err error) {
	l.mgr.BroadcastEvent("proxy:error", map[string]any{
		"requestId": func() string {
			if req != nil {
				return req.ID
			}
			return ""
		}(),
		"error": err.Error(),
	})
}

// BroadcastEvent sends a JSON event to all active mobile WebSocket subscribers.
func (m *MobileAPIManager) BroadcastEvent(eventType string, data any) {
	payload, err := json.Marshal(map[string]any{
		"event": eventType,
		"data":  data,
	})
	if err != nil {
		return
	}

	frame := encodeWSTextFrame(payload)

	m.mu.Lock()
	defer m.mu.Unlock()

	for id, conn := range m.wsConns {
		if _, err := conn.Write(frame); err != nil {
			_ = conn.Close()
			delete(m.wsConns, id)
		}
	}
}

// SendRemoteCommand sends a targeted or broadcast remote control instruction to mobile devices.
func (m *MobileAPIManager) SendRemoteCommand(deviceID, command string, data any) error {
	payload, err := json.Marshal(map[string]any{
		"event": command,
		"data":  data,
	})
	if err != nil {
		return err
	}
	frame := encodeWSTextFrame(payload)

	m.mu.Lock()
	defer m.mu.Unlock()

	for id, dev := range m.devices {
		if deviceID == "" || dev.DeviceID == deviceID || id == deviceID {
			if conn, ok := m.wsConns[id]; ok {
				if _, err := conn.Write(frame); err != nil {
					_ = conn.Close()
					delete(m.wsConns, id)
				}
			}
		}
	}
	return nil
}

// HandleRequest routes incoming mobile API and WebSocket requests.
// reader is the bufio.Reader that already consumed the HTTP request line+headers;
// any bytes it has buffered must be drained first before reading raw WebSocket frames.
func (m *MobileAPIManager) HandleRequest(clientConn net.Conn, reader *bufio.Reader, req *http.Request) bool {
	path := req.URL.Path

	if req.Method == http.MethodOptions {
		sendCORSResponse(clientConn, req)
		return true
	}

	// Bound per-client request rate to blunt floods and auth brute force.
	if m.apiLimiter != nil && !m.apiLimiter.allow(remoteIP(clientConn.RemoteAddr().String())) {
		sendJSONResponse(clientConn, http.StatusTooManyRequests, map[string]string{"error": "rate limit exceeded"})
		return true
	}

	// CA certificate download — served without auth for mobile browser installs
	if (path == "/ca.crt" || path == "/ssl" || path == "/api/ca/cert") && req.Method == http.MethodGet {
		if m.server.CertManager() == nil || m.server.CertManager().CA() == nil {
			sendJSONResponse(clientConn, http.StatusNotFound, map[string]string{"error": "CA not generated. Start the proxy first."})
			return true
		}
		caPEM := m.server.CertManager().CA().CertPEM
		resp := fmt.Sprintf(
			"HTTP/1.1 200 OK\r\n"+
				"Content-Type: application/x-x509-ca-cert\r\n"+
				"Content-Disposition: attachment; filename=\"proxypin-root-ca.crt\"\r\n"+
				"Access-Control-Allow-Origin: *\r\n"+
				"Content-Length: %d\r\n\r\n",
			len(caPEM),
		)
		_, _ = clientConn.Write([]byte(resp))
		_, _ = clientConn.Write(caPEM)
		_ = clientConn.Close()
		return true
	}

	// 1. WebSocket Event Stream for Android Companion & Web clients
	if strings.HasPrefix(path, "/ws") || strings.EqualFold(req.Header.Get("Upgrade"), "websocket") {
		if !m.checkAuth(req) {
			sendJSONResponse(clientConn, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
			return true
		}
		// Browsers always send Origin; native clients (OkHttp) do not. Reject
		// non-local browser origins to prevent cross-site WebSocket hijacking.
		if !isLocalOrigin(req) {
			sendJSONResponse(clientConn, http.StatusForbidden, map[string]string{"error": "origin not allowed"})
			return true
		}
		m.upgradeWebSocket(clientConn, reader, req)
		return true
	}

	// 2. Mobile REST API endpoints
	if strings.HasPrefix(path, "/api/") {
		m.handleREST(clientConn, req)
		return true
	}

	return false
}

func mobileAPIToken() string {
	return os.Getenv("HTTPEEK_API_TOKEN")
}

func (m *MobileAPIManager) checkAuth(req *http.Request) bool {
	token := mobileAPIToken()
	if token == "" {
		return true
	}
	if req.Header.Get("X-HTTPeek-Token") == token {
		return true
	}
	if req.URL.Query().Get("token") == token {
		return true
	}
	return false
}

// maxAPIBodyBytes bounds mobile REST request bodies to prevent memory
// exhaustion from oversized payloads.
const maxAPIBodyBytes = 64 * 1024 * 1024

// maxAPIFrameSize bounds a single mobile WebSocket frame payload.
const maxAPIFrameSize = 32 * 1024 * 1024

// readJSONBody reads a mobile API request body with a size bound.
func readJSONBody(r *http.Request) ([]byte, error) {
	if r == nil || r.Body == nil {
		return nil, nil
	}
	return readLimitedBody(r.Body, maxAPIBodyBytes)
}

func (m *MobileAPIManager) handleREST(clientConn net.Conn, req *http.Request) {
	if !m.checkAuth(req) {
		sendJSONResponse(clientConn, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	if req.ContentLength > maxAPIBodyBytes {
		sendJSONResponse(clientConn, http.StatusRequestEntityTooLarge, map[string]string{"error": "request body too large"})
		return
	}

	path := strings.TrimPrefix(req.URL.Path, "/api")

	switch {
	case (path == "/status" || path == "/proxy/status") && req.Method == http.MethodGet:
		cfg := m.server.Config()
		sendJSONResponse(clientConn, http.StatusOK, map[string]any{
			"running":     m.server.IsRunning(),
			"port":        cfg.Port,
			"enableSsl":   cfg.EnableSSL,
			"systemProxy": cfg.EnableSystemProxy,
			"version":     "1.0.0",
			"platform":    "android",
		})

	case (path == "/ca/info" || path == "/ca/details") && req.Method == http.MethodGet:
		if m.server.CertManager() == nil || m.server.CertManager().CA() == nil {
			sendJSONResponse(clientConn, http.StatusOK, map[string]any{"exists": false})
			return
		}
		ca := m.server.CertManager().CA()
		caCert := ca.Certificate
		sendJSONResponse(clientConn, http.StatusOK, map[string]any{
			"exists":             true,
			"subject":            caCert.Subject.CommonName,
			"issuer":             caCert.Issuer.CommonName,
			"validFrom":          caCert.NotBefore.Format("2006-01-02"),
			"validTo":            caCert.NotAfter.Format("2006-01-02"),
			"androidSubjectHash": cert.AndroidSubjectHashOld(caCert),
			"androidCertFile":    cert.AndroidSystemCertName(caCert),
		})

	case path == "/ca/export" && req.Method == http.MethodGet:
		if m.server.CertManager() == nil || m.server.CertManager().CA() == nil {
			sendJSONResponse(clientConn, http.StatusNotFound, map[string]string{"error": "CA not generated"})
			return
		}
		caPEM := m.server.CertManager().CA().CertPEM
		resp := fmt.Sprintf(
			"HTTP/1.1 200 OK\r\n"+
				"Content-Type: application/x-x509-ca-cert\r\n"+
				"Content-Disposition: attachment; filename=\"httpeek-root-ca.crt\"\r\n"+
				"Access-Control-Allow-Origin: *\r\n"+
				"Content-Length: %d\r\n\r\n",
			len(caPEM),
		)
		_, _ = clientConn.Write([]byte(resp))
		_, _ = clientConn.Write(caPEM)

	case path == "/composer" && req.Method == http.MethodPost:
		var payload struct {
			Method  string              `json:"method"`
			URL     string              `json:"url"`
			Headers map[string][]string `json:"headers"`
			Body    string              `json:"body"`
		}
		bodyBytes, _ := readJSONBody(req)
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		client := &http.Client{Timeout: 30 * time.Second}
		outReq, err := http.NewRequest(payload.Method, payload.URL, strings.NewReader(payload.Body))
		if err != nil {
			sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		for k, vals := range payload.Headers {
			for _, v := range vals {
				outReq.Header.Add(k, v)
			}
		}
		startTime := time.Now()
		resp, err := client.Do(outReq)
		if err != nil {
			sendJSONResponse(clientConn, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}
		defer resp.Body.Close()
		respBody, _ := readLimitedBody(resp.Body, maxAPIBodyBytes)
		sendJSONResponse(clientConn, http.StatusOK, map[string]any{
			"statusCode": resp.StatusCode,
			"statusText": resp.Status,
			"headers":    resp.Header,
			"bodyString": string(respBody),
			"bodySize":   len(respBody),
			"durationMs": time.Since(startTime).Milliseconds(),
		})

	case path == "/ping":
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"status": "pong", "time": time.Now().String()})

	case path == "/proxy/start" && req.Method == http.MethodPost:
		var payload struct {
			Port              int  `json:"port"`
			EnableSSL         bool `json:"enableSSL"`
			EnableSystemProxy bool `json:"enableSystemProxy"`
		}
		bodyBytes, _ := readJSONBody(req)
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if payload.Port <= 0 {
			payload.Port = m.server.Port()
		}
		cfg := m.server.Config()
		cfg.Port = payload.Port
		cfg.EnableSSL = payload.EnableSSL
		cfg.EnableSystemProxy = payload.EnableSystemProxy
		if err := m.server.Restart(&cfg); err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]any{
			"running": true,
			"port":    cfg.Port,
		})

	case path == "/proxy/stop" && req.Method == http.MethodPost:
		if err := m.server.Stop(); err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]any{"running": false})

	case path == "/proxy/port" && req.Method == http.MethodPost:
		var payload struct {
			Port int `json:"port"`
		}
		bodyBytes, _ := readJSONBody(req)
		_ = json.Unmarshal(bodyBytes, &payload)
		if payload.Port > 0 {
			cfg := m.server.Config()
			cfg.Port = payload.Port
			_ = m.server.Restart(&cfg)
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]any{"port": m.server.Port()})

	case path == "/proxy/ssl" && req.Method == http.MethodPost:
		var payload struct {
			EnableSSL bool `json:"enableSsl"`
		}
		bodyBytes, _ := readJSONBody(req)
		_ = json.Unmarshal(bodyBytes, &payload)
		cfg := m.server.Config()
		cfg.EnableSSL = payload.EnableSSL
		_ = m.server.Restart(&cfg)
		sendJSONResponse(clientConn, http.StatusOK, map[string]any{"enableSsl": cfg.EnableSSL})

	case path == "/proxy/system_proxy" && req.Method == http.MethodPost:
		var payload struct {
			EnableSystemProxy bool `json:"enableSystemProxy"`
		}
		bodyBytes, _ := readJSONBody(req)
		_ = json.Unmarshal(bodyBytes, &payload)
		cfg := m.server.Config()
		cfg.EnableSystemProxy = payload.EnableSystemProxy
		_ = m.server.Restart(&cfg)
		sendJSONResponse(clientConn, http.StatusOK, map[string]any{"enableSystemProxy": cfg.EnableSystemProxy})

	case path == "/proxy/external" && req.Method == http.MethodPost:
		var payload struct {
			Enabled  bool   `json:"enabled"`
			Host     string `json:"host"`
			Port     int    `json:"port"`
			Protocol string `json:"protocol"`
		}
		bodyBytes, _ := readJSONBody(req)
		_ = json.Unmarshal(bodyBytes, &payload)
		proto := payload.Protocol
		if proto == "" {
			proto = "http"
		}
		cfg := m.server.Config()
		if payload.Enabled && payload.Host != "" && payload.Port > 0 {
			if !strings.HasPrefix(payload.Host, "http://") && !strings.HasPrefix(payload.Host, "https://") && !strings.HasPrefix(payload.Host, "socks5://") {
				cfg.UpstreamProxy = fmt.Sprintf("%s://%s:%d", proto, payload.Host, payload.Port)
			} else {
				cfg.UpstreamProxy = fmt.Sprintf("%s:%d", payload.Host, payload.Port)
			}
		} else {
			cfg.UpstreamProxy = ""
		}
		_ = m.server.Restart(&cfg)
		sendJSONResponse(clientConn, http.StatusOK, map[string]any{"ok": true})

	case path == "/sessions" && req.Method == http.MethodGet:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		sessions, err := bridge.ListSessions()
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, sessions)

	case path == "/sessions" && req.Method == http.MethodPost:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		var payload struct {
			Name string `json:"name"`
		}
		bodyBytes, _ := readJSONBody(req)
		_ = json.Unmarshal(bodyBytes, &payload)
		sess, err := bridge.CreateSession(payload.Name)
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, sess)

	case strings.HasPrefix(path, "/sessions/") && req.Method == http.MethodGet:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		sessionID := strings.TrimPrefix(path, "/sessions/")
		sessionID = strings.TrimSuffix(sessionID, "/requests")
		if !validSessionID(sessionID) {
			sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": "invalid session id"})
			return
		}
		requests, err := bridge.GetSessionRequests(sessionID)
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, requests)

	case strings.HasPrefix(path, "/sessions/") && req.Method == http.MethodDelete:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		sessionID := strings.TrimPrefix(path, "/sessions/")
		if !validSessionID(sessionID) {
			sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": "invalid session id"})
			return
		}
		if err := bridge.DeleteSession(sessionID); err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"deleted": sessionID})

	case (path == "/har/import" || path == "/sessions/har/import") && req.Method == http.MethodPost:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		bodyBytes, _ := readJSONBody(req)
		var payload struct {
			Har         string `json:"har"`
			SessionName string `json:"sessionName"`
			Name        string `json:"name"`
		}
		_ = json.Unmarshal(bodyBytes, &payload)
		sName := payload.SessionName
		if sName == "" {
			sName = payload.Name
		}
		harStr := payload.Har
		if harStr == "" {
			harStr = string(bodyBytes)
		}
		sess, err := bridge.ImportHAR(harStr, sName)
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, sess)

	case (path == "/har/export" || path == "/sessions/har/export") && req.Method == http.MethodPost:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		bodyBytes, _ := readJSONBody(req)
		var payload struct {
			Requests []*HttpRequest `json:"requests"`
		}
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		har, err := bridge.ExportHAR(payload.Requests)
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"har": har})

	case (path == "/composer" || path == "/api/composer" || path == "/composer/send" || path == "/api/composer/send") && req.Method == http.MethodPost:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		bodyBytes, _ := readJSONBody(req)
		resp, err := bridge.SendCustomRequest(string(bodyBytes))
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, resp)

	case path == "/favorites" && req.Method == http.MethodGet:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		favs, err := bridge.GetFavorites()
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, favs)

	case path == "/favorites/toggle" && req.Method == http.MethodPost:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		bodyBytes, _ := readJSONBody(req)
		var payload struct {
			RequestID  string `json:"requestId"`
			IsFavorite bool   `json:"isFavorite"`
		}
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if err := bridge.ToggleFavorite(payload.RequestID, payload.IsFavorite); err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"ok": "true"})

	case path == "/rules/all" && req.Method == http.MethodGet:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		rules, err := bridge.GetAllRules()
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, rules)

	case path == "/rules/export" && req.Method == http.MethodGet:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		jsonStr, err := bridge.ExportRules()
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"rules": jsonStr})

	case path == "/rules/import" && req.Method == http.MethodPost:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		bodyBytes, _ := readJSONBody(req)
		var payload struct {
			Rules string `json:"rules"`
		}
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": "invalid JSON: " + err.Error()})
			return
		}
		if err := bridge.ImportRules(payload.Rules); err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"ok": "true"})

	case path == "/apps/detect" && req.Method == http.MethodGet:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		apps, err := bridge.DetectLaunchableApps()
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, apps)

	case path == "/apps/launch" && req.Method == http.MethodPost:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		bodyBytes, _ := readJSONBody(req)
		var payload struct {
			AppID string `json:"appId"`
		}
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": "invalid JSON: " + err.Error()})
			return
		}
		result, err := bridge.LaunchAndIntercept(payload.AppID)
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, result)

	case path == "/apps/launch-custom" && req.Method == http.MethodPost:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		bodyBytes, _ := readJSONBody(req)
		var payload struct {
			Path string `json:"path"`
		}
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": "invalid JSON: " + err.Error()})
			return
		}
		result, err := bridge.LaunchCustomApp(payload.Path)
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, result)

	case path == "/java/proxy" && req.Method == http.MethodPost:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		bodyBytes, _ := readJSONBody(req)
		var payload struct {
			Enable bool `json:"enable"`
		}
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": "invalid JSON: " + err.Error()})
			return
		}
		if err := bridge.SetJavaGlobalProxy(payload.Enable); err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"ok": "true"})

	case path == "/java/proxy/status" && req.Method == http.MethodGet:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		status, err := bridge.GetJavaGlobalProxyStatus()
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, status)

	case path == "/adb/resolve" && req.Method == http.MethodGet:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		p, err := bridge.ResolveADBPath()
		if err != nil {
			sendJSONResponse(clientConn, http.StatusOK, map[string]any{"path": "", "found": false})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]any{"path": p, "found": p != ""})

	case path == "/adb/download" && req.Method == http.MethodPost:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		p, err := bridge.DownloadADBIfMissing()
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"path": p})

	case strings.HasPrefix(path, "/rules/") && req.Method == http.MethodGet:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		kind := strings.TrimPrefix(path, "/rules/")
		rules, err := bridge.GetRules(kind)
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, rules)

	case strings.HasPrefix(path, "/rules/") && req.Method == http.MethodPut:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		kind := strings.TrimPrefix(path, "/rules/")
		bodyBytes, _ := readJSONBody(req)
		if err := bridge.SetRules(kind, bodyBytes); err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"ok": "true"})

	case path == "/report/configs" && req.Method == http.MethodGet:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		cfg, err := bridge.GetReportConfigs()
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, cfg)

	case path == "/report/configs" && req.Method == http.MethodPut:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		bodyBytes, _ := readJSONBody(req)
		if err := bridge.SetReportConfigs(bodyBytes); err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"ok": "true"})

	case path == "/breakpoint/resume" && req.Method == http.MethodPost:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		bodyBytes, _ := readJSONBody(req)
		var payload struct {
			RequestID    string `json:"requestId"`
			ID           string `json:"id"`
			IsResponse   bool   `json:"isResponse"`
			Stage        string `json:"stage"`
			ModifiedJSON string `json:"modifiedJson"`
		}
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		reqID := payload.RequestID
		if reqID == "" {
			reqID = payload.ID
		}
		isResp := payload.IsResponse || payload.Stage == "response"
		if err := bridge.ResumeBreakpoint(reqID, isResp, payload.ModifiedJSON); err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"ok": "true"})

	case path == "/breakpoint/abort" && req.Method == http.MethodPost:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		bodyBytes, _ := readJSONBody(req)
		var payload struct {
			RequestID  string `json:"requestId"`
			ID         string `json:"id"`
			IsResponse bool   `json:"isResponse"`
			Stage      string `json:"stage"`
		}
		_ = json.Unmarshal(bodyBytes, &payload)
		reqID := payload.RequestID
		if reqID == "" {
			reqID = payload.ID
		}
		isResp := payload.IsResponse || payload.Stage == "response"
		_ = bridge.AbortBreakpoint(reqID, isResp)
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"ok": "true"})

	case (path == "/requests/repeat" || strings.HasSuffix(path, "/repeat")) && req.Method == http.MethodPost:
		bridge := m.server.MobileAPIBridge()
		if bridge == nil {
			sendJSONResponse(clientConn, http.StatusServiceUnavailable, map[string]string{"error": "bridge unavailable"})
			return
		}
		var payload struct {
			RequestID string `json:"requestId"`
			ID        string `json:"id"`
		}
		bodyBytes, _ := readJSONBody(req)
		_ = json.Unmarshal(bodyBytes, &payload)
		reqID := payload.RequestID
		if reqID == "" {
			reqID = payload.ID
		}
		if reqID == "" && strings.HasPrefix(path, "/requests/") {
			parts := strings.Split(path, "/")
			if len(parts) >= 3 {
				reqID = parts[2]
			}
		}
		res, err := bridge.RepeatRequest(reqID)
		if err != nil {
			sendJSONResponse(clientConn, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sendJSONResponse(clientConn, http.StatusOK, res)

	case path == "/logs" && req.Method == http.MethodGet:
		limit := 100
		if qLimit := req.URL.Query().Get("limit"); qLimit != "" {
			if l, err := strconv.Atoi(qLimit); err == nil && l > 0 {
				limit = l
			}
		}
		entries := logger.GetRecentLogs(limit)
		sendJSONResponse(clientConn, http.StatusOK, map[string]any{
			"filePath": logger.GetLogFilePath(),
			"logDir":   logger.GetLogDir(),
			"entries":  entries,
		})

	case (path == "/logs/write" || path == "/logs") && req.Method == http.MethodPost:
		bodyBytes, _ := readJSONBody(req)
		var payload struct {
			Level    string                 `json:"level"`
			Category string                 `json:"category"`
			Caller   string                 `json:"caller"`
			Message  string                 `json:"message"`
			Fields   map[string]interface{} `json:"fields"`
		}
		_ = json.Unmarshal(bodyBytes, &payload)
		// Sanitize client-supplied log fields to prevent log spoofing/injection.
		if !validLogLevel(payload.Level) {
			sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": "invalid log level"})
			return
		}
		lvl := logger.ParseLevel(payload.Level)
		cat := truncateString(payload.Category, 32)
		if cat == "" {
			cat = "UI"
		}
		caller := truncateString(payload.Caller, 64)
		if caller == "" {
			caller = "REST:Client"
		}
		message := truncateString(payload.Message, 4096)
		logger.LogExplicit(lvl, cat, caller, message, payload.Fields)
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"ok": "true"})

	case path == "/logs/clear" && req.Method == http.MethodPost:
		_ = logger.ClearLogs()
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"ok": "true"})

	case path == "/mobile/devices" && req.Method == http.MethodGet:
		sendJSONResponse(clientConn, http.StatusOK, m.GetConnectedDevices())

	case path == "/mobile/sync" && req.Method == http.MethodPost:
		var syncPayload struct {
			DeviceID   string          `json:"deviceId"`
			DeviceName string          `json:"deviceName"`
			Requests   []*HttpRequest  `json:"requests"`
			Responses  []*HttpResponse `json:"responses"`
		}
		bodyBytes, _ := readJSONBody(req)
		if err := json.Unmarshal(bodyBytes, &syncPayload); err != nil {
			sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		const maxSyncBatch = 1000
		if len(syncPayload.Requests) > maxSyncBatch || len(syncPayload.Responses) > maxSyncBatch {
			sendJSONResponse(clientConn, http.StatusRequestEntityTooLarge, map[string]string{"error": "sync batch too large"})
			return
		}
		if m.server != nil {
			for _, r := range syncPayload.Requests {
				m.server.BroadcastRequest(r)
			}
			for _, r := range syncPayload.Responses {
				cleanMobileResponse(r)
				m.server.BroadcastResponse(r)
			}
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]any{
			"status":   "ok",
			"ingested": len(syncPayload.Requests) + len(syncPayload.Responses),
		})

	case path == "/mobile/disconnect" && req.Method == http.MethodPost:
		var payload struct {
			DeviceID string `json:"deviceId"`
		}
		bodyBytes, _ := readJSONBody(req)
		_ = json.Unmarshal(bodyBytes, &payload)
		if payload.DeviceID != "" {
			m.DisconnectDevice(payload.DeviceID)
		}
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"status": "disconnected"})

	default:
		sendJSONResponse(clientConn, http.StatusNotFound, map[string]string{"error": "Endpoint not found"})
	}
}

func (m *MobileAPIManager) upgradeWebSocket(clientConn net.Conn, bufReader *bufio.Reader, req *http.Request) {
	key := req.Header.Get("Sec-WebSocket-Key")
	if key == "" {
		sendJSONResponse(clientConn, http.StatusBadRequest, map[string]string{"error": "Missing Sec-WebSocket-Key"})
		return
	}

	// Calculate WebSocket accept hash
	const wsGUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
	h := sha1.New()
	h.Write([]byte(key + wsGUID))
	accept := base64.StdEncoding.EncodeToString(h.Sum(nil))

	resp := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + accept + "\r\n\r\n"

	if _, err := clientConn.Write([]byte(resp)); err != nil {
		return
	}

	remoteAddr := clientConn.RemoteAddr().String()
	remoteIP := remoteAddr
	if host, _, err := net.SplitHostPort(remoteAddr); err == nil {
		remoteIP = host
	}

	connID := fmt.Sprintf("%p", clientConn)
	m.mu.Lock()
	m.wsConns[connID] = clientConn
	m.devices[connID] = &MobileDeviceInfo{
		DeviceID:    connID,
		DeviceName:  "Android (" + remoteIP + ")",
		OSVersion:   "Android",
		RemoteIP:    remoteIP,
		ConnectedAt: time.Now(),
		LastPing:    time.Now(),
	}
	m.mu.Unlock()
	m.notifyDeviceChange()

	// Send initial status event upon connection
	m.BroadcastEvent("proxy:status", map[string]any{
		"running":   m.server.IsRunning(),
		"port":      m.server.Port(),
		"enableSsl": m.server.Config().EnableSSL,
	})

	// KEY FIX: Use io.MultiReader to drain any bytes already buffered in bufReader BEFORE
	// reading raw WebSocket frames from the socket. This ensures the mobile:hello frame
	// that Android sends immediately after the 101 upgrade is not lost in the bufio buffer.
	var frameReader io.Reader
	if bufReader != nil && bufReader.Buffered() > 0 {
		frameReader = io.MultiReader(bufReader, clientConn)
	} else {
		frameReader = clientConn
	}

	// Read loop with RFC 6455 frame decoding
	go func() {
		defer func() {
			m.mu.Lock()
			delete(m.wsConns, connID)
			delete(m.devices, connID)
			m.mu.Unlock()
			m.notifyDeviceChange()
			_ = clientConn.Close()
		}()

		for {
			header := make([]byte, 2)
			if _, err := io.ReadFull(frameReader, header); err != nil {
				break
			}

			opcode := header[0] & 0x0F
			if opcode == 0x08 { // Close frame
				break
			}

			isMasked := (header[1] & 0x80) != 0
			payloadLen := int(header[1] & 0x7F)

			if payloadLen == 126 {
				extLen := make([]byte, 2)
				if _, err := io.ReadFull(frameReader, extLen); err != nil {
					break
				}
				payloadLen = int(extLen[0])<<8 | int(extLen[1])
			} else if payloadLen == 127 {
				extLen := make([]byte, 8)
				if _, err := io.ReadFull(frameReader, extLen); err != nil {
					break
				}
				length := binary.BigEndian.Uint64(extLen)
			if length > uint64(maxAPIFrameSize) {
				writeWSCloseFrame(clientConn, 1009, "frame too large")
				break
			}
			payloadLen = int(length)
			}

			var maskKey []byte
			if isMasked {
				maskKey = make([]byte, 4)
				if _, err := io.ReadFull(frameReader, maskKey); err != nil {
					break
				}
			}

			payload := make([]byte, payloadLen)
			if _, err := io.ReadFull(frameReader, payload); err != nil {
				break
			}

			if isMasked {
				for i := 0; i < payloadLen; i++ {
					payload[i] ^= maskKey[i%4]
				}
			}

			// Handle Text / Ping frames
			if opcode == 0x09 { // Ping -> send Pong
				pong := []byte{0x8A, 0x00}
				_, _ = clientConn.Write(pong)
			} else if opcode == 0x01 { // Text frame
				m.handleIncomingClientMessage(connID, payload)
			}
		}
	}()
}

func (m *MobileAPIManager) handleIncomingClientMessage(connID string, data []byte) {
	var msg struct {
		Event string          `json:"event"`
		Data  json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		return
	}

	switch msg.Event {
	case "mobile:hello":
		var helloData struct {
			DeviceID   string `json:"deviceId"`
			DeviceName string `json:"deviceName"`
			OSVersion  string `json:"osVersion"`
			IsRooted   bool   `json:"isRooted"`
		}
		if err := json.Unmarshal(msg.Data, &helloData); err == nil {
			m.mu.Lock()
			if dev, ok := m.devices[connID]; ok {
				if helloData.DeviceID != "" {
					dev.DeviceID = helloData.DeviceID
				}
				if helloData.DeviceName != "" {
					dev.DeviceName = helloData.DeviceName
				}
				dev.OSVersion = helloData.OSVersion
				dev.IsRooted = helloData.IsRooted
				dev.LastPing = time.Now()
			}
			m.mu.Unlock()
			m.notifyDeviceChange()

			// Send ACK back
			ackPayload, _ := json.Marshal(map[string]any{
				"event": "mobile:hello_ack",
				"data": map[string]any{
					"status":  "paired",
					"version": "1.0.0",
					"time":    time.Now().UnixMilli(),
				},
			})
			m.sendToConn(connID, encodeWSTextFrame(ackPayload))
		}

	case "mobile:ping":
		m.mu.Lock()
		if dev, ok := m.devices[connID]; ok {
			dev.LastPing = time.Now()
		}
		m.mu.Unlock()
		pongPayload, _ := json.Marshal(map[string]any{
			"event": "mobile:pong",
			"data": map[string]any{
				"time": time.Now().UnixMilli(),
			},
		})
		m.sendToConn(connID, encodeWSTextFrame(pongPayload))

	case "proxy:request":
		var req HttpRequest
		if err := json.Unmarshal(msg.Data, &req); err == nil {
			m.mu.Lock()
			if dev, ok := m.devices[connID]; ok {
				dev.PacketCount++
				dev.LastPing = time.Now()
			}
			m.mu.Unlock()

			if m.server != nil {
				m.server.BroadcastRequest(&req)
			}
		}

	case "proxy:response":
		var resp HttpResponse
		if err := json.Unmarshal(msg.Data, &resp); err == nil {
			m.mu.Lock()
			if dev, ok := m.devices[connID]; ok {
				dev.PacketCount++
				dev.LastPing = time.Now()
			}
			m.mu.Unlock()

			if m.server != nil {
				cleanMobileResponse(&resp)
				m.server.BroadcastResponse(&resp)
			}
		}
	}
}

func cleanMobileResponse(resp *HttpResponse) {
	if resp == nil {
		return
	}
	contentEncoding := ""
	contentType := ""
	if resp.Headers != nil {
		for k, vals := range resp.Headers {
			if len(vals) > 0 {
				if strings.EqualFold(k, "Content-Encoding") {
					contentEncoding = vals[0]
				} else if strings.EqualFold(k, "Content-Type") {
					contentType = vals[0]
				}
			}
		}
	}
	rawBytes := []byte(resp.BodyString)
	if len(rawBytes) > 0 {
		_, decodedStr := DecodeBody(rawBytes, contentEncoding, contentType)
		if decodedStr != "" {
			resp.BodyString = decodedStr
		}
	}
}

func (m *MobileAPIManager) sendToConn(connID string, frame []byte) {
	m.mu.RLock()
	conn, ok := m.wsConns[connID]
	m.mu.RUnlock()
	if ok && conn != nil {
		_, _ = conn.Write(frame)
	}
}

func encodeWSTextFrame(payload []byte) []byte {
	length := len(payload)
	var frame []byte

	if length <= 125 {
		frame = make([]byte, 2+length)
		frame[0] = 0x81 // FIN + text opcode
		frame[1] = byte(length)
		copy(frame[2:], payload)
	} else if length <= 65535 {
		frame = make([]byte, 4+length)
		frame[0] = 0x81
		frame[1] = 126
		frame[2] = byte(length >> 8)
		frame[3] = byte(length & 0xFF)
		copy(frame[4:], payload)
	} else {
		frame = make([]byte, 10+length)
		frame[0] = 0x81
		frame[1] = 127
		for i := 0; i < 8; i++ {
			frame[2+i] = byte((length >> ((7 - i) * 8)) & 0xFF)
		}
		copy(frame[10:], payload)
	}
	return frame
}

// isLocalOrigin checks whether the request Origin/Referer is from localhost or a private LAN IP.
// This prevents remote websites from making cross-origin calls to the local proxy API.
func isLocalOrigin(req *http.Request) bool {
	origin := req.Header.Get("Origin")
	if origin == "" {
		return true
	}
	parsed, err := url.Parse(origin)
	if err != nil || parsed.User != nil {
		return false
	}
	if parsed.Scheme == "file" || parsed.Scheme == "wails" {
		return parsed.Host == ""
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false
	}
	if parsed.Path != "" && parsed.Path != "/" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return false
	}

	host := strings.Trim(strings.ToLower(parsed.Hostname()), "[]")
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return true
	}
	ip := net.ParseIP(host)
	if ip == nil || ip.To4() == nil {
		return false
	}
	v4 := ip.To4()
	return v4[0] == 10 || v4[0] == 192 && v4[1] == 168 || v4[0] == 172 && v4[1] >= 16 && v4[1] <= 31
}

func corsOrigin(req *http.Request) string {
	if origin := req.Header.Get("Origin"); origin != "" && isLocalOrigin(req) {
		return origin
	}
	return "null"
}

func sendJSONResponse(conn net.Conn, status int, data any) {
	body, _ := json.Marshal(data)
	resp := fmt.Sprintf(
		"HTTP/1.1 %d %s\r\n"+
			"Content-Type: application/json\r\n"+
			"Access-Control-Allow-Origin: *\r\n"+
			"Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE\r\n"+
			"Access-Control-Allow-Headers: Content-Type, X-HTTPeek-Token\r\n"+
			"Content-Length: %d\r\n"+
			"Connection: keep-alive\r\n\r\n",
		status, http.StatusText(status), len(body),
	)
	_, _ = conn.Write([]byte(resp))
	_, _ = conn.Write(body)
	// Removed: _ = conn.Close() - keep-alive allowed for mobile API clients
}

func sendJSONResponseWithOrigin(conn net.Conn, req *http.Request, status int, data any) {
	body, _ := json.Marshal(data)
	resp := fmt.Sprintf(
		"HTTP/1.1 %d %s\r\n"+
			"Content-Type: application/json\r\n"+
			"Access-Control-Allow-Origin: %s\r\n"+
			"Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE\r\n"+
			"Access-Control-Allow-Headers: Content-Type, X-HTTPeek-Token\r\n"+
			"Content-Length: %d\r\n"+
			"Connection: close\r\n\r\n",
		status, http.StatusText(status), corsOrigin(req), len(body),
	)
	_, _ = conn.Write([]byte(resp))
	_, _ = conn.Write(body)
	_ = conn.Close()
}

func sendCORSResponse(conn net.Conn, req *http.Request) {
	allowedOrigin := corsOrigin(req)
	resp := "HTTP/1.1 204 No Content\r\n" +
		"Access-Control-Allow-Origin: " + allowedOrigin + "\r\n" +
		"Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE\r\n" +
		"Access-Control-Allow-Headers: Content-Type, X-HTTPeek-Token\r\n" +
		"Connection: close\r\n\r\n"
	_, _ = conn.Write([]byte(resp))
	_ = conn.Close()
}
