package proxy

import "testing"

func TestHostPortString(t *testing.T) {
	hp := HostPort{Host: "example.com", Port: 443, SSL: true}
	got := hp.String()
	want := "example.com:443"
	if got != want {
		t.Fatalf("HostPort.String() = %q, want %q", got, want)
	}
}
