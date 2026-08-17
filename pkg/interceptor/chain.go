package interceptor

import (
	"sort"
	"sync"

	"httpeek/pkg/proxy"
)

// Interceptor is the interface for all traffic mutation and inspection hooks.
type Interceptor interface {
	Name() string
	Priority() int // Lower values execute first
	Enabled() bool
	SetEnabled(enabled bool)

	// PreConnect is invoked before connecting to remote server (e.g. for DNS/Hosts override).
	PreConnect(ctx *proxy.Context, hp proxy.HostPort) (proxy.HostPort, error)

	// OnRequest is invoked when a client request is received.
	// Returning a modified request alters upstream transmission. Returning nil cancels the request.
	OnRequest(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpRequest, error)

	// Execute is invoked to optionally short-circuit remote server calls (e.g. Request Mapping / Mocking).
	// Returning non-nil HttpResponse immediately responds to client without reaching the remote server.
	Execute(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpResponse, error)

	// OnResponse is invoked when remote server response is received.
	// Returning a modified response alters what is delivered to the client. Returning nil drops response.
	OnResponse(ctx *proxy.Context, req *proxy.HttpRequest, resp *proxy.HttpResponse) (*proxy.HttpResponse, error)

	// OnError is invoked when an error occurs during connection or request forwarding.
	OnError(ctx *proxy.Context, req *proxy.HttpRequest, err error)
}

// BaseInterceptor provides default no-op implementations for Interceptor.
type BaseInterceptor struct {
	name     string
	priority int
	enabled  bool
	mu       sync.RWMutex
}

func NewBaseInterceptor(name string, priority int, enabled bool) BaseInterceptor {
	return BaseInterceptor{
		name:     name,
		priority: priority,
		enabled:  enabled,
	}
}

func (b *BaseInterceptor) Name() string {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.name
}

func (b *BaseInterceptor) Priority() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.priority
}

func (b *BaseInterceptor) Enabled() bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.enabled
}

func (b *BaseInterceptor) SetEnabled(enabled bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.enabled = enabled
}

func (b *BaseInterceptor) PreConnect(ctx *proxy.Context, hp proxy.HostPort) (proxy.HostPort, error) {
	return hp, nil
}

func (b *BaseInterceptor) OnRequest(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpRequest, error) {
	return req, nil
}

func (b *BaseInterceptor) Execute(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpResponse, error) {
	return nil, nil
}

func (b *BaseInterceptor) OnResponse(ctx *proxy.Context, req *proxy.HttpRequest, resp *proxy.HttpResponse) (*proxy.HttpResponse, error) {
	return resp, nil
}

func (b *BaseInterceptor) OnError(ctx *proxy.Context, req *proxy.HttpRequest, err error) {}

// Chain manages a sorted list of registered Interceptors and implements proxy.Interceptor.
type Chain struct {
	mu           sync.RWMutex
	interceptors []Interceptor
}

// NewChain creates an empty interceptor chain.
func NewChain() *Chain {
	return &Chain{
		interceptors: make([]Interceptor, 0),
	}
}

func (c *Chain) Priority() int { return 0 }

func (c *Chain) PreConnect(ctx *proxy.Context, hp *proxy.HostPort) error {
	if hp == nil {
		return nil
	}
	res, err := c.RunPreConnect(ctx, *hp)
	if err == nil {
		*hp = res
	}
	return err
}

func (c *Chain) OnRequest(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpRequest, error) {
	return c.RunOnRequest(ctx, req)
}

func (c *Chain) Execute(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpResponse, error) {
	return c.RunExecute(ctx, req)
}

func (c *Chain) OnResponse(ctx *proxy.Context, resp *proxy.HttpResponse) (*proxy.HttpResponse, error) {
	var req *proxy.HttpRequest
	if ctx != nil {
		req = ctx.CurrentRequest
	}
	if req == nil && resp != nil {
		req = resp.Request
	}
	return c.RunOnResponse(ctx, req, resp)
}

