package proxy

import (
	"context"
	"crypto/tls"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"
)

// HttpMethod constants.
type HttpMethod string

const (
	MethodGet     HttpMethod = "GET"
	MethodPost    HttpMethod = "POST"
	MethodPut     HttpMethod = "PUT"
	MethodDelete  HttpMethod = "DELETE"
	MethodPatch   HttpMethod = "PATCH"
	MethodHead    HttpMethod = "HEAD"
	MethodOptions HttpMethod = "OPTIONS"
	MethodConnect HttpMethod = "CONNECT"
	MethodTrace   HttpMethod = "TRACE"
)

// Protocol constants.
const (
	ProtoHTTP10 = "HTTP/1.0"
	ProtoHTTP11 = "HTTP/1.1"
	ProtoHTTP2  = "HTTP/2.0"
	ProtoWS     = "WebSocket"
	ProtoSSE    = "SSE"
)

// HostPort represents a host and port combination.
type HostPort struct {
	Host string `json:"host"`
	Port int    `json:"port"`
	SSL  bool   `json:"ssl"`
}

// String returns formatted host:port.
func (hp HostPort) String() string {
	return net.JoinHostPort(hp.Host, strconv.Itoa(hp.Port))
}

// ProcessInfo contains metadata about the client OS process.
type ProcessInfo struct {
	PID  int    `json:"pid"`
	Name string `json:"name"`
	Path string `json:"path"`
	Icon string `json:"icon,omitempty"` // Base64 encoded PNG
}

// AppliedRule records an interceptor mutation on an exchange.
type AppliedRule struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Summary string `json:"summary"`
}

// ExchangeTimings holds phase timings for performance inspection.
type ExchangeTimings struct {
	DNS     int64 `json:"dns,omitempty"`
	Connect int64 `json:"connect,omitempty"`
	TLS     int64 `json:"tls,omitempty"`
	TTFB    int64 `json:"ttfb,omitempty"`
	Total   int64 `json:"total,omitempty"`
}

// HttpRequest represents an intercepted HTTP request.
type HttpRequest struct {
	ID           string           `json:"id"`
	ExchangeID   string           `json:"exchangeId,omitempty"`
	StreamID     uint32           `json:"streamId,omitempty"`
	Protocol     string           `json:"protocol"`
	Method       HttpMethod       `json:"method"`
	URL          string           `json:"url"`
	Path         string           `json:"path"`
	Query        url.Values       `json:"query"`
	Headers      http.Header      `json:"headers"`
	Body         []byte           `json:"-"`
	BodyBase64   string           `json:"bodyBase64,omitempty"`
	BodyString   string           `json:"bodyString"`
	BodyText     string           `json:"body"`
	RemoteAddr   string           `json:"remoteAddr"`
	ClientAddr   string           `json:"clientAddr"`
	HostPort     HostPort         `json:"hostPort"`
	Process      *ProcessInfo     `json:"process,omitempty"`
	StartTime    time.Time        `json:"startTime"`
	EndTime      time.Time        `json:"endTime"`
	DurationMs   int64            `json:"durationMs"`
	Timings      *ExchangeTimings `json:"timings,omitempty"`
	AppliedRules []AppliedRule    `json:"appliedRules,omitempty"`
	IsFavorite   bool             `json:"isFavorite"`
	IsWebSocket  bool             `json:"isWebSocket"`
	rawRequest   *http.Request
	Response     *HttpResponse    `json:"response,omitempty"`
	Context      map[string]any   `json:"-"`
	mu           sync.RWMutex
}

// SetRawRequest stores the underlying standard library http.Request.
func (r *HttpRequest) SetRawRequest(req *http.Request) {
	if r != nil {
		r.rawRequest = req
	}
}

// GetRawRequest returns the underlying standard library http.Request.
func (r *HttpRequest) GetRawRequest() *http.Request {
	if r == nil {
		return nil
	}
	return r.rawRequest
}

// RecordAppliedRule appends a rule application record to the request.
func (r *HttpRequest) RecordAppliedRule(ruleType, id, summary string) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.AppliedRules = append(r.AppliedRules, AppliedRule{
		ID:      id,
		Type:    ruleType,
		Summary: summary,
	})
}

// GetHeader returns the first value associated with the given key.
func (r *HttpRequest) GetHeader(key string) string {
	if r == nil || r.Headers == nil {
		return ""
	}
	return r.Headers.Get(key)
}

