package interceptor

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"sync"
	"time"

	"httpeek/pkg/proxy"

	"github.com/google/uuid"
)

type BlockAction string

const (
	BlockAction403  BlockAction = "403"
	BlockActionDrop BlockAction = "drop"
)

// BlockRule specifies a URL pattern to block.
type BlockRule struct {
	ID         string      `json:"id"`
	Name       string      `json:"name"`
	Enabled    bool        `json:"enabled"`
	URLPattern string      `json:"urlPattern"`
	Action     BlockAction `json:"action"` // "403", "drop", or status code
	StatusCode int         `json:"statusCode,omitempty"`
	regex      *regexp.Regexp
}

// UnmarshalJSON supports both action and statusCode.
func (b *BlockRule) UnmarshalJSON(data []byte) error {
	type Alias BlockRule
	aux := &struct {
		*Alias
	}{
		Alias: (*Alias)(b),
	}
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}
	if b.Action == "" {
		if b.StatusCode > 0 {
			b.Action = BlockAction(string(rune(b.StatusCode)))
		} else {
			b.Action = BlockAction403
		}
	}
	if b.StatusCode == 0 && b.Action != BlockActionDrop {
		b.StatusCode = 403
	}
	return nil
}

// RequestBlockInterceptor blocks matching requests before reaching remote servers.
type RequestBlockInterceptor struct {
	BaseInterceptor
	rules []*BlockRule
	mu    sync.RWMutex
}

// NewRequestBlockInterceptor creates a block interceptor with priority 30.
func NewRequestBlockInterceptor() *RequestBlockInterceptor {
	return &RequestBlockInterceptor{
		BaseInterceptor: NewBaseInterceptor("RequestBlock", 30, true),
		rules:           make([]*BlockRule, 0),
	}
}

// SetRules updates active blocking rules.
func (b *RequestBlockInterceptor) SetRules(rules []*BlockRule) {
	b.mu.Lock()
	defer b.mu.Unlock()

	for _, r := range rules {
		r.regex = compilePattern(r.URLPattern)
	}
	b.rules = rules
}

// GetRules returns active blocking rules.
func (b *RequestBlockInterceptor) GetRules() []*BlockRule {
	b.mu.RLock()
	defer b.mu.RUnlock()

	out := make([]*BlockRule, len(b.rules))
	copy(out, b.rules)
	return out
}

// Execute short-circuits with 403 or error drop if rule matches.
func (b *RequestBlockInterceptor) Execute(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpResponse, error) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, r := range b.rules {
		if !r.Enabled || r.regex == nil || !r.regex.MatchString(req.URL) {
			continue
		}

		if r.Action == BlockActionDrop {
			return nil, errors.New("request blocked by rule (connection dropped)")
		}

		// 403 Forbidden synthetic response
		now := time.Now()
		bodyBytes := []byte("Blocked by HTTPeek")
		headers := make(http.Header)
		headers.Set("Content-Type", "text/plain")
		headers.Set("X-Blocked-By", "HTTPeek")

		return &proxy.HttpResponse{
			ID:          uuid.NewString(),
			StatusCode:  http.StatusForbidden,
			StatusText:  "Forbidden",
			Protocol:    req.Protocol,
			Headers:     headers,
			Body:        bodyBytes,
			BodyString:  "Blocked by HTTPeek",
			BodySize:    int64(len(bodyBytes)),
			ContentType: "text/plain",
			StartTime:   now,
			EndTime:     now,
			DurationMs:  0,
			Request:     req,
		}, nil
	}

	return nil, nil
}
