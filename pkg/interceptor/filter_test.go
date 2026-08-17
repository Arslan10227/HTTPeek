package interceptor

import (
	"testing"

	"httpeek/pkg/proxy"
)

func TestHostFilterShouldFilterBlacklist(t *testing.T) {
	hf := NewHostFilter()
	hf.SetConfig(HostFilterConfig{
		BlacklistEnabled: true,
		Blacklist:        []string{"*.apple.com"},
	})

	if !hf.ShouldFilter("www.apple.com") {
		t.Fatal("expected www.apple.com to be filtered")
	}
	if hf.ShouldFilter("example.com") {
		t.Fatal("expected example.com not to be filtered")
	}
}

func TestHostFilterWhitelistMode(t *testing.T) {
	hf := NewHostFilter()
	hf.SetConfig(HostFilterConfig{
		WhitelistEnabled: true,
		Whitelist:        []string{"api.example.com"},
	})

	if hf.ShouldFilter("api.example.com") {
		t.Fatal("whitelisted host should not be filtered")
	}
	if !hf.ShouldFilter("other.example.com") {
		t.Fatal("non-whitelisted host should be filtered")
	}
}

func TestHostFilterInterceptorSetsFilteredFlag(t *testing.T) {
	hf := NewHostFilter()
	hf.SetConfig(HostFilterConfig{
		BlacklistEnabled: true,
		Blacklist:        []string{"blocked.test"},
	})

	interceptor := NewHostFilterInterceptor(hf)
	ctx := proxy.NewContext(t.Context(), nil)

	_, err := interceptor.PreConnect(ctx, proxy.HostPort{Host: "blocked.test", Port: 443, SSL: true})
	if err != nil {
		t.Fatalf("PreConnect failed: %v", err)
	}

	v, ok := ctx.Get("filtered")
	if !ok || v != true {
		t.Fatalf("expected filtered flag to be set, got ok=%v val=%v", ok, v)
	}
}
