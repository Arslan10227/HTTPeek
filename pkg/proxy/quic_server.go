package proxy

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"httpeek/pkg/logger"

	"github.com/google/uuid"
	"github.com/quic-go/quic-go"
	"github.com/quic-go/quic-go/http3"
)

// QUICServer manages the HTTP/3 and QUIC UDP listener for transparent and forward proxying.
type QUICServer struct {
	server      *Server
	h3Server    *http3.Server
	udpConn     *net.UDPConn
	h3Transport *http3.Transport
	h2Transport *http.Transport
	running     bool
	mu          sync.Mutex
}

// NewQUICServer creates a new HTTP/3 & QUIC intercepting proxy server.
func NewQUICServer(s *Server) *QUICServer {
	h3Trans := &http3.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
		},
		QUICConfig: &quic.Config{
			KeepAlivePeriod: 15 * time.Second,
			MaxIdleTimeout:  30 * time.Second,
		},
	}

	h2Trans := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
		},
		ForceAttemptHTTP2:   true,
		MaxIdleConns:        100,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	return &QUICServer{
		server:      s,
		h3Transport: h3Trans,
		h2Transport: h2Trans,
	}
}

// Start binds UDP port and begins serving HTTP/3 traffic.
func (qs *QUICServer) Start(port int) error {
	qs.mu.Lock()
	defer qs.mu.Unlock()

	if qs.running {
		return nil
	}

	addr, err := net.ResolveUDPAddr("udp", fmt.Sprintf(":%d", port))
	if err != nil {
		return fmt.Errorf("resolve UDP addr failed: %w", err)
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		logger.Warn("QUIC", fmt.Sprintf("Failed to bind UDP port %d for HTTP/3: %v", port, err))
		return err
	}
	qs.udpConn = conn

	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS13,
		NextProtos: []string{http3.NextProtoH3},
		GetCertificate: func(info *tls.ClientHelloInfo) (*tls.Certificate, error) {
			if qs.server.certManager != nil {
				host := info.ServerName
				if host == "" {
					host = "localhost"
				}
				return qs.server.certManager.GetCertificate(host)
			}
			return nil, fmt.Errorf("certificate manager unavailable")
		},
	}

	qs.h3Server = &http3.Server{
		TLSConfig:  tlsConfig,
		Handler:    http.HandlerFunc(qs.handleHTTP3Request),
		QUICConfig: &quic.Config{
			KeepAlivePeriod: 15 * time.Second,
			MaxIdleTimeout:  30 * time.Second,
			EnableDatagrams: true,
		},
	}

	qs.running = true
	logger.Info("QUIC", fmt.Sprintf("HTTP/3 & QUIC listener active on UDP :%d", port))

	go func() {
		if err := qs.h3Server.Serve(conn); err != nil && qs.running {
			logger.Warn("QUIC", fmt.Sprintf("HTTP/3 server exited: %v", err))
		}
	}()

	return nil
}

// Stop terminates the HTTP/3 listener.
func (qs *QUICServer) Stop() error {
	qs.mu.Lock()
	defer qs.mu.Unlock()

	if !qs.running {
		return nil
	}
	qs.running = false

	var err error
	if qs.h3Server != nil {
		err = qs.h3Server.Close()
	}
	if qs.udpConn != nil {
		_ = qs.udpConn.Close()
	}
	logger.Info("QUIC", "HTTP/3 & QUIC listener stopped")
	return err
}

