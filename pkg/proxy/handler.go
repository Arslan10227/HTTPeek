package proxy

import (
	"bufio"
	"bytes"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"httpeek/pkg/logger"

	"github.com/google/uuid"
	"golang.org/x/net/http2"
)

// Handler processes incoming proxy connections and routes protocols.
type Handler struct {
	server    *Server
	reqCount  atomic.Int64
	transport *http.Transport
	mobileAPI *MobileAPIManager
}

// NewHandler creates a new connection handler.
func NewHandler(s *Server) *Handler {
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          1000,
		MaxIdleConnsPerHost:   100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true, // For intercepting upstream
		},
	}

	if s != nil && s.cfg.UpstreamProxy != "" {
		if u, err := url.Parse(s.cfg.UpstreamProxy); err == nil {
			tr.Proxy = http.ProxyURL(u)
		}
	}

	_ = http2.ConfigureTransport(tr)

	var mobileAPI *MobileAPIManager
	if s != nil {
		mobileAPI = NewMobileAPIManager(s)
	}

	return &Handler{
		server:    s,
		transport: tr,
		mobileAPI: mobileAPI,
	}
}

// HandleConnection inspects the initial bytes to route between HTTP, CONNECT, and SOCKS5.
func (h *Handler) HandleConnection(ctx *Context, clientConn net.Conn) {
	reader := bufio.NewReader(clientConn)

	peek, err := reader.Peek(3)
	if err != nil {
		return
	}

	// Detect SOCKS5 protocol: version 5
	if peek[0] == 0x05 && (peek[1] == 0x01 || peek[1] == 0x02) {
		if h.server.Config().EnableSOCKS5 {
			h.handleSOCKS5(ctx, clientConn, reader)
		}
		return
	}

	// Otherwise, handle as HTTP / HTTPS CONNECT
	h.handleHTTP(ctx, clientConn, reader, false)
}

func (h *Handler) isInternalRequest(req *http.Request) bool {
	if req == nil {
		return false
	}

	host := strings.ToLower(strings.TrimSpace(req.Host))
	hostName := host
	port := 0
	if parsedHost, parsedPort, err := net.SplitHostPort(host); err == nil {
		hostName = strings.Trim(parsedHost, "[]")
		port, _ = strconv.Atoi(parsedPort)
	} else {
		hostName = strings.Trim(host, "[]")
	}

	localHost := hostName == "" || hostName == "localhost" || hostName == "proxy.pin" ||
		hostName == "httpeek.local" || hostName == "127.0.0.1" || hostName == "::1"
	listenerPort := port != 0 && port == h.server.Port()
	if !localHost && !listenerPort {
		return false
	}
	if port != 0 && port != h.server.Port() {
		return false
	}

	path := req.URL.Path
	return strings.HasPrefix(path, "/ws") || strings.HasPrefix(path, "/api/") ||
		path == "/ssl" || path == "/ssl/" || path == "/ca.crt" || path == "/favicon.ico"
}

func (h *Handler) handleHTTP(ctx *Context, clientConn net.Conn, reader *bufio.Reader, isTLS bool) {
	for {
		h.applyReadDeadline(clientConn)
		req, err := http.ReadRequest(reader)
		if err != nil {
			return
		}

		path := req.URL.Path
		isInternal := h.isInternalRequest(req)

		if isInternal {
			// Handle Mobile API / WebSocket event stream
			if h.mobileAPI != nil && (strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/ws") || path == "/ca.crt") {
				if h.mobileAPI.HandleRequest(clientConn, reader, req) {
					return
				}
			}

			// Handle Root CA certificate download endpoint
			if path == "/ssl" || path == "/ssl/" || path == "/ca.crt" {
				h.serveCACertificate(clientConn, req)
				return
			}
		}

		if req.Method == http.MethodConnect {
			h.handleConnectTunnel(ctx, clientConn, reader, req)
			return
		}

		// WebSocket upgrade over plain HTTP: the Go transport cannot relay
		// 101 responses, so handle the upgrade explicitly like the TLS path.
		if strings.EqualFold(req.Header.Get("Upgrade"), "websocket") {
			h.handleWebSocketUpgrade(ctx, clientConn, req, false)
			return
		}

		// Plain HTTP proxy request
		if err := h.forwardHTTPRequest(ctx, clientConn, req, isTLS); err != nil {
			h.server.DispatchError(ctx, nil, err)
			return
		}

		// Close connection if not Keep-Alive
		if req.Close || strings.EqualFold(req.Header.Get("Connection"), "close") {
			return
		}
	}
}

