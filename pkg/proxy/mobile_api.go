package proxy

import (
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"httpeek/pkg/cert"
	"httpeek/pkg/logger"
)

// MobileAPIManager handles embedded REST endpoints and WebSocket event streams for mobile clients.
type MobileAPIManager struct {
	server  *Server
	wsConns map[string]net.Conn
	mu      sync.RWMutex
}

// NewMobileAPIManager initializes a mobile API manager.
func NewMobileAPIManager(s *Server) *MobileAPIManager {
	m := &MobileAPIManager{
		server:  s,
		wsConns: make(map[string]net.Conn),
	}

	// Hook server event listener to broadcast to all connected mobile WebSockets
	s.AddListener(&mobileAPIEventListener{mgr: m})
	return m
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

// HandleRequest routes incoming mobile API and WebSocket requests.
func (m *MobileAPIManager) HandleRequest(clientConn net.Conn, req *http.Request) bool {
	path := req.URL.Path

	if req.Method == http.MethodOptions {
		sendCORSResponse(clientConn, req)
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

	// 1. WebSocket Event Stream for Android WebView
	if path == "/ws/events" || (path == "/ws" && strings.EqualFold(req.Header.Get("Upgrade"), "websocket")) {
		if !m.checkAuth(req) {
			sendJSONResponse(clientConn, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
			return true
		}
		m.upgradeWebSocket(clientConn, req)
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

func (m *MobileAPIManager) handleREST(clientConn net.Conn, req *http.Request) {
	if !m.checkAuth(req) {
		sendJSONResponse(clientConn, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
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
		bodyBytes, _ := io.ReadAll(req.Body)
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
		respBody, _ := io.ReadAll(resp.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
		_ = json.Unmarshal(bodyBytes, &payload)
		cfg := m.server.Config()
		cfg.EnableSSL = payload.EnableSSL
		_ = m.server.Restart(&cfg)
		sendJSONResponse(clientConn, http.StatusOK, map[string]any{"enableSsl": cfg.EnableSSL})

	case path == "/proxy/system_proxy" && req.Method == http.MethodPost:
		var payload struct {
			EnableSystemProxy bool `json:"enableSystemProxy"`
		}
		bodyBytes, _ := io.ReadAll(req.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
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
		bodyBytes, _ := io.ReadAll(req.Body)
		var payload struct {
			Level    string                 `json:"level"`
			Category string                 `json:"category"`
			Caller   string                 `json:"caller"`
			Message  string                 `json:"message"`
			Fields   map[string]interface{} `json:"fields"`
		}
		_ = json.Unmarshal(bodyBytes, &payload)
		lvl := logger.ParseLevel(payload.Level)
		cat := payload.Category
		if cat == "" {
			cat = "UI"
		}
		caller := payload.Caller
		if caller == "" {
			caller = "REST:Client"
		}
		logger.LogExplicit(lvl, cat, caller, payload.Message, payload.Fields)
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"ok": "true"})

	case path == "/logs/clear" && req.Method == http.MethodPost:
		_ = logger.ClearLogs()
		sendJSONResponse(clientConn, http.StatusOK, map[string]string{"ok": "true"})

	default:
		sendJSONResponse(clientConn, http.StatusNotFound, map[string]string{"error": "Endpoint not found"})
	}
}

func (m *MobileAPIManager) upgradeWebSocket(clientConn net.Conn, req *http.Request) {
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

	connID := fmt.Sprintf("%p", clientConn)
	m.mu.Lock()
	m.wsConns[connID] = clientConn
	m.mu.Unlock()

	// Send initial status event upon connection
	m.BroadcastEvent("proxy:status", map[string]any{
		"running":   m.server.IsRunning(),
		"port":      m.server.Port(),
		"enableSsl": m.server.Config().EnableSSL,
	})

	// Keep-alive read loop for close frames / pings
	go func() {
		buf := make([]byte, 512)
		for {
			_, err := clientConn.Read(buf)
			if err != nil {
				break
			}
		}
		m.mu.Lock()
		delete(m.wsConns, connID)
		m.mu.Unlock()
		_ = clientConn.Close()
	}()
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
		// No origin header — same-origin or non-browser client; allow.
		return true
	}
	// Allow localhost variants
	for _, local := range []string{"http://localhost", "https://localhost", "http://127.", "https://127.", "file://", "wails://"} {
		if strings.HasPrefix(origin, local) {
			return true
		}
	}
	// Allow RFC 1918 private ranges (10.x, 172.16-31.x, 192.168.x)
	for _, prefix := range []string{"http://10.", "https://10.", "http://192.168.", "https://192.168.", "http://172."} {
		if strings.HasPrefix(origin, prefix) {
			return true
		}
	}
	return false
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
			"Access-Control-Allow-Origin: %s\r\n"+
			"Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE\r\n"+
			"Access-Control-Allow-Headers: Content-Type, X-HTTPeek-Token\r\n"+
			"Access-Control-Allow-Credentials: true\r\n"+
			"Content-Length: %d\r\n"+
			"Connection: close\r\n\r\n",
		status, http.StatusText(status), "*", len(body),
	)
	_, _ = conn.Write([]byte(resp))
	_, _ = conn.Write(body)
	_ = conn.Close()
}

func sendJSONResponseWithOrigin(conn net.Conn, req *http.Request, status int, data any) {
	body, _ := json.Marshal(data)
	resp := fmt.Sprintf(
		"HTTP/1.1 %d %s\r\n"+
			"Content-Type: application/json\r\n"+
			"Access-Control-Allow-Origin: %s\r\n"+
			"Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE\r\n"+
			"Access-Control-Allow-Headers: Content-Type, X-HTTPeek-Token\r\n"+
			"Access-Control-Allow-Credentials: true\r\n"+
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
		"Access-Control-Allow-Credentials: true\r\n" +
		"Connection: close\r\n\r\n"
	_, _ = conn.Write([]byte(resp))
	_ = conn.Close()
}
