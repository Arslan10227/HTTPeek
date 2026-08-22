package platform

import (
	"archive/zip"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"httpeek/pkg/logger"
)

// ProgressReader wraps an io.Reader to track download progress.
type ProgressReader struct {
	io.Reader
	Total      int64
	Downloaded int64
	OnProgress func(downloaded int64, total int64)
}

func (pr *ProgressReader) Read(p []byte) (int, error) {
	n, err := pr.Reader.Read(p)
	pr.Downloaded += int64(n)
	if pr.OnProgress != nil {
		pr.OnProgress(pr.Downloaded, pr.Total)
	}
	return n, err
}

// ToolStatus represents the installation status of an external binary tool.
type ToolStatus struct {
	Name        string `json:"name"`
	Installed   bool   `json:"installed"`
	Path        string `json:"path"`
	Version     string `json:"version,omitempty"`
	Size        int64  `json:"size,omitempty"`
	DownloadURL string `json:"downloadUrl,omitempty"`
}

// BinaryDownloader handles fetching verified companion binaries on-demand.
type BinaryDownloader struct {
	client *http.Client
	binDir string
}

// NewBinaryDownloader creates a new BinaryDownloader with target binDir.
func NewBinaryDownloader(binDir string) *BinaryDownloader {
	if binDir == "" {
		if userCfg, err := os.UserConfigDir(); err == nil {
			binDir = filepath.Join(userCfg, "HTTPeek", "bin")
		} else {
			binDir = "bin"
		}
	}
	_ = os.MkdirAll(binDir, 0755)

	return &BinaryDownloader{
		client: &http.Client{
			Timeout: 180 * time.Second,
		},
		binDir: binDir,
	}
}

// BinDir returns the active binary directory.
func (bd *BinaryDownloader) BinDir() string {
	return bd.binDir
}

// GetStatus checks if specific tools (adb, frida) are available.
func (bd *BinaryDownloader) GetStatus() map[string]ToolStatus {
	result := make(map[string]ToolStatus)

	// 1. ADB
	adbPath, _ := bd.ResolveBinary("adb")
	adbInstalled := adbPath != ""
	var adbSize int64 = 0
	if adbInstalled {
		if fi, err := os.Stat(adbPath); err == nil {
			adbSize = fi.Size()
		}
	}
	result["adb"] = ToolStatus{
		Name:        "Android ADB Platform Tools",
		Installed:   adbInstalled,
		Path:        adbPath,
		Size:        adbSize,
		DownloadURL: getADBDownloadURL(),
	}

	// 2. Frida
	fridaPath, _ := bd.ResolveBinary("frida")
	if fridaPath == "" {
		fridaPath, _ = bd.ResolveBinary("frida-inject")
	}
	fridaInstalled := fridaPath != ""
	var fridaSize int64 = 0
	if fridaInstalled {
		if fi, err := os.Stat(fridaPath); err == nil {
			fridaSize = fi.Size()
		}
	}
	result["frida"] = ToolStatus{
		Name:        "Frida Dynamic Instrumentation CLI",
		Installed:   fridaInstalled,
		Path:        fridaPath,
		Size:        fridaSize,
		DownloadURL: getFridaDownloadURL(),
	}

	return result
}

// ResolveBinary looks up a binary in the app's binDir or system PATH.
func (bd *BinaryDownloader) ResolveBinary(name string) (string, error) {
	exeName := name
	if runtime.GOOS == "windows" && !strings.HasSuffix(strings.ToLower(name), ".exe") {
		exeName += ".exe"
	}

	// 1. Local HTTPeek/bin folder
	targetPath := filepath.Join(bd.binDir, exeName)
	if info, err := os.Stat(targetPath); err == nil && !info.IsDir() {
		return targetPath, nil
	}

	// 2. System PATH
	if p, err := exec.LookPath(name); err == nil {
		return p, nil
	}
	if p, err := exec.LookPath(exeName); err == nil {
		return p, nil
	}

	return "", fmt.Errorf("binary %s not found", name)
}

// DownloadWithProgress downloads a binary package or tool with live progress feedback.
func (bd *BinaryDownloader) DownloadWithProgress(
	toolName string,
	onProgress func(downloaded int64, total int64),
) (string, error) {
	var downloadURL string
	var isZip bool

	switch strings.ToLower(toolName) {
	case "adb":
		downloadURL = getADBDownloadURL()
		isZip = true
	case "frida":
		downloadURL = getFridaDownloadURL()
		isZip = false
	default:
		return "", fmt.Errorf("unsupported tool: %s", toolName)
	}

	logger.Info("BinaryDownloader", fmt.Sprintf("Downloading %s from %s...", toolName, downloadURL))

	req, err := http.NewRequest("GET", downloadURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "HTTPeek-Downloader/1.0")

	resp, err := bd.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("download %s failed: %w", toolName, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download %s failed with HTTP %s", toolName, resp.Status)
	}

	totalBytes := resp.ContentLength

	// Download to temp file
	tempFile, err := os.CreateTemp("", "httpeek_download_*")
	if err != nil {
		return "", err
	}
	defer os.Remove(tempFile.Name())

	pr := &ProgressReader{
		Reader:      resp.Body,
		Total:       totalBytes,
		OnProgress:  onProgress,
	}

	if _, err := io.Copy(tempFile, pr); err != nil {
		tempFile.Close()
		return "", err
	}
	tempFile.Close()

	if isZip {
		// Extract zip to binDir
		if err := extractZip(tempFile.Name(), bd.binDir); err != nil {
			return "", fmt.Errorf("extract zip failed: %w", err)
		}
	} else {
		// Direct executable copy
		exeName := toolName
		if runtime.GOOS == "windows" && !strings.HasSuffix(toolName, ".exe") {
			exeName += ".exe"
		}
		targetPath := filepath.Join(bd.binDir, exeName)
		if err := copyFile(tempFile.Name(), targetPath); err != nil {
			return "", err
		}
		_ = os.Chmod(targetPath, 0755)
	}

	return bd.ResolveBinary(toolName)
}

func getADBDownloadURL() string {
	switch runtime.GOOS {
	case "darwin":
		return "https://dl.google.com/android/repository/platform-tools-latest-darwin.zip"
	case "linux":
		return "https://dl.google.com/android/repository/platform-tools-latest-linux.zip"
	default:
		return "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
	}
}

func getFridaDownloadURL() string {
	// Frida inject standalone release
	switch runtime.GOOS {
	case "darwin":
		return "https://github.com/frida/frida/releases/download/16.6.6/frida-inject-16.6.6-macos-arm64"
	case "linux":
		return "https://github.com/frida/frida/releases/download/16.6.6/frida-inject-16.6.6-linux-x86_64"
	default:
		return "https://github.com/frida/frida/releases/download/16.6.6/frida-inject-16.6.6-windows-x86_64.exe"
	}
}

func extractZip(zipPath, destDir string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		// Strip leading directory if it's "platform-tools/"
		name := f.Name
		if strings.HasPrefix(name, "platform-tools/") {
			name = strings.TrimPrefix(name, "platform-tools/")
		}
		if name == "" || strings.HasSuffix(name, "/") {
			continue
		}

		outPath := filepath.Join(destDir, name)
		if err := os.MkdirAll(filepath.Dir(outPath), 0755); err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			return err
		}

		outFile, err := os.OpenFile(outPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			rc.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}
