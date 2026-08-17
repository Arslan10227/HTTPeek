package interceptor

import (
	"net/http"
	"testing"

	"httpeek/pkg/proxy"
)

func TestHostsInterceptor(t *testing.T) {
	hosts := NewHostsInterceptor()
	hosts.SetRules([]*HostRule{
		{
			ID:       "1",
			Enabled:  true,
			Pattern:  "api.local.test",
			TargetIP: "127.0.0.1",
		},
	})

	hp := proxy.HostPort{Host: "api.local.test", Port: 80}
	newHP, err := hosts.PreConnect(nil, hp)
	if err != nil {
		t.Fatalf("PreConnect failed: %v", err)
	}
	if newHP.Host != "127.0.0.1" {
		t.Fatalf("Expected target IP 127.0.0.1, got %s", newHP.Host)
	}
}

func TestRewriteInterceptor(t *testing.T) {
	rewrite := NewRequestRewriteInterceptor()
	rewrite.SetRules([]*RewriteRule{
		{
			ID:         "1",
			Name:       "Test Rewrite",
			Enabled:    true,
			URLPattern: "https://api.test.com/*",
			Type:       RuleRequestUpdate,
			Items: []*RewriteItem{
				{
					Type:    ActionAddHeader,
					Enabled: true,
					Key:     "X-Test-Injected",
					Value:   "true",
				},
				{
					Type:    ActionUpdateBody,
					Enabled: true,
					Key:     "old_value",
					Value:   "new_value",
				},
			},
		},
	})

	req := &proxy.HttpRequest{
		URL:        "https://api.test.com/v1/users",
		Headers:    make(http.Header),
		Body:       []byte(`{"key":"old_value"}`),
		BodyString: `{"key":"old_value"}`,
	}

	modified, err := rewrite.OnRequest(nil, req)
	if err != nil {
		t.Fatalf("OnRequest failed: %v", err)
	}

	if modified.Headers.Get("X-Test-Injected") != "true" {
		t.Fatal("Expected injected header")
	}

	if modified.BodyString != `{"key":"new_value"}` {
		t.Fatalf("Expected replaced body, got %s", modified.BodyString)
	}
}

func TestMockInterceptor(t *testing.T) {
	mock := NewRequestMapInterceptor()
	mock.SetRules([]*MapRule{
		{
			ID:         "1",
			Name:       "Test Mock",
			Enabled:    true,
			URLPattern: "https://mock.api.com/users",
			Type:       MapStaticMock,
			StatusCode: 200,
			Body:       `[{"id":1,"name":"Alice"}]`,
		},
	})

	req := &proxy.HttpRequest{
		URL: "https://mock.api.com/users",
	}

	resp, err := mock.Execute(nil, req)
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if resp == nil {
		t.Fatal("Expected mock response")
	}
	if resp.StatusCode != 200 {
		t.Fatalf("Expected status 200, got %d", resp.StatusCode)
	}
	if resp.BodyString != `[{"id":1,"name":"Alice"}]` {
		t.Fatalf("Unexpected mock body: %s", resp.BodyString)
	}
}

func TestScriptInterceptor(t *testing.T) {
	script := NewScriptInterceptor(nil)
	script.SetRules([]*ScriptRule{
		{
			ID:         "1",
			Name:       "Test Script",
			Enabled:    true,
			URLPattern: "https://script.api.com/*",
			ScriptCode: `
				function onRequest(ctx, req) {
					req.headers['X-Script-Auth'] = 'secret-token';
					req.body = 'modified_by_script';
					return req;
				}
			`,
		},
	})

	req := &proxy.HttpRequest{
		URL:        "https://script.api.com/test",
		Headers:    make(http.Header),
		Body:       []byte("initial"),
		BodyString: "initial",
	}

	modified, err := script.OnRequest(nil, req)
	if err != nil {
		t.Fatalf("Script OnRequest failed: %v", err)
	}
	if modified.Headers.Get("X-Script-Auth") != "secret-token" {
		t.Fatalf("Expected script auth header, got %s", modified.Headers.Get("X-Script-Auth"))
	}
	if modified.BodyString != "modified_by_script" {
		t.Fatalf("Expected modified body, got %s", modified.BodyString)
	}
}
