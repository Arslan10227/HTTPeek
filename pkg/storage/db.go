package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// DB manages embedded SQLite persistence.
type DB struct {
	conn *sql.DB
}

// OpenDB initializes or opens the SQLite database in the given directory.
func OpenDB(storageDir string) (*DB, error) {
	if storageDir == "" {
		storageDir = "."
	}
	if err := os.MkdirAll(storageDir, 0755); err != nil {
		return nil, fmt.Errorf("create storage dir failed: %w", err)
	}

	dbPath := filepath.Join(storageDir, "httpeek.db")
	db, err := sql.Open("sqlite", dbPath+
		"?_pragma=journal_mode(WAL)"+
		"&_pragma=synchronous(NORMAL)"+
		"&_pragma=busy_timeout(10000)"+
		"&_pragma=foreign_keys(ON)")
	if err != nil {
		return nil, fmt.Errorf("open SQLite db failed: %w", err)
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)

	s := &DB{conn: db}
	if err := s.initSchema(); err != nil {
		db.Close()
		return nil, fmt.Errorf("init SQLite schema failed: %w", err)
	}

	return s, nil
}

func (d *DB) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS sessions (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		created_at INTEGER NOT NULL,
		request_count INTEGER DEFAULT 0,
		file_size INTEGER DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS requests (
		id TEXT PRIMARY KEY,
		session_id TEXT NOT NULL,
		protocol TEXT,
		method TEXT,
		url TEXT,
		host TEXT,
		path TEXT,
		status_code INTEGER,
		content_type TEXT,
		request_headers TEXT,
		request_body BLOB,
		response_headers TEXT,
		response_body BLOB,
		start_time INTEGER,
		end_time INTEGER,
		duration_ms INTEGER,
		process_name TEXT,
		process_pid INTEGER,
		is_favorite INTEGER DEFAULT 0,
		FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_requests_session_id ON requests(session_id);
	CREATE INDEX IF NOT EXISTS idx_requests_url ON requests(url);
	CREATE INDEX IF NOT EXISTS idx_requests_host ON requests(host);
	CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status_code);
	CREATE INDEX IF NOT EXISTS idx_requests_query ON requests(session_id, status_code, host, method, content_type, start_time);

	CREATE TABLE IF NOT EXISTS rules (
		id TEXT PRIMARY KEY,
		rule_type TEXT NOT NULL,
		name TEXT NOT NULL,
		enabled INTEGER DEFAULT 1,
		data TEXT NOT NULL,
		updated_at INTEGER NOT NULL
	);

	-- Favorites table storing copies of favourite requests so they survive session deletion.
	CREATE TABLE IF NOT EXISTS favorites (
		id TEXT PRIMARY KEY,
		protocol TEXT,
		method TEXT,
		url TEXT,
		host TEXT,
		path TEXT,
		status_code INTEGER,
		content_type TEXT,
		request_headers TEXT,
		request_body BLOB,
		response_headers TEXT,
		response_body BLOB,
		start_time INTEGER,
		end_time INTEGER,
		duration_ms INTEGER,
		process_name TEXT,
		process_pid INTEGER,
		created_at INTEGER NOT NULL
	);
	`

	if _, err := d.conn.Exec(schema); err != nil {
		return fmt.Errorf("apply base schema failed: %w", err)
	}

	// Ensure the synthetic 'favorites' session exists for backward compatibility.
	if _, err := d.conn.Exec(
		`INSERT OR IGNORE INTO sessions (id, name, created_at, request_count, file_size) VALUES (?, ?, ?, 0, 0)`,
		"favorites", "Favorites", 0,
	); err != nil {
		return fmt.Errorf("ensure favorites session failed: %w", err)
	}

	// Composite indexes for common query patterns on large sessions.
	indexes := `
	CREATE INDEX IF NOT EXISTS idx_requests_session_status ON requests(session_id, status_code);
	CREATE INDEX IF NOT EXISTS idx_requests_session_host ON requests(session_id, host);
	CREATE INDEX IF NOT EXISTS idx_requests_session_start ON requests(session_id, start_time);
	`
	if _, err := d.conn.Exec(indexes); err != nil {
		return fmt.Errorf("apply indexes failed: %w", err)
	}

	// Schema versioning via PRAGMA user_version. Append future migrations
	// here, gated on the current version.
	var version int
	if err := d.conn.QueryRow("PRAGMA user_version").Scan(&version); err != nil {
		return fmt.Errorf("read schema version failed: %w", err)
	}
	if version < 1 {
		if _, err := d.conn.Exec("PRAGMA user_version = 1"); err != nil {
			return fmt.Errorf("set schema version failed: %w", err)
		}
	}

	if version < 2 {
		// Migrate old favorite requests to the new table.
		migrate := `
		INSERT INTO favorites (id, protocol, method, url, host, path, status_code, content_type, request_headers, request_body, response_headers, response_body, start_time, end_time, duration_ms, process_name, process_pid, created_at)
		SELECT id, protocol, method, url, host, path, status_code, content_type, request_headers, request_body, response_headers, response_body, start_time, end_time, duration_ms, process_name, process_pid, start_time
		FROM requests WHERE is_favorite = 1;
		`
		if _, err := d.conn.Exec(migrate); err != nil {
			return fmt.Errorf("migrate favorites failed: %w", err)
		}
		if _, err := d.conn.Exec("PRAGMA user_version = 2"); err != nil {
			return fmt.Errorf("set schema version 2 failed: %w", err)
		}
	}
	// Version 3: external_interceptor_runs table
	if version < 3 {
		createTable := `
		CREATE TABLE IF NOT EXISTS external_interceptor_runs (
			id TEXT PRIMARY KEY,
			interceptor_name TEXT NOT NULL,
			started_at INTEGER NOT NULL,
			stopped_at INTEGER,
			pid INTEGER,
			status TEXT,
			config TEXT
		);
		`
		if _, err := d.conn.Exec(createTable); err != nil {
			return fmt.Errorf("create external_interceptor_runs table failed: %w", err)
		}
		if _, err := d.conn.Exec("PRAGMA user_version = 3"); err != nil {
			return fmt.Errorf("set schema version 3 failed: %w", err)
		}
	}

	return nil
}

// Close closes the database connection.
func (d *DB) Close() error {
	if d.conn != nil {
		return d.conn.Close()
	}
	return nil
}

// Conn returns the underlying *sql.DB.
func (d *DB) Conn() *sql.DB {
	return d.conn
}
