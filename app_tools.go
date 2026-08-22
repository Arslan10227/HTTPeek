package main

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"httpeek/pkg/logger"
	"httpeek/pkg/platform"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// GetBinaryToolsStatus returns the installation status of companion tools (ADB, Frida).
func (a *App) GetBinaryToolsStatus() map[string]platform.ToolStatus {
	bd := platform.NewBinaryDownloader(filepath.Join(a.dataDir, "bin"))
	return bd.GetStatus()
}

// DownloadBinaryTool downloads and installs target tool (adb, frida) with live progress.
func (a *App) DownloadBinaryTool(toolName string) (map[string]any, error) {
	bd := platform.NewBinaryDownloader(filepath.Join(a.dataDir, "bin"))

	lastEmit := time.Now()

	path, err := bd.DownloadWithProgress(toolName, func(downloaded, total int64) {
		// Throttle Wails events to every 100ms
		if time.Since(lastEmit) > 100*time.Millisecond || downloaded == total {
			lastEmit = time.Now()
			percentage := 0
			if total > 0 {
				percentage = int((float64(downloaded) / float64(total)) * 100)
			}
			if a.ctx != nil {
				wailsRuntime.EventsEmit(a.ctx, "tool:download_progress", map[string]any{
					"tool":       toolName,
					"downloaded": downloaded,
					"total":      total,
					"percent":    percentage,
				})
			}
		}
	})

	if err != nil {
		logger.Error("BinaryDownloader", fmt.Sprintf("Download failed for %s: %v", toolName, err))
		return map[string]any{
			"success": false,
			"error":   err.Error(),
		}, err
	}

	logger.Info("BinaryDownloader", fmt.Sprintf("Tool %s installed at %s", toolName, path))
	return map[string]any{
		"success": true,
		"tool":    toolName,
		"path":    path,
	}, nil
}

// OpenBinariesFolder opens the companion binaries folder in OS file explorer.
func (a *App) OpenBinariesFolder() error {
	binDir := filepath.Join(a.dataDir, "bin")
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", binDir)
	case "darwin":
		cmd = exec.Command("open", binDir)
	default:
		cmd = exec.Command("xdg-open", binDir)
	}

	return cmd.Start()
}
