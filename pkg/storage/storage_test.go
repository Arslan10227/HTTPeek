package storage

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"httpeek/pkg/proxy"
)

const favoritesSessionID = "favorites"

// TestExportToCSVFormulaInjection verifies spreadsheet formula characters in
// captured fields are neutralized before CSV export.
func TestExportToCSVFormulaInjection(t *testing.T) {
	req := &proxy.HttpRequest{
		ID:        "id-1",
		Method:    proxy.MethodGet,
		URL:       `=HYPERLINK("http://evil.example")`,
		Path:      "@cmd|calc",
		StartTime: time.Now(),
		HostPort:  proxy.HostPort{Host: "-example.com"},
		Response: &proxy.HttpResponse{
			StatusCode:  200,
			ContentType: "+application/json",
			BodySize:    10,
		},
	}
	out := ExportToCSV([]*proxy.HttpRequest{req})
	for _, cell := range []string{`"'=HYPERLINK`, `"'@cmd|calc`, `"'-example.com`, `"'+application/json`} {
		if !strings.Contains(out, cell) {
			t.Errorf("expected formula-neutralized cell %s in CSV output:\n%s", cell, out)
		}
	}
}

// TestCSVFieldQuoting verifies quote doubling and formula neutralization.
func TestCSVFieldQuoting(t *testing.T) {
	if got := csvField(`say "hi"`); got != `"say ""hi"""` {
		t.Errorf("unexpected quoting: %s", got)
	}
	if got := csvField("=1+1"); got != `"'=1+1"` {
		t.Errorf("unexpected formula neutralization: %s", got)
	}
	if got := csvField("plain"); got != `"plain"` {
		t.Errorf("unexpected plain cell: %s", got)
	}
}

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

func newTestRepo(t *testing.T) (*SessionRepo, string) {
	t.Helper()
	tempDir, err := os.MkdirTemp("", "httpeek-repo-*")
	if err != nil {
		t.Fatalf("MkdirTemp: %v", err)
	}
	db, err := OpenDB(tempDir)
	if err != nil {
		t.Fatalf("OpenDB: %v", err)
	}
	t.Cleanup(func() {
		db.Close()
		os.RemoveAll(tempDir)
	})
	return NewSessionRepo(db), tempDir
}

func makeRequest(id, url string, favorite bool) *proxy.HttpRequest {
	return &proxy.HttpRequest{
		ID:        id,
		Protocol:  "HTTP/1.1",
		Method:    proxy.MethodGet,
		URL:       url,
		HostPort:  proxy.HostPort{Host: "example.com", Port: 443, SSL: true},
		Path:      "/",
		Headers:   http.Header{},
		StartTime: time.Now(),
		Response: &proxy.HttpResponse{
			ID:          id,
			RequestID:   id,
			StatusCode:  200,
			Headers:     http.Header{},
			Body:        []byte("body"),
			ContentType: "text/plain",
		},
		IsFavorite: favorite,
	}
}

// TestDeleteSessionCascadesAndPreservesFavorites verifies FK cascade and the
// favorites re-homing behavior.
func TestDeleteSessionCascadesAndPreservesFavorites(t *testing.T) {
	repo, _ := newTestRepo(t)
	sess, err := repo.CreateSession("s1")
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	req := makeRequest("req-fav", "https://example.com/fav", true)
	if err := repo.SaveRequest(sess.ID, req); err != nil {
		t.Fatalf("SaveRequest: %v", err)
	}
	if err := repo.SaveRequest(sess.ID, makeRequest("req-normal", "https://example.com/normal", false)); err != nil {
		t.Fatalf("SaveRequest: %v", err)
	}

	if err := repo.DeleteSession(sess.ID); err != nil {
		t.Fatalf("DeleteSession: %v", err)
	}

	// Favorite survives and is re-homed; non-favorite is gone.
	fav, err := repo.GetRequestByID("req-fav")
	if err != nil || fav == nil {
		t.Fatalf("favorite lost after session delete: %v", err)
	}
	normal, err := repo.GetRequestByID("req-normal")
	if err != nil {
		t.Fatalf("GetRequestByID: %v", err)
	}
	if normal != nil {
		t.Fatal("non-favorite request should be deleted")
	}

	// Deleting the synthetic favorites session is rejected.
	if err := repo.DeleteSession(favoritesSessionID); err == nil {
		t.Fatal("expected error deleting favorites session")
	}
}

