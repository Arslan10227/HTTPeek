package interceptor

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"sync"

	"httpeek/pkg/proxy"
)

type CryptoAlgorithm string

const (
	AlgorithmAES_CBC CryptoAlgorithm = "AES_CBC"
	AlgorithmAES_ECB CryptoAlgorithm = "AES_ECB"
	AlgorithmAES_GCM CryptoAlgorithm = "AES_GCM"
	AlgorithmAES_CTR CryptoAlgorithm = "AES_CTR"
)

type DataEncoding string

const (
	EncodingHex    DataEncoding = "hex"
	EncodingBase64 DataEncoding = "base64"
	EncodingRaw    DataEncoding = "raw"
)

// CryptoRule specifies auto-decrypt rules for matching URLs.
type CryptoRule struct {
	ID         string          `json:"id"`
	Name       string          `json:"name"`
	Enabled    bool            `json:"enabled"`
	URLPattern string          `json:"urlPattern"`
	Algorithm  CryptoAlgorithm `json:"algorithm"`
	Encoding   DataEncoding    `json:"encoding"`
	Key        string          `json:"key"`
	IV         string          `json:"iv,omitempty"`
	DecryptReq bool            `json:"decryptReq"`
	DecryptRes bool            `json:"decryptRes"`
	regex      *regexp.Regexp
}

// UnmarshalJSON supports both explicit flags and target string.
func (c *CryptoRule) UnmarshalJSON(data []byte) error {
	type Alias CryptoRule
	aux := &struct {
		Target string `json:"target"`
		*Alias
	}{
		Alias: (*Alias)(c),
	}
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}
	if aux.Target != "" {
		switch strings.ToLower(aux.Target) {
		case "request":
			c.DecryptReq = true
			c.DecryptRes = false
		case "response":
			c.DecryptReq = false
			c.DecryptRes = true
		case "both", "all":
			c.DecryptReq = true
			c.DecryptRes = true
		}
	}
	if !c.DecryptReq && !c.DecryptRes && c.Enabled {
		c.DecryptReq = true
		c.DecryptRes = true
	}
	if c.Encoding == "" {
		c.Encoding = EncodingBase64
	}
	if c.Algorithm == "" {
		c.Algorithm = AlgorithmAES_CBC
	}
	return nil
}

// RequestCryptoInterceptor decrypts encrypted payloads in requests and responses.
type RequestCryptoInterceptor struct {
	BaseInterceptor
	rules []*CryptoRule
	mu    sync.RWMutex
}

// NewRequestCryptoInterceptor creates a crypto interceptor with priority 80.
func NewRequestCryptoInterceptor() *RequestCryptoInterceptor {
	return &RequestCryptoInterceptor{
		BaseInterceptor: NewBaseInterceptor("RequestCrypto", 80, true),
		rules:           make([]*CryptoRule, 0),
	}
}

// SetRules updates active decryption rules.
func (c *RequestCryptoInterceptor) SetRules(rules []*CryptoRule) {
	c.mu.Lock()
	defer c.mu.Unlock()

	for _, r := range rules {
		r.regex = compilePattern(r.URLPattern)
	}
	c.rules = rules
}

// GetRules returns active decryption rules.
func (c *RequestCryptoInterceptor) GetRules() []*CryptoRule {
	c.mu.RLock()
	defer c.mu.RUnlock()

	out := make([]*CryptoRule, len(c.rules))
	copy(out, c.rules)
	return out
}

// OnRequest decrypts the request body if matched.
func (c *RequestCryptoInterceptor) OnRequest(ctx *proxy.Context, req *proxy.HttpRequest) (*proxy.HttpRequest, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	for _, r := range c.rules {
		if !r.Enabled || !r.DecryptReq || r.regex == nil || !r.regex.MatchString(req.URL) {
			continue
		}
		if len(req.Body) == 0 {
			continue
		}

		decrypted, err := c.decryptData(req.Body, r)
		if err == nil && len(decrypted) > 0 {
			req.Body = decrypted
			req.BodyString = string(decrypted)
			req.BodyText = string(decrypted)
		}
	}

	return req, nil
}

