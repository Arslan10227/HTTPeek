package cert

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"runtime"

	"golang.org/x/crypto/pbkdf2"
)

// KeyStorage handles encrypting and decrypting the master CA private key
// using OS-native security or AES-256-GCM with hardware-derived entropy.
type KeyStorage struct{}

// NewKeyStorage creates a KeyStorage instance.
func NewKeyStorage() *KeyStorage {
	return &KeyStorage{}
}

// EncryptKey encrypts the raw PEM private key bytes.
func (ks *KeyStorage) EncryptKey(rawPEM []byte) ([]byte, error) {
	if len(rawPEM) == 0 {
		return nil, fmt.Errorf("empty key bytes")
	}

	// 1. Try Windows DPAPI if running on Windows
	if runtime.GOOS == "windows" {
		if encrypted, err := encryptDPAPI(rawPEM); err == nil {
			// Prefix with magic header "DPAPI:"
			return append([]byte("DPAPI:"), encrypted...), nil
		}
	}

	// 2. Cross-platform AES-256-GCM with machine-derived entropy
	key := deriveMachineKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nonce, nonce, rawPEM, nil)
	return append([]byte("GCM:"), ciphertext...), nil
}

// DecryptKey decrypts the stored key bytes.
// If the key is in plaintext PEM (backward compatibility), it is returned directly.
func (ks *KeyStorage) DecryptKey(storedData []byte) ([]byte, error) {
	if len(storedData) == 0 {
		return nil, fmt.Errorf("empty stored key data")
	}

	// Check if already plaintext PEM (starts with "-----BEGIN")
	if len(storedData) > 10 && string(storedData[:10]) == "-----BEGIN" {
		return storedData, nil
	}

	// Check for DPAPI prefix
	if len(storedData) > 6 && string(storedData[:6]) == "DPAPI:" {
		return decryptDPAPI(storedData[6:])
	}

	// Check for GCM prefix
	if len(storedData) > 4 && string(storedData[:4]) == "GCM:" {
		cipherData := storedData[4:]
		key := deriveMachineKey()
		block, err := aes.NewCipher(key)
		if err != nil {
			return nil, err
		}
		gcm, err := cipher.NewGCM(block)
		if err != nil {
			return nil, err
		}
		nonceSize := gcm.NonceSize()
		if len(cipherData) < nonceSize {
			return nil, fmt.Errorf("ciphertext too short")
		}
		nonce, ciphertext := cipherData[:nonceSize], cipherData[nonceSize:]
		return gcm.Open(nil, nonce, ciphertext, nil)
	}

	// Fallback attempt: try DPAPI directly on Windows, else try GCM
	if runtime.GOOS == "windows" {
		if decrypted, err := decryptDPAPI(storedData); err == nil {
			return decrypted, nil
		}
	}

	return storedData, nil
}

// deriveMachineKey derives a stable 256-bit encryption key bound to the local machine.
func deriveMachineKey() []byte {
	seed := "HTTPeek-Local-CA-MasterKey-Entropy"
	if h, err := os.Hostname(); err == nil {
		seed += h
	}
	if userHome, err := os.UserHomeDir(); err == nil {
		seed += userHome
	}

	salt := []byte("HTTPeek-Security-Salt-2026")
	return pbkdf2.Key([]byte(seed), salt, 10000, 32, sha256.New)
}
