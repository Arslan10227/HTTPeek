package interceptor

import (
	"encoding/json"
	"regexp"
	"strings"
	"sync"
	"time"

	"httpeek/pkg/proxy"
)

// BreakpointRule defines match criteria for pausing traffic.
type BreakpointRule struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Enabled           bool   `json:"enabled"`
	URLPattern        string `json:"urlPattern"`
	Method            string `json:"method,omitempty"` // empty = all methods
	InterceptRequest  bool   `json:"interceptRequest"`
	InterceptResponse bool   `json:"interceptResponse"`
	regex             *regexp.Regexp
}

// UnmarshalJSON supports both {interceptRequest, interceptResponse} and {breakType: 'both'|'request'|'response'}.
func (b *BreakpointRule) UnmarshalJSON(data []byte) error {
	type Alias BreakpointRule
	aux := &struct {
		BreakType string `json:"breakType"`
		*Alias
	}{
		Alias: (*Alias)(b),
	}
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}
	if aux.BreakType != "" {
		switch aux.BreakType {
		case "request":
			b.InterceptRequest = true
			b.InterceptResponse = false
		case "response":
			b.InterceptRequest = false
			b.InterceptResponse = true
		case "both", "all":
			b.InterceptRequest = true
			b.InterceptResponse = true
		}
	}
	if !b.InterceptRequest && !b.InterceptResponse && b.Enabled {
		b.InterceptRequest = true
		b.InterceptResponse = true
	}
	return nil
}

type pausedRequest struct {
	req     *proxy.HttpRequest
	resChan chan *proxy.HttpRequest
}

type pausedResponse struct {
	resp    *proxy.HttpResponse
	resChan chan *proxy.HttpResponse
}

// BreakpointNotifier callback signature when breakpoint triggers.
type BreakpointNotifier func(event *BreakpointEvent)

// BreakpointEvent represents a paused breakpoint notification for the GUI.
type BreakpointEvent struct {
	Type      string              `json:"type"` // "request" or "response"
	RequestID string              `json:"requestId"`
	Request   *proxy.HttpRequest  `json:"request,omitempty"`
	Response  *proxy.HttpResponse `json:"response,omitempty"`
}

// RequestBreakpointInterceptor pauses matched requests/responses for interactive user inspection.
type RequestBreakpointInterceptor struct {
	BaseInterceptor
	rules           []*BreakpointRule
	pausedRequests  map[string]pausedRequest
	pausedResponses map[string]pausedResponse
	notifier        BreakpointNotifier
	timeout         time.Duration
	mu              sync.RWMutex
}

// NewRequestBreakpointInterceptor creates a new breakpoint interceptor with priority 50.
func NewRequestBreakpointInterceptor(notifier BreakpointNotifier) *RequestBreakpointInterceptor {
	return &RequestBreakpointInterceptor{
		BaseInterceptor: NewBaseInterceptor("RequestBreakpoint", 50, true),
		rules:           make([]*BreakpointRule, 0),
		pausedRequests:  make(map[string]pausedRequest),
		pausedResponses: make(map[string]pausedResponse),
		notifier:        notifier,
		timeout:         5 * time.Minute,
	}
}

// SetRules updates active breakpoint rules.
func (b *RequestBreakpointInterceptor) SetRules(rules []*BreakpointRule) {
	b.mu.Lock()
	defer b.mu.Unlock()

	for _, r := range rules {
		r.regex = compilePattern(r.URLPattern)
	}
	b.rules = rules
}

// GetRules returns active breakpoint rules.
func (b *RequestBreakpointInterceptor) GetRules() []*BreakpointRule {
	b.mu.RLock()
	defer b.mu.RUnlock()

	out := make([]*BreakpointRule, len(b.rules))
	copy(out, b.rules)
	return out
}

