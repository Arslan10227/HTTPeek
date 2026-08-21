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
	"httpeek/pkg/logger"
	"httpeek/pkg/platform/helpers"
	"httpeek/pkg/storage"
)

// FridaInterceptor launches Frida scripts to bypass SSL pinning and route mobile/desktop apps to HTTPeek.
type FridaInterceptor struct {
	interceptor.BaseInterceptor
	repo      *storage.ExternalInterceptorRepo
	processes map[string]*exec.Cmd
	mu        sync.Mutex
}

// NewFridaInterceptor creates a new FridaInterceptor.
func NewFridaInterceptor(repo *storage.ExternalInterceptorRepo) *FridaInterceptor {
	base := interceptor.NewBaseInterceptor("FridaInterceptor", 60, true)
	return &FridaInterceptor{
		BaseInterceptor: base,
		repo:            repo,
		processes:       make(map[string]*exec.Cmd),
	}
}

// CheckFridaInstalled verifies if the frida CLI is available in assets or PATH.
func (f *FridaInterceptor) CheckFridaInstalled() bool {
	fridaBin := helpers.GetFridaPath()
	if _, err := os.Stat(fridaBin); err == nil {
		return true
	}
	_, err := exec.LookPath(fridaBin)
	if err == nil {
		return true
	}
	// Also check python module fallback
	if pyBin, err := exec.LookPath("python"); err == nil {
		testCmd := helpers.Command(context.Background(), pyBin, "-c", "import frida")
		if err := testCmd.Run(); err == nil {
			return true
		}
	}
	return false
}

// buildFridaCommand prepares the exec.Cmd for Frida with fallback to python -m frida_tools.cli.
func (f *FridaInterceptor) buildFridaCommand(ctx context.Context, fridaArgs []string) *exec.Cmd {
	fridaBin := helpers.GetFridaPath()
	if _, err := os.Stat(fridaBin); err == nil {
		return helpers.Command(ctx, fridaBin, fridaArgs...)
	}
	if p, err := exec.LookPath(fridaBin); err == nil {
		return helpers.Command(ctx, p, fridaArgs...)
	}
	if p, err := exec.LookPath("frida"); err == nil {
		return helpers.Command(ctx, p, fridaArgs...)
	}
	// Fallback to python -m frida_tools.cli
	if pyBin, err := exec.LookPath("python"); err == nil {
		args := append([]string{"-m", "frida_tools.cli"}, fridaArgs...)
		return helpers.Command(ctx, pyBin, args...)
	}
	return helpers.Command(ctx, fridaBin, fridaArgs...)
}

// SpawnAppWithScript launches a mobile app via Frida with an SSL unpinning script.
func (f *FridaInterceptor) SpawnAppWithScript(ctx context.Context, targetApp string, scriptPath string, deviceSerial string) (string, error) {
	if scriptPath == "" {
		scriptPath = helpers.GetFridaScriptPath()
	}
	if _, err := os.Stat(scriptPath); err != nil {
		logger.Error("Frida", fmt.Sprintf("Script not found at %s: %v", scriptPath, err))
		return "", fmt.Errorf("frida script not found at %s: %w", scriptPath, err)
	}

	args := []string{}
	if deviceSerial != "" {
		args = append(args, "--device", deviceSerial)
	} else {
		args = append(args, "-U") // Default USB device
	}

	args = append(args, "-f", targetApp, "-l", scriptPath, "--no-pause")

	logger.Info("Frida", fmt.Sprintf("Spawning app %s on device %s with script %s", targetApp, deviceSerial, scriptPath))
	cmd := f.buildFridaCommand(ctx, args)
	helpers.HideExec(cmd)

	if err := cmd.Start(); err != nil {
		logger.Error("Frida", fmt.Sprintf("Failed to spawn Frida on %s: %v", targetApp, err))
		return "", fmt.Errorf("failed to start Frida: %w", err)
	}

	runID := fmt.Sprintf("frida-%s-%d", targetApp, time.Now().UnixNano())
	pid := cmd.Process.Pid

	f.mu.Lock()
	f.processes[runID] = cmd
	f.mu.Unlock()

	if f.repo != nil {
		configJSON, _ := json.Marshal(map[string]any{
			"app":    targetApp,
			"script": scriptPath,
			"device": deviceSerial,
			"mode":   "spawn",
		})
		_ = f.repo.CreateRun(runID, f.Name(), pid, string(configJSON))
	}

	logger.Info("Frida", fmt.Sprintf("Frida spawned successfully (PID: %d, RunID: %s)", pid, runID))

	go func() {
		err := cmd.Wait()
		status := "stopped"
		if err != nil {
			status = fmt.Sprintf("error: %v", err)
			logger.Warn("Frida", fmt.Sprintf("Frida process %s exited with error: %v", runID, err))
		} else {
			logger.Info("Frida", fmt.Sprintf("Frida process %s exited normally", runID))
		}
		f.mu.Lock()
		delete(f.processes, runID)
		f.mu.Unlock()
		if f.repo != nil {
			_ = f.repo.FinishRun(runID, status)
		}
	}()

	return runID, nil
}

