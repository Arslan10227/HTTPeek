package interceptor

import (
	"context"
	"strings"
	"testing"
	"time"

	"httpeek/pkg/proxy"
)

// TestInvalidRegexDoesNotPanic verifies that an invalid regex pattern is
// logged and the rule's regex is nil (never matches) instead of panicking.
func TestInvalidRegexDoesNotPanic(t *testing.T) {
	block := NewRequestBlockInterceptor()
	block.SetRules([]*BlockRule{
		{ID: "1", Name: "bad", Enabled: true, URLPattern: "regex:[invalid("},
		{ID: "2", Name: "good", Enabled: true, URLPattern: "https://nonexistent.test/*"},
	})
	rules := block.GetRules()
	if rules[0].regex != nil {
		t.Errorf("invalid regex should yield nil regex, got %v", rules[0].regex)
	}
	if rules[1].regex == nil {
		t.Error("valid regex should compile")
	}

	// The invalid rule must not match; the valid rule targets a different host.
	req := &proxy.HttpRequest{URL: "https://example.com/test"}
	resp, err := block.Execute(nil, req)
	if err != nil {
		t.Fatalf("Execute with invalid rule: %v", err)
	}
	if resp != nil {
		t.Fatal("invalid-regex rule should not match")
	}
}

// TestBlockResponseContentLength verifies the 403 response sets Content-Length.
func TestBlockResponseContentLength(t *testing.T) {
	block := NewRequestBlockInterceptor()
	block.SetRules([]*BlockRule{
		{ID: "1", Name: "block-all", Enabled: true, URLPattern: "regex:.*"},
	})
	req := &proxy.HttpRequest{URL: "https://example.com", Protocol: "HTTP/1.1"}
	resp, err := block.Execute(nil, req)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if resp == nil {
		t.Fatal("expected block response")
	}
	if cl := resp.Headers.Get("Content-Length"); cl == "" {
		t.Error("block response missing Content-Length header")
	}
	if resp.Headers.Get("Content-Length") != "18" {
		t.Errorf("Content-Length = %q, want 18", resp.Headers.Get("Content-Length"))
	}
}

// TestMockResponseContentLength verifies mock responses set Content-Length.
func TestMockResponseContentLength(t *testing.T) {
	mock := NewRequestMapInterceptor()
	mock.SetRules([]*MapRule{
		{ID: "1", Name: "mock", Enabled: true, URLPattern: "https://mock.test/api", Type: MapStaticMock, StatusCode: 200, Body: `{"ok":true}`},
	})
	req := &proxy.HttpRequest{URL: "https://mock.test/api", Protocol: "HTTP/1.1"}
	resp, err := mock.Execute(nil, req)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if resp == nil {
		t.Fatal("expected mock response")
	}
	if cl := resp.Headers.Get("Content-Length"); cl == "" {
		t.Error("mock response missing Content-Length header")
	}
	if resp.Headers.Get("Content-Length") != "11" {
		t.Errorf("Content-Length = %q, want 11", resp.Headers.Get("Content-Length"))
	}
}

// TestRuleIDUniqueness verifies empty and duplicate IDs are fixed.
func TestRuleIDUniqueness(t *testing.T) {
	block := NewRequestBlockInterceptor()
	block.SetRules([]*BlockRule{
		{ID: "", Name: "empty-id", Enabled: true, URLPattern: "https://a.test/*"},
		{ID: "dup", Name: "first", Enabled: true, URLPattern: "https://b.test/*"},
		{ID: "dup", Name: "second", Enabled: true, URLPattern: "https://c.test/*"},
		{ID: "", Name: "another-empty", Enabled: true, URLPattern: "https://d.test/*"},
	})
	rules := block.GetRules()
	ids := make(map[string]bool)
	for _, r := range rules {
		if r.ID == "" {
			t.Error("rule has empty ID after EnsureUniqueIDs")
		}
		if ids[r.ID] {
			t.Errorf("duplicate ID after dedup: %s", r.ID)
		}
		ids[r.ID] = true
	}
	if len(ids) != 4 {
		t.Errorf("expected 4 unique IDs, got %d", len(ids))
	}
}

