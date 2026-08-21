package interceptor

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync"

	"httpeek/pkg/logger"
	"httpeek/pkg/proxy"
)

// HostRule maps a host pattern (domain, wildcard, or regex) to a target IP or domain alias.
type HostRule struct {
	ID       string `json:"id"`
	Name     string `json:"name,omitempty"`
	Enabled  bool   `json:"enabled"`
	Pattern  string `json:"pattern"` // e.g. "api.example.com", "*.example.com", or "regex:^.*\.test$"
	TargetIP string `json:"targetIp"`
	regex    *regexp.Regexp
}

// UnmarshalJSON supports both {pattern, targetIp} and {domain, target}.
func (h *HostRule) UnmarshalJSON(data []byte) error {
	type Alias HostRule
	aux := &struct {
		Domain string `json:"domain"`
		Target string `json:"target"`
		*Alias
	}{
		Alias: (*Alias)(h),
	}
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}
	if h.Pattern == "" && aux.Domain != "" {
		h.Pattern = aux.Domain
	}
	if h.TargetIP == "" && aux.Target != "" {
		h.TargetIP = aux.Target
	}
	return nil
}

// HostsInterceptor overrides destination IP addresses matching configured rules.
type HostsInterceptor struct {
	BaseInterceptor
	rules []*HostRule
	mu    sync.RWMutex
}

// NewHostsInterceptor creates a new Hosts interceptor with priority 10.
func NewHostsInterceptor() *HostsInterceptor {
	return &HostsInterceptor{
		BaseInterceptor: NewBaseInterceptor("Hosts", 10, true),
		rules:           make([]*HostRule, 0),
	}
}

// SetRules updates the active list of host mapping rules.
func (h *HostsInterceptor) SetRules(rules []*HostRule) {
	h.mu.Lock()
	defer h.mu.Unlock()

	EnsureUniqueIDs(rules, func(r *HostRule) string { return r.ID }, func(r *HostRule, id string) { r.ID = id })
	for _, r := range rules {
		if strings.HasPrefix(r.Pattern, "regex:") {
			compiled, err := regexp.Compile(strings.TrimPrefix(r.Pattern, "regex:"))
			if err != nil {
				logger.Warn("Interceptor", fmt.Sprintf("hosts rule %q has invalid regex %q: %v", r.Name, r.Pattern, err))
				r.regex = nil
			} else {
				r.regex = compiled
			}
		} else if strings.Contains(r.Pattern, "*") {
			escaped := regexp.QuoteMeta(r.Pattern)
			escaped = strings.ReplaceAll(escaped, "\\*", ".*")
			compiled, err := regexp.Compile("^" + escaped + "$")
			if err != nil {
				logger.Warn("Interceptor", fmt.Sprintf("hosts rule %q has invalid wildcard %q: %v", r.Name, r.Pattern, err))
				r.regex = nil
			} else {
				r.regex = compiled
			}
		}
	}
	h.rules = rules
}

// GetRules returns active host mapping rules.
func (h *HostsInterceptor) GetRules() []*HostRule {
	h.mu.RLock()
	defer h.mu.RUnlock()

	out := make([]*HostRule, len(h.rules))
	copy(out, h.rules)
	return out
}

// PreConnect modifies the remote target IP or domain alias if a rule matches.
func (h *HostsInterceptor) PreConnect(ctx *proxy.Context, hp proxy.HostPort) (proxy.HostPort, error) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, r := range h.rules {
		if !r.Enabled {
			continue
		}

		matched := false
		if r.regex != nil {
			matched = r.regex.MatchString(hp.Host)
		} else {
			matched = strings.EqualFold(r.Pattern, hp.Host)
		}

		if matched && strings.TrimSpace(r.TargetIP) != "" {
			hp.Host = strings.TrimSpace(r.TargetIP)
			break
		}
	}

	return hp, nil
}

