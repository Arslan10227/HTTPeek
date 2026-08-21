// Package adb provides smart discovery and on-demand download of the Android
// Debug Bridge (adb) binary. It searches PATH, ANDROID_HOME/ANDROID_SDK_ROOT,
// platform-default Android Studio SDK locations, and a previously
// auto-downloaded cache. If none of those yield a usable binary, it can
// download the official Google platform-tools zip and extract it into the
// caller's data directory.
package adb

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"httpeek/pkg/logger"
)

// ErrADBNotFound is returned when no usable adb binary could be located.
var ErrADBNotFound = errors.New("adb not found: not on PATH, not in common SDK locations, and not in cached download")

// ExeName returns the platform-specific adb binary filename.
func ExeName() string {
	if runtime.GOOS == "windows" {
		return "adb.exe"
	}
	return "adb"
}

// CandidateSDKRoots returns plausible Android SDK root directories for the
// current platform, derived from environment variables and the user's home
// directory. Each entry should contain a "platform-tools" subdirectory when
// the SDK is actually installed there.
func CandidateSDKRoots() []string {
	var roots []string
	if v := os.Getenv("ANDROID_HOME"); v != "" {
		roots = append(roots, v)
	}
	if v := os.Getenv("ANDROID_SDK_ROOT"); v != "" {
		roots = append(roots, v)
	}
	home, err := os.UserHomeDir()
	if err == nil {
		switch runtime.GOOS {
		case "windows":
			roots = append(roots, filepath.Join(home, "AppData", "Local", "Android", "Sdk"))
		case "darwin":
			roots = append(roots, filepath.Join(home, "Library", "Android", "sdk"))
		case "linux":
			roots = append(roots, filepath.Join(home, "Android", "Sdk"))
		}
	}
	return roots
}

// CachedPath returns the path where a previously auto-downloaded adb lives.
func CachedPath(dataDir string) string {
	return filepath.Join(dataDir, "tools", "platform-tools", ExeName())
}

// fileExists checks if a file exists at the given path.
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// ResolvePath finds a usable adb executable.
//
// Search order:
//  1. PATH (exec.LookPath)
//  2. ANDROID_HOME / ANDROID_SDK_ROOT / platform-tools
//  3. Platform-default Android Studio SDK locations / platform-tools
//  4. Previously auto-downloaded copy in <dataDir>/tools/platform-tools
//
// Returns ErrADBNotFound if none of the above yield a usable binary.
func ResolvePath(dataDir string) (string, error) {
	if p, err := exec.LookPath(ExeName()); err == nil {
		return p, nil
	}
	for _, root := range CandidateSDKRoots() {
		p := filepath.Join(root, "platform-tools", ExeName())
		if fileExists(p) {
			return p, nil
		}
	}
	cached := CachedPath(dataDir)
	if fileExists(cached) {
		return cached, nil
	}
	return "", ErrADBNotFound
}

// platformToolsDownloadURL returns the official Google platform-tools zip URL
// for the current OS.
func platformToolsDownloadURL() (string, error) {
	switch runtime.GOOS {
	case "windows":
		return "https://dl.google.com/android/repository/platform-tools-latest-windows.zip", nil
	case "darwin":
		return "https://dl.google.com/android/repository/platform-tools-latest-darwin.zip", nil
	case "linux":
		return "https://dl.google.com/android/repository/platform-tools-latest-linux.zip", nil
	default:
		return "", fmt.Errorf("unsupported OS for ADB download: %s", runtime.GOOS)
	}
}

// Download downloads the official Google platform-tools zip for the current
// OS/arch into <dataDir>/tools/platform-tools and returns the path to the adb
// binary. The progress callback (if non-nil) is invoked with byte-download
// percentage 0..100.
//
// Requires outbound HTTPS access to dl.google.com. If the network is offline,
// returns the underlying HTTP error so callers can present a clear message.
func Download(dataDir string, progress func(pct int)) (string, error) {
	url, err := platformToolsDownloadURL()
	if err != nil {
		return "", err
	}

	targetDir := filepath.Join(dataDir, "tools")
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return "", fmt.Errorf("create tools dir: %w", err)
	}

	zipPath := filepath.Join(targetDir, "platform-tools.zip")
	if err := downloadFile(url, zipPath, progress); err != nil {
		return "", fmt.Errorf("download platform-tools: %w", err)
	}
	defer os.Remove(zipPath)

	if err := extractZip(zipPath, targetDir); err != nil {
		return "", fmt.Errorf("extract platform-tools: %w", err)
	}

	adbPath := CachedPath(dataDir)
	if !fileExists(adbPath) {
		return "", fmt.Errorf("extraction completed but adb binary not found at %s", adbPath)
	}

	// Ensure executable bit on unix-like systems.
	if runtime.GOOS != "windows" {
		_ = os.Chmod(adbPath, 0o755)
	}

	logger.Info("ADB", fmt.Sprintf("Downloaded platform-tools to %s", filepath.Dir(adbPath)))
	return adbPath, nil
}

// DownloadIfMissing resolves adb; if not found, downloads it. Returns the
// resolved path on success.
func DownloadIfMissing(dataDir string) (string, error) {
	if p, err := ResolvePath(dataDir); err == nil {
		return p, nil
	}
	logger.Info("ADB", "ADB not found; downloading official platform-tools from Google")
	return Download(dataDir, nil)
}

func downloadFile(url, destPath string, progress func(pct int)) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d for %s", resp.StatusCode, url)
	}

	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	total := resp.ContentLength
	written := int64(0)
	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := out.Write(buf[:n]); werr != nil {
				return werr
			}
			written += int64(n)
			if progress != nil && total > 0 {
				pct := int(float64(written) / float64(total) * 100)
				progress(pct)
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
	}
	if progress != nil {
		progress(100)
	}
	return nil
}

func extractZip(zipPath, destDir string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		target := filepath.Join(destDir, f.Name)
		// Guard against zip-slip.
		if !isWithinDir(destDir, target) {
			continue
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			out.Close()
			return err
		}
		if _, err := io.Copy(out, rc); err != nil {
			rc.Close()
			out.Close()
			return err
		}
		rc.Close()
		out.Close()
	}
	return nil
}

func isWithinDir(base, target string) bool {
	rel, err := filepath.Rel(base, target)
	if err != nil {
		return false
	}
	if rel == "" || rel == "." {
		return true
	}
	// Reject paths that escape the base directory.
	for _, part := range filepath.SplitList(rel) {
		if part == ".." {
			return false
		}
	}
	return rel[0] != '.' || rel == "."
}
