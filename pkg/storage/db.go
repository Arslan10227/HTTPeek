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
	db, err := sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=busy_timeout(5000)")
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

	CREATE TABLE IF NOT EXISTS rules (
		id TEXT PRIMARY KEY,
		rule_type TEXT NOT NULL,
		name TEXT NOT NULL,
		enabled INTEGER DEFAULT 1,
		data TEXT NOT NULL,
		updated_at INTEGER NOT NULL
	);
	`

	_, err := d.conn.Exec(schema)
	return err
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