// handleHTTP3Request intercepts and processes downstream HTTP/3 requests.
func (qs *QUICServer) handleHTTP3Request(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	requestID := uuid.New().String()

	host := r.Host
	if host == "" {
		host = r.URL.Host
	}

	// Read downstream body
	var bodyBytes []byte
	if r.Body != nil {
		var err error
		bodyBytes, err = io.ReadAll(r.Body)
		_ = r.Body.Close()
		if err != nil {
			logger.Warn("QUIC", fmt.Sprintf("Failed to read HTTP/3 request body: %v", err))
		}
	}

	reqURL := r.URL.String()
	if !strings.HasPrefix(reqURL, "http://") && !strings.HasPrefix(reqURL, "https://") {
		reqURL = "https://" + host + r.URL.RequestURI()
	}

	parsedURL, _ := url.Parse(reqURL)
	_ = parsedURL
	port := 443
	if h, pStr, err := net.SplitHostPort(host); err == nil {
		host = h
		if p, err := strconvAtoi(pStr); err == nil {
			port = p
		}
	}

	httpReq := &HttpRequest{
		ID:         requestID,
		Protocol:   ProtoHTTP3,
		Method:     HttpMethod(r.Method),
		URL:        reqURL,
		Path:       r.URL.Path,
		Query:      r.URL.Query(),
		Headers:    r.Header.Clone(),
		Body:       bodyBytes,
		BodyString: string(bodyBytes),
		BodyText:   string(bodyBytes),
		RemoteAddr: r.RemoteAddr,
		ClientAddr: r.RemoteAddr,
		HostPort: HostPort{
			Host: host,
			Port: port,
			SSL:  true,
		},
		StartTime: startTime,
	}

	ctx := &Context{
		Values: make(map[string]any),
	}

	// 1. Process Request Phase in Interceptor Chain
	if qs.server.interceptor != nil {
		var err error
		httpReq, err = qs.server.interceptor.OnRequest(ctx, httpReq)
		if err != nil {
			http.Error(w, fmt.Sprintf("HTTPeek: Request Interceptor Error: %v", err), http.StatusForbidden)
			return
		}
	}

	// Emit Request Event to Frontend & Listeners
	qs.server.DispatchRequest(ctx, httpReq)

	// Check if an interceptor short-circuited (Execute)
	var shortCircuitResp *HttpResponse
	if qs.server.interceptor != nil {
		var err error
		shortCircuitResp, err = qs.server.interceptor.Execute(ctx, httpReq)
		if err != nil {
			http.Error(w, fmt.Sprintf("HTTPeek: Execute Error: %v", err), http.StatusBadGateway)
			return
		}
	}

	var respBodyBytes []byte
	var statusCode int
	var statusText string
	var respHeaders http.Header
	var contentType string

	if shortCircuitResp != nil {
		statusCode = shortCircuitResp.StatusCode
		statusText = shortCircuitResp.StatusText
		respHeaders = shortCircuitResp.Headers
		respBodyBytes = shortCircuitResp.Body
		contentType = shortCircuitResp.ContentType
	} else {
		// 2. Prepare Upstream Request
		outReq, err := http.NewRequestWithContext(r.Context(), string(httpReq.Method), httpReq.URL, bytes.NewReader(httpReq.Body))
		if err != nil {
			http.Error(w, fmt.Sprintf("HTTPeek: Request construction error: %v", err), http.StatusBadRequest)
			return
		}
		outReq.Header = httpReq.Headers.Clone()
		outReq.Header.Del("Alt-Svc") // avoid nested looping

		// 3. Send Upstream (try HTTP/3 first, fallback to HTTP/2/1.1)
		var resp *http.Response
		resp, err = qs.h3Transport.RoundTrip(outReq)
		if err != nil {
			// Fallback to standard TLS (HTTP/2 or HTTP/1.1)
			outReqFallback, _ := http.NewRequestWithContext(r.Context(), string(httpReq.Method), httpReq.URL, bytes.NewReader(httpReq.Body))
			outReqFallback.Header = httpReq.Headers.Clone()
			resp, err = qs.h2Transport.RoundTrip(outReqFallback)
		}

		if err != nil {
			logger.Warn("QUIC", fmt.Sprintf("Upstream roundtrip failed for %s: %v", httpReq.URL, err))
			http.Error(w, fmt.Sprintf("HTTPeek: Gateway Error: %v", err), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		respBodyBytes, _ = io.ReadAll(resp.Body)
		statusCode = resp.StatusCode
		statusText = resp.Status
		respHeaders = resp.Header.Clone()
		contentType = resp.Header.Get("Content-Type")
	}

	duration := time.Since(startTime).Milliseconds()

	httpResp := &HttpResponse{
		ID:          requestID,
		RequestID:   requestID,
		StatusCode:  statusCode,
		StatusText:  statusText,
		Headers:     respHeaders,
		Body:        respBodyBytes,
		BodyString:  string(respBodyBytes),
		BodyText:    string(respBodyBytes),
		ContentType: contentType,
		DurationMs:  duration,
		Request:     httpReq,
	}
	httpReq.Response = httpResp
	httpReq.EndTime = time.Now()
	httpReq.DurationMs = duration

	// 4. Process Response Phase in Interceptor Chain
	if qs.server.interceptor != nil {
		var err error
		httpResp, err = qs.server.interceptor.OnResponse(ctx, httpResp)
		if err != nil {
			logger.Warn("QUIC", fmt.Sprintf("Response interceptor error: %v", err))
		}
	}

	// Emit Response Event to Frontend
	qs.server.DispatchResponse(ctx, httpResp)

	// 5. Write Downstream Response
	for k, vals := range httpResp.Headers {
		for _, v := range vals {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(httpResp.StatusCode)
	_, _ = w.Write(httpResp.Body)
}

func strconvAtoi(s string) (int, error) {
	var res int
	var sign = 1
	for i, c := range s {
		if i == 0 && c == '-' {
			sign = -1
			continue
		}
		if c < '0' || c > '9' {
			return 0, fmt.Errorf("invalid int")
		}
		res = res*10 + int(c-'0')
	}
	return res * sign, nil
}
