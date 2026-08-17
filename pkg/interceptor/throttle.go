package interceptor

import (
	"encoding/json"
	"errors"
	"math/rand"
	"regexp"
	"sync"
	"time"

	"httpeek/pkg/proxy"

	"golang.org/x/time/rate"
)

// ThrottleProfile defines network condition parameters.
type ThrottleProfile struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Enabled        bool    `json:"enabled"`
	URLPattern     string  `json:"urlPattern,omitempty"` // empty = all URLs
	DownstreamKBps int     `json:"downstreamKbps"`       // KB/s limit (0 = unlimited)
	UpstreamKBps   int     `json:"upstreamKbps"`         // KB/s limit (0 = unlimited)
	LatencyMs      int     `json:"latencyMs"`            // Fixed delay in ms
	JitterMs       int     `json:"jitterMs"`             // Random variation in ms
	DropRate       float64 `json:"dropRate"`             // Packet drop rate percentage (0.0 to 100.0)
	regex          *regexp.Regexp
	downLimiter    *rate.Limiter
	upLimiter      *rate.Limiter
}

// UnmarshalJSON supports both HTTPeek and ProxyPin weak network profile formats.
func (p *ThrottleProfile) UnmarshalJSON(data []byte) error {
	type Alias ThrottleProfile
	aux := &struct {
		LatencyUpMs    int     `json:"latencyUpMs"`
		LatencyDownMs  int     `json:"latencyDownMs"`
		KbpsUp         int     `json:"kbpsUp"`
		KbpsDown       int     `json:"kbpsDown"`
		PacketLossRate float64 `json:"packetLossRate"`
		*Alias
	}{
		Alias: (*Alias)(p),
	}
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}
	if p.LatencyMs == 0 && (aux.LatencyUpMs > 0 || aux.LatencyDownMs > 0) {
		p.LatencyMs = (aux.LatencyUpMs + aux.LatencyDownMs) / 2
		if p.LatencyMs == 0 {
			p.LatencyMs = aux.LatencyUpMs
		}
	}
	if p.UpstreamKBps == 0 && aux.KbpsUp > 0 {
		p.UpstreamKBps = aux.KbpsUp
	}
	if p.DownstreamKBps == 0 && aux.KbpsDown > 0 {
		p.DownstreamKBps = aux.KbpsDown
	}
	if p.DropRate == 0 && aux.PacketLossRate > 0 {
		p.DropRate = aux.PacketLossRate * 100.0
	}
	return nil
}

// ThrottleConfig wraps weak network toggle state and profile.
type ThrottleConfig struct {
	Enabled bool             `json:"enabled"`
	Profile *ThrottleProfile `json:"profile"`
}

// Preset Profiles.
var (
	Preset2G = ThrottleProfile{
		Name:           "2G (GPRS)",
		DownstreamKBps: 50,
		UpstreamKBps:   20,
		LatencyMs:      500,
		JitterMs:       150,
		DropRate:       2.0,
	}
	Preset3G = ThrottleProfile{
		Name:           "3G (HSPA)",
		DownstreamKBps: 750,
		UpstreamKBps:   250,
		LatencyMs:      100,
		JitterMs:       40,
		DropRate:       0.5,
	}
	Preset4G = ThrottleProfile{
		Name:           "4G (LTE)",
		DownstreamKBps: 4000,
		UpstreamKBps:   1500,
		LatencyMs:      30,
		JitterMs:       10,
		DropRate:       0.0,
	}
	Preset5G = ThrottleProfile{
		Name:           "5G",
		DownstreamKBps: 20000,
		UpstreamKBps:   15000,
		LatencyMs:      5,
		JitterMs:       2,
		DropRate:       0.0,
	}
	PresetWiFi = ThrottleProfile{
		Name:           "Wi-Fi",
		DownstreamKBps: 50000,
		UpstreamKBps:   30000,
		LatencyMs:      2,
		JitterMs:       1,
		DropRate:       0.0,
	}
	PresetDSL = ThrottleProfile{
		Name:           "DSL",
		DownstreamKBps: 2000,
		UpstreamKBps:   512,
		LatencyMs:      40,
		JitterMs:       5,
		DropRate:       0.0,
	}
	PresetOffline = ThrottleProfile{
		Name:     "Offline",
		DropRate: 100.0,
	}
)

// NetworkThrottleInterceptor simulates degraded network conditions.
type NetworkThrottleInterceptor struct {
	BaseInterceptor
	profiles     []*ThrottleProfile
	globalConfig ThrottleConfig
	mu           sync.RWMutex
}

