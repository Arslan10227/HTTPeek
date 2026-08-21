package storage

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"httpeek/pkg/logger"
	"httpeek/pkg/proxy"

	"github.com/google/uuid"
)

// favoritesSessionID is the synthetic session used to store favorite requests.



// favIntFor converts the IsFavorite bool to the integer column value.
func favIntFor(req *proxy.HttpRequest) int {
	if req != nil && req.IsFavorite {
		return 1
	}
	return 0
}

// Session represents a capture recording session.
type Session struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"createdAt"`
	RequestCount int       `json:"requestCount"`
	FileSize     int64     `json:"fileSize"`
}

// SessionRepo handles database queries for captured requests and sessions.
type SessionRepo struct {
	db *DB
}

// NewSessionRepo creates a new session repository.
func NewSessionRepo(db *DB) *SessionRepo {
	return &SessionRepo{db: db}
}

// CreateSession inserts a new recording session. Duplicate names get an
// auto-incremented suffix so sessions stay distinguishable.
func (sr *SessionRepo) CreateSession(name string) (*Session, error) {
	if name == "" {
		name = time.Now().Format("2006-01-02 15:04:05")
	}

	uniqueName, err := sr.uniqueSessionName(name)
	if err != nil {
		return nil, err
	}

	session := &Session{
		ID:        uuid.NewString(),
		Name:      uniqueName,
		CreatedAt: time.Now(),
	}

	query := `INSERT INTO sessions (id, name, created_at, request_count, file_size) VALUES (?, ?, ?, 0, 0)`
	if _, err := sr.db.Conn().Exec(query, session.ID, session.Name, session.CreatedAt.UnixMilli()); err != nil {
		return nil, fmt.Errorf("create session failed: %w", err)
	}

	return session, nil
}

// RenameSession updates a session's display name.
func (sr *SessionRepo) RenameSession(sessionID, name string) error {
	if sessionID == "" {
		return fmt.Errorf("invalid session id")
	}
	if name == "" {
		return fmt.Errorf("session name must not be empty")
	}
	uniqueName, err := sr.uniqueSessionNameExcluding(name, sessionID)
	if err != nil {
		return err
	}
	if _, err := sr.db.Conn().Exec(`UPDATE sessions SET name = ? WHERE id = ?`, uniqueName, sessionID); err != nil {
		return fmt.Errorf("rename session failed: %w", err)
	}
	return nil
}

// uniqueSessionName ensures the name is not already taken, appending (2), (3)...
func (sr *SessionRepo) uniqueSessionName(name string) (string, error) {
	return sr.uniqueSessionNameExcluding(name, "")
}

func (sr *SessionRepo) uniqueSessionNameExcluding(name, excludeID string) (string, error) {
	candidate := name
	for i := 2; ; i++ {
		var count int
		err := sr.db.Conn().QueryRow(`SELECT COUNT(*) FROM sessions WHERE name = ? AND id != ?`, candidate, excludeID).Scan(&count)
		if err != nil {
			return "", fmt.Errorf("check session name failed: %w", err)
		}
		if count == 0 {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s (%d)", name, i)
	}
}

// SaveRequest saves an intercepted request/response into the active session.
// The insert and session counter update run in one transaction.
func (sr *SessionRepo) SaveRequest(sessionID string, req *proxy.HttpRequest) error {
	if req == nil {
		return nil
	}
	if sessionID == "" {
		return fmt.Errorf("save request failed: empty session id")
	}

	reqHeadersJSON, err := json.Marshal(req.Headers)
	if err != nil {
		return fmt.Errorf("marshal request headers failed: %w", err)
	}
	var respHeadersJSON []byte
	var respBody []byte
	var statusCode int
	var contentType string

	if req.Response != nil {
		respHeadersJSON, err = json.Marshal(req.Response.Headers)
		if err != nil {
			return fmt.Errorf("marshal response headers failed: %w", err)
		}
		respBody = req.Response.Body
		statusCode = req.Response.StatusCode
		contentType = req.Response.ContentType
	}

	procName := ""
	procPID := 0
	if req.Process != nil {
		procName = req.Process.Name
		procPID = req.Process.PID
	}

	query := `
	INSERT INTO requests (
		id, session_id, protocol, method, url, host, path,
		status_code, content_type, request_headers, request_body,
		response_headers, response_body, start_time, end_time,
		duration_ms, process_name, process_pid, is_favorite
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	tx, err := sr.db.Conn().Begin()
	if err != nil {
		return fmt.Errorf("begin save transaction failed: %w", err)
	}
	defer tx.Rollback()

	favInt := 0
	if req.IsFavorite {
		favInt = 1
	}

	if _, err := tx.Exec(
		query,
		req.ID,
		sessionID,
		req.Protocol,
		string(req.Method),
		req.URL,
		req.HostPort.Host,
		req.Path,
		statusCode,
		contentType,
		string(reqHeadersJSON),
		req.Body,
		string(respHeadersJSON),
		respBody,
		req.StartTime.UnixMilli(),
		req.EndTime.UnixMilli(),
		req.DurationMs,
		procName,
		procPID,
		favInt,
	); err != nil {
		return fmt.Errorf("save request failed: %w", err)
	}

	bodyBytes := int64(len(req.Body) + len(respBody))
	if _, err := tx.Exec(
		`UPDATE sessions SET request_count = request_count + 1, file_size = file_size + ? WHERE id = ?`,
		bodyBytes, sessionID,
	); err != nil {
		return fmt.Errorf("update session counters failed: %w", err)
	}

	return tx.Commit()
}

