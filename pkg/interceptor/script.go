package interceptor

import (
	"regexp"
	"sync"

	"httpeek/pkg/proxy"
	"httpeek/pkg/scriptengine"
)

// ScriptRule defines a JavaScript script matching specific URLs.
type ScriptRule struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Enabled    bool   `json:"enabled"`
	URLPattern string `json:"urlPattern"`
	ScriptCode string `json:"scriptCode"`
	regex      *regexp.Regexp
}

// ScriptInterceptor executes JavaScript scripts on matching traffic.
type ScriptInterceptor struct {
	BaseInterceptor
	rules      []*ScriptRule
	session    map[string]any
	sessionMu  sync.RWMutex
	env        map[string]string
	logHandler scriptengine.ScriptLogHandler
	mu         sync.RWMutex
}

// NewScriptInterceptor creates a script interceptor with priority 70.
func NewScriptInterceptor(logHandler scriptengine.ScriptLogHandler) *ScriptInterceptor {
	return &ScriptInterceptor{
		BaseInterceptor: NewBaseInterceptor("Script", 70, true),
		rules:           make([]*ScriptRule, 0),
		session:         make(map[string]any),
		env:             make(map[string]string),
		logHandler:      logHandler,
	}
}

// SetRules updates active script rules.
func (s *ScriptInterceptor) SetRules(rules []*ScriptRule) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, r := range rules {
		r.regex = compilePattern(r.URLPattern)
	}
	s.rules = rules
}

// GetRules returns active script rules.
func (s *ScriptInterceptor) GetRules() []*ScriptRule {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]*ScriptRule, len(s.rules))
	copy(out, s.rules)
	return out
}

// SetEnv updates environment variables accessible to scripts.
func (s *ScriptInterceptor) SetEnv(env map[string]string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.env = env
}

// OnRequest runs matching script's onRequest hook.
func (s *ScriptInterceptor) OnRequest(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpRequest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, r := range s.rules {
		if !r.Enabled || r.regex == nil || !r.regex.MatchString(req.URL) || r.ScriptCode == "" {
			continue
		}

		engine := scriptengine.NewEngine(s.logHandler, s.session, &s.sessionMu)
		modified, err := engine.RunOnRequest(r.ScriptCode, req, s.env)
		if err != nil {
			if s.logHandler != nil {
				s.logHandler(r.Name, "error", err.Error())
			}
			continue
		}
		req = modified
	}

	return req, nil
}

// OnResponse runs matching script's onResponse hook.
func (s *ScriptInterceptor) OnResponse(ctx *proxy.Context, req *proxy.HttpRequest, resp *proxy.HttpResponse) (*proxy.HttpResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, r := range s.rules {
		if !r.Enabled || r.regex == nil || !r.regex.MatchString(req.URL) || r.ScriptCode == "" {
			continue
		}

		engine := scriptengine.NewEngine(s.logHandler, s.session, &s.sessionMu)
		modified, err := engine.RunOnResponse(r.ScriptCode, req, resp, s.env)
		if err != nil {
			if s.logHandler != nil {
				s.logHandler(r.Name, "error", err.Error())
			}
			continue
		}
		resp = modified
	}

	return resp, nil
}