func (c *Chain) OnError(ctx *proxy.Context, req *proxy.HttpRequest, err error) {
	c.RunOnError(ctx, req, err)
}

// Add registers an interceptor and sorts the chain by priority.
func (c *Chain) Add(i Interceptor) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.interceptors = append(c.interceptors, i)
	sort.SliceStable(c.interceptors, func(a, b int) bool {
		return c.interceptors[a].Priority() < c.interceptors[b].Priority()
	})
}

// RunPreConnect executes all active interceptors for PreConnect.
func (c *Chain) RunPreConnect(ctx *proxy.Context, hp proxy.HostPort) (proxy.HostPort, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	current := hp
	for _, i := range c.interceptors {
		if !i.Enabled() {
			continue
		}
		modified, err := i.PreConnect(ctx, current)
		if err != nil {
			return current, err
		}
		current = modified
	}
	return current, nil
}

// RunOnRequest executes all active interceptors for OnRequest.
func (c *Chain) RunOnRequest(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpRequest, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	current := req
	for _, i := range c.interceptors {
		if !i.Enabled() {
			continue
		}
		modified, err := i.OnRequest(ctx, current)
		if err != nil {
			return nil, err
		}
		if modified == nil {
			return nil, nil // Aborted
		}
		if modified != current {
			current.RecordAppliedRule(i.Name(), i.Name(), "Request modified by "+i.Name())
		}
		current = modified
	}
	return current, nil
}

// RunExecute checks if any interceptor can short-circuit and mock the response.
func (c *Chain) RunExecute(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpResponse, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	for _, i := range c.interceptors {
		if !i.Enabled() {
			continue
		}
		resp, err := i.Execute(ctx, req)
		if err != nil {
			return nil, err
		}
		if resp != nil {
			req.RecordAppliedRule(i.Name(), i.Name(), "Mock/short-circuit by "+i.Name())
			return resp, nil // Mocked
		}
	}
	return nil, nil
}

// RunOnResponse executes all active interceptors for OnResponse.
func (c *Chain) RunOnResponse(ctx *proxy.Context, req *proxy.HttpRequest, resp *proxy.HttpResponse) (*proxy.HttpResponse, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	current := resp
	for _, i := range c.interceptors {
		if !i.Enabled() {
			continue
		}
		modified, err := i.OnResponse(ctx, req, current)
		if err != nil {
			return nil, err
		}
		if modified == nil {
			return nil, nil // Dropped
		}
		if modified != current && req != nil {
			req.RecordAppliedRule(i.Name(), i.Name(), "Response modified by "+i.Name())
		}
		current = modified
	}
	return current, nil
}

// RunOnError broadcasts error events to all interceptors.
func (c *Chain) RunOnError(ctx *proxy.Context, req *proxy.HttpRequest, err error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	for _, i := range c.interceptors {
		if i.Enabled() {
			i.OnError(ctx, req, err)
		}
	}
}

// HostFilterInterceptor filters incoming hosts by whitelist/blacklist.
type HostFilterInterceptor struct {
	BaseInterceptor
	filter *HostFilter
}

// NewHostFilterInterceptor creates a HostFilter interceptor with highest priority 5.
func NewHostFilterInterceptor(filter *HostFilter) *HostFilterInterceptor {
	return &HostFilterInterceptor{
		BaseInterceptor: NewBaseInterceptor("HostFilter", 5, true),
		filter:          filter,
	}
}

// Filter returns the underlying HostFilter.
func (h *HostFilterInterceptor) Filter() *HostFilter {
	return h.filter
}

// PreConnect checks if host should be filtered.
func (h *HostFilterInterceptor) PreConnect(ctx *proxy.Context, hp proxy.HostPort) (proxy.HostPort, error) {
	if h.filter != nil && h.filter.ShouldFilter(hp.Host) {
		if ctx != nil && ctx.Context != nil {
			ctx.Set("filtered", true)
		}
	}
	return hp, nil
}