// HttpResponse represents an intercepted HTTP response.
type HttpResponse struct {
	ID          string         `json:"id"`
	RequestID   string         `json:"requestId,omitempty"`
	StatusCode  int            `json:"statusCode"`
	StatusText  string         `json:"statusText"`
	Protocol    string         `json:"protocol"`
	Headers     http.Header    `json:"headers"`
	Body        []byte         `json:"-"`
	BodyBase64  string         `json:"bodyBase64,omitempty"`
	BodyString  string         `json:"bodyString"`
	BodyText    string         `json:"body"`
	BodySize    int64          `json:"bodySize"`
	ContentType string         `json:"contentType"`
	IsBinary    bool           `json:"isBinary"`
	StartTime   time.Time      `json:"startTime"`
	EndTime     time.Time      `json:"endTime"`
	DurationMs  int64          `json:"durationMs"`
	WsFrames    []*WsFrame     `json:"wsFrames,omitempty"`
	SSEEvents   []*SSEEvent    `json:"sseEvents,omitempty"`
	rawResponse *http.Response
	Request     *HttpRequest   `json:"-"`
	mu          sync.RWMutex
}

// SetRawResponse stores the underlying standard library http.Response.
func (resp *HttpResponse) SetRawResponse(res *http.Response) {
	if resp != nil {
		resp.rawResponse = res
	}
}

// GetRawResponse returns the underlying standard library http.Response.
func (resp *HttpResponse) GetRawResponse() *http.Response {
	if resp == nil {
		return nil
	}
	return resp.rawResponse
}

// WsFrame represents a single WebSocket frame.
type WsFrame struct {
	ID         string    `json:"id"`
	RequestID  string    `json:"requestId"`
	Opcode     int       `json:"opcode"` // 1=Text, 2=Binary, 8=Close, 9=Ping, 10=Pong
	OpcodeName string    `json:"opcodeName"`
	Direction  string    `json:"direction"` // "send" or "receive"
	Payload    []byte    `json:"-"`
	Text       string    `json:"text,omitempty"`
	Length     int       `json:"length"`
	Timestamp  time.Time `json:"timestamp"`
}

// SSEEvent represents a single Server-Sent Event chunk.
type SSEEvent struct {
	ID        string    `json:"id"`
	RequestID string    `json:"requestId"`
	Event     string    `json:"event"`
	Data      string    `json:"data"`
	Retry     int       `json:"retry,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// Context carries per-connection and per-request lifecycle state.
type Context struct {
	Context        context.Context
	Cancel         context.CancelFunc
	ClientConn     net.Conn
	ServerConn     net.Conn
	TLSClientState *tls.ConnectionState
	CurrentRequest *HttpRequest
	Values         map[string]any
	mu             sync.RWMutex
}

// NewContext creates a new initialized Context for an exchange.
func NewContext(parent context.Context, clientConn net.Conn) *Context {
	ctx, cancel := context.WithCancel(parent)
	return &Context{
		Context:    ctx,
		Cancel:     cancel,
		ClientConn: clientConn,
		Values:     make(map[string]any),
	}
}

// Set stores a key-value pair in the context.
func (c *Context) Set(key string, val any) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Values[key] = val
}

// Get retrieves a key-value pair from the context.
func (c *Context) Get(key string) (any, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	v, ok := c.Values[key]
	return v, ok
}

// ProxyEvent is emitted by the proxy engine to listeners.
type ProxyEvent struct {
	Type     string        `json:"type"` // "request", "response", "ws_frame", "sse_event", "error"
	Request  *HttpRequest  `json:"request,omitempty"`
	Response *HttpResponse `json:"response,omitempty"`
	WsFrame  *WsFrame      `json:"wsFrame,omitempty"`
	SSEEvent *SSEEvent     `json:"sseEvent,omitempty"`
	Error    string        `json:"error,omitempty"`
}

// EventListener receives real-time proxy traffic events.
type EventListener interface {
	OnRequest(ctx *Context, req *HttpRequest)
	OnResponse(ctx *Context, resp *HttpResponse)
	OnWsFrame(ctx *Context, frame *WsFrame)
	OnSSEEvent(ctx *Context, event *SSEEvent)
	OnError(ctx *Context, req *HttpRequest, err error)
}

// Interceptor intercepts and mutates proxy traffic.
type Interceptor interface {
	Priority() int
	PreConnect(ctx *Context, hostPort *HostPort) error
	OnRequest(ctx *Context, req *HttpRequest) (*HttpRequest, error)
	Execute(ctx *Context, req *HttpRequest) (*HttpResponse, error)
	OnResponse(ctx *Context, resp *HttpResponse) (*HttpResponse, error)
	OnError(ctx *Context, req *HttpRequest, err error)
}

