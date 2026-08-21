//go:build windows

package helpers

import (
	"context"
	"os/exec"
	"syscall"
)

// HideExec sets Windows process creation flags to suppress console windows.
func HideExec(cmd *exec.Cmd) {
	if cmd == nil {
		return
	}
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
}

// Command creates an exec.Cmd with window suppression enabled on Windows.
func Command(ctx context.Context, name string, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, name, args...)
	HideExec(cmd)
	return cmd
}
