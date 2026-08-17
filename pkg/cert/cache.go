package cert

import (
	"crypto/tls"
	"sync"
	"time"
)

type cacheEntry struct {
	cert      *tls.Certificate
	expiresAt time.Time
}

// CertCache provides thread-safe caching of dynamically generated TLS certificates.
type CertCache struct {
	mu      sync.RWMutex
	entries map[string]cacheEntry
	ttl     time.Duration
}

// NewCertCache creates a new certificate cache with the specified TTL.
func NewCertCache(ttl time.Duration) *CertCache {
	c := &CertCache{
		entries: make(map[string]cacheEntry),
		ttl:     ttl,
	}

	// Periodic cleanup goroutine
	go c.cleanupLoop()
	return c
}

// Get retrieves a certificate from the cache if present and unexpired.
func (c *CertCache) Get(host string) (*tls.Certificate, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.entries[host]
	if !ok {
		return nil, false
	}
	if time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.cert, true
}

// Set stores a certificate in the cache with the default TTL.
func (c *CertCache) Set(host string, cert *tls.Certificate) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.entries[host] = cacheEntry{
		cert:      cert,
		expiresAt: time.Now().Add(c.ttl),
	}
}

// Clear flushes all cached certificates.
func (c *CertCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]cacheEntry)
}

func (c *CertCache) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		c.mu.Lock()
		now := time.Now()
		for k, v := range c.entries {
			if now.After(v.expiresAt) {
				delete(c.entries, k)
			}
		}
		c.mu.Unlock()
	}
}