func (h *Handler) handleConnectTunnel(ctx *Context, clientConn net.Conn, reader *bufio.Reader, req *http.Request) {
	host, portStr, err := net.SplitHostPort(req.Host)
	if err != nil {
		host = req.Host
		portStr = "443"
	}
	port, _ := strconv.Atoi(portStr)

	ctx.Set("filtered", false)
	host, port, filtered := h.applyPreConnect(ctx, host, port, true)
	targetAddr := net.JoinHostPort(host, strconv.Itoa(port))

	// Respond 200 Connection Established to client
	_, err = clientConn.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))
	if err != nil {
		return
	}

	// Long-lived tunnel: clear request-scoped deadlines.
	_ = clientConn.SetDeadline(time.Time{})

	// Wrap the connection so any bytes the bufio.Reader buffered beyond the
	// CONNECT request line (e.g. a pipelined TLS ClientHello) are preserved.
	conn := clientConn
	if reader != nil {
		conn = &bufferedConn{Conn: clientConn, reader: reader}
	}

	if filtered || !h.server.Config().EnableSSL {
		// Passthrough without MITM TLS decryption (filtered hosts or SSL disabled)
		h.passthroughTunnel(ctx, conn, targetAddr)
		return
	}

	if h.server.CertManager() == nil {
		h.passthroughTunnel(ctx, conn, targetAddr)
		return
	}

	// Perform MITM TLS Handshake with client
	tlsConfig := &tls.Config{
		GetCertificate: func(info *tls.ClientHelloInfo) (*tls.Certificate, error) {
			serverName := info.ServerName
			if serverName == "" {
				serverName = host
			}
			return h.server.CertManager().GetCertificate(serverName)
		},
		NextProtos: []string{"http/1.1"},
	}
	tlsClientConn := tls.Server(conn, tlsConfig)
	if err := tlsClientConn.Handshake(); err != nil {
		h.server.DispatchError(ctx, nil, fmt.Errorf("TLS client handshake failed for %s: %w", host, err))
		return
	}
	defer tlsClientConn.Close()

	ctx.TLSClientState = &tls.ConnectionState{}
	*ctx.TLSClientState = tlsClientConn.ConnectionState()

	// Handle decrypted HTTP requests over the TLS tunnel
	tlsReader := bufio.NewReader(tlsClientConn)
	h.handleDecryptedTLS(ctx, tlsClientConn, tlsReader, host, port)
}

func (h *Handler) handleDecryptedTLS(ctx *Context, clientConn net.Conn, reader *bufio.Reader, host string, port int) {
	for {
		h.applyReadDeadline(clientConn)
		req, err := http.ReadRequest(reader)
		if err != nil {
			return
		}

		// Reconstruct full URL for HTTPS
		if req.URL.Scheme == "" {
			req.URL.Scheme = "https"
		}
		if req.URL.Host == "" {
			if port == 443 {
				req.URL.Host = host
			} else {
				req.URL.Host = net.JoinHostPort(host, strconv.Itoa(port))
			}
		}

		// Check for WebSocket upgrade
		if strings.EqualFold(req.Header.Get("Upgrade"), "websocket") {
			h.handleWebSocketUpgrade(ctx, clientConn, req, true)
			return
		}

		if err := h.forwardHTTPRequest(ctx, clientConn, req, true); err != nil {
			h.server.DispatchError(ctx, nil, err)
			return
		}

		if req.Close || strings.EqualFold(req.Header.Get("Connection"), "close") {
			return
		}
	}
}

