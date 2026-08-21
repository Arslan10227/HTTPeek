package storage

import (
	"bytes"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"httpeek/pkg/proxy"

	"github.com/google/uuid"
)

// HAR represents standard HTTP Archive 1.2 root object.
type HAR struct {
	Log HARLog `json:"log"`
}

type HARLog struct {
	Version string     `json:"version"`
	Creator HARCreator `json:"creator"`
	Pages   []HARPage  `json:"pages,omitempty"`
	Entries []HAREntry `json:"entries"`
}

type HARCreator struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type HARPage struct {
	StartedDateTime string `json:"startedDateTime"`
	ID              string `json:"id"`
	Title           string `json:"title"`
}

type HAREntry struct {
	StartedDateTime string      `json:"startedDateTime"`
	Time            int64       `json:"time"`
	Request         HARRequest  `json:"request"`
	Response        HARResponse `json:"response"`
	Cache           struct{}    `json:"cache"`
	Timings         HARTimings  `json:"timings"`
	ServerIPAddress string      `json:"serverIPAddress,omitempty"`
}

type HARRequest struct {
	Method      string          `json:"method"`
	URL         string          `json:"url"`
	HTTPVersion string          `json:"httpVersion"`
	Headers     []HARHeaderPair `json:"headers"`
	QueryString []HARHeaderPair `json:"queryString"`
	Cookies     []HARCookie     `json:"cookies"`
	HeadersSize int             `json:"headersSize"`
	BodySize    int             `json:"bodySize"`
	PostData    *HARPostData    `json:"postData,omitempty"`
}

type HARResponse struct {
	Status      int             `json:"status"`
	StatusText  string          `json:"statusText"`
	HTTPVersion string          `json:"httpVersion"`
	Headers     []HARHeaderPair `json:"headers"`
	Cookies     []HARCookie     `json:"cookies"`
	Content     HARContent      `json:"content"`
	RedirectURL string          `json:"redirectURL"`
	HeadersSize int             `json:"headersSize"`
	BodySize    int64           `json:"bodySize"`
}

type HARHeaderPair struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type HARCookie struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type HARPostData struct {
	MimeType string `json:"mimeType"`
	Text     string `json:"text"`
}

type HARContent struct {
	Size     int64  `json:"size"`
	MimeType string `json:"mimeType"`
	Text     string `json:"text,omitempty"`
	Encoding string `json:"encoding,omitempty"`
}

type HARTimings struct {
	Blocked int64 `json:"blocked,omitempty"`
	DNS     int64 `json:"dns,omitempty"`
	Connect int64 `json:"connect,omitempty"`
	SSL     int64 `json:"ssl,omitempty"`
	Send    int64 `json:"send"`
	Wait    int64 `json:"wait"`
	Receive int64 `json:"receive"`
}

// ExportToHAR converts captured requests into standard HAR 1.2 format.
func ExportToHAR(requests []*proxy.HttpRequest, title string) *HAR {
	if title == "" {
		title = "HTTPeek Capture"
	}

	har := &HAR{
		Log: HARLog{
			Version: "1.2",
			Creator: HARCreator{
				Name:    "HTTPeek Go",
				Version: "1.0.0",
			},
			Pages: []HARPage{
				{
					StartedDateTime: time.Now().UTC().Format(time.RFC3339),
					ID:              "page_1",
					Title:           title,
				},
			},
			Entries: make([]HAREntry, 0, len(requests)),
		},
	}

	for _, req := range requests {
		entry := RequestToHAREntry(req)
		har.Log.Entries = append(har.Log.Entries, entry)
	}

	return har
}

