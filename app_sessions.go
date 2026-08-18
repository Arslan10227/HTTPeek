package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"httpeek/pkg/logger"
	"httpeek/pkg/proxy"
	"httpeek/pkg/storage"

	"github.com/google/uuid"
)

// CreateNewSession starts a new recording session.
func (a *App) CreateNewSession(name string) (*storage.Session, error) {
	if a.sessionRepo == nil {
		return nil, fmt.Errorf("storage not initialized")
	}
	sess, err := a.sessionRepo.CreateSession(name)
	if err == nil {
		a.currentSess = sess
	}
	return sess, err
}

// ListSessions retrieves all recorded sessions.
func (a *App) ListSessions() ([]*storage.Session, error) {
	if a.sessionRepo == nil {
		return nil, fmt.Errorf("storage not initialized")
	}
	return a.sessionRepo.ListSessions()
}

// DeleteSession deletes a recorded session and its captured requests.
func (a *App) DeleteSession(sessionID string) error {
	if a.sessionRepo == nil {
		return fmt.Errorf("storage not initialized")
	}
	return a.sessionRepo.DeleteSession(sessionID)
}

// GetSessionRequests retrieves captured requests from a specific session.
func (a *App) GetSessionRequests(sessionID string) ([]*proxy.HttpRequest, error) {
	if a.sessionRepo == nil {
		return nil, fmt.Errorf("storage not initialized")
	}
	return a.sessionRepo.GetSessionRequests(sessionID)
}

// ExportHAR generates a formatted HAR 1.2 JSON string from a list of requests.
func (a *App) ExportHAR(requests []*proxy.HttpRequest) (string, error) {
	if a.sessions != nil {
		return a.sessions.ExportHAR(requests)
	}
	har := storage.ExportToHAR(requests, "HTTPeek Archive")
	data, err := json.MarshalIndent(har, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// ExportRequestsAs serializes requests into the specified format (har, json, csv, curl).
func (a *App) ExportRequestsAs(requests []*proxy.HttpRequest, format string) (string, error) {
	if a.sessions != nil {
		return a.sessions.ExportRequestsAs(requests, format)
	}
	return a.ExportHAR(requests)
}

// ImportHAR parses a HAR / JSON string with resilient fallback and creates a new recorded session.
func (a *App) ImportHAR(harJSON string, sessionName string) (*storage.Session, error) {
	if a.sessions != nil {
		return a.sessions.ImportHAR(harJSON, sessionName)
	}
	if sessionName == "" {
		sessionName = fmt.Sprintf("Imported Session %s", time.Now().Format("15:04:05"))
	}
	requests, err := storage.ImportHARBytes([]byte(harJSON))
	if err != nil {
		return nil, err
	}

	if a.sessionRepo == nil {
		return nil, fmt.Errorf("storage not initialized")
	}

	sess, err := a.sessionRepo.CreateSession(sessionName)
	if err != nil {
		return nil, err
	}

	for _, req := range requests {
		_ = a.sessionRepo.SaveRequest(sess.ID, req)
		if req.Response != nil {
			_ = a.sessionRepo.SaveResponse(req.Response)
		}
	}

	return sess, nil
}

// GetFavorites retrieves all pinned favorite requests.
func (a *App) GetFavorites() ([]*proxy.HttpRequest, error) {
	if a.sessionRepo == nil {
		return nil, fmt.Errorf("storage not initialized")
	}
	return a.sessionRepo.GetFavorites()
}

// ToggleFavoriteRequest persists favorite status change into database.
func (a *App) ToggleFavoriteRequest(requestID string, isFavorite bool) error {
	if a.sessionRepo == nil {
		return fmt.Errorf("storage not initialized")
	}
	return a.sessionRepo.ToggleFavorite(requestID, isFavorite)
}

// RepeatRequest executes a request multiple times in sequence with specified delay interval.
func (a *App) RepeatRequest(req *proxy.HttpRequest, count int, intervalMs int) ([]*proxy.HttpResponse, error) {
	if count <= 0 {
		count = 1
	}
	results := make([]*proxy.HttpResponse, 0, count)
	for i := 0; i < count; i++ {
		resp, err := a.ReplayRequest(req)
		if err != nil {
			logger.Warn("App", fmt.Sprintf("RepeatRequest iteration %d failed: %v", i+1, err))
			continue
		}
		if resp != nil {
			results = append(results, resp)
		}
		if intervalMs > 0 && i < count-1 {
			time.Sleep(time.Duration(intervalMs) * time.Millisecond)
		}
	}
	return results, nil
}

// ReplayRequest resends an intercepted HTTP request.
func (a *App) ReplayRequest(req *proxy.HttpRequest) (*proxy.HttpResponse, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	bodyReader := bytes.NewReader(req.Body)
	if len(req.Body) == 0 && req.BodyString != "" {
		bodyReader = bytes.NewReader([]byte(req.BodyString))
	}
	httpReq, err := http.NewRequest(string(req.Method), req.URL, bodyReader)
	if err != nil {
		return nil, err
	}
	for k, vals := range req.Headers {
		for _, v := range vals {
			httpReq.Header.Add(k, v)
		}
	}
	startTime := time.Now()
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	endTime := time.Now()
	contentType := resp.Header.Get("Content-Type")
	contentEncoding := resp.Header.Get("Content-Encoding")
	decodedBytes, decodedStr := proxy.DecodeBody(bodyBytes, contentEncoding, contentType)
	bodyBase64 := base64.StdEncoding.EncodeToString(decodedBytes)

	return &proxy.HttpResponse{
		ID:          uuid.NewString(),
		StatusCode:  resp.StatusCode,
		StatusText:  resp.Status,
		Protocol:    resp.Proto,
		Headers:     resp.Header.Clone(),
		Body:        decodedBytes,
		BodyBase64:  bodyBase64,
		BodyString:  decodedStr,
		BodyText:    decodedStr,
		BodySize:    int64(len(decodedBytes)),
		ContentType: contentType,
		StartTime:   startTime,
		EndTime:     endTime,
		DurationMs:  endTime.Sub(startTime).Milliseconds(),
	}, nil
}
