package storage

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"httpeek/pkg/proxy"

	"github.com/google/uuid"
)

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

// CreateSession inserts a new recording session.
func (sr *SessionRepo) CreateSession(name string) (*Session, error) {
	if name == "" {
		name = time.Now().Format("2006-01-02 15:04:05")
	}

	session := &Session{
		ID:        uuid.NewString(),
		Name:      name,
		CreatedAt: time.Now(),
	}

	query := `INSERT INTO sessions (id, name, created_at, request_count, file_size) VALUES (?, ?, ?, 0, 0)`
	_, err := sr.db.Conn().Exec(query, session.ID, session.Name, session.CreatedAt.UnixMilli())
	if err != nil {
		return nil, fmt.Errorf("create session failed: %w", err)
	}

	return session, nil
}

// SaveRequest saves an intercepted request/response into the active session.
func (sr *SessionRepo) SaveRequest(sessionID string, req *proxy.HttpRequest) error {
	reqHeadersJSON, _ := json.Marshal(req.Headers)
	var respHeadersJSON []byte
	var respBody []byte
	var statusCode int
	var contentType string

	if req.Response != nil {
		respHeadersJSON, _ = json.Marshal(req.Response.Headers)
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
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
	`

	_, err := sr.db.Conn().Exec(
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
	)

	if err != nil {
		return fmt.Errorf("save request failed: %w", err)
	}

	// Update session request count
	_, _ = sr.db.Conn().Exec(`UPDATE sessions SET request_count = request_count + 1 WHERE id = ?`, sessionID)
	return nil
}

// SaveResponse updates an existing request record with response data.
func (sr *SessionRepo) SaveResponse(resp *proxy.HttpResponse) error {
	if resp == nil {
		return nil
	}

	respHeadersJSON, _ := json.Marshal(resp.Headers)
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
	_, err := sr.db.Conn().Exec(
		query,
		resp.StatusCode,
		resp.ContentType,
		string(respHeadersJSON),
		resp.Body,
		resp.EndTime.UnixMilli(),
		resp.DurationMs,
		targetID,
	)
	return err
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

// DeleteSession deletes a session and its associated non-favorite captured requests.
func (sr *SessionRepo) DeleteSession(sessionID string) error {
	// 1. Delete non-favorite requests belonging to this session
	_, _ = sr.db.Conn().Exec(`DELETE FROM requests WHERE session_id = ? AND is_favorite = 0`, sessionID)

	// 2. If any requests in the session are marked as favorite, re-assign session_id to 'favorites' so they are preserved
	_, _ = sr.db.Conn().Exec(`UPDATE requests SET session_id = 'favorites' WHERE session_id = ? AND is_favorite = 1`, sessionID)

	// 3. Delete session record
	_, err := sr.db.Conn().Exec(`DELETE FROM sessions WHERE id = ?`, sessionID)
	return err
}

// ToggleFavorite marks or unmarks a request as favorite.
func (sr *SessionRepo) ToggleFavorite(requestID string, isFavorite bool) error {
	favInt := 0
	if isFavorite {
		favInt = 1
	}
	_, err := sr.db.Conn().Exec(`UPDATE requests SET is_favorite = ? WHERE id = ?`, favInt, requestID)
	return err
}

// GetSessionRequests queries all captured requests belonging to a session.
func (sr *SessionRepo) GetSessionRequests(sessionID string) ([]*proxy.HttpRequest, error) {
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

// GetFavorites queries all pinned favorite requests across sessions.
func (sr *SessionRepo) GetFavorites() ([]*proxy.HttpRequest, error) {
	query := `
	SELECT id, protocol, method, url, host, path, status_code, content_type,
	       request_headers, request_body, response_headers, response_body,
	       start_time, end_time, duration_ms, process_name, process_pid, is_favorite
	FROM requests
	WHERE is_favorite = 1
	ORDER BY start_time DESC
	`
	return sr.scanRequests(query)
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
			_ = json.Unmarshal([]byte(reqHeadersJSON), &httpReq.Headers)
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
				_ = json.Unmarshal([]byte(respHeadersJSON), &httpResp.Headers)
			}
			httpReq.Response = httpResp
		}

		list = append(list, httpReq)
	}

	return list, nil
}