func (h *Handler) forwardHTTPRequest(ctx *Context, clientConn net.Conn, req *http.Request, isTLS bool) error {
	reqID := uuid.NewString()
	startTime := time.Now()

	var bodyBytes []byte
	maxRequestBodyBytes := h.server.Config().MaxRequestBodyBytes
	if maxRequestBodyBytes > 0 && req.ContentLength > maxRequestBodyBytes {
		return h.writeBodyLimitError(clientConn, req, fmt.Errorf("%w: request is %d bytes", ErrBodyTooLarge, req.ContentLength), http.StatusRequestEntityTooLarge)
	}
	if req.Body != nil {
		var err error
		bodyBytes, err = readLimitedBody(req.Body, maxRequestBodyBytes)
		if err != nil {
			if errors.Is(err, ErrBodyTooLarge) {
				return h.writeBodyLimitError(clientConn, req, err, http.StatusRequestEntityTooLarge)
			}
			return err
		}
		req.Body = io.NopCloser(bytes.NewReader(bodyBytes))
	}

	host := req.URL.Hostname()
	if host == "" {
		host = req.Host
		if idx := strings.IndexByte(host, ':'); idx != -1 {
			host = host[:idx]
		}
	}

	port := 80
	if isTLS {
		port = 443
	}
	if req.URL.Port() != "" {
		if p, err := strconv.Atoi(req.URL.Port()); err == nil {
			port = p
		}
	}

	fullURL := req.URL.String()
	if !strings.HasPrefix(fullURL, "http://") && !strings.HasPrefix(fullURL, "https://") {
		scheme := "http://"
		if isTLS {
			scheme = "https://"
		}
		fullURL = scheme + req.Host + req.URL.RequestURI()
	}

	// Decompress & decode request body for inspection and scripting
	decodedReqBytes, decodedReqStr := DecodeBody(bodyBytes, req.Header.Get("Content-Encoding"), req.Header.Get("Content-Type"))
	bodyBase64 := base64.StdEncoding.EncodeToString(decodedReqBytes)

	httpReq := &HttpRequest{
		ID:         reqID,
		ExchangeID: reqID,
		Protocol:   req.Proto,
		Method:     HttpMethod(req.Method),
		URL:        fullURL,
		Path:       req.URL.Path,
		Query:      req.URL.Query(),
		Headers:    req.Header.Clone(),
		Body:       decodedReqBytes,
		BodyBase64: bodyBase64,
		BodyString: decodedReqStr,
		BodyText:   decodedReqStr,
		RemoteAddr: req.Host,
		ClientAddr: clientConn.RemoteAddr().String(),
		HostPort: HostPort{
			Host: host,
			Port: port,
			SSL:  isTLS,
		},
		StartTime:  startTime,
		rawRequest: req,
		Context:    make(map[string]any),
	}

	ctx.CurrentRequest = httpReq

	ctx.Set("filtered", false)
	host, port, filtered := h.applyPreConnect(ctx, host, port, isTLS)
	httpReq.HostPort = HostPort{Host: host, Port: port, SSL: isTLS}
	h.rewriteRequestHost(req, host, port)

	capture := !filtered

	// Run Interceptor Chain OnRequest
	if capture && h.server.Interceptor() != nil {
		modReq, err := h.server.Interceptor().OnRequest(ctx, httpReq)
		if err != nil {
			return h.writeInterceptorError(clientConn, req, err)
		}
		if modReq != nil {
			httpReq = modReq
			bodyBytes = httpReq.Body
		}

		// Run Interceptor Execute (Mock / Synthetic short-circuit)
		mockResp, err := h.server.Interceptor().Execute(ctx, httpReq)
		if err != nil {
			return h.writeInterceptorError(clientConn, req, err)
		}
		if mockResp != nil {
			httpReq.Response = mockResp
			httpReq.EndTime = time.Now()
			httpReq.DurationMs = httpReq.EndTime.Sub(startTime).Milliseconds()

			h.server.DispatchRequest(ctx, httpReq)
			h.server.DispatchResponse(ctx, mockResp)

			h.applyWriteDeadline(clientConn)
			defer clientConn.SetWriteDeadline(time.Time{})
			statusText := mockResp.StatusText
			if statusText == "" {
				statusText = http.StatusText(mockResp.StatusCode)
			}
			respLine := fmt.Sprintf("HTTP/1.1 %d %s\r\n", mockResp.StatusCode, statusText)
			clientConn.Write([]byte(respLine))
			for k, vals := range mockResp.Headers {
				for _, v := range vals {
					clientConn.Write([]byte(fmt.Sprintf("%s: %s\r\n", k, v)))
				}
			}
			clientConn.Write([]byte(fmt.Sprintf("Content-Length: %d\r\n\r\n", len(mockResp.Body))))
			clientConn.Write(mockResp.Body)
			return nil
		}
	}

	// Emit onRequest to UI
	if capture {
		h.server.DispatchRequest(ctx, httpReq)
	}

	// Construct upstream request reflecting all interceptor modifications
	outURL, err := url.Parse(httpReq.URL)
	if err != nil {
		outURL = req.URL
	}
	if isTLS {
		outURL.Scheme = "https"
	} else if outURL.Scheme == "" {
		outURL.Scheme = "http"
	}
	if outURL.Host == "" {
		outURL.Host = httpReq.HostPort.String()
	}

	outReq, err := http.NewRequestWithContext(ctx.Context, string(httpReq.Method), outURL.String(), bytes.NewReader(bodyBytes))
	if err != nil {
		outReq = req.Clone(ctx.Context)
		outReq.Body = io.NopCloser(bytes.NewReader(bodyBytes))
	}
	outReq.Header = httpReq.Headers.Clone()
	outReq.Header.Del("Content-Encoding")
	outReq.Header.Del("Content-Length")
	outReq.Header.Del("Transfer-Encoding")
	// Preserve the original authority including non-default ports (virtual
	// hosts depend on Host:port). Go stores the Host header outside the
	// Header map, so an interceptor-supplied "Host" key takes precedence.
	outReq.Host = httpReq.HostPort.String()
	if host := httpReq.Headers.Get("Host"); host != "" {
		outReq.Host = host
		outReq.Header.Set("Host", host)
	}

	// Limit Accept-Encoding to formats we decompress reliably
	outReq.Header.Set("Accept-Encoding", "gzip, deflate, br")
	removeHopByHopHeaders(outReq.Header)

	// Send upstream request
	upstreamStart := time.Now()
	resp, err := h.transport.RoundTrip(outReq)
	connectMs := time.Since(upstreamStart).Milliseconds()
	if err != nil {
		h.server.DispatchError(ctx, httpReq, err)
		return err
	}
	defer resp.Body.Close()
	contentType := resp.Header.Get("Content-Type")
	contentEncoding := resp.Header.Get("Content-Encoding")
	isBinary := isBinaryContentType(contentType)

	// Check if this is an SSE (Server-Sent Events) stream - stream immediately without blocking
	if strings.Contains(strings.ToLower(contentType), "text/event-stream") {
		httpResp := &HttpResponse{
			ID:          reqID,
			StatusCode:  resp.StatusCode,
			StatusText:  resp.Status,
			Protocol:    resp.Proto,
			Headers:     resp.Header.Clone(),
			Body:        []byte("[Streaming Server-Sent Events]"),
			BodyString:  "[Streaming Server-Sent Events]",
			BodyText:    "[Streaming Server-Sent Events]",
			BodySize:    0,
			ContentType: contentType,
			IsBinary:    false,
			StartTime:   startTime,
			EndTime:     time.Now(),
			DurationMs:  time.Since(startTime).Milliseconds(),
			rawResponse: resp,
			Request:     httpReq,
		}
		httpReq.Response = httpResp
		if capture {
			h.server.DispatchResponse(ctx, httpResp)
		}
		return h.streamSSEResponse(ctx, clientConn, resp, nil)
	}

	respBodyBytes, err := readLimitedBody(resp.Body, h.server.Config().MaxResponseBodyBytes)
	if err != nil {
		if errors.Is(err, ErrBodyTooLarge) {
			return h.writeBodyLimitError(clientConn, req, err, http.StatusBadGateway)
		}
		return err
	}

	endTime := time.Now()
	duration := endTime.Sub(startTime).Milliseconds()

	// Decompress and decode response body
	decodedRespBytes, decodedRespStr := DecodeBody(respBodyBytes, contentEncoding, contentType)
	storageDir := ""
	if h.server != nil {
		storageDir = h.server.Config().StorageDir
	}
	decodedRespBytes, decodedRespStr, _ = PrepareBodyForStorage(storageDir, reqID, "response", decodedRespBytes, decodedRespStr)
	respBase64 := base64.StdEncoding.EncodeToString(decodedRespBytes)

	httpResp := &HttpResponse{
		ID:          reqID,
		StatusCode:  resp.StatusCode,
		StatusText:  resp.Status,
		Protocol:    resp.Proto,
		Headers:     resp.Header.Clone(),
		Body:        decodedRespBytes,
		BodyBase64:  respBase64,
		BodyString:  decodedRespStr,
		BodyText:    decodedRespStr,
		BodySize:    int64(len(decodedRespBytes)),
		ContentType: contentType,
		IsBinary:    isBinary,
		StartTime:   startTime,
		EndTime:     endTime,
		DurationMs:  duration,
		rawResponse: resp,
		Request:     httpReq,
	}

	// Run Interceptor Chain OnResponse
	if capture && h.server.Interceptor() != nil {
		modResp, err := h.server.Interceptor().OnResponse(ctx, httpResp)
		if err != nil {
			return h.writeInterceptorError(clientConn, req, err)
		}
		if modResp != nil {
			httpResp = modResp
			decodedRespBytes = httpResp.Body
			// Re-derive metadata after interceptor mutation so UI/export
			// consumers agree with the bytes actually delivered.
			httpResp.BodySize = int64(len(decodedRespBytes))
			if ct := httpResp.Headers.Get("Content-Type"); ct != "" {
				httpResp.ContentType = ct
			}
			httpResp.IsBinary = isBinaryContentType(httpResp.ContentType)
		}
	}

	httpReq.Response = httpResp
	httpReq.EndTime = endTime
	httpReq.DurationMs = duration
	httpReq.Timings = &ExchangeTimings{
		Connect: connectMs,
		TTFB:    connectMs,
		Total:   duration,
	}
	if isTLS {
		httpReq.Timings.TLS = connectMs / 2
		httpReq.Timings.Connect = connectMs / 2
	}
	if resp.Proto == ProtoHTTP2 || strings.HasPrefix(resp.Proto, "HTTP/2") {
		httpReq.Protocol = ProtoHTTP2
		httpResp.Protocol = ProtoHTTP2
	}

	// Emit onResponse to UI
	if capture {
		h.server.DispatchResponse(ctx, httpResp)
	}

	// Write response to client using httpResp (which includes all interceptor mutations)
	clientHeaders := httpResp.Headers.Clone()
	removeHopByHopHeaders(clientHeaders)

	// Since we deliver the decoded/modified body, clear compressed Content-Encoding and chunked Transfer-Encoding
	clientHeaders.Del("Content-Encoding")
	clientHeaders.Del("Transfer-Encoding")
	clientHeaders.Set("Content-Length", strconv.Itoa(len(decodedRespBytes)))
	// HTTP/1.0 closes by default unless keep-alive was requested; reflect the
	// client's framing intent instead of always advertising keep-alive.
	if req != nil && req.Close {
		clientHeaders.Set("Connection", "close")
	} else {
		clientHeaders.Set("Connection", "keep-alive")
	}

	statusCode := httpResp.StatusCode
	if statusCode == 0 {
		statusCode = resp.StatusCode
	}
	statusText := httpResp.StatusText
	if statusText == "" {
		statusText = http.StatusText(statusCode)
	}

	h.applyWriteDeadline(clientConn)
	defer clientConn.SetWriteDeadline(time.Time{})
	clientProto := "HTTP/1.1"
	if req != nil && req.Proto != "" {
		clientProto = req.Proto
	}
	statusLine := fmt.Sprintf("%s %d %s\r\n", clientProto, statusCode, statusText)
	if _, err := clientConn.Write([]byte(statusLine)); err != nil {
		return err
	}

	if err := clientHeaders.Write(clientConn); err != nil {
		return err
	}

	if _, err := clientConn.Write([]byte("\r\n")); err != nil {
		return err
	}

	if len(decodedRespBytes) > 0 {
		_, err = clientConn.Write(decodedRespBytes)
		if err != nil {
			return err
		}
	}

	logger.Debug("Proxy", fmt.Sprintf("[%s] %s -> %d (%dms, %d B)", httpReq.Method, httpReq.URL, statusCode, duration, len(decodedRespBytes)))
	return nil
}

