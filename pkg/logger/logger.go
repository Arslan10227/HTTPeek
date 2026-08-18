package logger

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Level defines the severity of a log entry.
type Level int

const (
	LevelTrace Level = iota
	LevelDebug
	LevelInfo
	LevelWarn
	LevelError
	LevelFatal
)

func (l Level) String() string {
	switch l {
	case LevelTrace:
		return "TRACE"
	case LevelDebug:
		return "DEBUG"
	case LevelInfo:
		return "INFO"
	case LevelWarn:
		return "WARN"
	case LevelError:
		return "ERROR"
	case LevelFatal:
		return "FATAL"
	default:
		return "INFO"
	}
}

// ParseLevel converts string to Level.
func ParseLevel(lvl string) Level {
	switch strings.ToUpper(strings.TrimSpace(lvl)) {
	case "TRACE":
		return LevelTrace
	case "DEBUG":
		return LevelDebug
	case "INFO":
		return LevelInfo
	case "WARN", "WARNING":
		return LevelWarn
	case "ERROR":
		return LevelError
	case "FATAL":
		return LevelFatal
	default:
		return LevelInfo
	}
}

// Entry represents a structured log event.
type Entry struct {
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Caller    string                 `json:"caller"`
	Category  string                 `json:"category"`
	Message   string                 `json:"message"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
}

// Logger handles single-destination clean writing (file in logs/ + console + memory buffer + Wails event stream).
type Logger struct {
	mu          sync.RWMutex
	level       Level
	files       []*os.File
	filePaths   []string
	primaryPath string
	logDir      string
	wCtx        context.Context
	closed      bool
	recent      []Entry
	maxBuf      int
}

var (
	defaultLogger *Logger
	once          sync.Once
)

// Init initializes the clean centralized logger.
func Init() *Logger {
	once.Do(func() {
		var files []*os.File
		var filePaths []string
		seenPaths := make(map[string]bool)

		addLogFile := func(path string) {
			cleanPath := filepath.Clean(path)
			if cleanPath == "" || seenPaths[cleanPath] {
				return
			}
			seenPaths[cleanPath] = true

			dir := filepath.Dir(cleanPath)
			_ = os.MkdirAll(dir, 0755)

			f, err := os.OpenFile(cleanPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
			if err == nil && f != nil {
				files = append(files, f)
				filePaths = append(filePaths, cleanPath)
			}
		}

		// 1. Primary: Local application logs directory (e.g. build/bin/logs/proxypin.log or ./logs/proxypin.log)
		execPath, err := os.Executable()
		var localLogDir string
		if err == nil && execPath != "" {
			execDir := filepath.Dir(execPath)
			localLogDir = filepath.Join(execDir, "logs")
			addLogFile(filepath.Join(localLogDir, "proxypin.log"))

			// Clean up legacy/redundant files in root if they exist
			_ = os.Remove(filepath.Join(execDir, "goproxypin.log"))
			_ = os.Remove(filepath.Join(execDir, "proxypin.log"))
		}

		// 2. Also log to AppData if on Windows / Desktop OS
		userConfigDir, err := os.UserConfigDir()
		var appDataLogDir string
		if err == nil && userConfigDir != "" {
			appDataLogDir = filepath.Join(userConfigDir, "ProxyPin", "logs")
			addLogFile(filepath.Join(appDataLogDir, "proxypin.log"))

			// Clean up legacy files in AppData root
			_ = os.Remove(filepath.Join(userConfigDir, "ProxyPin", "goproxypin.log"))
			_ = os.Remove(filepath.Join(userConfigDir, "ProxyPin", "proxypin.log"))
			_ = os.Remove(filepath.Join(appDataLogDir, "goproxypin.log"))
		}

		primary := ""
		if len(filePaths) > 0 {
			primary = filePaths[0]
		}
		activeLogDir := localLogDir
		if activeLogDir == "" {
			activeLogDir = appDataLogDir
		}

		defaultLogger = &Logger{
			level:       LevelTrace,
			files:       files,
			filePaths:   filePaths,
			primaryPath: primary,
			logDir:      activeLogDir,
			recent:      make([]Entry, 0, 500),
			maxBuf:      500,
		}

		startupMsg := fmt.Sprintf("=== ProxyPin Logger Initialized (PID: %d, OS: %s/%s, Executable: %s, Log: %s) ===",
			os.Getpid(), runtime.GOOS, runtime.GOARCH, execPath, primary)
		defaultLogger.log(LevelInfo, "Logger", startupMsg, nil, 2)
	})
	return defaultLogger
}

// SetWailsContext attaches the Wails application context for UI event streaming.
func SetWailsContext(ctx context.Context) {
	l := GetLogger()
	l.mu.Lock()
	l.wCtx = ctx
	l.mu.Unlock()
}

// GetLogger returns the initialized default logger.
func GetLogger() *Logger {
	return Init()
}

// SetLevel updates the minimum logging level threshold.
func SetLevel(lvl Level) {
	l := GetLogger()
	l.mu.Lock()
	l.level = lvl
	l.mu.Unlock()
}

// GetLogFilePath returns the absolute path of the primary verbose log file.
func GetLogFilePath() string {
	l := GetLogger()
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.primaryPath
}

// GetLogDir returns the directory containing log files.
func GetLogDir() string {
	l := GetLogger()
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.logDir
}

// GetRecentLogs retrieves the most recent log entries.
func GetRecentLogs(limit int) []Entry {
	l := GetLogger()
	l.mu.RLock()
	defer l.mu.RUnlock()

	if limit <= 0 || limit > len(l.recent) {
		limit = len(l.recent)
	}
	start := len(l.recent) - limit
	res := make([]Entry, limit)
	copy(res, l.recent[start:])
	return res
}

// ClearLogs clears all log files and in-memory log buffer.
func ClearLogs() error {
	l := GetLogger()
	l.mu.Lock()
	defer l.mu.Unlock()

	l.recent = make([]Entry, 0, l.maxBuf)
	for _, f := range l.files {
		if f != nil {
			_ = f.Truncate(0)
			_, _ = f.Seek(0, 0)
			_ = f.Sync()
		}
	}
	return nil
}

func (l *Logger) log(level Level, category string, msg string, fields map[string]interface{}, callerSkip int) {
	if l == nil || l.closed || level < l.level {
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05.000")

	// Resolve caller function and line
	var callerStr string
	_, file, line, ok := runtime.Caller(callerSkip)
	if ok {
		parts := strings.Split(filepath.ToSlash(file), "/")
		if len(parts) > 2 {
			callerStr = fmt.Sprintf("%s/%s:%d", parts[len(parts)-2], parts[len(parts)-1], line)
		} else {
			callerStr = fmt.Sprintf("%s:%d", filepath.Base(file), line)
		}
	} else {
		callerStr = "system:0"
	}

	var fieldStr string
	if len(fields) > 0 {
		var fParts []string
		for k, v := range fields {
			fParts = append(fParts, fmt.Sprintf("%s=%v", k, v))
		}
		fieldStr = " | " + strings.Join(fParts, " ")
	}

	catStr := ""
	if category != "" {
		catStr = "[" + category + "] "
	}

	formattedLine := fmt.Sprintf("[%s] [%-5s] [%s] %s%s%s\n", now, level.String(), callerStr, catStr, msg, fieldStr)
	lineBytes := []byte(formattedLine)

	l.mu.Lock()
	defer l.mu.Unlock()

	// 1. Output to stdout
	_, _ = os.Stdout.Write(lineBytes)

	// 2. Write to log files and flush immediately
	for _, f := range l.files {
		if f != nil {
			_, _ = f.Write(lineBytes)
			_ = f.Sync()
		}
	}

	entry := Entry{
		Timestamp: now,
		Level:     level.String(),
		Caller:    callerStr,
		Category:  category,
		Message:   msg,
		Fields:    fields,
	}

	// 3. Append to memory ring buffer
	if len(l.recent) >= l.maxBuf {
		l.recent = l.recent[1:]
	}
	l.recent = append(l.recent, entry)

	// 4. Stream to Wails frontend if context is available
	if l.wCtx != nil {
		wailsRuntime.EventsEmit(l.wCtx, "log:event", entry)
	}
}

// LogExplicit writes a log entry with a custom caller tag (e.g. from UI).
func LogExplicit(level Level, category string, caller string, msg string, fields map[string]interface{}) {
	l := GetLogger()
	if l == nil || l.closed || level < l.level {
		return
	}

	now := time.Now().Format("2006-01-02 15:04:05.000")
	if caller == "" {
		caller = "ui:frontend"
	}

	var fieldStr string
	if len(fields) > 0 {
		var fParts []string
		for k, v := range fields {
			fParts = append(fParts, fmt.Sprintf("%s=%v", k, v))
		}
		fieldStr = " | " + strings.Join(fParts, " ")
	}

	catStr := ""
	if category != "" {
		catStr = "[" + category + "] "
	}

	formattedLine := fmt.Sprintf("[%s] [%-5s] [%s] %s%s%s\n", now, level.String(), caller, catStr, msg, fieldStr)
	lineBytes := []byte(formattedLine)

	l.mu.Lock()
	defer l.mu.Unlock()

	_, _ = os.Stdout.Write(lineBytes)

	for _, f := range l.files {
		if f != nil {
			_, _ = f.Write(lineBytes)
			_ = f.Sync()
		}
	}

	entry := Entry{
		Timestamp: now,
		Level:     level.String(),
		Caller:    caller,
		Category:  category,
		Message:   msg,
		Fields:    fields,
	}

	if len(l.recent) >= l.maxBuf {
		l.recent = l.recent[1:]
	}
	l.recent = append(l.recent, entry)

	if l.wCtx != nil {
		wailsRuntime.EventsEmit(l.wCtx, "log:event", entry)
	}
}

// Trace logs trace-level diagnostics.
func Trace(category, msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	GetLogger().log(LevelTrace, category, msg, f, 2)
}

// Debug logs debug-level diagnostics.
func Debug(category, msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	GetLogger().log(LevelDebug, category, msg, f, 2)
}

// Info logs standard informational messages.
func Info(category, msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	GetLogger().log(LevelInfo, category, msg, f, 2)
}

// Warn logs warnings.
func Warn(category, msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	GetLogger().log(LevelWarn, category, msg, f, 2)
}

// Error logs error conditions.
func Error(category, msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	GetLogger().log(LevelError, category, msg, f, 2)
}

// Fatal logs fatal error and exits.
func Fatal(category, msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	GetLogger().log(LevelFatal, category, msg, f, 2)
	os.Exit(1)
}

// Close flushes and closes all log files.
func Close() {
	if defaultLogger != nil {
		defaultLogger.mu.Lock()
		defer defaultLogger.mu.Unlock()
		defaultLogger.closed = true
		for _, f := range defaultLogger.files {
			if f != nil {
				_ = f.Sync()
				_ = f.Close()
			}
		}
	}
}