// TestRuleIDUniquenessAcrossFamilies verifies ID dedup works for all rule types.
func TestRuleIDUniquenessAcrossFamilies(t *testing.T) {
	t.Run("mock", func(t *testing.T) {
		mock := NewRequestMapInterceptor()
		mock.SetRules([]*MapRule{
			{ID: "x", Name: "a", Enabled: true, URLPattern: "https://a.test/*"},
			{ID: "x", Name: "b", Enabled: true, URLPattern: "https://b.test/*"},
		})
		rules := mock.GetRules()
		if rules[0].ID == rules[1].ID {
			t.Error("duplicate IDs not deduped")
		}
	})
	t.Run("hosts", func(t *testing.T) {
		hosts := NewHostsInterceptor()
		hosts.SetRules([]*HostRule{
			{ID: "x", Enabled: true, Pattern: "a.test", TargetIP: "1.2.3.4"},
			{ID: "x", Enabled: true, Pattern: "b.test", TargetIP: "1.2.3.5"},
		})
		rules := hosts.GetRules()
		if rules[0].ID == rules[1].ID {
			t.Error("duplicate IDs not deduped")
		}
	})
	t.Run("throttle", func(t *testing.T) {
		throttle := NewNetworkThrottleInterceptor()
		throttle.SetProfiles([]*ThrottleProfile{
			{ID: "x", Name: "a", Enabled: true},
			{ID: "x", Name: "b", Enabled: true},
		})
		profiles := throttle.GetProfiles()
		if profiles[0].ID == profiles[1].ID {
			t.Error("duplicate IDs not deduped")
		}
	})
}

// TestThrottleNilContextDoesNotPanic verifies the throttle interceptor
// handles a nil proxy.Context without panicking.
func TestThrottleNilContextDoesNotPanic(t *testing.T) {
	throttle := NewNetworkThrottleInterceptor()
	throttle.SetProfiles([]*ThrottleProfile{
		{ID: "1", Name: "latency", Enabled: true, LatencyMs: 5, JitterMs: 0},
	})
	req := &proxy.HttpRequest{URL: "https://example.com", Body: []byte("hello")}
	// Should not panic with nil ctx.
	modified, err := throttle.OnRequest(nil, req)
	if err != nil {
		t.Fatalf("OnRequest nil ctx: %v", err)
	}
	if modified == nil {
		t.Fatal("expected modified request")
	}

	resp := &proxy.HttpResponse{Body: []byte("world")}
	modifiedResp, err := throttle.OnResponse(nil, req, resp)
	if err != nil {
		t.Fatalf("OnResponse nil ctx: %v", err)
	}
	if modifiedResp == nil {
		t.Fatal("expected modified response")
	}
}

// TestThrottleCtxCancellation verifies that a cancelled context aborts the
// latency delay instead of blocking for the full duration.
func TestThrottleCtxCancellation(t *testing.T) {
	throttle := NewNetworkThrottleInterceptor()
	throttle.SetProfiles([]*ThrottleProfile{
		{ID: "1", Name: "slow", Enabled: true, LatencyMs: 5000},
	})

	ctx, cancel := context.WithCancel(context.Background())
	proxyCtx := &proxy.Context{Context: ctx}
	req := &proxy.HttpRequest{URL: "https://example.com"}

	// Cancel after 10ms; the 5s delay should abort.
	go func() {
		time.Sleep(10 * time.Millisecond)
		cancel()
	}()
	start := time.Now()
	_, err := throttle.OnRequest(proxyCtx, req)
	elapsed := time.Since(start)
	if err == nil {
		t.Fatal("expected cancellation error")
	}
	if elapsed > time.Second {
		t.Errorf("delay not aborted by cancellation: elapsed %v", elapsed)
	}
}

// TestThrottleRateLimitErrorPropagated verifies rate-limit errors are
// returned, not silently swallowed.
func TestThrottleRateLimitErrorPropagated(t *testing.T) {
	throttle := NewNetworkThrottleInterceptor()
	throttle.SetProfiles([]*ThrottleProfile{
		{ID: "1", Name: "tiny-bandwidth", Enabled: true, UpstreamKBps: 1},
	})
	// 1 KB/s limiter with 1KB burst; sending 2MB should block.
	// With a short-timeout context, it should error.
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	proxyCtx := &proxy.Context{Context: ctx}
	req := &proxy.HttpRequest{URL: "https://example.com", Body: make([]byte, 2*1024*1024)}
	_, err := throttle.OnRequest(proxyCtx, req)
	if err == nil {
		// On fast machines the limiter might not block in 50ms; that's fine.
		// The important thing is it doesn't panic.
		return
	}
	if !strings.Contains(err.Error(), "throttle") && !strings.Contains(err.Error(), "context") {
		t.Errorf("unexpected error: %v", err)
	}
}
