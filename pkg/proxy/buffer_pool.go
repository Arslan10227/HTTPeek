package proxy

import (
	"io"
	"sync"
)

const defaultBufferSize = 32 * 1024 // 32 KB buffer

var bufferPool = sync.Pool{
	New: func() any {
		b := make([]byte, defaultBufferSize)
		return &b
	},
}

// GetBuffer retrieves a byte slice from the pool.
func GetBuffer() *[]byte {
	return bufferPool.Get().(*[]byte)
}

// PutBuffer returns a byte slice to the pool.
func PutBuffer(buf *[]byte) {
	if buf != nil {
		bufferPool.Put(buf)
	}
}

// CopyBuffer copies from src to dst using a pooled buffer.
func CopyBuffer(dst io.Writer, src io.Reader) (int64, error) {
	buf := GetBuffer()
	defer PutBuffer(buf)
	return io.CopyBuffer(dst, src, *buf)
}
