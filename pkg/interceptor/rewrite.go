package interceptor

import (
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"httpeek/pkg/proxy"
)

type RewriteRuleType string

const (
	RuleRequestReplace  RewriteRuleType = "requestReplace"
	RuleRequestUpdate   RewriteRuleType = "requestUpdate"
	RuleResponseReplace RewriteRuleType = "responseReplace"
	RuleResponseUpdate  RewriteRuleType = "responseUpdate"
	RuleRedirect        RewriteRuleType = "redirect"
)

type ActionType string

const (
	ActionReplaceRequestLine ActionType = "replaceRequestLine"
	ActionAddHeader          ActionType = "addHeader"
	ActionRemoveHeader       ActionType = "removeHeader"
	ActionUpdateHeader       ActionType = "updateHeader"
	ActionAddQueryParam      ActionType = "addQueryParam"
	ActionRemoveQueryParam   ActionType = "removeQueryParam"
	ActionUpdateQueryParam   ActionType = "updateQueryParam"
	ActionReplaceBody        ActionType = "replaceBody"
	ActionUpdateBody         ActionType = "updateBody"
	ActionReplaceStatus      ActionType = "replaceStatus"
)

// RewriteItem defines a single mutation step within a rewrite rule.
type RewriteItem struct {
	ID         string     `json:"id"`
	Type       ActionType `json:"type"`
	Enabled    bool       `json:"enabled"`
	Key        string     `json:"key,omitempty"`        // Header name, query param name, or regex search pattern
	Value      string     `json:"value,omitempty"`      // Replacement value or substitution template ($1)
	Method     string     `json:"method,omitempty"`     // For replaceRequestLine
	Path       string     `json:"path,omitempty"`       // For replaceRequestLine
	QueryParam string     `json:"queryParam,omitempty"` // For replaceRequestLine
	StatusCode int        `json:"statusCode,omitempty"` // For replaceStatus
	BodyFile   string     `json:"bodyFile,omitempty"`   // File path for replaceBody
	IsRegex    bool       `json:"isRegex,omitempty"`
	regex      *regexp.Regexp
}

// RewriteRule binds a URL pattern to a list of rewrite mutation items.
type RewriteRule struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Enabled     bool            `json:"enabled"`
	URLPattern  string          `json:"urlPattern"`
	Method      string          `json:"method,omitempty"`
	RedirectURL string          `json:"redirectUrl,omitempty"`
	Type        RewriteRuleType `json:"type"`
	Items       []*RewriteItem  `json:"items"`
	regex       *regexp.Regexp
}

// UnmarshalJSON provides dual compatibility with ProxyPin and HTTPeek rule formats.
func (r *RewriteRule) UnmarshalJSON(data []byte) error {
	type Alias RewriteRule
	aux := &struct {
		Action         string            `json:"action"`
		ReplaceBody    string            `json:"replaceBody"`
		ReplaceHeaders map[string]string `json:"replaceHeaders"`
		ReplaceStatus  int               `json:"replaceStatus"`
		*Alias
	}{
		Alias: (*Alias)(r),
	}
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}

	if r.Type == "" && aux.Action != "" {
		switch aux.Action {
		case "redirect":
			r.Type = RuleRedirect
		case "replace":
			if aux.ReplaceStatus > 0 || len(aux.ReplaceHeaders) > 0 || aux.ReplaceBody != "" {
				r.Type = RuleResponseReplace
			} else {
				r.Type = RuleRequestReplace
			}
		case "update":
			r.Type = RuleRequestUpdate
		}
	}

	// If items were not provided, synthesise from flat fields
	if len(r.Items) == 0 {
		if aux.ReplaceStatus > 0 {
			r.Items = append(r.Items, &RewriteItem{
				ID:         r.ID + "-status",
				Type:       ActionReplaceStatus,
				Enabled:    true,
				StatusCode: aux.ReplaceStatus,
			})
		}
		for k, v := range aux.ReplaceHeaders {
			r.Items = append(r.Items, &RewriteItem{
				ID:      r.ID + "-hdr-" + k,
				Type:    ActionUpdateHeader,
				Enabled: true,
				Key:     k,
				Value:   v,
			})
		}
		if aux.ReplaceBody != "" {
			actionType := ActionReplaceBody
			r.Items = append(r.Items, &RewriteItem{
				ID:      r.ID + "-body",
				Type:    actionType,
				Enabled: true,
				Value:   aux.ReplaceBody,
			})
		}
	}

	return nil
}

