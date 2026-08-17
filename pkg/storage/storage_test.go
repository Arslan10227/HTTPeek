package storage

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"httpeek/pkg/proxy"
)

func TestStorageAndHARImportExport(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "httpeek-test-*")
	if err != nil {
		t.Fatalf("MkdirTemp failed: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// 1. Initialize SQLite DB
	db, err := OpenDB(tempDir)
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer db.Close()

	// 2. Test Session Repository
	repo := NewSessionRepo(db)
	session, err := repo.CreateSession("Test Session")
	if err != nil {
		t.Fatalf("CreateSession failed: %v", err)
	}
	if session.ID == "" {
		t.Fatal("Session ID is empty")
	}

	// 3. Save Captured Request
	req := &proxy.HttpRequest{
		ID:         "req-1",
		Protocol:   "HTTP/1.1",
		Method:     proxy.MethodPost,
		URL:        "https://api.example.com/v1/auth",
		HostPort:   proxy.HostPort{Host: "api.example.com", Port: 443, SSL: true},
		Path:       "/v1/auth",
		Headers:    http.Header{"Content-Type": []string{"application/json"}},
		Body:       []byte(`{"username":"admin"}`),
		BodyString: `{"username":"admin"}`,
		StartTime:  time.Now(),
		EndTime:    time.Now().Add(50 * time.Millisecond),
		DurationMs: 50,
		Process: &proxy.ProcessInfo{
			PID:  1234,
			Name: "curl.exe",
		},
		Response: &proxy.HttpResponse{
			StatusCode:  200,
			StatusText:  "200 OK",
			Protocol:    "HTTP/1.1",
			Headers:     http.Header{"Content-Type": []string{"application/json"}},
			Body:        []byte(`{"token":"xyz123"}`),
			BodyString:  `{"token":"xyz123"}`,
			BodySize:    18,
			ContentType: "application/json",
			DurationMs:  50,
		},
	}

	if err := repo.SaveRequest(session.ID, req); err != nil {
		t.Fatalf("SaveRequest failed: %v", err)
	}

	// 4. Test HAR Export & Import
	harFile := filepath.Join(tempDir, "export.har")
	if err := ExportHARToFile([]*proxy.HttpRequest{req}, "Test HAR", harFile); err != nil {
		t.Fatalf("ExportHARToFile failed: %v", err)
	}

	imported, err := ImportHARFromFile(harFile)
	if err != nil {
		t.Fatalf("ImportHARFromFile failed: %v", err)
	}
	if len(imported) != 1 {
		t.Fatalf("Expected 1 imported request, got %d", len(imported))
	}

	impReq := imported[0]
	if impReq.URL != "https://api.example.com/v1/auth" || impReq.Method != proxy.MethodPost {
		t.Errorf("Imported request mismatch: %s %s", impReq.Method, impReq.URL)
	}
	if impReq.Response == nil || impReq.Response.StatusCode != 200 {
		t.Errorf("Imported response mismatch: %v", impReq.Response)
	}
}
