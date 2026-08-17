package interceptor

import (
	"errors"
	"testing"
	"time"

	"httpeek/pkg/proxy"
)

func TestBreakpointAbortReturnsError(t *testing.T) {
	bp := NewRequestBreakpointInterceptor(nil)
	bp.timeout = 2 * time.Second

	bp.SetRules([]*BreakpointRule{{
		ID:               "bp-1",
		Enabled:          true,
		URLPattern:       "*://example.com/*",
		InterceptRequest: true,
	}})

	req := &proxy.HttpRequest{
		ID:     "req-1",
		Method: proxy.MethodGet,
		URL:    "https://example.com/test",
	}

	done := make(chan struct{})
	go func() {
		defer close(done)
		_, err := bp.OnRequest(nil, req)
		if !errors.Is(err, proxy.ErrBreakpointAborted) {
			t.Errorf("expected ErrBreakpointAborted, got %v", err)
		}
	}()

	time.Sleep(50 * time.Millisecond)
	bp.ResumeRequest("req-1", nil)
	<-done
}

func TestBreakpointTimeoutReturnsError(t *testing.T) {
	bp := NewRequestBreakpointInterceptor(nil)
	bp.timeout = 20 * time.Millisecond

	bp.SetRules([]*BreakpointRule{{
		ID:               "bp-2",
		Enabled:          true,
		URLPattern:       "*://timeout.test/*",
		InterceptRequest: true,
	}})

	req := &proxy.HttpRequest{
		ID:     "req-2",
		Method: proxy.MethodGet,
		URL:    "https://timeout.test/path",
	}

	_, err := bp.OnRequest(nil, req)
	if !errors.Is(err, proxy.ErrBreakpointTimeout) {
		t.Fatalf("expected ErrBreakpointTimeout, got %v", err)
	}
}
