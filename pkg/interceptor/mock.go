package interceptor

import (
	"encoding/json"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"httpeek/pkg/proxy"

	"github.com/google/uuid"
)

type MapType string

const (
	MapLocalFile  MapType = "localFile"
	MapLocalDir   MapType = "localDir"
	MapStaticMock MapType = "staticMock"
)

// MapRule defines a request mapping / mock rule.
type MapRule struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Enabled     bool              `json:"enabled"`
	URLPattern  string            `json:"urlPattern"`
	Type        MapType           `json:"type"`
	TargetFile  string            `json:"targetFile,omitempty"`
	TargetDir   string            `json:"targetDir,omitempty"`
	StatusCode  int               `json:"statusCode,omitempty"`
	Headers     map[string]string `json:"headers,omitempty"`
	Body        string            `json:"body,omitempty"`
	ContentType string            `json:"contentType,omitempty"`
	regex       *regexp.Regexp
}

// UnmarshalJSON supports both {targetFile, body} and {filePath, responseBody}.
func (m *MapRule) UnmarshalJSON(data []byte) error {
	type Alias MapRule
	aux := &struct {
		FilePath     string `json:"filePath"`
		ResponseBody string `json:"responseBody"`
		*Alias
	}{
		Alias: (*Alias)(m),
	}
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}
	if m.TargetFile == "" && aux.FilePath != "" {
		m.TargetFile = aux.FilePath
		if m.Type == "" {
			m.Type = MapLocalFile
		}
	}
	if m.Body == "" && aux.ResponseBody != "" {
		m.Body = aux.ResponseBody
		if m.Type == "" {
			m.Type = MapStaticMock
		}
	}
	if m.Type == "" {
		if m.TargetFile != "" {
			m.Type = MapLocalFile
		} else {
			m.Type = MapStaticMock
		}
	}
	return nil
}

// RequestMapInterceptor short-circuits remote calls by serving local files or mock data.
type RequestMapInterceptor struct {
	BaseInterceptor
	rules []*MapRule
	mu    sync.RWMutex
}

// NewRequestMapInterceptor creates a new map/mock interceptor with priority 40.
func NewRequestMapInterceptor() *RequestMapInterceptor {
	return &RequestMapInterceptor{
		BaseInterceptor: NewBaseInterceptor("RequestMap", 40, true),
		rules:           make([]*MapRule, 0),
	}
}

// SetRules updates active mapping rules.
func (m *RequestMapInterceptor) SetRules(rules []*MapRule) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, r := range rules {
		r.regex = compilePattern(r.URLPattern)
	}
	m.rules = rules
}

// GetRules returns the active mapping rules.
func (m *RequestMapInterceptor) GetRules() []*MapRule {
	m.mu.RLock()
	defer m.mu.RUnlock()

	out := make([]*MapRule, len(m.rules))
	copy(out, m.rules)
	return out
}

// Execute checks if request matches a mock/map rule and returns synthetic response.
func (m *RequestMapInterceptor) Execute(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpResponse, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, rule := range m.rules {
		if !rule.Enabled || rule.regex == nil || !rule.regex.MatchString(req.URL) {
			continue
		}

		switch rule.Type {
		case MapStaticMock:
			return m.buildStaticMock(req, rule), nil

		case MapLocalFile:
			if rule.TargetFile != "" {
				if data, err := os.ReadFile(rule.TargetFile); err == nil {
					ct := rule.ContentType
					if ct == "" {
						ct = mime.TypeByExtension(filepath.Ext(rule.TargetFile))
					}
					if ct == "" {
						ct = "application/octet-stream"
					}
					return m.buildFileResponse(req, data, ct, rule), nil
				}
			}

		case MapLocalDir:
			if rule.TargetDir != "" {
				relPath := strings.TrimPrefix(req.Path, "/")
				fullPath := filepath.Join(rule.TargetDir, filepath.FromSlash(relPath))
				if data, err := os.ReadFile(fullPath); err == nil {
					ct := mime.TypeByExtension(filepath.Ext(fullPath))
					if ct == "" {
						ct = "application/octet-stream"
					}
					return m.buildFileResponse(req, data, ct, rule), nil
				}
			}
		}
	}

	return nil, nil
}

func (m *RequestMapInterceptor) buildStaticMock(req *proxy.HttpRequest, rule *MapRule) *proxy.HttpResponse {
	status := rule.StatusCode
	if status == 0 {
		status = 200
	}

	headers := make(http.Header)
	for k, v := range rule.Headers {
		headers.Set(k, v)
	}

	ct := rule.ContentType
	if ct == "" {
		ct = "application/json; charset=utf-8"
	}
	headers.Set("Content-Type", ct)
	headers.Set("X-Mocked-By", "HTTPeek")

	bodyBytes := []byte(rule.Body)
	now := time.Now()

	return &proxy.HttpResponse{
		ID:          uuid.NewString(),
		StatusCode:  status,
		StatusText:  http.StatusText(status),
		Protocol:    req.Protocol,
		Headers:     headers,
		Body:        bodyBytes,
		BodyBase64:  "",
		BodyString:  rule.Body,
		BodyText:    rule.Body,
		BodySize:    int64(len(bodyBytes)),
		ContentType: ct,
		StartTime:   now,
		EndTime:     now,
		DurationMs:  0,
		Request:     req,
	}
}

func (m *RequestMapInterceptor) buildFileResponse(req *proxy.HttpRequest, data []byte, ct string, rule *MapRule) *proxy.HttpResponse {
	status := rule.StatusCode
	if status == 0 {
		status = 200
	}

	headers := make(http.Header)
	for k, v := range rule.Headers {
		headers.Set(k, v)
	}
	headers.Set("Content-Type", ct)
	headers.Set("X-Mapped-By", "HTTPeek")

	now := time.Now()
	isBinary := isBinaryContentType(ct)

	bodyString := ""
	if !isBinary {
		bodyString = string(data)
	}

	return &proxy.HttpResponse{
		ID:          uuid.NewString(),
		StatusCode:  status,
		StatusText:  http.StatusText(status),
		Protocol:    req.Protocol,
		Headers:     headers,
		Body:        data,
		BodyBase64:  "",
		BodyString:  bodyString,
		BodyText:    bodyString,
		BodySize:    int64(len(data)),
		ContentType: ct,
		IsBinary:    isBinary,
		StartTime:   now,
		EndTime:     now,
		DurationMs:  0,
		Request:     req,
	}
}

func isBinaryContentType(ct string) bool {
	ct = strings.ToLower(ct)
	binaryPrefixes := []string{
		"image/", "audio/", "video/", "font/",
		"application/octet-stream", "application/zip", "application/pdf",
	}
	for _, p := range binaryPrefixes {
		if strings.HasPrefix(ct, p) {
			return true
		}
	}
	return false
}
