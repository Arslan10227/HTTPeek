package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/md5"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"html"
	"net/url"
	"strconv"
	"strings"

	"httpeek/pkg/cert"
	"httpeek/pkg/scriptengine"

	"github.com/dop251/goja"
)

// ToolboxEncode performs text encoding, decoding, hashing, and JWT inspection.
func (a *App) ToolboxEncode(action, input string) (string, error) {
	switch action {
	case "url_encode":
		return url.QueryEscape(input), nil
	case "url_decode":
		return url.QueryUnescape(input)
	case "base64_encode":
		return base64.StdEncoding.EncodeToString([]byte(input)), nil
	case "base64_decode":
		b, err := base64.StdEncoding.DecodeString(strings.TrimSpace(input))
		if err != nil {
			b, err = base64.URLEncoding.DecodeString(strings.TrimSpace(input))
		}
		return string(b), err
	case "base64_url_encode":
		return base64.URLEncoding.EncodeToString([]byte(input)), nil
	case "base64_url_decode":
		b, err := base64.URLEncoding.DecodeString(strings.TrimSpace(input))
		if err != nil {
			b, err = base64.StdEncoding.DecodeString(strings.TrimSpace(input))
		}
		return string(b), err
	case "hex_encode":
		return hex.EncodeToString([]byte(input)), nil
	case "hex_decode":
		b, err := hex.DecodeString(strings.ReplaceAll(strings.TrimSpace(input), " ", ""))
		return string(b), err
	case "unicode_encode":
		var sb strings.Builder
		for _, r := range input {
			if r > 127 {
				sb.WriteString(fmt.Sprintf("\\u%04x", r))
			} else {
				sb.WriteRune(r)
			}
		}
		return sb.String(), nil
	case "unicode_decode":
		var out []rune
		in := []rune(input)
		for i := 0; i < len(in); {
			if i+5 < len(in) && in[i] == '\\' && (in[i+1] == 'u' || in[i+1] == 'U') {
				hexStr := string(in[i+2 : i+6])
				if val, err := strconv.ParseInt(hexStr, 16, 32); err == nil {
					out = append(out, rune(val))
					i += 6
					continue
				}
			}
			out = append(out, in[i])
			i++
		}
		return string(out), nil
	case "html_encode":
		return html.EscapeString(input), nil
	case "html_decode":
		return html.UnescapeString(input), nil
	case "md5":
		h := md5.Sum([]byte(input))
		return hex.EncodeToString(h[:]), nil
	case "sha1":
		h := sha1.Sum([]byte(input))
		return hex.EncodeToString(h[:]), nil
	case "sha256":
		h := sha256.Sum256([]byte(input))
		return hex.EncodeToString(h[:]), nil
	case "sha512":
		h := sha512.Sum512([]byte(input))
		return hex.EncodeToString(h[:]), nil
	case "jwt_decode":
		parts := strings.Split(strings.TrimSpace(input), ".")
		if len(parts) < 2 {
			return "", fmt.Errorf("invalid JWT format (expected header.payload.signature)")
		}
		decodeSeg := func(seg string) (string, error) {
			if l := len(seg) % 4; l > 0 {
				seg += strings.Repeat("=", 4-l)
			}
			b, err := base64.URLEncoding.DecodeString(seg)
			if err != nil {
				b, err = base64.StdEncoding.DecodeString(seg)
			}
			if err != nil {
				return "", err
			}
			var pretty bytes.Buffer
			if json.Indent(&pretty, b, "", "  ") == nil {
				return pretty.String(), nil
			}
			return string(b), nil
		}
		hdr, _ := decodeSeg(parts[0])
		payload, _ := decodeSeg(parts[1])
		sig := ""
		if len(parts) > 2 {
			sig = parts[2]
		}
		result := fmt.Sprintf("// Header\n%s\n\n// Payload\n%s\n\n// Signature\n%s", hdr, payload, sig)
		return result, nil
	default:
		return input, nil
	}
}

