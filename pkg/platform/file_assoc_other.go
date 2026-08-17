//go:build !windows

package platform

// RegisterHARAssociation is a no-op on non-Windows platforms.
func RegisterHARAssociation() error {
	return nil
}

// UnregisterHARAssociation is a no-op on non-Windows platforms.
func UnregisterHARAssociation() error {
	return nil
}

// IsHARAssociated is a no-op on non-Windows platforms.
func IsHARAssociated() bool {
	return false
}
