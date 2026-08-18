//go:build !windows

package system

// FindPIDByLocalPortWindows is a stub on non-Windows platforms.
func FindPIDByLocalPortWindows(targetPort int) (int, error) {
	return 0, nil
}

// GetProcessPathByPIDWindows is a stub on non-Windows platforms.
func GetProcessPathByPIDWindows(pid int) (string, string, error) {
	return "", "", nil
}