func (h *Handler) serveCACertificate(clientConn net.Conn, req *http.Request) {
	if h.server == nil || h.server.CertManager() == nil || h.server.CertManager().CA() == nil {
		body := []byte("Root CA not available")
		resp := fmt.Sprintf("HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: %d\r\nConnection: close\r\n\r\n", len(body))
		_, _ = clientConn.Write([]byte(resp))
		_, _ = clientConn.Write(body)
		return
	}
	caCertPEM := h.server.CertManager().CA().CertPEM
	resp := fmt.Sprintf(
		"HTTP/1.1 200 OK\r\n"+
			"Content-Type: application/x-x509-ca-cert\r\n"+
			"Content-Disposition: attachment; filename=\"httpeek-root-ca.crt\"\r\n"+
			"Content-Length: %d\r\n"+
			"Connection: close\r\n\r\n",
		len(caCertPEM),
	)
	_, _ = clientConn.Write([]byte(resp))
	_, _ = clientConn.Write(caCertPEM)
}

func (h *Handler) passthroughTunnel(ctx *Context, clientConn net.Conn, targetAddr string) {
	remoteConn, err := net.DialTimeout("tcp", targetAddr, 10*time.Second)
	if err != nil {
		return
	}
	h.passthroughTunnelWithRemote(clientConn, remoteConn)
}

