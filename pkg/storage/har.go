package storage

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
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
	var reqHeaders []HARHeaderPair
	for k, v := range req.Headers {
		reqHeaders = append(reqHeaders, HARHeaderPair{Name: k, Value: strings.Join(v, ", ")})
	}

	var queryPairs []HARHeaderPair
	for k, v := range req.Query {
		queryPairs = append(queryPairs, HARHeaderPair{Name: k, Value: strings.Join(v, ", ")})
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
		for k, v := range resp.Headers {
			respHeaders = append(respHeaders, HARHeaderPair{Name: k, Value: strings.Join(v, ", ")})
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
func ExportHARToFile(requests []*proxy.HttpRequest, title, filePath string) error {
	har := ExportToHAR(requests, title)
	data, err := json.MarshalIndent(har, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal HAR failed: %w", err)
	}
	return os.WriteFile(filePath, data, 0644)
}

// ImportHARFromFile parses a HAR file into a slice of HttpRequest objects.
func ImportHARFromFile(filePath string) ([]*proxy.HttpRequest, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	var har HAR
	if err := json.Unmarshal(data, &har); err != nil {
		return nil, fmt.Errorf("unmarshal HAR failed: %w", err)
	}

	var requests []*proxy.HttpRequest
	for _, entry := range har.Log.Entries {
		req := HAREntryToRequest(entry)
		requests = append(requests, req)
	}

	return requests, nil
}

// HAREntryToRequest parses a single HAREntry into a complete HttpRequest model.
func HAREntryToRequest(entry HAREntry) *proxy.HttpRequest {
	reqID := uuid.New().String()
	respID := uuid.New().String()

	startTime, err := time.Parse(time.RFC3339Nano, entry.StartedDateTime)
	if err != nil || startTime.IsZero() {
		startTime, err = time.Parse(time.RFC3339, entry.StartedDateTime)
		if err != nil || startTime.IsZero() {
			startTime = time.Now()
		}
	}

	headers := make(http.Header)
	for _, h := range entry.Request.Headers {
		headers.Add(h.Name, h.Value)
	}

	var body []byte
	bodyString := ""
	if entry.Request.PostData != nil {
		bodyString = entry.Request.PostData.Text
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

	req := &proxy.HttpRequest{
		ID:       reqID,
		Protocol: protocol,
		Method:   proxy.HttpMethod(strings.ToUpper(entry.Request.Method)),
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
			respHeaders.Add(h.Name, h.Value)
		}

		respBody := []byte(entry.Response.Content.Text)
		if entry.Response.Content.Encoding == "base64" {
			decoded, err := base64.StdEncoding.DecodeString(entry.Response.Content.Text)
			if err == nil {
				respBody = decoded
			}
		}

		respProtocol := entry.Response.HTTPVersion
		if respProtocol == "" {
			respProtocol = protocol
		}

		resp := &proxy.HttpResponse{
			ID:          respID,
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
