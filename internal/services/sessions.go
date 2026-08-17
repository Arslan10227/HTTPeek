package services

import (
	"encoding/json"
	"fmt"
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

// ImportHAR parses HAR JSON and creates a new session.
func (s *SessionService) ImportHAR(harJSON, sessionName string) (*storage.Session, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("storage not initialized")
	}
	if sessionName == "" {
		sessionName = fmt.Sprintf("Imported HAR %s", time.Now().Format("15:04:05"))
	}
	var har storage.HAR
	if err := json.Unmarshal([]byte(harJSON), &har); err != nil {
		return nil, fmt.Errorf("invalid HAR JSON: %w", err)
	}

	sess, err := s.repo.CreateSession(sessionName)
	if err != nil {
		return nil, err
	}

	for _, entry := range har.Log.Entries {
		req := storage.HAREntryToRequest(entry)
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
