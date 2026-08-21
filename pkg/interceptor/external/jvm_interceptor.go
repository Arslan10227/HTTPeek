package external

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"sync"
	"time"

	"httpeek/pkg/interceptor"
	"httpeek/pkg/storage"
)

// JVMTarget represents a running JVM process found via list-targets.
type JVMTarget struct {
	PID  string `json:"pid"`
	Name string `json:"name"`
}

// JVMInterceptor manages JVM agent injection and Java application launching.
type JVMInterceptor struct {
	interceptor.BaseInterceptor
	repo      *storage.ExternalInterceptorRepo
	jarPath   string
	mu        sync.Mutex
	processes map[string]*exec.Cmd
}

// NewJVMInterceptor creates a new JVMInterceptor.
func NewJVMInterceptor(repo *storage.ExternalInterceptorRepo, jarPath string) *JVMInterceptor {
	base := interceptor.NewBaseInterceptor("JVMInterceptor", 85, true)
	return &JVMInterceptor{
		BaseInterceptor: base,
		repo:            repo,
		jarPath:         jarPath,
		processes:       make(map[string]*exec.Cmd),
	}
}

// SetJarPath updates the path to http-proxy-agent JAR if needed.
func (j *JVMInterceptor) SetJarPath(jarPath string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.jarPath = jarPath
}

// JarPath returns the current agent JAR path.
func (j *JVMInterceptor) JarPath() string {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.jarPath
}

// ListTargets returns all running JVM processes discoverable on this machine.
func (j *JVMInterceptor) ListTargets(ctx context.Context) ([]JVMTarget, error) {
	jarPath := j.JarPath()
	if _, err := os.Stat(jarPath); err != nil {
		return nil, fmt.Errorf("JVM agent JAR not found at %s: %w", jarPath, err)
	}

	cmd := exec.CommandContext(ctx, "java", "-jar", jarPath, "list-targets", "--json")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to scan JVM targets: %w", err)
	}

	var targets []JVMTarget
	if err := json.Unmarshal(output, &targets); err != nil {
		return nil, fmt.Errorf("failed to parse targets JSON: %w (output: %s)", err, string(output))
	}
	return targets, nil
}

// Attach attaches the JVM agent to an existing running process by PID.
func (j *JVMInterceptor) Attach(ctx context.Context, pid int, proxyHost string, proxyPort int, certPath string, nonProxyHosts string) error {
	jarPath := j.JarPath()
	if _, err := os.Stat(jarPath); err != nil {
		return fmt.Errorf("JVM agent JAR not found at %s: %w", jarPath, err)
	}

	args := []string{"-jar", jarPath, strconv.Itoa(pid), proxyHost, strconv.Itoa(proxyPort), certPath}
	if nonProxyHosts != "" {
		args = append(args, nonProxyHosts)
	}

	cmd := exec.CommandContext(ctx, "java", args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to attach JVM agent to PID %d: %v (output: %s)", pid, err, string(out))
	}

	if j.repo != nil {
		runID := fmt.Sprintf("jvm-attach-%d-%d", pid, time.Now().UnixNano())
		configJSON, _ := json.Marshal(map[string]any{
			"pid":           pid,
			"proxyHost":     proxyHost,
			"proxyPort":     proxyPort,
			"certPath":      certPath,
			"nonProxyHosts": nonProxyHosts,
		})
		_ = j.repo.CreateRun(runID, j.Name(), pid, string(configJSON))
	}
	return nil
}

// LaunchApplication launches a Java application with -javaagent preloaded.
func (j *JVMInterceptor) LaunchApplication(ctx context.Context, appJarOrClass string, appArgs []string, proxyHost string, proxyPort int, certPath string, nonProxyHosts string) (string, error) {
	jarPath := j.JarPath()
	if _, err := os.Stat(jarPath); err != nil {
		return "", fmt.Errorf("JVM agent JAR not found at %s: %w", jarPath, err)
	}

	agentConfigArg := fmt.Sprintf("%s|%d|%s", proxyHost, proxyPort, certPath)
	if nonProxyHosts != "" {
		agentConfigArg += "|" + nonProxyHosts
	}

	jvmArgs := []string{
		fmt.Sprintf("-javaagent:%s=%s", jarPath, agentConfigArg),
		"-Djdk.attach.allowAttachSelf=true",
	}

	var cmdArgs []string
	cmdArgs = append(cmdArgs, jvmArgs...)
	cmdArgs = append(cmdArgs, "-jar", appJarOrClass)
	cmdArgs = append(cmdArgs, appArgs...)

	cmd := exec.CommandContext(ctx, "java", cmdArgs...)
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("failed to start Java process: %w", err)
	}

	runID := fmt.Sprintf("jvm-launch-%d", time.Now().UnixNano())
	pid := cmd.Process.Pid

	j.mu.Lock()
	j.processes[runID] = cmd
	j.mu.Unlock()

	if j.repo != nil {
		configJSON, _ := json.Marshal(map[string]any{
			"app":           appJarOrClass,
			"args":          appArgs,
			"proxyHost":     proxyHost,
			"proxyPort":     proxyPort,
			"certPath":      certPath,
			"nonProxyHosts": nonProxyHosts,
		})
		_ = j.repo.CreateRun(runID, j.Name(), pid, string(configJSON))
	}

	go func() {
		err := cmd.Wait()
		status := "stopped"
		if err != nil {
			status = fmt.Sprintf("error: %v", err)
		}
		j.mu.Lock()
		delete(j.processes, runID)
		j.mu.Unlock()
		if j.repo != nil {
			_ = j.repo.FinishRun(runID, status)
		}
	}()

	return runID, nil
}

// StopProcess terminates a started Java process by run ID.
func (j *JVMInterceptor) StopProcess(runID string) error {
	j.mu.Lock()
	cmd, exists := j.processes[runID]
	j.mu.Unlock()

	if !exists || cmd == nil || cmd.Process == nil {
		return fmt.Errorf("process with run ID %s not found or already stopped", runID)
	}

	return cmd.Process.Kill()
}