func (h *Handler) passthroughTunnelWithRemote(clientConn net.Conn, remoteConn net.Conn) {
	defer remoteConn.Close()

	errChan := make(chan error, 2)
	go func() {
		buf := GetBuffer()
		defer PutBuffer(buf)
		_, err := io.CopyBuffer(remoteConn, clientConn, *buf)
		errChan <- err
	}()
	go func() {
		buf := GetBuffer()
		defer PutBuffer(buf)
		_, err := io.CopyBuffer(clientConn, remoteConn, *buf)
		errChan <- err
	}()

	<-errChan
}

func removeHopByHopHeaders(header http.Header) {
	hopByHop := []string{
		"Proxy-Connection",
		"Keep-Alive",
		"Transfer-Encoding",
		"Upgrade",
	}
	for _, h := range hopByHop {
		header.Del(h)
	}
}

func isBinaryContentType(ct string) bool {
	ct = strings.ToLower(ct)
	if ct == "" {
		return false
	}
	textTypes := []string{
		"text/",
		"application/json",
		"application/javascript",
		"application/xml",
		"application/x-www-form-urlencoded",
		"application/xhtml+xml",
		"image/svg+xml",
	}
	for _, t := range textTypes {
		if strings.Contains(ct, t) {
			return false
		}
	}
	return true
}

