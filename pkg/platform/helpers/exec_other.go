//go:build !windows

package helpers

import (
	"context"
	"os/exec"
)

// HideExec is a no-op on non-Windows platforms.
func HideExec(cmd *exec.Cmd) {
	// No-op
}

// Command creates an exec.Cmd configured for execution.
func Command(ctx context.Context, name string, args ...string) *exec.Cmd {
	return exec.CommandContext(ctx, name, args...)
}
