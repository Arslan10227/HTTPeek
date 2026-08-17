package services

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"httpeek/pkg/proxy"
	"httpeek/pkg/storage"
)

// SessionService wraps SQLite session, HAR, and favorite storage.
type SessionService struct {
	repo *storage.SessionRepo
}

// NewSessionService creates a session service.
func NewSessionService(repo *storage.SessionRepo) *SessionService {
	return &SessionService{repo: repo}
}

// ExportHAR generates a formatted HAR 1.2 JSON string.
func (s *SessionService) ExportHAR(requests []*proxy.HttpRequest) (string, error) {
	if s.repo == nil {
		return "", fmt.Errorf("storage not initialized")
	}
	har := storage.ExportToHAR(requests, "HTTPeek Archive")
	data, err := json.MarshalIndent(har, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// ExportRequestsAs serializes requests in the desired format (har, json, csv, curl).
func (s *SessionService) ExportRequestsAs(requests []*proxy.HttpRequest, format string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "json":
		return storage.ExportToJSON(requests)
	case "csv":
		return storage.ExportToCSV(requests), nil
	case "curl", "sh", "bash":
		return storage.ExportToCurlScript(requests), nil
	case "har":
		fallthrough
	default:
		return s.ExportHAR(requests)
	}
}

// ImportHAR parses HAR / JSON data and creates a new recorded session.
func (s *SessionService) ImportHAR(harJSON, sessionName string) (*storage.Session, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("storage not initialized")
	}
	if sessionName == "" {
		sessionName = fmt.Sprintf("Imported Session %s", time.Now().Format("15:04:05"))
	}

	requests, err := storage.ImportHARBytes([]byte(harJSON))
	if err != nil {
		return nil, fmt.Errorf("import failed: %w", err)
	}

	sess, err := s.repo.CreateSession(sessionName)
	if err != nil {
		return nil, err
	}

	for _, req := range requests {
		_ = s.repo.SaveRequest(sess.ID, req)
		if req.Response != nil {
			_ = s.repo.SaveResponse(req.Response)
		}
	}
	return sess, nil
}

// ListSessions returns all recorded sessions.
func (s *SessionService) ListSessions() ([]*storage.Session, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("storage not initialized")
	}
	return s.repo.ListSessions()
}

// GetSessionRequests returns requests for a session.
func (s *SessionService) GetSessionRequests(sessionID string) ([]*proxy.HttpRequest, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("storage not initialized")
	}
	return s.repo.GetSessionRequests(sessionID)
}

// DeleteSession removes a session and its requests.
func (s *SessionService) DeleteSession(sessionID string) error {
	if s.repo == nil {
		return fmt.Errorf("storage not initialized")
	}
	return s.repo.DeleteSession(sessionID)
}

// GetFavorites returns pinned favorite requests.
func (s *SessionService) GetFavorites() ([]*proxy.HttpRequest, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("storage not initialized")
	}
	return s.repo.GetFavorites()
}

// ToggleFavorite persists favorite status.
func (s *SessionService) ToggleFavorite(requestID string, isFavorite bool) error {
	if s.repo == nil {
		return fmt.Errorf("storage not initialized")
	}
	return s.repo.ToggleFavorite(requestID, isFavorite)
}
