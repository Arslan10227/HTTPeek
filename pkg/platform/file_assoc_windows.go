//go:build windows

package platform

import (
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

const (
	harExt     = ".har"
	progID     = "HTTPeek.HAR"
	appDisplay = "HTTP Archive File"
)

// RegisterHARAssociation registers HTTPeek as the default open handler for .har files in HKCU.
func RegisterHARAssociation() error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("could not get executable path: %w", err)
	}
	exePath = filepath.Clean(exePath)

	// 1. HKCU\Software\Classes\.har -> "HTTPeek.HAR"
	extKey, _, err := registry.CreateKey(registry.CURRENT_USER, `Software\Classes\`+harExt, registry.ALL_ACCESS)
	if err != nil {
		return fmt.Errorf("failed to create extension key: %w", err)
	}
	defer extKey.Close()
	if err := extKey.SetStringValue("", progID); err != nil {
		return err
	}
	_ = extKey.SetStringValue("Content Type", "application/json")

	// 2. HKCU\Software\Classes\HTTPeek.HAR -> "HTTP Archive File"
	progKey, _, err := registry.CreateKey(registry.CURRENT_USER, `Software\Classes\`+progID, registry.ALL_ACCESS)
	if err != nil {
		return fmt.Errorf("failed to create ProgID key: %w", err)
	}
	defer progKey.Close()
	if err := progKey.SetStringValue("", appDisplay); err != nil {
		return err
	}

	// 3. HKCU\Software\Classes\HTTPeek.HAR\DefaultIcon -> "<exe>,0"
	iconKey, _, err := registry.CreateKey(registry.CURRENT_USER, `Software\Classes\`+progID+`\DefaultIcon`, registry.ALL_ACCESS)
	if err == nil {
		_ = iconKey.SetStringValue("", fmt.Sprintf(`"%s",0`, exePath))
		iconKey.Close()
	}

	// 4. HKCU\Software\Classes\HTTPeek.HAR\shell\open\command -> "<exe>" "%1"
	cmdKey, _, err := registry.CreateKey(registry.CURRENT_USER, `Software\Classes\`+progID+`\shell\open\command`, registry.ALL_ACCESS)
	if err != nil {
		return fmt.Errorf("failed to create open command key: %w", err)
	}
	defer cmdKey.Close()
	return cmdKey.SetStringValue("", fmt.Sprintf(`"%s" "%%1"`, exePath))
}

// UnregisterHARAssociation removes the HKCU file association for .har files.
func UnregisterHARAssociation() error {
	_ = registry.DeleteKey(registry.CURRENT_USER, `Software\Classes\`+progID+`\shell\open\command`)
	_ = registry.DeleteKey(registry.CURRENT_USER, `Software\Classes\`+progID+`\shell\open`)
	_ = registry.DeleteKey(registry.CURRENT_USER, `Software\Classes\`+progID+`\shell`)
	_ = registry.DeleteKey(registry.CURRENT_USER, `Software\Classes\`+progID+`\DefaultIcon`)
	_ = registry.DeleteKey(registry.CURRENT_USER, `Software\Classes\`+progID)
	_ = registry.DeleteKey(registry.CURRENT_USER, `Software\Classes\`+harExt)
	return nil
}

// IsHARAssociated checks if .har is associated with HTTPeek in HKCU.
func IsHARAssociated() bool {
	extKey, err := registry.OpenKey(registry.CURRENT_USER, `Software\Classes\`+harExt, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer extKey.Close()

	val, _, err := extKey.GetStringValue("")
	if err != nil || val != progID {
		return false
	}

	cmdKey, err := registry.OpenKey(registry.CURRENT_USER, `Software\Classes\`+progID+`\shell\open\command`, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer cmdKey.Close()

	cmdVal, _, err := cmdKey.GetStringValue("")
	return err == nil && cmdVal != ""
}