// RequestToHAREntry converts a single HttpRequest/Response pair into a HAR entry.
func RequestToHAREntry(req *proxy.HttpRequest) HAREntry {
	// One entry per header value so duplicates (Set-Cookie, WWW-Authenticate)
	// keep their individual semantics per HAR 1.2.
	var reqHeaders []HARHeaderPair
	for k, vals := range req.Headers {
		for _, v := range vals {
			reqHeaders = append(reqHeaders, HARHeaderPair{Name: k, Value: v})
		}
	}

	var queryPairs []HARHeaderPair
	for k, vals := range req.Query {
		for _, v := range vals {
			queryPairs = append(queryPairs, HARHeaderPair{Name: k, Value: v})
		}
	}

	var postData *HARPostData
	if len(req.Body) > 0 || req.BodyString != "" {
		text := req.BodyString
		if text == "" && len(req.Body) > 0 {
			text = string(req.Body)
		}
		postData = &HARPostData{
			MimeType: req.Headers.Get("Content-Type"),
			Text:     text,
		}
	}

	harReq := HARRequest{
		Method:      string(req.Method),
		URL:         req.URL,
		HTTPVersion: req.Protocol,
		Headers:     reqHeaders,
		QueryString: queryPairs,
		HeadersSize: -1,
		BodySize:    len(req.Body),
		PostData:    postData,
	}

	var harResp HARResponse
	if req.Response != nil {
		resp := req.Response
		var respHeaders []HARHeaderPair
		for k, vals := range resp.Headers {
			for _, v := range vals {
				respHeaders = append(respHeaders, HARHeaderPair{Name: k, Value: v})
			}
		}

		respText := resp.BodyString
		if respText == "" && len(resp.Body) > 0 {
			respText = string(resp.Body)
		}
		encoding := ""
		if resp.IsBinary && len(resp.Body) > 0 {
			respText = base64.StdEncoding.EncodeToString(resp.Body)
			encoding = "base64"
		}

		harResp = HARResponse{
			Status:      resp.StatusCode,
			StatusText:  resp.StatusText,
			HTTPVersion: resp.Protocol,
			Headers:     respHeaders,
			HeadersSize: -1,
			BodySize:    resp.BodySize,
			RedirectURL: resp.Headers.Get("Location"),
			Content: HARContent{
				Size:     resp.BodySize,
				MimeType: resp.ContentType,
				Text:     respText,
				Encoding: encoding,
			},
		}
	}

	startTimeStr := time.Now().UTC().Format(time.RFC3339Nano)
	if !req.StartTime.IsZero() {
		startTimeStr = req.StartTime.UTC().Format(time.RFC3339Nano)
	}

	return HAREntry{
		StartedDateTime: startTimeStr,
		Time:            req.DurationMs,
		Request:         harReq,
		Response:        harResp,
		Timings: HARTimings{
			Send:    0,
			Wait:    req.DurationMs,
			Receive: 0,
		},
	}
}

// ExportHARToFile writes the HAR object to a file path as formatted JSON.
// ExportHARToFile writes the HAR object to a file path as formatted JSON.
func ExportHARToFile(requests []*proxy.HttpRequest, title, filePath string) error {
	har := ExportToHAR(requests, title)
	data, err := json.MarshalIndent(har, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal HAR failed: %w", err)
	}
	return os.WriteFile(filePath, data, 0644)
}