// AttachAppWithScript hooks into an already running mobile/desktop app process via Frida.
func (f *FridaInterceptor) AttachAppWithScript(ctx context.Context, targetAppOrPid string, scriptPath string, deviceSerial string) (string, error) {
	if scriptPath == "" {
		scriptPath = helpers.GetFridaScriptPath()
	}
	if _, err := os.Stat(scriptPath); err != nil {
		logger.Error("Frida", fmt.Sprintf("Script not found at %s: %v", scriptPath, err))
		return "", fmt.Errorf("frida script not found at %s: %w", scriptPath, err)
	}

	args := []string{}
	if deviceSerial != "" {
		args = append(args, "--device", deviceSerial)
	} else {
		args = append(args, "-U") // Default USB device
	}

	// If numeric, attach by PID (-p), otherwise attach by process name (-n)
	if _, err := strconv.Atoi(targetAppOrPid); err == nil {
		args = append(args, "-p", targetAppOrPid, "-l", scriptPath)
	} else {
		args = append(args, "-n", targetAppOrPid, "-l", scriptPath)
	}

	logger.Info("Frida", fmt.Sprintf("Attaching to %s on device %s with script %s", targetAppOrPid, deviceSerial, scriptPath))
	cmd := f.buildFridaCommand(ctx, args)
	helpers.HideExec(cmd)

	if err := cmd.Start(); err != nil {
		logger.Error("Frida", fmt.Sprintf("Failed to attach Frida to %s: %v", targetAppOrPid, err))
		return "", fmt.Errorf("failed to attach Frida to %s: %w", targetAppOrPid, err)
	}

	runID := fmt.Sprintf("frida-attach-%s-%d", targetAppOrPid, time.Now().UnixNano())
	pid := cmd.Process.Pid

	f.mu.Lock()
	f.processes[runID] = cmd
	f.mu.Unlock()

	if f.repo != nil {
		configJSON, _ := json.Marshal(map[string]any{
			"target": targetAppOrPid,
			"script": scriptPath,
			"device": deviceSerial,
			"mode":   "attach",
		})
		_ = f.repo.CreateRun(runID, f.Name(), pid, string(configJSON))
	}

	logger.Info("Frida", fmt.Sprintf("Frida attached successfully (PID: %d, RunID: %s)", pid, runID))

	go func() {
		err := cmd.Wait()
		status := "stopped"
		if err != nil {
			status = fmt.Sprintf("error: %v", err)
			logger.Warn("Frida", fmt.Sprintf("Frida attach process %s exited with error: %v", runID, err))
		} else {
			logger.Info("Frida", fmt.Sprintf("Frida attach process %s exited normally", runID))
		}
		f.mu.Lock()
		delete(f.processes, runID)
		f.mu.Unlock()
		if f.repo != nil {
			_ = f.repo.FinishRun(runID, status)
		}
	}()

	return runID, nil
}

// StopScript terminates an active Frida injection process.
func (f *FridaInterceptor) StopScript(runID string) error {
	f.mu.Lock()
	cmd, exists := f.processes[runID]
	f.mu.Unlock()

	if !exists || cmd == nil || cmd.Process == nil {
		return fmt.Errorf("frida run %s not active", runID)
	}

	logger.Info("Frida", fmt.Sprintf("Stopping Frida process %s (PID: %d)", runID, cmd.Process.Pid))
	return cmd.Process.Kill()
}
