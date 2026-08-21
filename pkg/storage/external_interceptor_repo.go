package storage

import (
    "database/sql"
    "fmt"
    "time"
)

type ExternalInterceptorRun struct {
    ID               string
    InterceptorName  string
    StartedAt        int64
    StoppedAt        sql.NullInt64
    PID              sql.NullInt64
    Status           sql.NullString
    Config           sql.NullString
}

type ExternalInterceptorRepo struct {
    db *DB
}

func NewExternalInterceptorRepo(db *DB) *ExternalInterceptorRepo {
    return &ExternalInterceptorRepo{db: db}
}

// CreateRun inserts a new row for a started external interceptor.
func (r *ExternalInterceptorRepo) CreateRun(id, name string, pid int, configJSON string) error {
    _, err := r.db.Conn().Exec(`INSERT INTO external_interceptor_runs (id, interceptor_name, started_at, pid, config) VALUES (?, ?, ?, ?, ?)`,
        id, name, time.Now().Unix(), pid, configJSON)
    if err != nil {
        return fmt.Errorf("insert external_interceptor_run failed: %w", err)
    }
    return nil
}

// FinishRun updates stopped_at, status for a given run ID.
func (r *ExternalInterceptorRepo) FinishRun(id string, status string) error {
    _, err := r.db.Conn().Exec(`UPDATE external_interceptor_runs SET stopped_at = ?, status = ? WHERE id = ?`, time.Now().Unix(), status, id)
    if err != nil {
        return fmt.Errorf("update external_interceptor_run failed: %w", err)
    }
    return nil
}

// ListRuns returns recent runs (limit 100).
func (r *ExternalInterceptorRepo) ListRuns(limit int) ([]ExternalInterceptorRun, error) {
    rows, err := r.db.Conn().Query(`SELECT id, interceptor_name, started_at, stopped_at, pid, status, config FROM external_interceptor_runs ORDER BY started_at DESC LIMIT ?`, limit)
    if err != nil {
        return nil, fmt.Errorf("query external_interceptor_runs failed: %w", err)
    }
    defer rows.Close()
    var runs []ExternalInterceptorRun
    for rows.Next() {
        var run ExternalInterceptorRun
        if err := rows.Scan(&run.ID, &run.InterceptorName, &run.StartedAt, &run.StoppedAt, &run.PID, &run.Status, &run.Config); err != nil {
            return nil, fmt.Errorf("scan external_interceptor_runs failed: %w", err)
        }
        runs = append(runs, run)
    }
    return runs, nil
}

// ListActiveRuns returns only runs that have not been stopped yet.
// The UI polls this so it never re-shows finished interceptors from previous sessions.
func (r *ExternalInterceptorRepo) ListActiveRuns() ([]ExternalInterceptorRun, error) {
    rows, err := r.db.Conn().Query(
        `SELECT id, interceptor_name, started_at, stopped_at, pid, status, config
         FROM external_interceptor_runs
         WHERE stopped_at IS NULL AND (status IS NULL OR status = 'active')
         ORDER BY started_at DESC`,
    )
    if err != nil {
        return nil, fmt.Errorf("query active external_interceptor_runs failed: %w", err)
    }
    defer rows.Close()
    var runs []ExternalInterceptorRun
    for rows.Next() {
        var run ExternalInterceptorRun
        if err := rows.Scan(&run.ID, &run.InterceptorName, &run.StartedAt, &run.StoppedAt, &run.PID, &run.Status, &run.Config); err != nil {
            return nil, fmt.Errorf("scan active external_interceptor_runs failed: %w", err)
        }
        runs = append(runs, run)
    }
    return runs, nil
}

// MarkAllRunsStopped marks every run that has no stopped_at as stopped.
// Called at application startup to prevent stale sessions from reappearing in the UI.
func (r *ExternalInterceptorRepo) MarkAllRunsStopped() error {
    _, err := r.db.Conn().Exec(
        `UPDATE external_interceptor_runs SET stopped_at = ?, status = 'stopped'
         WHERE stopped_at IS NULL`,
        time.Now().Unix(),
    )
    if err != nil {
        return fmt.Errorf("mark all runs stopped failed: %w", err)
    }
    return nil
}
