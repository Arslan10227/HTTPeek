package interceptor

import (
	"regexp"
	"strings"
	"sync"
)

// HostFilterConfig represents whitelist and blacklist configuration.
type HostFilterConfig struct {
	WhitelistEnabled bool     `json:"whitelistEnabled"`
	Whitelist        []string `json:"whitelist"`
	BlacklistEnabled bool     `json:"blacklistEnabled"`
	Blacklist        []string `json:"blacklist"`
}

// HostFilter manages domain capture filtering matching ProxyPin's HostFilter.
type HostFilter struct {
	whitelistEnabled bool
	rawWhitelist     []string
	whitelist        []*regexp.Regexp
	blacklistEnabled bool
	rawBlacklist     []string
	blacklist        []*regexp.Regexp
	mu               sync.RWMutex
}

// NewHostFilter creates an initialized HostFilter with default system blacklist.
func NewHostFilter() *HostFilter {
	hf := &HostFilter{
		whitelistEnabled: false,
		rawWhitelist:     make([]string, 0),
		whitelist:        make([]*regexp.Regexp, 0),
		blacklistEnabled: true,
		rawBlacklist:     make([]string, 0),
		blacklist:        make([]*regexp.Regexp, 0),
	}
	// Default excluded background telemetry
	hf.AddBlacklist("*.apple.com")
	hf.AddBlacklist("*.icloud.com")
	return hf
}

// ShouldFilter returns true if the host should be ignored / bypassed.
func (hf *HostFilter) ShouldFilter(host string) bool {
	hf.mu.RLock()
	defer hf.mu.RUnlock()

	host = strings.ToLower(host)

	// Whitelist mode: if enabled, only hosts matching whitelist are allowed
	if hf.whitelistEnabled && len(hf.whitelist) > 0 {
		for _, reg := range hf.whitelist {
			if reg.MatchString(host) {
				return false
			}
		}
		return true
	}

	// Blacklist mode: if enabled, hosts matching blacklist are filtered
	if hf.blacklistEnabled && len(hf.blacklist) > 0 {
		for _, reg := range hf.blacklist {
			if reg.MatchString(host) {
				return true
			}
		}
	}

	return false
}

// GetConfig returns current whitelist and blacklist settings.
func (hf *HostFilter) GetConfig() HostFilterConfig {
	hf.mu.RLock()
	defer hf.mu.RUnlock()

	wl := make([]string, len(hf.rawWhitelist))
	copy(wl, hf.rawWhitelist)
	bl := make([]string, len(hf.rawBlacklist))
	copy(bl, hf.rawBlacklist)

	return HostFilterConfig{
		WhitelistEnabled: hf.whitelistEnabled,
		Whitelist:        wl,
		BlacklistEnabled: hf.blacklistEnabled,
		Blacklist:        bl,
	}
}

// SetConfig replaces the filter configuration.
func (hf *HostFilter) SetConfig(cfg HostFilterConfig) {
	hf.mu.Lock()
	defer hf.mu.Unlock()

	hf.whitelistEnabled = cfg.WhitelistEnabled
	hf.rawWhitelist = cfg.Whitelist
	hf.whitelist = make([]*regexp.Regexp, 0, len(cfg.Whitelist))
	for _, p := range cfg.Whitelist {
		if r := compileHostPattern(p); r != nil {
			hf.whitelist = append(hf.whitelist, r)
		}
	}

	hf.blacklistEnabled = cfg.BlacklistEnabled
	hf.rawBlacklist = cfg.Blacklist
	hf.blacklist = make([]*regexp.Regexp, 0, len(cfg.Blacklist))
	for _, p := range cfg.Blacklist {
		if r := compileHostPattern(p); r != nil {
			hf.blacklist = append(hf.blacklist, r)
		}
	}
}

// AddWhitelist adds a domain pattern to whitelist.
func (hf *HostFilter) AddWhitelist(pattern string) {
	hf.mu.Lock()
	defer hf.mu.Unlock()
	hf.rawWhitelist = append(hf.rawWhitelist, pattern)
	if r := compileHostPattern(pattern); r != nil {
		hf.whitelist = append(hf.whitelist, r)
	}
}

// AddBlacklist adds a domain pattern to blacklist.
func (hf *HostFilter) AddBlacklist(pattern string) {
	hf.mu.Lock()
	defer hf.mu.Unlock()
	hf.rawBlacklist = append(hf.rawBlacklist, pattern)
	if r := compileHostPattern(pattern); r != nil {
		hf.blacklist = append(hf.blacklist, r)
	}
}

func compileHostPattern(pattern string) *regexp.Regexp {
	pattern = strings.TrimSpace(strings.ToLower(pattern))
	if pattern == "" {
		return nil
	}
	escaped := regexp.QuoteMeta(pattern)
	escaped = strings.ReplaceAll(escaped, "\\*", ".*")
	r, _ := regexp.Compile("^" + escaped + "$")
	return r
}