// NewNetworkThrottleInterceptor creates a throttle interceptor with priority 20.
func NewNetworkThrottleInterceptor() *NetworkThrottleInterceptor {
	return &NetworkThrottleInterceptor{
		BaseInterceptor: NewBaseInterceptor("NetworkThrottle", 20, true),
		profiles:        make([]*ThrottleProfile, 0),
	}
}

// SetProfiles updates the list of active throttle profiles.
func (t *NetworkThrottleInterceptor) SetProfiles(profiles []*ThrottleProfile) {
	t.mu.Lock()
	defer t.mu.Unlock()

	for _, p := range profiles {
		t.initProfileLimiters(p)
	}
	t.profiles = profiles
}

// GetProfiles returns active throttle profiles.
func (t *NetworkThrottleInterceptor) GetProfiles() []*ThrottleProfile {
	t.mu.RLock()
	defer t.mu.RUnlock()

	out := make([]*ThrottleProfile, len(t.profiles))
	copy(out, t.profiles)
	return out
}

// SetConfig sets the global weak network configuration.
func (t *NetworkThrottleInterceptor) SetConfig(cfg ThrottleConfig) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if cfg.Profile != nil {
		cfg.Profile.Enabled = cfg.Enabled
		t.initProfileLimiters(cfg.Profile)
	}
	t.globalConfig = cfg
}

// GetConfig returns the global weak network configuration.
func (t *NetworkThrottleInterceptor) GetConfig() ThrottleConfig {
	t.mu.RLock()
	defer t.mu.RUnlock()

	return t.globalConfig
}

func (t *NetworkThrottleInterceptor) initProfileLimiters(p *ThrottleProfile) {
	if p.URLPattern != "" {
		p.regex = compilePattern(p.URLPattern)
	}
	if p.DownstreamKBps > 0 {
		bytesPerSec := p.DownstreamKBps * 1024
		p.downLimiter = rate.NewLimiter(rate.Limit(bytesPerSec), bytesPerSec)
	}
	if p.UpstreamKBps > 0 {
		bytesPerSec := p.UpstreamKBps * 1024
		p.upLimiter = rate.NewLimiter(rate.Limit(bytesPerSec), bytesPerSec)
	}
}

// OnRequest applies upstream delay, jitter, packet drop, and rate limiting.
func (t *NetworkThrottleInterceptor) OnRequest(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpRequest, error) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	var activeList []*ThrottleProfile
	if t.globalConfig.Enabled && t.globalConfig.Profile != nil {
		activeList = append(activeList, t.globalConfig.Profile)
	}
	activeList = append(activeList, t.profiles...)

	for _, p := range activeList {
		if !p.Enabled {
			continue
		}
		if p.regex != nil && !p.regex.MatchString(req.URL) {
			continue
		}

		// Check drop rate
		if p.DropRate > 0 && rand.Float64()*100.0 < p.DropRate {
			return nil, errors.New("simulated network packet drop on request")
		}

		// Apply latency & jitter
		delay := p.LatencyMs
		if p.JitterMs > 0 {
			jitter := rand.Intn(p.JitterMs*2) - p.JitterMs
			delay += jitter
			if delay < 0 {
				delay = 0
			}
		}
		if delay > 0 {
			time.Sleep(time.Duration(delay) * time.Millisecond)
		}

		// Rate limit upstream body
		if p.upLimiter != nil && len(req.Body) > 0 {
			_ = p.upLimiter.WaitN(ctx.Context, len(req.Body))
		}
	}

	return req, nil
}

// OnResponse applies downstream delay and rate limiting.
func (t *NetworkThrottleInterceptor) OnResponse(ctx *proxy.Context, req *proxy.HttpRequest, resp *proxy.HttpResponse) (*proxy.HttpResponse, error) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	var activeList []*ThrottleProfile
	if t.globalConfig.Enabled && t.globalConfig.Profile != nil {
		activeList = append(activeList, t.globalConfig.Profile)
	}
	activeList = append(activeList, t.profiles...)

	for _, p := range activeList {
		if !p.Enabled {
			continue
		}
		if p.regex != nil && !p.regex.MatchString(req.URL) {
			continue
		}

		// Check drop rate
		if p.DropRate > 0 && rand.Float64()*100.0 < p.DropRate {
			return nil, errors.New("simulated network packet drop on response")
		}

		// Rate limit downstream body
		if p.downLimiter != nil && len(resp.Body) > 0 {
			_ = p.downLimiter.WaitN(ctx.Context, len(resp.Body))
		}
	}

	return resp, nil
}