// RequestRewriteInterceptor handles dynamic header, param, status, body, and redirect rewrites.
type RequestRewriteInterceptor struct {
	BaseInterceptor
	rules []*RewriteRule
	mu    sync.RWMutex
}

// NewRequestRewriteInterceptor creates a new rewrite interceptor with priority 60.
func NewRequestRewriteInterceptor() *RequestRewriteInterceptor {
	return &RequestRewriteInterceptor{
		BaseInterceptor: NewBaseInterceptor("RequestRewrite", 60, true),
		rules:           make([]*RewriteRule, 0),
	}
}

// SetRules updates the active rewrite rules.
func (r *RequestRewriteInterceptor) SetRules(rules []*RewriteRule) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, rule := range rules {
		rule.regex = compilePattern(rule.URLPattern)
		for _, item := range rule.Items {
			if item.IsRegex && item.Key != "" {
				item.regex, _ = regexp.Compile(item.Key)
			}
		}
	}
	r.rules = rules
}

// GetRules returns active rewrite rules.
func (r *RequestRewriteInterceptor) GetRules() []*RewriteRule {
	r.mu.RLock()
	defer r.mu.RUnlock()

	out := make([]*RewriteRule, len(r.rules))
	copy(out, r.rules)
	return out
}

// OnRequest mutates the request according to matching request rules.
func (r *RequestRewriteInterceptor) OnRequest(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpRequest, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, rule := range r.rules {
		if !rule.Enabled || rule.regex == nil || !rule.regex.MatchString(req.URL) {
			continue
		}
		if rule.Method != "" && !strings.EqualFold(rule.Method, string(req.Method)) {
			continue
		}
		// Skip response-only rewrite rules in request phase
		if rule.Type == RuleResponseReplace || rule.Type == RuleResponseUpdate {
			continue
		}

		if rule.Type == RuleRedirect && rule.RedirectURL != "" {
			targetURL := rule.RedirectURL
			if strings.Contains(rule.URLPattern, "*") && strings.Contains(targetURL, "*") {
				base := strings.ReplaceAll(rule.URLPattern, "*", "")
				suffix := strings.ReplaceAll(req.URL, base, "")
				targetURL = strings.ReplaceAll(targetURL, "*", suffix)
			}
			req.URL = targetURL
			if parsed, err := url.Parse(targetURL); err == nil {
				req.Path = parsed.Path
				req.Query = parsed.Query()
				req.HostPort.Host = parsed.Hostname()
				if parsed.Port() != "" {
					req.HostPort.Port, _ = strconv.Atoi(parsed.Port())
				}
				req.Headers.Set("Host", parsed.Host)
			}
			continue
		}

		for _, item := range rule.Items {
			if !item.Enabled {
				continue
			}
			r.applyRequestItem(req, item)
		}
	}

	return req, nil
}

// OnResponse mutates the response according to matching response rules.
func (r *RequestRewriteInterceptor) OnResponse(ctx *proxy.Context, req *proxy.HttpRequest, resp *proxy.HttpResponse) (*proxy.HttpResponse, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, rule := range r.rules {
		if !rule.Enabled || rule.regex == nil || !rule.regex.MatchString(req.URL) {
			continue
		}
		if rule.Method != "" && !strings.EqualFold(rule.Method, string(req.Method)) {
			continue
		}
		// Skip request-only rewrite rules in response phase
		if rule.Type == RuleRequestReplace || rule.Type == RuleRequestUpdate || rule.Type == RuleRedirect {
			continue
		}

		for _, item := range rule.Items {
			if !item.Enabled {
				continue
			}
			r.applyResponseItem(resp, item)
		}
	}

	return resp, nil
}

