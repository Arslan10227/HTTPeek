package external

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

	"httpeek/pkg/interceptor"
	"httpeek/pkg/storage"
)

// TerminalInterceptor launches pre-configured shells with proxy and certificate environment variables.
type TerminalInterceptor struct {
	interceptor.BaseInterceptor
	repo      *storage.ExternalInterceptorRepo
	mu        sync.Mutex
	processes map[string]*exec.Cmd
}

// NewTerminalInterceptor creates a new TerminalInterceptor.
func NewTerminalInterceptor(repo *storage.ExternalInterceptorRepo) *TerminalInterceptor {
	base := interceptor.NewBaseInterceptor("TerminalInterceptor", 80, true)
	return &TerminalInterceptor{
		BaseInterceptor: base,
		repo:            repo,
		processes:       make(map[string]*exec.Cmd),
	}
}

// LaunchTerminal starts an interactive terminal window with all proxy environment variables injected.
func (t *TerminalInterceptor) LaunchTerminal(ctx context.Context, shellType string, proxyHost string, proxyPort int, certPath string, nonProxyHosts string) (string, error) {
	proxyURL := fmt.Sprintf("http://%s:%d", proxyHost, proxyPort)

	env := os.Environ()
	env = append(env,
		fmt.Sprintf("HTTP_PROXY=%s", proxyURL),
		fmt.Sprintf("HTTPS_PROXY=%s", proxyURL),
		fmt.Sprintf("http_proxy=%s", proxyURL),
		fmt.Sprintf("https_proxy=%s", proxyURL),
		fmt.Sprintf("ALL_PROXY=%s", proxyURL),
		fmt.Sprintf("SSL_CERT_FILE=%s", certPath),
		fmt.Sprintf("NODE_EXTRA_CA_CERTS=%s", certPath),
		fmt.Sprintf("REQUESTS_CA_BUNDLE=%s", certPath),
		fmt.Sprintf("CURL_CA_BUNDLE=%s", certPath),
		fmt.Sprintf("GIT_SSL_CAINFO=%s", certPath),
	)

	if nonProxyHosts != "" {
		env = append(env,
			fmt.Sprintf("NO_PROXY=%s", nonProxyHosts),
			fmt.Sprintf("no_proxy=%s", nonProxyHosts),
		)
	}

	// Java global tool options
	javaOpts := fmt.Sprintf("-Dhttp.proxyHost=%s -Dhttp.proxyPort=%d -Dhttps.proxyHost=%s -Dhttps.proxyPort=%d",
		proxyHost, proxyPort, proxyHost, proxyPort)
	if certPath != "" {
		javaOpts += fmt.Sprintf(" -Djavax.net.ssl.trustStore=%s", certPath)
	}
	env = append(env, fmt.Sprintf("JAVA_TOOL_OPTIONS=%s", javaOpts))

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		switch strings.ToLower(shellType) {
		case "cmd":
			cmd = exec.CommandContext(ctx, "cmd.exe", "/K", fmt.Sprintf("echo [HTTPeek] Terminal Proxy Active (Proxy: %s:%d, CA: %s)", proxyHost, proxyPort, certPath))
		default:
			// PowerShell
			promptMsg := fmt.Sprintf("Write-Host '[HTTPeek] Terminal Proxy Active (Proxy: %s:%d, CA: %s)' -ForegroundColor Cyan", proxyHost, proxyPort, certPath)
			cmd = exec.CommandContext(ctx, "powershell.exe", "-NoExit", "-Command", promptMsg)
		}
	} else if runtime.GOOS == "darwin" {
		cmd = exec.CommandContext(ctx, "open", "-a", "Terminal")
	} else {
		cmd = exec.CommandContext(ctx, "x-terminal-emulator")
	}

	cmd.Env = env
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("failed to launch terminal: %w", err)
	}

	runID := fmt.Sprintf("term-%d", time.Now().UnixNano())
	pid := 0
	if cmd.Process != nil {
		pid = cmd.Process.Pid
	}

	t.mu.Lock()
	t.processes[runID] = cmd
	t.mu.Unlock()

	if t.repo != nil {
		configJSON, _ := json.Marshal(map[string]any{
			"shell":         shellType,
			"proxyHost":     proxyHost,
			"proxyPort":     proxyPort,
			"certPath":      certPath,
			"nonProxyHosts": nonProxyHosts,
		})
		_ = t.repo.CreateRun(runID, t.Name(), pid, string(configJSON))
	}

	go func() {
		err := cmd.Wait()
		status := "stopped"
		if err != nil {
			status = fmt.Sprintf("error: %v", err)
		}
		t.mu.Lock()
		delete(t.processes, runID)
		t.mu.Unlock()
		if t.repo != nil {
			_ = t.repo.FinishRun(runID, status)
		}
	}()

	return runID, nil
}