// OnResponse decrypts the response body if matched.
func (c *RequestCryptoInterceptor) OnResponse(ctx *proxy.Context, req *proxy.HttpRequest, resp *proxy.HttpResponse) (*proxy.HttpResponse, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	for _, r := range c.rules {
		if !r.Enabled || !r.DecryptRes || r.regex == nil || !r.regex.MatchString(req.URL) {
			continue
		}
		if len(resp.Body) == 0 {
			continue
		}

		decrypted, err := c.decryptData(resp.Body, r)
		if err == nil && len(decrypted) > 0 {
			resp.Body = decrypted
			resp.BodyString = string(decrypted)
			resp.BodyText = string(decrypted)
			resp.BodySize = int64(len(decrypted))
		}
	}

	return resp, nil
}

func (c *RequestCryptoInterceptor) decryptData(data []byte, rule *CryptoRule) ([]byte, error) {
	var ciphertext []byte
	var err error

	switch rule.Encoding {
	case EncodingBase64:
		ciphertext, err = base64.StdEncoding.DecodeString(strings.TrimSpace(string(data)))
	case EncodingHex:
		ciphertext, err = hex.DecodeString(strings.TrimSpace(string(data)))
	default:
		ciphertext = data
	}
	if err != nil {
		return nil, err
	}

	key := []byte(rule.Key)
	iv := []byte(rule.IV)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	switch rule.Algorithm {
	case AlgorithmAES_CBC:
		if len(ciphertext)%aes.BlockSize != 0 {
			return nil, errors.New("ciphertext is not a multiple of the block size")
		}
		if len(iv) != aes.BlockSize {
			return nil, errors.New("IV must match block size (16 bytes)")
		}
		mode := cipher.NewCBCDecrypter(block, iv)
		plain := make([]byte, len(ciphertext))
		mode.CryptBlocks(plain, ciphertext)
		return pkcs7Unpad(plain)

	case AlgorithmAES_CTR:
		if len(iv) != aes.BlockSize {
			return nil, errors.New("IV must match block size (16 bytes)")
		}
		stream := cipher.NewCTR(block, iv)
		plain := make([]byte, len(ciphertext))
		stream.XORKeyStream(plain, ciphertext)
		return plain, nil

	case AlgorithmAES_GCM:
		aesGCM, err := cipher.NewGCM(block)
		if err != nil {
			return nil, err
		}
		if len(iv) == 0 {
			iv = ciphertext[:aesGCM.NonceSize()]
			ciphertext = ciphertext[aesGCM.NonceSize():]
		}
		return aesGCM.Open(nil, iv, ciphertext, nil)

	case AlgorithmAES_ECB:
		if len(ciphertext)%aes.BlockSize != 0 {
			return nil, errors.New("ciphertext is not a multiple of the block size")
		}
		plain := make([]byte, len(ciphertext))
		for bs, be := 0, aes.BlockSize; bs < len(ciphertext); bs, be = bs+aes.BlockSize, be+aes.BlockSize {
			block.Decrypt(plain[bs:be], ciphertext[bs:be])
		}
		return pkcs7Unpad(plain)
	}

	return nil, errors.New("unsupported algorithm")
}

// pkcs7Unpad removes RFC 5652 padding. It rejects invalid padding instead of
// returning the raw ciphertext so callers can distinguish failure from data.
func pkcs7Unpad(data []byte) ([]byte, error) {
	length := len(data)
	if length == 0 {
		return nil, errors.New("empty ciphertext")
	}
	unpadding := int(data[length-1])
	if unpadding == 0 || unpadding > aes.BlockSize || unpadding > length {
		return nil, errors.New("invalid PKCS7 padding")
	}
	for i := length - unpadding; i < length; i++ {
		if data[i] != byte(unpadding) {
			return nil, errors.New("invalid PKCS7 padding")
		}
	}
	return data[:length-unpadding], nil
}