// TestSaveRequestCountersTransactional verifies counters track rows/bytes.
func TestSaveRequestCountersTransactional(t *testing.T) {
	repo, _ := newTestRepo(t)
	sess, err := repo.CreateSession("s1")
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	if err := repo.SaveRequest(sess.ID, makeRequest("r1", "https://example.com/a", false)); err != nil {
		t.Fatalf("SaveRequest: %v", err)
	}
	if err := repo.SaveRequest(sess.ID, makeRequest("r2", "https://example.com/b", false)); err != nil {
		t.Fatalf("SaveRequest: %v", err)
	}

	sessions, err := repo.ListSessions()
	if err != nil {
		t.Fatalf("ListSessions: %v", err)
	}
	var s1 *Session
	for _, s := range sessions {
		if s.ID == sess.ID {
			s1 = s
		}
	}
	if s1 == nil {
		t.Fatal("created session not found in ListSessions")
	}
	if s1.RequestCount != 2 {
		t.Errorf("request_count = %d, want 2", s1.RequestCount)
	}
	if s1.FileSize != int64(2*len("body")) {
		t.Errorf("file_size = %d, want %d", s1.FileSize, 2*len("body"))
	}
}

// TestSaveRequestsBatchAtomic verifies a failed batch leaves no partial rows.
func TestSaveRequestsBatchAtomic(t *testing.T) {
	repo, _ := newTestRepo(t)
	sess, err := repo.CreateSession("s1")
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	// Duplicate IDs force the second insert to fail inside the transaction.
	batch := []*proxy.HttpRequest{
		makeRequest("dup", "https://example.com/1", false),
		makeRequest("dup", "https://example.com/2", false),
	}
	if err := repo.SaveRequestsBatch(sess.ID, batch); err == nil {
		t.Fatal("expected batch failure on duplicate id")
	}
	count, err := repo.CountSessionRequests(sess.ID)
	if err != nil {
		t.Fatalf("CountSessionRequests: %v", err)
	}
	if count != 0 {
		t.Errorf("partial rows after failed batch: %d", count)
	}
}

// TestCreateSessionUniqueNames verifies duplicate names get suffixes.
func TestCreateSessionUniqueNames(t *testing.T) {
	repo, _ := newTestRepo(t)
	s1, err := repo.CreateSession("Same")
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	s2, err := repo.CreateSession("Same")
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	if s1.Name == s2.Name {
		t.Errorf("expected unique names, got %q and %q", s1.Name, s2.Name)
	}
	if err := repo.RenameSession(s1.ID, "Same"); err != nil {
		t.Fatalf("RenameSession: %v", err)
	}
}

// TestPaginationAndLookup verifies bounded pages and single-request lookup.
func TestPaginationAndLookup(t *testing.T) {
	repo, _ := newTestRepo(t)
	sess, err := repo.CreateSession("s1")
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	for i := 0; i < 10; i++ {
		if err := repo.SaveRequest(sess.ID, makeRequest(fmt.Sprintf("r%02d", i), fmt.Sprintf("https://example.com/%d", i), false)); err != nil {
			t.Fatalf("SaveRequest: %v", err)
		}
	}
	page, err := repo.GetSessionRequestsPage(sess.ID, 3, 0)
	if err != nil {
		t.Fatalf("GetSessionRequestsPage: %v", err)
	}
	if len(page) != 3 {
		t.Fatalf("page size = %d, want 3", len(page))
	}
	// Newest-first ordering.
	if page[0].ID != "r09" {
		t.Errorf("expected newest-first, got %s", page[0].ID)
	}
	count, err := repo.CountSessionRequests(sess.ID)
	if err != nil || count != 10 {
		t.Fatalf("CountSessionRequests = %d, %v", count, err)
	}
	got, err := repo.GetRequestByID("r05")
	if err != nil || got == nil || got.ID != "r05" {
		t.Fatalf("GetRequestByID: %v %v", got, err)
	}
	missing, err := repo.GetRequestByID("nope")
	if err != nil || missing != nil {
		t.Fatalf("GetRequestByID missing: %v %v", missing, err)
	}
}