func (h *Handler) applyPreConnect(ctx *Context, host string, port int, ssl bool) (string, int, bool) {
	hp := HostPort{Host: host, Port: port, SSL: ssl}
	if h.server.Interceptor() != nil {
		_ = h.server.Interceptor().PreConnect(ctx, &hp)
	}
	filtered := false
	if v, ok := ctx.Get("filtered"); ok {
		filtered, _ = v.(bool)
	}
	return hp.Host, hp.Port, filtered
}

func (h *Handler) rewriteRequestHost(req *http.Request, host string, port int) {
	if host == "" {
		return
	}
	if port == 443 || port == 80 {
		req.URL.Host = host
	} else {
		req.URL.Host = net.JoinHostPort(host, strconv.Itoa(port))
	}
	req.Host = req.URL.Host
}

func (h *Handler) applyReadDeadline(conn net.Conn) {
	if h.server == nil {
		return
	}
	if rt := h.server.Config().ReadTimeout; rt > 0 {
		_ = conn.SetReadDeadline(time.Now().Add(rt))
	}
}

func (h *Handler) applyWriteDeadline(conn net.Conn) {
	if h.server == nil {
		return
	}
	if wt := h.server.Config().WriteTimeout; wt > 0 {
		_ = conn.SetWriteDeadline(time.Now().Add(wt))
	}
}