// OnRequest pauses the request if a rule matches InterceptRequest.
func (b *RequestBreakpointInterceptor) OnRequest(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpRequest, error) {
	b.mu.RLock()
	var matchedRule *BreakpointRule
	for _, r := range b.rules {
		if !r.Enabled || !r.InterceptRequest || r.regex == nil || !r.regex.MatchString(req.URL) {
			continue
		}
		if r.Method != "" && !strings.EqualFold(r.Method, string(req.Method)) {
			continue
		}
		matchedRule = r
		break
	}
	b.mu.RUnlock()

	if matchedRule == nil {
		return req, nil
	}

	resChan := make(chan *proxy.HttpRequest, 1)

	b.mu.Lock()
	b.pausedRequests[req.ID] = pausedRequest{
		req:     req,
		resChan: resChan,
	}
	b.mu.Unlock()

	// Notify GUI
	if b.notifier != nil {
		b.notifier(&BreakpointEvent{
			Type:      "request",
			RequestID: req.ID,
			Request:   req,
		})
	}

	// Wait for user resume, abort, or timeout
	select {
	case modifiedReq := <-resChan:
		if modifiedReq == nil {
			return nil, proxy.ErrBreakpointAborted
		}
		return modifiedReq, nil
	case <-time.After(b.timeout):
		b.mu.Lock()
		delete(b.pausedRequests, req.ID)
		b.mu.Unlock()
		return nil, proxy.ErrBreakpointTimeout
	}
}

// OnResponse pauses the response if a rule matches InterceptResponse.
func (b *RequestBreakpointInterceptor) OnResponse(ctx *proxy.Context, req *proxy.HttpRequest, resp *proxy.HttpResponse) (*proxy.HttpResponse, error) {
	b.mu.RLock()
	var matchedRule *BreakpointRule
	for _, r := range b.rules {
		if !r.Enabled || !r.InterceptResponse || r.regex == nil || !r.regex.MatchString(req.URL) {
			continue
		}
		if r.Method != "" && !strings.EqualFold(r.Method, string(req.Method)) {
			continue
		}
		matchedRule = r
		break
	}
	b.mu.RUnlock()

	if matchedRule == nil {
		return resp, nil
	}

	resChan := make(chan *proxy.HttpResponse, 1)

	b.mu.Lock()
	b.pausedResponses[req.ID] = pausedResponse{
		resp:    resp,
		resChan: resChan,
	}
	b.mu.Unlock()

	// Notify GUI
	if b.notifier != nil {
		b.notifier(&BreakpointEvent{
			Type:      "response",
			RequestID: req.ID,
			Request:   req,
			Response:  resp,
		})
	}

	// Wait for user resume, abort, or timeout
	select {
	case modifiedResp := <-resChan:
		if modifiedResp == nil {
			return nil, proxy.ErrBreakpointAborted
		}
		return modifiedResp, nil
	case <-time.After(b.timeout):
		b.mu.Lock()
		delete(b.pausedResponses, req.ID)
		b.mu.Unlock()
		return nil, proxy.ErrBreakpointTimeout
	}
}

// ResumeRequest resumes a paused request, applying modifications.
func (b *RequestBreakpointInterceptor) ResumeRequest(requestID string, req *proxy.HttpRequest) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if p, ok := b.pausedRequests[requestID]; ok {
		delete(b.pausedRequests, requestID)
		p.resChan <- req
	}
}

// ResumeUnmodifiedRequest resumes a paused request with its original untouched state.
func (b *RequestBreakpointInterceptor) ResumeUnmodifiedRequest(requestID string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if p, ok := b.pausedRequests[requestID]; ok {
		delete(b.pausedRequests, requestID)
		p.resChan <- p.req
	}
}

// AbortRequest aborts a paused request.
func (b *RequestBreakpointInterceptor) AbortRequest(requestID string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if p, ok := b.pausedRequests[requestID]; ok {
		delete(b.pausedRequests, requestID)
		p.resChan <- nil
	}
}

// ResumeResponse resumes a paused response, applying modifications.
func (b *RequestBreakpointInterceptor) ResumeResponse(requestID string, resp *proxy.HttpResponse) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if p, ok := b.pausedResponses[requestID]; ok {
		delete(b.pausedResponses, requestID)
		p.resChan <- resp
	}
}

// ResumeUnmodifiedResponse resumes a paused response with its original untouched state.
func (b *RequestBreakpointInterceptor) ResumeUnmodifiedResponse(requestID string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if p, ok := b.pausedResponses[requestID]; ok {
		delete(b.pausedResponses, requestID)
		p.resChan <- p.resp
	}
}

// AbortResponse aborts a paused response.
func (b *RequestBreakpointInterceptor) AbortResponse(requestID string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if p, ok := b.pausedResponses[requestID]; ok {
		delete(b.pausedResponses, requestID)
		p.resChan <- nil
	}
}