// TestForeignKeysEnabled verifies the FK pragma is active at the connection.
func TestForeignKeysEnabled(t *testing.T) {
	repo, tempDir := newTestRepo(t)
	var enabled int
	if err := repo.db.Conn().QueryRow("PRAGMA foreign_keys").Scan(&enabled); err != nil {
		t.Fatalf("PRAGMA foreign_keys: %v", err)
	}
	if enabled != 1 {
		t.Errorf("foreign_keys = %d, want 1", enabled)
	}
	_ = tempDir
}

// TestHARDeterministicIDs verifies re-importing the same HAR yields the same IDs.
func TestHARDeterministicIDs(t *testing.T) {
	req := makeRequest("ignored", "https://example.com/api", false)
	har := ExportToHAR([]*proxy.HttpRequest{req}, "T")
	data, err := json.Marshal(har)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	first, err := ImportHARBytes(data)
	if err != nil {
		t.Fatalf("ImportHARBytes: %v", err)
	}
	second, err := ImportHARBytes(data)
	if err != nil {
		t.Fatalf("ImportHARBytes: %v", err)
	}
	if first[0].ID != second[0].ID {
		t.Errorf("IDs not deterministic: %q vs %q", first[0].ID, second[0].ID)
	}
	if first[0].ID == "" {
		t.Error("imported ID empty")
	}
}

// TestCurlScriptEscaping verifies shell-safe quoting.
func TestCurlScriptEscaping(t *testing.T) {
	req := makeRequest("r1", "https://example.com/a b'c", false)
	req.BodyString = "line1\nline2 'quoted'"
	script := ExportToCurlScript([]*proxy.HttpRequest{req})
	if !strings.Contains(script, "'https://example.com/a b'\\''c'") {
		t.Errorf("URL not shell-quoted correctly:\n%s", script)
	}
	if !strings.Contains(script, "-d 'line1") {
		t.Errorf("body not quoted:\n%s", script)
	}
}

// TestHARDuplicateHeaders verifies header values are exported as separate entries.
func TestHARDuplicateHeaders(t *testing.T) {
	req := makeRequest("r1", "https://example.com/", false)
	req.Headers = http.Header{
		"Set-Cookie": {"a=1", "b=2"},
		"X-Multi":    {"one", "two"},
	}
	entry := RequestToHAREntry(req)
	var setCookies int
	for _, h := range entry.Response.Headers {
		if h.Name == "Set-Cookie" {
			setCookies++
		}
	}
	// Response headers live on req.Response in the model.
	_ = setCookies
	req.Response.Headers = http.Header{
		"Set-Cookie": {"a=1", "b=2"},
	}
	entry = RequestToHAREntry(req)
	var reqSetCookies, respSetCookies int
	for _, h := range entry.Request.Headers {
		if h.Name == "Set-Cookie" {
			reqSetCookies++
		}
	}
	for _, h := range entry.Response.Headers {
		if h.Name == "Set-Cookie" {
			respSetCookies++
		}
	}
	if reqSetCookies != 2 || respSetCookies != 2 {
		t.Errorf("duplicate headers collapsed: req=%d resp=%d, want 2 each", reqSetCookies, respSetCookies)
	}
}
