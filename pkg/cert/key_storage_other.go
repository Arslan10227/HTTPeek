//go:build !windows
// +build !windows

package cert

import "fmt"

func encryptDPAPI(data []byte) ([]byte, error) {
	return nil, fmt.Errorf("DPAPI is only supported on Windows")
}

func decryptDPAPI(data []byte) ([]byte, error) {
	return nil, fmt.Errorf("DPAPI is only supported on Windows")
}