func readLimitedBody(reader io.Reader, limit int64) ([]byte, error) {
	if limit <= 0 {
		return io.ReadAll(reader)
	}
	body, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > limit {
		return nil, fmt.Errorf("%w: limit is %d bytes", ErrBodyTooLarge, limit)
	}
	return body, nil
}

func (h *Handler) writeBodyLimitError(clientConn net.Conn, req *http.Request, err error, status int) error {
	h.applyWriteDeadline(clientConn)
	defer clientConn.SetWriteDeadline(time.Time{})
	body := []byte(err.Error())
	proto := "HTTP/1.1"
	if req != nil && req.Proto != "" {
		proto = req.Proto
	}
	resp := fmt.Sprintf("%s %d %s\r\nContent-Type: text/plain\r\nContent-Length: %d\r\nConnection: close\r\n\r\n",
		proto, status, http.StatusText(status), len(body))
	_, _ = clientConn.Write([]byte(resp))
	_, _ = clientConn.Write(body)
	return err
}

func (h *Handler) writeInterceptorError(clientConn net.Conn, req *http.Request, err error) error {
	h.applyWriteDeadline(clientConn)
	defer clientConn.SetWriteDeadline(time.Time{})
	status := http.StatusBadGateway
	msg := err.Error()
	switch {
	case errors.Is(err, ErrBreakpointAborted):
		status = http.StatusForbidden
		msg = "Request aborted by breakpoint"
	case errors.Is(err, ErrBreakpointTimeout):
		status = http.StatusGatewayTimeout
		msg = "Breakpoint timed out"
	}
	body := []byte(msg)
	proto := "HTTP/1.1"
	if req != nil && req.Proto != "" {
		proto = req.Proto
	}
	resp := fmt.Sprintf("%s %d %s\r\nContent-Type: text/plain\r\nContent-Length: %d\r\nConnection: close\r\n\r\n",
		proto, status, http.StatusText(status), len(body))
	_, _ = clientConn.Write([]byte(resp))
	_, _ = clientConn.Write(body)
	return err
}