// ToolboxAES performs AES encryption and decryption with ECB, CBC, CTR, and GCM modes.
func (a *App) ToolboxAES(action, mode, input, keyStr, ivStr string) (string, error) {
	key := []byte(keyStr)
	if len(key) != 16 && len(key) != 24 && len(key) != 32 {
		return "", fmt.Errorf("AES key must be 16, 24, or 32 bytes (got %d bytes)", len(key))
	}

	iv := []byte(ivStr)
	if len(iv) < 12 {
		padded := make([]byte, 16)
		copy(padded, iv)
		iv = padded
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	mode = strings.ToUpper(mode)
	if mode == "" {
		mode = "CBC"
	}

	if action == "encrypt" {
		plaintext := []byte(input)

		switch mode {
		case "GCM":
			aesGCM, err := cipher.NewGCM(block)
			if err != nil {
				return "", err
			}
			nonce := iv
			if len(nonce) > aesGCM.NonceSize() {
				nonce = nonce[:aesGCM.NonceSize()]
			}
			ciphertext := aesGCM.Seal(nil, nonce, plaintext, nil)
			return base64.StdEncoding.EncodeToString(ciphertext), nil

		case "CTR":
			ciphertext := make([]byte, len(plaintext))
			stream := cipher.NewCTR(block, iv[:aes.BlockSize])
			stream.XORKeyStream(ciphertext, plaintext)
			return base64.StdEncoding.EncodeToString(ciphertext), nil

		case "ECB":
			padding := aes.BlockSize - len(plaintext)%aes.BlockSize
			padtext := bytes.Repeat([]byte{byte(padding)}, padding)
			plaintext = append(plaintext, padtext...)
			ciphertext := make([]byte, len(plaintext))
			for bs, be := 0, aes.BlockSize; bs < len(plaintext); bs, be = bs+aes.BlockSize, be+aes.BlockSize {
				block.Encrypt(ciphertext[bs:be], plaintext[bs:be])
			}
			return base64.StdEncoding.EncodeToString(ciphertext), nil

		default: // CBC
			padding := aes.BlockSize - len(plaintext)%aes.BlockSize
			padtext := bytes.Repeat([]byte{byte(padding)}, padding)
			plaintext = append(plaintext, padtext...)
			ciphertext := make([]byte, len(plaintext))
			modeEnc := cipher.NewCBCEncrypter(block, iv[:aes.BlockSize])
			modeEnc.CryptBlocks(ciphertext, plaintext)
			return base64.StdEncoding.EncodeToString(ciphertext), nil
		}
	} else { // Decrypt
		ciphertext, err := base64.StdEncoding.DecodeString(input)
		if err != nil {
			ciphertext, err = hex.DecodeString(strings.ReplaceAll(input, " ", ""))
			if err != nil {
				return "", fmt.Errorf("invalid ciphertext format (expected Base64 or Hex)")
			}
		}

		switch mode {
		case "GCM":
			aesGCM, err := cipher.NewGCM(block)
			if err != nil {
				return "", err
			}
			nonce := iv
			if len(nonce) > aesGCM.NonceSize() {
				nonce = nonce[:aesGCM.NonceSize()]
			}
			plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
			if err != nil {
				return "", fmt.Errorf("GCM decryption failed: %w", err)
			}
			return string(plaintext), nil

		case "CTR":
			plaintext := make([]byte, len(ciphertext))
			stream := cipher.NewCTR(block, iv[:aes.BlockSize])
			stream.XORKeyStream(plaintext, ciphertext)
			return string(plaintext), nil

		case "ECB":
			if len(ciphertext)%aes.BlockSize != 0 {
				return "", fmt.Errorf("ciphertext is not a multiple of the block size")
			}
			plaintext := make([]byte, len(ciphertext))
			for bs, be := 0, aes.BlockSize; bs < len(ciphertext); bs, be = bs+aes.BlockSize, be+aes.BlockSize {
				block.Decrypt(plaintext[bs:be], ciphertext[bs:be])
			}
			if len(plaintext) > 0 {
				padding := int(plaintext[len(plaintext)-1])
				if padding > 0 && padding <= aes.BlockSize && len(plaintext) >= padding {
					plaintext = plaintext[:len(plaintext)-padding]
				}
			}
			return string(plaintext), nil

		default: // CBC
			if len(ciphertext)%aes.BlockSize != 0 {
				return "", fmt.Errorf("ciphertext is not a multiple of the block size")
			}
			plaintext := make([]byte, len(ciphertext))
			modeDec := cipher.NewCBCDecrypter(block, iv[:aes.BlockSize])
			modeDec.CryptBlocks(plaintext, ciphertext)
			if len(plaintext) > 0 {
				padding := int(plaintext[len(plaintext)-1])
				if padding > 0 && padding <= aes.BlockSize && len(plaintext) >= padding {
					plaintext = plaintext[:len(plaintext)-padding]
				}
			}
			return string(plaintext), nil
		}
	}
}

// ToolboxRSA performs RSA encryption, decryption, and signing.
func (a *App) ToolboxRSA(action, input, keyPEM, passphrase string) (string, error) {
	block, _ := pem.Decode([]byte(keyPEM))
	if block == nil {
		return "", fmt.Errorf("invalid PEM key block")
	}

	keyBytes := block.Bytes
	if x509.IsEncryptedPEMBlock(block) {
		decrypted, err := x509.DecryptPEMBlock(block, []byte(passphrase))
		if err != nil {
			return "", fmt.Errorf("failed to decrypt PEM block: %w", err)
		}
		keyBytes = decrypted
	}

	switch action {
	case "encrypt":
		pubKey, err := x509.ParsePKIXPublicKey(keyBytes)
		if err != nil {
			cert, errCert := x509.ParseCertificate(keyBytes)
			if errCert != nil {
				return "", fmt.Errorf("failed to parse RSA public key or certificate: %v", err)
			}
			pubKey = cert.PublicKey
		}
		rsaPub, ok := pubKey.(*rsa.PublicKey)
		if !ok {
			return "", fmt.Errorf("not an RSA public key")
		}
		encrypted, err := rsa.EncryptPKCS1v15(rand.Reader, rsaPub, []byte(input))
		if err != nil {
			return "", err
		}
		return base64.StdEncoding.EncodeToString(encrypted), nil

	case "decrypt":
		privKey, err := x509.ParsePKCS1PrivateKey(keyBytes)
		if err != nil {
			pkcs8, err8 := x509.ParsePKCS8PrivateKey(keyBytes)
			if err8 != nil {
				return "", fmt.Errorf("failed to parse RSA private key: %v", err)
			}
			var ok bool
			privKey, ok = pkcs8.(*rsa.PrivateKey)
			if !ok {
				return "", fmt.Errorf("not an RSA private key")
			}
		}
		ciphertext, err := base64.StdEncoding.DecodeString(strings.TrimSpace(input))
		if err != nil {
			ciphertext, err = hex.DecodeString(strings.ReplaceAll(input, " ", ""))
			if err != nil {
				return "", fmt.Errorf("invalid ciphertext (expected Base64 or Hex)")
			}
		}
		decrypted, err := rsa.DecryptPKCS1v15(rand.Reader, privKey, ciphertext)
		if err != nil {
			return "", err
		}
		return string(decrypted), nil

	default:
		return "", fmt.Errorf("unsupported RSA action: %s", action)
	}
}

// ToolboxCertHash computes OpenSSL old hash (for Android root CA store), new hash, and SHA-1/SHA-256 fingerprints.
func (a *App) ToolboxCertHash(certPEM string) (map[string]any, error) {
	var targetCert *x509.Certificate

	if strings.TrimSpace(certPEM) == "" {
		if a.certMgr != nil && a.certMgr.CA() != nil {
			targetCert = a.certMgr.CA().Certificate
		} else {
			return nil, fmt.Errorf("no certificate provided and proxy CA not initialized")
		}
	} else {
		block, _ := pem.Decode([]byte(certPEM))
		if block == nil {
			return nil, fmt.Errorf("failed to decode certificate PEM")
		}
		parsed, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("failed to parse X.509 certificate: %w", err)
		}
		targetCert = parsed
	}

	oldHash := cert.AndroidSubjectHashOld(targetCert)
	newHash := cert.AndroidSubjectHashNew(targetCert)

	sha1Sum := sha1.Sum(targetCert.Raw)
	sha256Sum := sha256.Sum256(targetCert.Raw)

	return map[string]any{
		"oldHash":           fmt.Sprintf("%08x.0", oldHash),
		"newHash":           fmt.Sprintf("%08x.0", newHash),
		"sha1Fingerprint":   strings.ToUpper(hex.EncodeToString(sha1Sum[:])),
		"sha256Fingerprint": strings.ToUpper(hex.EncodeToString(sha256Sum[:])),
		"subject":           targetCert.Subject.CommonName,
		"issuer":            targetCert.Issuer.CommonName,
		"serialNumber":      targetCert.SerialNumber.String(),
		"validFrom":         targetCert.NotBefore.Format("2006-01-02 15:04:05"),
		"validTo":           targetCert.NotAfter.Format("2006-01-02 15:04:05"),
	}, nil
}