func (r *RequestRewriteInterceptor) applyRequestItem(req *proxy.HttpRequest, item *RewriteItem) {
	switch item.Type {
	case ActionReplaceRequestLine:
		if item.Method != "" {
			req.Method = proxy.HttpMethod(item.Method)
		}
		if item.Path != "" {
			req.Path = item.Path
			if parsed, err := url.Parse(req.URL); err == nil {
				parsed.Path = item.Path
				if item.QueryParam != "" {
					parsed.RawQuery = item.QueryParam
				}
				req.URL = parsed.String()
				req.Query = parsed.Query()
			}
		}

	case ActionAddHeader:
		req.Headers.Add(item.Key, item.Value)

	case ActionRemoveHeader:
		req.Headers.Del(item.Key)

	case ActionUpdateHeader:
		req.Headers.Set(item.Key, item.Value)

	case ActionAddQueryParam:
		req.Query.Add(item.Key, item.Value)
		updateURLQuery(req)

	case ActionRemoveQueryParam:
		req.Query.Del(item.Key)
		updateURLQuery(req)

	case ActionUpdateQueryParam:
		req.Query.Set(item.Key, item.Value)
		updateURLQuery(req)

	case ActionReplaceBody:
		if item.BodyFile != "" {
			if data, err := os.ReadFile(item.BodyFile); err == nil {
				req.Body = data
				req.BodyString = string(data)
			}
		} else {
			req.Body = []byte(item.Value)
			req.BodyString = item.Value
		}
		req.Headers.Set("Content-Length", strconv.Itoa(len(req.Body)))
		req.Headers.Del("Content-Encoding")

	case ActionUpdateBody:
		if len(req.Body) > 0 && item.Key != "" {
			bodyStr := req.BodyString
			if item.regex != nil {
				bodyStr = item.regex.ReplaceAllString(bodyStr, item.Value)
			} else {
				bodyStr = strings.ReplaceAll(bodyStr, item.Key, item.Value)
			}
			req.Body = []byte(bodyStr)
			req.BodyString = bodyStr
			req.Headers.Set("Content-Length", strconv.Itoa(len(req.Body)))
			req.Headers.Del("Content-Encoding")
		}
	}
}

func (r *RequestRewriteInterceptor) applyResponseItem(resp *proxy.HttpResponse, item *RewriteItem) {
	switch item.Type {
	case ActionReplaceStatus:
		if item.StatusCode > 0 {
			resp.StatusCode = item.StatusCode
			resp.StatusText = http.StatusText(item.StatusCode)
		}

	case ActionAddHeader:
		resp.Headers.Add(item.Key, item.Value)

	case ActionRemoveHeader:
		resp.Headers.Del(item.Key)

	case ActionUpdateHeader:
		resp.Headers.Set(item.Key, item.Value)

	case ActionReplaceBody:
		if item.BodyFile != "" {
			if data, err := os.ReadFile(item.BodyFile); err == nil {
				resp.Body = data
				resp.BodyString = string(data)
				resp.BodySize = int64(len(data))
			}
		} else {
			resp.Body = []byte(item.Value)
			resp.BodyString = item.Value
			resp.BodySize = int64(len(item.Value))
		}
		resp.Headers.Set("Content-Length", strconv.Itoa(len(resp.Body)))
		resp.Headers.Del("Content-Encoding")

	case ActionUpdateBody:
		if len(resp.Body) > 0 && item.Key != "" {
			bodyStr := resp.BodyString
			if item.regex != nil {
				bodyStr = item.regex.ReplaceAllString(bodyStr, item.Value)
			} else {
				bodyStr = strings.ReplaceAll(bodyStr, item.Key, item.Value)
			}
			resp.Body = []byte(bodyStr)
			resp.BodyString = bodyStr
			resp.BodySize = int64(len(resp.Body))
			resp.Headers.Set("Content-Length", strconv.Itoa(len(resp.Body)))
			resp.Headers.Del("Content-Encoding")
		}
	}
}

func updateURLQuery(req *proxy.HttpRequest) {
	if parsed, err := url.Parse(req.URL); err == nil {
		parsed.RawQuery = req.Query.Encode()
		req.URL = parsed.String()
	}
}

func compilePattern(pattern string) *regexp.Regexp {
	if strings.TrimSpace(pattern) == "" {
		return nil
	}
	if strings.HasPrefix(pattern, "regex:") {
		r, _ := regexp.Compile(strings.TrimPrefix(pattern, "regex:"))
		return r
	}
	p := pattern
	escaped := regexp.QuoteMeta(p)
	escaped = strings.ReplaceAll(escaped, "\\*", ".*")
	if !strings.Contains(p, "://") {
		escaped = "(https?://)?" + escaped
	}
	r, _ := regexp.Compile("(?i)" + escaped)
	return r
}
