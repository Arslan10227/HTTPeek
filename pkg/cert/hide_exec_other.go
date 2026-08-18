//go:build !windows

package cert

import "os/exec"

func hideExec(cmd *exec.Cmd) {
	// No-op on non-Windows platforms
}