// ToolboxRunJS executes a JavaScript scratchpad in the Goja runtime and returns logs and return value.
func (a *App) ToolboxRunJS(code string, mockContextJSON string) (map[string]any, error) {
	var logs []string
	logHandler := func(scriptName, level, message string) {
		logs = append(logs, fmt.Sprintf("[%s] %s", strings.ToUpper(level), message))
	}

	engine := scriptengine.NewEngine(logHandler, make(map[string]any), nil)
	vm := goja.New()

	consoleObj := vm.NewObject()
	_ = consoleObj.Set("log", func(call goja.FunctionCall) goja.Value {
		var parts []string
		for _, arg := range call.Arguments {
			parts = append(parts, fmt.Sprint(arg.Export()))
		}
		logs = append(logs, "[INFO] "+strings.Join(parts, " "))
		return goja.Undefined()
	})
	_ = consoleObj.Set("error", func(call goja.FunctionCall) goja.Value {
		var parts []string
		for _, arg := range call.Arguments {
			parts = append(parts, fmt.Sprint(arg.Export()))
		}
		logs = append(logs, "[ERROR] "+strings.Join(parts, " "))
		return goja.Undefined()
	})
	_ = vm.Set("console", consoleObj)

	val, err := vm.RunString(code)
	if err != nil {
		return map[string]any{
			"logs":   logs,
			"error":  err.Error(),
			"result": nil,
		}, nil
	}

	_ = engine

	return map[string]any{
		"logs":   logs,
		"error":  nil,
		"result": fmt.Sprint(val.Export()),
	}, nil
}

