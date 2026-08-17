package interceptor

import (
	"bytes"
	"encoding/json"
	"net/http"
	"regexp"
	"sync"
	"time"

	"httpeek/pkg/proxy"
)

// ReportServerConfig defines an external webhook endpoint to forward captured traffic.
type ReportServerConfig struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Enabled    bool              `json:"enabled"`
	URLPattern string            `json:"urlPattern,omitempty"`
	WebhookURL string            `json:"webhookUrl"`
	Headers    map[string]string `json:"headers,omitempty"`
	regex      *regexp.Regexp
}

// ReportServerInterceptor asynchronously pushes captured traffic events to external servers.
type ReportServerInterceptor struct {
	BaseInterceptor
	configs []*ReportServerConfig
	client  *http.Client
	mu      sync.RWMutex
}

// NewReportServerInterceptor creates a report server interceptor with priority 90.
func NewReportServerInterceptor() *ReportServerInterceptor {
	return &ReportServerInterceptor{
		BaseInterceptor: NewBaseInterceptor("ReportServer", 90, true),
		configs:         make([]*ReportServerConfig, 0),
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// SetConfigs updates active report server configurations.
func (r *ReportServerInterceptor) SetConfigs(configs []*ReportServerConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, c := range configs {
		if c.URLPattern != "" {
			c.regex = compilePattern(c.URLPattern)
		}
	}
	r.configs = configs
}

// GetConfigs returns a copy of active report server configurations.
func (r *ReportServerInterceptor) GetConfigs() []*ReportServerConfig {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*ReportServerConfig, len(r.configs))
	copy(out, r.configs)
	return out
}

// OnResponse asynchronously forwards completed requests to configured report webhooks.
func (r *ReportServerInterceptor) OnResponse(ctx *proxy.Context, req *proxy.HttpRequest, resp *proxy.HttpResponse) (*proxy.HttpResponse, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, c := range r.configs {
		if !c.Enabled || c.WebhookURL == "" {
			continue
		}
		if c.regex != nil && !c.regex.MatchString(req.URL) {
			continue
		}

		go r.dispatchWebhook(c, req, resp)
	}

	return resp, nil
}

func (r *ReportServerInterceptor) dispatchWebhook(c *ReportServerConfig, req *proxy.HttpRequest, resp *proxy.HttpResponse) {
	payload := map[string]any{
		"requestId":  req.ID,
		"method":     req.Method,
		"url":        req.URL,
		"statusCode": resp.StatusCode,
		"durationMs": resp.DurationMs,
		"request": map[string]any{
			"headers": req.Headers,
			"body":    req.BodyString,
		},
		"response": map[string]any{
			"headers": resp.Headers,
			"body":    resp.BodyString,
		},
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return
	}

	httpReq, err := http.NewRequest("POST", c.WebhookURL, bytes.NewReader(data))
	if err != nil {
		return
	}

	httpReq.Header.Set("Content-Type", "application/json")
	for k, v := range c.Headers {
		httpReq.Header.Set(k, v)
	}

	respPost, err := r.client.Do(httpReq)
	if err == nil && respPost != nil {
		_ = respPost.Body.Close()
	}
}
