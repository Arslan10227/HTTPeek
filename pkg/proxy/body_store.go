package proxy

import (
	"fmt"
	"os"
	"path/filepath"
)

const maxInlineBodyBytes = 512 * 1024

// PrepareBodyForStorage caps inline body size and spills larger payloads to disk when storageDir is set.
func PrepareBodyForStorage(storageDir, exchangeID, kind string, data []byte, decoded string) ([]byte, string, int64) {
	size := int64(len(data))
	if len(data) <= maxInlineBodyBytes || storageDir == "" {
		if decoded == "" && len(data) > 0 {
			decoded = string(data)
		}
		return data, decoded, size
	}

	spillDir := filepath.Join(storageDir, "bodies")
	_ = os.MkdirAll(spillDir, 0700)
	spillPath := filepath.Join(spillDir, fmt.Sprintf("%s-%s.bin", exchangeID, kind))
	// Captured bodies can contain credentials; restrict file access to the owner.
	if err := os.WriteFile(spillPath, data, 0600); err != nil {
		if decoded == "" {
			decoded = string(data)
		}
		return data, decoded, size
	}

	previewLen := len(decoded)
	if previewLen > maxInlineBodyBytes {
		previewLen = maxInlineBodyBytes
	}
	preview := ""
	if previewLen > 0 {
		preview = decoded[:previewLen]
	}
	note := fmt.Sprintf("\n\n[Body truncated — %d bytes spilled to %s]", size, spillPath)
	return data[:maxInlineBodyBytes], preview + note, size
}
