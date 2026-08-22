package platform

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"httpeek/pkg/logger"
)

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
			Timeout: 60 * time.Second,
		},
		binDir: binDir,
	}
}

// BinDir returns the active binary directory.
func (bd *BinaryDownloader) BinDir() string {
	return bd.binDir
}

// ResolveOrDownload resolves a binary from local binDir, system PATH, or downloads on demand.
func (bd *BinaryDownloader) ResolveOrDownload(name string, downloadURL string, expectedSHA256 string) (string, error) {
	exeName := name
	if runtime.GOOS == "windows" && filepath.Ext(name) == "" {
		exeName += ".exe"
	}

	targetPath := filepath.Join(bd.binDir, exeName)

	// 1. Check local bin directory with checksum verification
	if info, err := os.Stat(targetPath); err == nil && !info.IsDir() {
		if expectedSHA256 == "" || verifyChecksum(targetPath, expectedSHA256) {
			return targetPath, nil
		}
	}

	// 2. Check system PATH
	if p, err := exec.LookPath(name); err == nil {
		return p, nil
	}
	if p, err := exec.LookPath(exeName); err == nil {
		return p, nil
	}

	// 3. If downloadURL is empty, return local target path
	if downloadURL == "" {
		return targetPath, nil
	}

	// 4. Download on-demand with progress and checksum validation
	logger.Info("BinaryDownloader", fmt.Sprintf("Downloading %s from %s...", exeName, downloadURL))

	req, err := http.NewRequest("GET", downloadURL, nil)
	if err != nil {
		return "", err
	}

	resp, err := bd.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("download %s failed: %w", name, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download %s failed with status: %s", name, resp.Status)
	}

	tempFile := targetPath + ".tmp"
	f, err := os.OpenFile(tempFile, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return "", err
	}

	hasher := sha256.New()
	writer := io.MultiWriter(f, hasher)

	if _, err := io.Copy(writer, resp.Body); err != nil {
		f.Close()
		_ = os.Remove(tempFile)
		return "", err
	}
	f.Close()

	actualSHA256 := hex.EncodeToString(hasher.Sum(nil))
	if expectedSHA256 != "" && actualSHA256 != expectedSHA256 {
		_ = os.Remove(tempFile)
		return "", fmt.Errorf("checksum mismatch for %s: expected %s, got %s", name, expectedSHA256, actualSHA256)
	}

	if err := os.Rename(tempFile, targetPath); err != nil {
		return "", err
	}

	_ = os.Chmod(targetPath, 0755)
	logger.Info("BinaryDownloader", fmt.Sprintf("Successfully installed %s to %s", exeName, targetPath))
	return targetPath, nil
}

func verifyChecksum(filePath string, expectedSHA256 string) bool {
	f, err := os.Open(filePath)
	if err != nil {
		return false
	}
	defer f.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, f); err != nil {
		return false
	}

	return hex.EncodeToString(hasher.Sum(nil)) == expectedSHA256
}
