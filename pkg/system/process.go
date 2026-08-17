package system

import (
	"runtime"
	"sync"
	"time"

	"httpeek/pkg/proxy"
)

type processCacheEntry struct {
	info      *proxy.ProcessInfo
	expiresAt time.Time
}

// ProcessManager resolves and caches process metadata for local network connections.
type ProcessManager struct {
	mu    sync.RWMutex
	cache map[int]processCacheEntry
}

var defaultProcessManager = &ProcessManager{
	cache: make(map[int]processCacheEntry),
}

// GetProcessByLocalPort resolves the local OS process that established a connection on the given port.
func GetProcessByLocalPort(port int) (*proxy.ProcessInfo, error) {
	return defaultProcessManager.GetProcessByPort(port)
}

// GetProcessByPort retrieves process info by local TCP port with caching.
func (pm *ProcessManager) GetProcessByPort(port int) (*proxy.ProcessInfo, error) {
	pm.mu.RLock()
	if entry, ok := pm.cache[port]; ok && time.Now().Before(entry.expiresAt) {
		pm.mu.RUnlock()
		return entry.info, nil
	}
	pm.mu.RUnlock()

	var pid int
	var name, path string
	var err error

	switch runtime.GOOS {
	case "windows":
		pid, err = FindPIDByLocalPortWindows(port)
		if err == nil && pid > 0 {
			name, path, _ = GetProcessPathByPIDWindows(pid)
		}
	default:
		// Fallback for non-Windows platforms
		return nil, nil
	}

	if err != nil || pid <= 0 {
		return nil, err
	}

	if name == "" {
		name = "Unknown"
	}

	info := &proxy.ProcessInfo{
		PID:  pid,
		Name: name,
		Path: path,
	}

	pm.mu.Lock()
	pm.cache[port] = processCacheEntry{
		info:      info,
		expiresAt: time.Now().Add(15 * time.Second),
	}
	pm.mu.Unlock()

	return info, nil
}