// SaveRequestsBatch persists many requests atomically (used by HAR import).
func (sr *SessionRepo) SaveRequestsBatch(sessionID string, reqs []*proxy.HttpRequest) error {
	if sessionID == "" {
		return fmt.Errorf("save batch failed: empty session id")
	}
	tx, err := sr.db.Conn().Begin()
	if err != nil {
		return fmt.Errorf("begin import transaction failed: %w", err)
	}
	defer tx.Rollback()

	var totalBytes int64
	for _, req := range reqs {
		if req == nil {
			continue
		}
		reqHeadersJSON, err := json.Marshal(req.Headers)
		if err != nil {
			return fmt.Errorf("marshal request headers failed: %w", err)
		}
		var respHeadersJSON []byte
		var respBody []byte
		var statusCode int
		var contentType string
		if req.Response != nil {
			respHeadersJSON, err = json.Marshal(req.Response.Headers)
			if err != nil {
				return fmt.Errorf("marshal response headers failed: %w", err)
			}
			respBody = req.Response.Body
			statusCode = req.Response.StatusCode
			contentType = req.Response.ContentType
		}

		procName := ""
		procPID := 0
		if req.Process != nil {
			procName = req.Process.Name
			procPID = req.Process.PID
		}

		if _, err := tx.Exec(
			`INSERT INTO requests (
				id, session_id, protocol, method, url, host, path,
				status_code, content_type, request_headers, request_body,
				response_headers, response_body, start_time, end_time,
				duration_ms, process_name, process_pid, is_favorite
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			req.ID,
			sessionID,
			req.Protocol,
			string(req.Method),
			req.URL,
			req.HostPort.Host,
			req.Path,
			statusCode,
			contentType,
			string(reqHeadersJSON),
			req.Body,
			string(respHeadersJSON),
			respBody,
			req.StartTime.UnixMilli(),
			req.EndTime.UnixMilli(),
			req.DurationMs,
			procName,
			procPID,
			favIntFor(req),
		); err != nil {
			return fmt.Errorf("save imported request failed: %w", err)
		}
		totalBytes += int64(len(req.Body) + len(respBody))
	}

	if _, err := tx.Exec(
		`UPDATE sessions SET request_count = request_count + ?, file_size = file_size + ? WHERE id = ?`,
		len(reqs), totalBytes, sessionID,
	); err != nil {
		return fmt.Errorf("update session counters failed: %w", err)
	}

	return tx.Commit()
}

// SaveResponse updates an existing request record with response data.
func (sr *SessionRepo) SaveResponse(resp *proxy.HttpResponse) error {
	if resp == nil {
		return nil
	}

	respHeadersJSON, err := json.Marshal(resp.Headers)
	if err != nil {
		return fmt.Errorf("marshal response headers failed: %w", err)
	}
	query := `
	UPDATE requests SET 
		status_code = ?,
		content_type = ?,
		response_headers = ?,
		response_body = ?,
		end_time = ?,
		duration_ms = ?
	WHERE id = ?
	`
	targetID := resp.RequestID
	if targetID == "" {
		targetID = resp.ID
	}
	if targetID == "" {
		return fmt.Errorf("save response failed: missing request id")
	}
	result, err := sr.db.Conn().Exec(
		query,
		resp.StatusCode,
		resp.ContentType,
		string(respHeadersJSON),
		resp.Body,
		resp.EndTime.UnixMilli(),
		resp.DurationMs,
		targetID,
	)
	if err != nil {
		return fmt.Errorf("save response failed: %w", err)
	}
	if n, err := result.RowsAffected(); err == nil && n > 0 {
		// Track captured body bytes on the owning session.
		_, _ = sr.db.Conn().Exec(
			`UPDATE sessions SET file_size = file_size + ? WHERE id = (SELECT session_id FROM requests WHERE id = ?)`,
			len(resp.Body), targetID,
		)
	}
	return nil
}

// ListSessions retrieves all recorded sessions.
func (sr *SessionRepo) ListSessions() ([]*Session, error) {
	query := `SELECT id, name, created_at, request_count, file_size FROM sessions ORDER BY created_at DESC`
	rows, err := sr.db.Conn().Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*Session
	for rows.Next() {
		var s Session
		var createdMilli int64
		if err := rows.Scan(&s.ID, &s.Name, &createdMilli, &s.RequestCount, &s.FileSize); err != nil {
			continue
		}
		s.CreatedAt = time.UnixMilli(createdMilli)
		list = append(list, &s)
	}

	return list, nil
}

// DeleteSession deletes a session and its associated captured requests.
func (sr *SessionRepo) DeleteSession(sessionID string) error {
	if sessionID == "" {
		return fmt.Errorf("invalid session id %q", sessionID)
	}
	if sessionID == "favorites" {
		return fmt.Errorf("cannot delete favorites session")
	}

	tx, err := sr.db.Conn().Begin()
	if err != nil {
		return fmt.Errorf("begin delete transaction failed: %w", err)
	}
	defer tx.Rollback()

	// Copy favorite requests to the favorites table before deletion to preserve them.
	if _, err := tx.Exec(`INSERT OR REPLACE INTO favorites (id, protocol, method, url, host, path, status_code, content_type, request_headers, request_body, response_headers, response_body, start_time, end_time, duration_ms, process_name, process_pid, created_at)
		SELECT id, protocol, method, url, host, path, status_code, content_type, request_headers, request_body, response_headers, response_body, start_time, end_time, duration_ms, process_name, process_pid, start_time
		FROM requests WHERE session_id = ? AND is_favorite = 1`, sessionID); err != nil {
		return fmt.Errorf("copy favorites before delete failed: %w", err)
	}

	// Delete all requests belonging to the session.
	if _, err := tx.Exec(`DELETE FROM requests WHERE session_id = ?`, sessionID); err != nil {
		return fmt.Errorf("delete session requests failed: %w", err)
	}

	// Delete the session row itself.
	if _, err := tx.Exec(`DELETE FROM sessions WHERE id = ?`, sessionID); err != nil {
		return fmt.Errorf("delete session failed: %w", err)
	}

	return tx.Commit()
}

// ToggleFavorite marks or unmarks a request as favorite.
func (sr *SessionRepo) ToggleFavorite(requestID string, isFavorite bool) error {
	tx, err := sr.db.Conn().Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if isFavorite {
		// 1. Update requests table flag
		_, err = tx.Exec(`UPDATE requests SET is_favorite = 1 WHERE id = ?`, requestID)
		if err != nil {
			return err
		}

		// 2. Copy request into durable favorites table
		_, err = tx.Exec(`
			INSERT OR REPLACE INTO favorites (
				id, protocol, method, url, host, path, status_code, content_type,
				request_headers, request_body, response_headers, response_body,
				start_time, end_time, duration_ms, process_name, process_pid, created_at
			)
			SELECT 
				id, protocol, method, url, host, path, status_code, content_type,
				request_headers, request_body, response_headers, response_body,
				start_time, end_time, duration_ms, process_name, process_pid, ?
			FROM requests
			WHERE id = ?
		`, time.Now().UnixMilli(), requestID)
		if err != nil {
			return err
		}
	} else {
		// 1. Clear flag in requests table
		_, err = tx.Exec(`UPDATE requests SET is_favorite = 0 WHERE id = ?`, requestID)
		if err != nil {
			return err
		}

		// 2. Delete from favorites table
		_, err = tx.Exec(`DELETE FROM favorites WHERE id = ?`, requestID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// DeleteFavorite permanently removes a request from both the requests table
// and the durable favorites table so it cannot reappear on next load.
func (sr *SessionRepo) DeleteFavorite(requestID string) error {
	tx, err := sr.db.Conn().Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.Exec(`DELETE FROM favorites WHERE id = ?`, requestID); err != nil {
		return fmt.Errorf("delete from favorites failed: %w", err)
	}
	if _, err = tx.Exec(`DELETE FROM requests WHERE id = ?`, requestID); err != nil {
		return fmt.Errorf("delete from requests failed: %w", err)
	}
	return tx.Commit()
}

// GetSessionRequests queries all captured requests belonging to a session.
func (sr *SessionRepo) GetSessionRequests(sessionID string) ([]*proxy.HttpRequest, error) {
	if sessionID == "" {
		return nil, fmt.Errorf("invalid empty session id")
	}
	query := `
	SELECT id, protocol, method, url, host, path, status_code, content_type,
	       request_headers, request_body, response_headers, response_body,
	       start_time, end_time, duration_ms, process_name, process_pid, is_favorite
	FROM requests
	WHERE session_id = ?
	ORDER BY start_time ASC
	`
	return sr.scanRequests(query, sessionID)
}

// GetSessionRequestsPage returns a bounded page of session requests ordered
// newest-first, with body bytes excluded for lightweight UI listing.
func (sr *SessionRepo) GetSessionRequestsPage(sessionID string, limit, offset int) ([]*proxy.HttpRequest, error) {
	if sessionID == "" {
		return nil, fmt.Errorf("invalid empty session id")
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	query := `
	SELECT id, protocol, method, url, host, path, status_code, content_type,
	       request_headers, NULL, response_headers, NULL,
	       start_time, end_time, duration_ms, process_name, process_pid, is_favorite
	FROM requests
	WHERE session_id = ?
	ORDER BY start_time DESC
	LIMIT ? OFFSET ?
	`
	return sr.scanRequests(query, sessionID, limit, offset)
}

// GetSessionRequestCount returns the number of captured requests in a session.
func (sr *SessionRepo) GetSessionRequestCount(sessionID string) (int, error) {
	if sessionID == "" {
		return 0, fmt.Errorf("invalid empty session id")
	}
	var count int
	err := sr.db.Conn().QueryRow(
		`SELECT COUNT(*) FROM requests WHERE session_id = ?`,
		sessionID,
	).Scan(&count)
	return count, err
}

// CountSessionRequests returns the number of requests recorded in a session.
func (sr *SessionRepo) CountSessionRequests(sessionID string) (int, error) {
	return sr.GetSessionRequestCount(sessionID)
}

// GetRequestByID loads a single request including headers and body from durable storage.
func (sr *SessionRepo) GetRequestByID(requestID string) (*proxy.HttpRequest, error) {
	query := `
	SELECT id, protocol, method, url, host, path, status_code, content_type,
	       request_headers, request_body, response_headers, response_body,
	       start_time, end_time, duration_ms, process_name, process_pid, is_favorite
	FROM requests
	WHERE id = ?
	LIMIT 1
	`
	reqs, err := sr.scanRequests(query, requestID)
	if err != nil {
		return nil, err
	}
	if len(reqs) > 0 {
		return reqs[0], nil
	}
	// Fallback: fetch from favorites table where the request was saved.
	favQuery := `
	SELECT id, protocol, method, url, host, path, status_code, content_type,
	       request_headers, request_body, response_headers, response_body,
	       start_time, end_time, duration_ms, process_name, process_pid, 1
	FROM favorites
	WHERE id = ?
	LIMIT 1`
	favReqs, err := sr.scanRequests(favQuery, requestID)
	if err != nil {
		return nil, err
	}
	if len(favReqs) > 0 {
		favReqs[0].IsFavorite = true
		return favReqs[0], nil
	}
	// Not found in either table.
	return nil, nil
}

// GetFavorites queries all pinned favorite requests across sessions and durable storage.
func (sr *SessionRepo) GetFavorites() ([]*proxy.HttpRequest, error) {
	queryReqs := `
	SELECT id, protocol, method, url, host, path, status_code, content_type,
	       request_headers, request_body, response_headers, response_body,
	       start_time, end_time, duration_ms, process_name, process_pid, is_favorite
	FROM requests
	WHERE is_favorite = 1
	ORDER BY start_time DESC
	`
	reqs, err := sr.scanRequests(queryReqs)
	if err != nil {
		reqs = []*proxy.HttpRequest{}
	}

	queryFavs := `
	SELECT id, protocol, method, url, host, path, status_code, content_type,
	       request_headers, request_body, response_headers, response_body,
	       start_time, end_time, duration_ms, process_name, process_pid, 1
	FROM favorites
	ORDER BY start_time DESC
	`
	favs, err := sr.scanRequests(queryFavs)
	if err != nil {
		favs = []*proxy.HttpRequest{}
	}

	seen := make(map[string]bool)
	var merged []*proxy.HttpRequest
	for _, r := range reqs {
		if r != nil && !seen[r.ID] {
			r.IsFavorite = true
			seen[r.ID] = true
			merged = append(merged, r)
		}
	}
	for _, r := range favs {
		if r != nil && !seen[r.ID] {
			r.IsFavorite = true
			seen[r.ID] = true
			merged = append(merged, r)
		}
	}
	return merged, nil
}

func (sr *SessionRepo) scanRequests(query string, args ...any) ([]*proxy.HttpRequest, error) {
	rows, err := sr.db.Conn().Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*proxy.HttpRequest
	for rows.Next() {
		var (
			id, protocol, method, rawURL, host, path string
			statusCode, isFavorite                   int
			contentType                              string
			reqHeadersJSON, respHeadersJSON          string
			reqBody, respBody                        []byte
			startMilli, endMilli, durationMs         int64
			procName                                 string
			procPID                                  int
		)

		err := rows.Scan(
			&id, &protocol, &method, &rawURL, &host, &path, &statusCode, &contentType,
			&reqHeadersJSON, &reqBody, &respHeadersJSON, &respBody,
			&startMilli, &endMilli, &durationMs, &procName, &procPID, &isFavorite,
		)
		if err != nil {
			logger.Warn("Storage", fmt.Sprintf("scan request row failed: %v", err))
			continue
		}

		httpReq := &proxy.HttpRequest{
			ID:         id,
			Protocol:   protocol,
			Method:     proxy.HttpMethod(method),
			URL:        rawURL,
			Path:       path,
			Body:       reqBody,
			BodyString: string(reqBody),
			BodyText:   string(reqBody),
			StartTime:  time.UnixMilli(startMilli),
			EndTime:    time.UnixMilli(endMilli),
			IsFavorite: isFavorite == 1,
			HostPort: proxy.HostPort{
				Host: host,
				SSL:  strings.HasPrefix(strings.ToLower(rawURL), "https"),
			},
		}

		if reqHeadersJSON != "" {
			if err := json.Unmarshal([]byte(reqHeadersJSON), &httpReq.Headers); err != nil {
				logger.Warn("Storage", fmt.Sprintf("unmarshal request headers for %s failed: %v", id, err))
			}
		}

		if procName != "" || procPID > 0 {
			httpReq.Process = &proxy.ProcessInfo{
				Name: procName,
				PID:  procPID,
			}
		}

		if statusCode > 0 {
			httpResp := &proxy.HttpResponse{
				ID:          id,
				StatusCode:  statusCode,
				ContentType: contentType,
				Body:        respBody,
				BodyString:  string(respBody),
				BodyText:    string(respBody),
				BodySize:    int64(len(respBody)),
				StartTime:   time.UnixMilli(startMilli),
				EndTime:     time.UnixMilli(endMilli),
				DurationMs:  durationMs,
			}
			if respHeadersJSON != "" {
				if err := json.Unmarshal([]byte(respHeadersJSON), &httpResp.Headers); err != nil {
					logger.Warn("Storage", fmt.Sprintf("unmarshal response headers for %s failed: %v", id, err))
				}
			}
			httpReq.Response = httpResp
		}

		list = append(list, httpReq)
	}

	return list, nil
}
