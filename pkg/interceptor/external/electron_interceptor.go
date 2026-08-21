package external

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"sync"
	"time"

	"httpeek/pkg/interceptor"
	"httpeek/pkg/storage"
)

// ElectronInterceptor launches Electron applications with proxy configuration flags.
type ElectronInterceptor struct {
	interceptor.BaseInterceptor
	repo      *storage.ExternalInterceptorRepo
	processes map[string]*exec.Cmd
	mu        sync.Mutex
}

// NewElectronInterceptor creates a new ElectronInterceptor.
func NewElectronInterceptor(repo *storage.ExternalInterceptorRepo) *ElectronInterceptor {
	base := interceptor.NewBaseInterceptor("ElectronInterceptor", 70, true)
	return &ElectronInterceptor{
		BaseInterceptor: base,
		repo:            repo,
		processes:       make(map[string]*exec.Cmd),
	}
}

// LaunchElectronApp launches an Electron binary with proxy flags and certificate environment variables.
func (e *ElectronInterceptor) LaunchElectronApp(ctx context.Context, appPath string, extraArgs []string, proxyHost string, proxyPort int, certPath string) (string, error) {
	if _, err := os.Stat(appPath); err != nil {
		return "", fmt.Errorf("electron app not found at %s: %w", appPath, err)
	}

	proxyServer := fmt.Sprintf("http=%s:%d;https=%s:%d", proxyHost, proxyPort, proxyHost, proxyPort)

	args := []string{
		fmt.Sprintf("--proxy-server=%s", proxyServer),
	}
	args = append(args, extraArgs...)

	env := os.Environ()
	proxyURL := fmt.Sprintf("http://%s:%d", proxyHost, proxyPort)
	env = append(env,
		fmt.Sprintf("HTTP_PROXY=%s", proxyURL),
		fmt.Sprintf("HTTPS_PROXY=%s", proxyURL),
		fmt.Sprintf("NODE_TLS_REJECT_UNAUTHORIZED=0"),
	)
	if certPath != "" {
		env = append(env,
			fmt.Sprintf("NODE_EXTRA_CA_CERTS=%s", certPath),
			fmt.Sprintf("SSL_CERT_FILE=%s", certPath),
		)
	}

	cmd := exec.CommandContext(ctx, appPath, args...)
	cmd.Env = env

	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("failed to launch electron app: %w", err)
	}

	runID := fmt.Sprintf("electron-%d", time.Now().UnixNano())
	pid := cmd.Process.Pid

	e.mu.Lock()
	e.processes[runID] = cmd
	e.mu.Unlock()

	if e.repo != nil {
		configJSON, _ := json.Marshal(map[string]any{
			"appPath":   appPath,
			"args":      args,
			"proxyHost": proxyHost,
			"proxyPort": proxyPort,
		})
		_ = e.repo.CreateRun(runID, e.Name(), pid, string(configJSON))
	}

	go func() {
		err := cmd.Wait()
		status := "stopped"
		if err != nil {
			status = fmt.Sprintf("error: %v", err)
		}
		e.mu.Lock()
		delete(e.processes, runID)
		e.mu.Unlock()
		if e.repo != nil {
			_ = e.repo.FinishRun(runID, status)
		}
	}()

	return runID, nil
}
