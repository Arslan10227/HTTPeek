package external

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"httpeek/pkg/interceptor"
	"httpeek/pkg/storage"
)

// BrowserType enum for supported browser families.
type BrowserType string

const (
	BrowserChrome   BrowserType = "chrome"
	BrowserEdge     BrowserType = "edge"
	BrowserBrave    BrowserType = "brave"
	BrowserFirefox  BrowserType = "firefox"
	BrowserChromium BrowserType = "chromium"
)

// BrowserInterceptor launches isolated browser instances configured to route through HTTPeek.
type BrowserInterceptor struct {
	interceptor.BaseInterceptor
	repo      *storage.ExternalInterceptorRepo
	tempDirs  map[string]string
	processes map[string]*exec.Cmd
	mu        sync.Mutex
}

// NewBrowserInterceptor creates a new BrowserInterceptor.
func NewBrowserInterceptor(repo *storage.ExternalInterceptorRepo) *BrowserInterceptor {
	base := interceptor.NewBaseInterceptor("BrowserInterceptor", 75, true)
	return &BrowserInterceptor{
		BaseInterceptor: base,
		repo:            repo,
		tempDirs:        make(map[string]string),
		processes:       make(map[string]*exec.Cmd),
	}
}

// LaunchBrowser spawns an isolated browser window targeting the proxy.
func (b *BrowserInterceptor) LaunchBrowser(ctx context.Context, browserPath string, bType BrowserType, initialURL string, proxyHost string, proxyPort int, certPath string) (string, error) {
	if _, err := os.Stat(browserPath); err != nil {
		return "", fmt.Errorf("browser executable not found at %s: %w", browserPath, err)
	}

	proxyServer := fmt.Sprintf("http=%s:%d;https=%s:%d", proxyHost, proxyPort, proxyHost, proxyPort)

	// Create temporary profile directory so user's default browser profile is untouched
	tmpProfile, err := os.MkdirTemp("", "httpeek-browser-*")
	if err != nil {
		return "", fmt.Errorf("failed to create temporary profile dir: %w", err)
	}

	var args []string
	if bType == BrowserFirefox {
		// Firefox isolated profile
		args = []string{
			"-no-remote",
			"-profile", tmpProfile,
		}
	} else {
		// Chromium-based browsers (Chrome, Edge, Brave, Opera, Chromium)
		args = []string{
			fmt.Sprintf("--proxy-server=%s", proxyServer),
			fmt.Sprintf("--user-data-dir=%s", tmpProfile),
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-background-networking",
			"--disable-client-side-phishing-detection",
			"--disable-default-apps",
			"--disable-sync",
			"--ignore-certificate-errors-spki-list",
		}
	}

	if initialURL != "" {
		args = append(args, initialURL)
	} else {
		args = append(args, "https://amiusing.httpeek.app")
	}

	cmd := exec.CommandContext(ctx, browserPath, args...)
	if err := cmd.Start(); err != nil {
		_ = os.RemoveAll(tmpProfile)
		return "", fmt.Errorf("failed to launch browser: %w", err)
	}

	runID := fmt.Sprintf("browser-%s-%d", bType, time.Now().UnixNano())
	pid := cmd.Process.Pid

	b.mu.Lock()
	b.processes[runID] = cmd
	b.tempDirs[runID] = tmpProfile
	b.mu.Unlock()

	if b.repo != nil {
		configJSON, _ := json.Marshal(map[string]any{
			"browser":   bType,
			"path":      browserPath,
			"proxyHost": proxyHost,
			"proxyPort": proxyPort,
			"profile":   tmpProfile,
		})
		_ = b.repo.CreateRun(runID, b.Name(), pid, string(configJSON))
	}

	go func() {
		err := cmd.Wait()
		status := "stopped"
		if err != nil {
			status = fmt.Sprintf("error: %v", err)
		}
		b.mu.Lock()
		delete(b.processes, runID)
		dir := b.tempDirs[runID]
		delete(b.tempDirs, runID)
		b.mu.Unlock()

		if dir != "" {
			_ = os.RemoveAll(dir)
		}
		if b.repo != nil {
			_ = b.repo.FinishRun(runID, status)
		}
	}()

	return runID, nil
}

// StopBrowser closes an open browser run and cleans up its temporary profile.
func (b *BrowserInterceptor) StopBrowser(runID string) error {
	b.mu.Lock()
	cmd, exists := b.processes[runID]
	profileDir := b.tempDirs[runID]
	b.mu.Unlock()

	if !exists || cmd == nil || cmd.Process == nil {
		return fmt.Errorf("browser run %s not active", runID)
	}

	_ = cmd.Process.Kill()
	if profileDir != "" {
		_ = os.RemoveAll(filepath.Clean(profileDir))
	}
	return nil
}
