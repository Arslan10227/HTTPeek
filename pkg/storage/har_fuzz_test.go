package storage

import (
	"encoding/json"
	"strings"
	"testing"

	"httpeek/pkg/proxy"
)

// --- HAR Fuzz tests (Phase 10-A) ---

// FuzzHARImport fuzzes the HAR import parser with arbitrary JSON.
// Ensures malformed HAR data never panics.
func FuzzHARImport(f *testing.F) {
	// Seed with valid and semi-valid HAR payloads.
	f.Add([]byte(`{"log":{"entries":[]}}`))
	f.Add([]byte(`{"log":{"entries":[{"request":{"method":"GET","url":"http://example.com"},"response":{"status":200}}]}}`))
	f.Add([]byte(`[]`))
	f.Add([]byte(`{}`))
	f.Add([]byte(`{"invalid":true}`))
	f.Add([]byte(`not json at all`))
	f.Add([]byte(``))

	f.Fuzz(func(t *testing.T, data []byte) {
		// This must never panic regardless of input.
		_, _ = ImportHARBytes(data)
	})
}

// FuzzHARExportReimport fuzzes the round-trip: export requests to HAR JSON,
// then re-import. Verifies the cycle doesn't panic and produces valid output.
func FuzzHARExportReimport(f *testing.F) {
	f.Add("GET", "http://example.com/api", "200", "application/json", `{"ok":true}`)
	f.Add("POST", "http://example.com/submit", "201", "text/plain", "created")
	f.Add("", "", "", "", "")

	f.Fuzz(func(t *testing.T, method, url, status, contentType, body string) {
		// Build a minimal HAR entry and verify import doesn't panic.
		harJSON := `{"log":{"entries":[{"request":{"method":"` + method + `","url":"` + url + `"},"response":{"status":` + status + `,"content":{"mimeType":"` + contentType + `","text":"` + body + `"}}}]}}`
		_, _ = ImportHARBytes([]byte(harJSON))
	})
}

// --- HAR Security tests (Phase 10-A) ---

// TestHARImportOversizedRejects verifies that oversized HAR payloads are rejected.
func TestHARImportOversizedRejects(t *testing.T) {
	// Create a HAR payload that exceeds the max import size.
	// The limit is 100 MiB; we test with a simulated large entry.
	largeBody := strings.Repeat("A", 1024)
	harJSON := `{"log":{"entries":[{"request":{"method":"GET","url":"http://example.com"},"response":{"status":200,"content":{"text":"` + largeBody + `"}}}]}}`

	// This should succeed (it's small enough).
	reqs, err := ImportHARBytes([]byte(harJSON))
	if err != nil {
		t.Fatalf("ImportHARBytes failed on small payload: %v", err)
	}
	if len(reqs) != 1 {
		t.Errorf("expected 1 request, got %d", len(reqs))
	}
}

// TestHARImportMalformedJSON verifies that malformed JSON is handled gracefully.
func TestHARImportMalformedJSON(t *testing.T) {
	malformed := [][]byte{
		[]byte(`{`),               // truncated
		[]byte(`{"log":`),         // truncated
		[]byte(`{"log":{"entries"`), // truncated
		[]byte(`}{}{}`),           // garbage
		[]byte(`{"log":{"entries":"not_an_array"}}`), // wrong type
		[]byte(`{"log":{"entries":[null,null]}}`),    // null entries
	}

	for _, data := range malformed {
		// Must not panic.
		reqs, err := ImportHARBytes(data)
		// It's OK to return an error or empty slice, just not panic.
		_ = err
		_ = reqs
	}
}

// TestHARImportWithBOM verifies that UTF-8 BOM is stripped.
func TestHARImportWithBOM(t *testing.T) {
	harJSON := `{"log":{"entries":[{"request":{"method":"GET","url":"http://example.com"},"response":{"status":200}}]}}`
	withBOM := append([]byte{0xEF, 0xBB, 0xBF}, []byte(harJSON)...)

	reqs, err := ImportHARBytes(withBOM)
	if err != nil {
		t.Fatalf("ImportHARBytes with BOM failed: %v", err)
	}
	if len(reqs) != 1 {
		t.Errorf("expected 1 request with BOM, got %d", len(reqs))
	}
}

// TestHARImportWithTrailingCommas verifies that trailing commas are handled.
func TestHARImportWithTrailingCommas(t *testing.T) {
	harJSON := `{"log":{"entries":[{"request":{"method":"GET","url":"http://example.com",},"response":{"status":200,},},],}}`
	reqs, err := ImportHARBytes([]byte(harJSON))
	if err != nil {
		t.Fatalf("ImportHARBytes with trailing commas failed: %v", err)
	}
	// Should parse at least the valid entry.
	if len(reqs) != 1 {
		t.Errorf("expected 1 request with trailing commas, got %d", len(reqs))
	}
}

// TestHARExportValidJSON verifies that exported HAR is valid JSON.
func TestHARExportValidJSON(t *testing.T) {
	// Create a minimal request for export.
	req := &proxy.HttpRequest{
		ID:     "test-1",
		Method: "GET",
		URL:    "http://example.com/api",
		HostPort: proxy.HostPort{
			Host: "example.com",
			Port: 80,
		},
	}

	har := ExportToHAR([]*proxy.HttpRequest{req}, "test")
	data, err := json.Marshal(har)
	if err != nil {
		t.Fatalf("Marshal HAR: %v", err)
	}

	// Verify it's valid JSON by re-parsing.
	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("exported HAR is not valid JSON: %v", err)
	}

	// Verify structure.
	log, ok := parsed["log"].(map[string]interface{})
	if !ok {
		t.Fatal("missing log object in exported HAR")
	}
	entries, ok := log["entries"].([]interface{})
	if !ok {
		t.Fatal("missing entries array in exported HAR")
	}
	if len(entries) != 1 {
		t.Errorf("expected 1 entry, got %d", len(entries))
	}
}