// ExportToJSON serializes requests into formatted JSON.
func ExportToJSON(requests []*proxy.HttpRequest) (string, error) {
	data, err := json.MarshalIndent(requests, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// csvField quotes a CSV cell and neutralizes spreadsheet formula injection.
func csvField(s string) string {
	s = strings.ReplaceAll(s, "\"", "\"\"")
	if s != "" {
		switch s[0] {
		case '=', '+', '-', '@':
			s = "'" + s
		}
	}
	return "\"" + s + "\""
}

// ExportToCSV serializes requests into a summary CSV format.
func ExportToCSV(requests []*proxy.HttpRequest) string {
	var sb strings.Builder
	sb.WriteString("ID,Method,URL,Host,Path,Status,Content-Type,Duration(ms),BodySize(bytes),StartTime\n")
	for _, req := range requests {
		status := 0
		contentType := ""
		bodySize := int64(0)
		if req.Response != nil {
			status = req.Response.StatusCode
			contentType = req.Response.ContentType
			bodySize = req.Response.BodySize
		}
		sb.WriteString(fmt.Sprintf("%s,%s,%s,%s,%s,%d,%s,%d,%d,%s\n",
			csvField(req.ID),
			csvField(string(req.Method)),
			csvField(req.URL),
			csvField(req.HostPort.Host),
			csvField(req.Path),
			status,
			csvField(contentType),
			req.DurationMs,
			bodySize,
			csvField(req.StartTime.Format(time.RFC3339)),
		))
	}
	return sb.String()
}

// shellQuote escapes a value for safe use inside a single-quoted bash string.
func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}

// ExportToCurlScript generates an executable bash shell script with cURL commands for all requests.
func ExportToCurlScript(requests []*proxy.HttpRequest) string {
	var sb strings.Builder
	sb.WriteString("#!/usr/bin/env bash\n# Generated by HTTPeek - https://github.com/Arslan10227/HTTPeek\n\n")
	for i, req := range requests {
		sb.WriteString(fmt.Sprintf("# [%d] %s %s\n", i+1, req.Method, req.URL))
		sb.WriteString(fmt.Sprintf("curl -X %s %s", req.Method, shellQuote(req.URL)))
		for k, vals := range req.Headers {
			for _, v := range vals {
				sb.WriteString(fmt.Sprintf(" \\\n  -H %s", shellQuote(fmt.Sprintf("%s: %s", k, v))))
			}
		}
		if req.BodyString != "" {
			sb.WriteString(fmt.Sprintf(" \\\n  -d %s", shellQuote(req.BodyString)))
		}
		sb.WriteString("\n\necho \"\"\n\n")
	}
	return sb.String()
}

// maxHARImportBytes bounds HAR file/string imports to avoid memory exhaustion.
const maxHARImportBytes = 100 * 1024 * 1024

// ImportHARFromFile parses a HAR file into a slice of HttpRequest objects.
func ImportHARFromFile(filePath string) ([]*proxy.HttpRequest, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, maxHARImportBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxHARImportBytes {
		return nil, fmt.Errorf("HAR file exceeds %d bytes", maxHARImportBytes)
	}

	return ImportHARBytes(data)
}

// importBodyBytes bounds individual imported body payloads.
const importBodyBytes = 32 * 1024 * 1024

// ImportHARBytes parses standard or loose/partial HAR / JSON payloads with fallback resilience.
func ImportHARBytes(data []byte) ([]*proxy.HttpRequest, error) {
	if len(data) == 0 {
		return []*proxy.HttpRequest{}, nil
	}

	// Sanitize common corruptions: strip UTF-8 BOM and trailing commas before } or ]
	cleaned := bytes.TrimPrefix(data, []byte("\xef\xbb\xbf"))
	trailingCommaRe := regexp.MustCompile(`,(\s*[}\]])`)
	cleaned = trailingCommaRe.ReplaceAll(cleaned, []byte("$1"))
	data = cleaned

	// Strategy 1: Standard HAR 1.2 object {"log": {"entries": [...]}}
	var har HAR
	if err := json.Unmarshal(data, &har); err == nil && len(har.Log.Entries) > 0 {
		var requests []*proxy.HttpRequest
		for _, entry := range har.Log.Entries {
			if req := HAREntryToRequest(entry); req != nil {
				requests = append(requests, req)
			}
		}
		return requests, nil
	}

	// Strategy 2: Direct array of HAREntry [{"request": ...}]
	var entries []HAREntry
	if err := json.Unmarshal(data, &entries); err == nil && len(entries) > 0 && entries[0].Request.URL != "" {
		var requests []*proxy.HttpRequest
		for _, entry := range entries {
			if req := HAREntryToRequest(entry); req != nil {
				requests = append(requests, req)
			}
		}
		return requests, nil
	}

	// Strategy 3: Direct array of proxy.HttpRequest [{"id": ..., "url": ...}]
	var rawReqs []*proxy.HttpRequest
	if err := json.Unmarshal(data, &rawReqs); err == nil && len(rawReqs) > 0 && rawReqs[0].URL != "" {
		for _, r := range rawReqs {
			if r.ID == "" {
				r.ID = uuid.NewString()
			}
			if r.StartTime.IsZero() {
				r.StartTime = time.Now()
			}
			if r.DurationMs == 0 && r.Response != nil {
				r.DurationMs = r.Response.DurationMs
			}
		}
		return rawReqs, nil
	}

	// Strategy 4: Loose JSON Array / Postman collection entries
	var genericList []map[string]any
	if err := json.Unmarshal(data, &genericList); err == nil && len(genericList) > 0 {
		var requests []*proxy.HttpRequest
		for _, m := range genericList {
			rawURL := fmt.Sprintf("%v", m["url"])
			if rawURL == "" || rawURL == "<nil>" {
				continue
			}
			method := fmt.Sprintf("%v", m["method"])
			if method == "" || method == "<nil>" {
				method = "GET"
			}
			req := &proxy.HttpRequest{
				ID:        uuid.NewString(),
				Method:    proxy.HttpMethod(strings.ToUpper(method)),
				URL:       rawURL,
				Protocol:  "HTTP/1.1",
				StartTime: time.Now(),
			}
			if parsed, _ := url.Parse(rawURL); parsed != nil {
				req.HostPort.Host = parsed.Hostname()
				req.Path = parsed.Path
				if req.Path == "" {
					req.Path = "/"
				}
				req.HostPort.SSL = strings.HasPrefix(strings.ToLower(rawURL), "https")
			}
			requests = append(requests, req)
		}
		if len(requests) > 0 {
			return requests, nil
		}
	}

	return nil, fmt.Errorf("could not parse valid HAR or Request data from input")
}

// deterministicRequestID derives a stable identifier for a HAR entry.
func deterministicRequestID(method, rawURL, startedAt string) string {
	h := sha1.Sum([]byte(method + "|" + rawURL + "|" + startedAt))
	return fmt.Sprintf("%x", h[:16])
}

// HAREntryToRequest parses a single HAREntry into a complete HttpRequest model.
func HAREntryToRequest(entry HAREntry) *proxy.HttpRequest {
	if entry.Request.URL == "" {
		return nil
	}

	// Deterministic IDs derived from the entry content so re-importing the
	// same HAR yields stable identifiers (enables dedupe and correlation).
	reqID := deterministicRequestID(entry.Request.Method, entry.Request.URL, entry.StartedDateTime)

	startTime, err := time.Parse(time.RFC3339Nano, entry.StartedDateTime)
	if err != nil || startTime.IsZero() {
		startTime, err = time.Parse(time.RFC3339, entry.StartedDateTime)
		if err != nil || startTime.IsZero() {
			startTime = time.Now()
		}
	}

	headers := make(http.Header)
	for _, h := range entry.Request.Headers {
		if h.Name != "" {
			headers.Add(h.Name, h.Value)
		}
	}

	var body []byte
	bodyString := ""
	if entry.Request.PostData != nil {
		bodyString = entry.Request.PostData.Text
		if len(bodyString) > importBodyBytes {
			bodyString = bodyString[:importBodyBytes]
		}
		body = []byte(bodyString)
	}

	rawURL := entry.Request.URL
	parsedURL, _ := url.Parse(rawURL)
	host := ""
	port := 80
	path := "/"
	query := make(url.Values)
	isTLS := strings.HasPrefix(strings.ToLower(rawURL), "https")
	if isTLS {
		port = 443
	}

	if parsedURL != nil {
		host = parsedURL.Hostname()
		if p := parsedURL.Port(); p != "" {
			if pNum, err := strconv.Atoi(p); err == nil {
				port = pNum
			}
		}
		path = parsedURL.Path
		if path == "" {
			path = "/"
		}
		query = parsedURL.Query()
	}

	protocol := entry.Request.HTTPVersion
	if protocol == "" {
		if isTLS {
			protocol = "HTTP/2.0"
		} else {
			protocol = "HTTP/1.1"
		}
	}

	methodStr := strings.ToUpper(entry.Request.Method)
	if methodStr == "" {
		methodStr = "GET"
	}

	req := &proxy.HttpRequest{
		ID:       reqID,
		Protocol: protocol,
		Method:   proxy.HttpMethod(methodStr),
		URL:      rawURL,
		Path:     path,
		Query:    query,
		HostPort: proxy.HostPort{
			Host: host,
			Port: port,
			SSL:  isTLS,
		},
		Headers:    headers,
		Body:       body,
		BodyString: bodyString,
		StartTime:  startTime,
		EndTime:    startTime.Add(time.Duration(entry.Time) * time.Millisecond),
		DurationMs: entry.Time,
	}

	if entry.Response.Status > 0 {
		respHeaders := make(http.Header)
		for _, h := range entry.Response.Headers {
			if h.Name != "" {
				respHeaders.Add(h.Name, h.Value)
			}
		}

		respBody := []byte(entry.Response.Content.Text)
		if len(respBody) > importBodyBytes {
			respBody = respBody[:importBodyBytes]
		}
		if entry.Response.Content.Encoding == "base64" && entry.Response.Content.Text != "" {
			decoded, err := base64.StdEncoding.DecodeString(entry.Response.Content.Text)
			if err == nil {
				if len(decoded) > importBodyBytes {
					decoded = decoded[:importBodyBytes]
				}
				respBody = decoded
			}
		}

		respProtocol := entry.Response.HTTPVersion
		if respProtocol == "" {
			respProtocol = protocol
		}

		resp := &proxy.HttpResponse{
			ID:          reqID,
			RequestID:   reqID,
			StatusCode:  entry.Response.Status,
			StatusText:  entry.Response.StatusText,
			Protocol:    respProtocol,
			Headers:     respHeaders,
			Body:        respBody,
			BodyString:  string(respBody),
			BodySize:    int64(len(respBody)),
			ContentType: entry.Response.Content.MimeType,
			StartTime:   startTime,
			EndTime:     startTime.Add(time.Duration(entry.Time) * time.Millisecond),
			DurationMs:  entry.Time,
			Request:     req,
		}
		req.Response = resp
	}

	return req
}
