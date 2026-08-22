package scriptengine

import (
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"httpeek/pkg/proxy"

	"github.com/dop251/goja"
)

// ScriptLogHandler callback for console.log statements from scripts.
type ScriptLogHandler func(scriptName, level, message string)

// Engine executes JavaScript code manipulating requests and responses.
type Engine struct {
	vm         *goja.Runtime
	logHandler ScriptLogHandler
	session    map[string]any
	sessionMu  *sync.RWMutex
	client     *http.Client
}

// NewEngine creates an initialized Goja runtime with standard utilities.
func NewEngine(logHandler ScriptLogHandler, session map[string]any, sessionMu *sync.RWMutex) *Engine {
	vm := goja.New()
	e := &Engine{
		vm:         vm,
		logHandler: logHandler,
		session:    session,
		sessionMu:  sessionMu,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}

	e.setupEnvironment()
	return e
}

func (e *Engine) setupEnvironment() {
	// console.log, console.error, console.warn
	consoleObj := e.vm.NewObject()
	_ = consoleObj.Set("log", func(call goja.FunctionCall) goja.Value {
		e.log("info", call.Arguments)
		return goja.Undefined()
	})
	_ = consoleObj.Set("warn", func(call goja.FunctionCall) goja.Value {
		e.log("warn", call.Arguments)
		return goja.Undefined()
	})
	_ = consoleObj.Set("error", func(call goja.FunctionCall) goja.Value {
		e.log("error", call.Arguments)
		return goja.Undefined()
	})
	_ = e.vm.Set("console", consoleObj)

	// crypto utilities
	cryptoObj := e.vm.NewObject()
	_ = cryptoObj.Set("md5", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) == 0 {
			return e.vm.ToValue("")
		}
		str := call.Arguments[0].String()
		hash := md5.Sum([]byte(str))
		return e.vm.ToValue(hex.EncodeToString(hash[:]))
	})
	_ = cryptoObj.Set("sha1", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) == 0 {
			return e.vm.ToValue("")
		}
		str := call.Arguments[0].String()
		hash := sha1.Sum([]byte(str))
		return e.vm.ToValue(hex.EncodeToString(hash[:]))
	})
	_ = cryptoObj.Set("sha256", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) == 0 {
			return e.vm.ToValue("")
		}
		str := call.Arguments[0].String()
		hash := sha256.Sum256([]byte(str))
		return e.vm.ToValue(hex.EncodeToString(hash[:]))
	})
	_ = cryptoObj.Set("sha512", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) == 0 {
			return e.vm.ToValue("")
		}
		str := call.Arguments[0].String()
		hash := sha512.Sum512([]byte(str))
		return e.vm.ToValue(hex.EncodeToString(hash[:]))
	})
	_ = cryptoObj.Set("hmac", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) < 3 {
			return e.vm.ToValue("")
		}
		algo := strings.ToLower(call.Arguments[0].String())
		key := []byte(call.Arguments[1].String())
		data := []byte(call.Arguments[2].String())

		var mac []byte
		switch algo {
		case "sha1":
			h := hmac.New(sha1.New, key)
			h.Write(data)
			mac = h.Sum(nil)
		case "sha512":
			h := hmac.New(sha512.New, key)
			h.Write(data)
			mac = h.Sum(nil)
		case "md5":
			h := hmac.New(md5.New, key)
			h.Write(data)
			mac = h.Sum(nil)
		default: // sha256 default
			h := hmac.New(sha256.New, key)
			h.Write(data)
			mac = h.Sum(nil)
		}
		return e.vm.ToValue(hex.EncodeToString(mac))
	})
	_ = e.vm.Set("crypto", cryptoObj)

	// Base64 helpers
	_ = e.vm.Set("base64Encode", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) == 0 {
			return e.vm.ToValue("")
		}
		return e.vm.ToValue(base64.StdEncoding.EncodeToString([]byte(call.Arguments[0].String())))
	})
	_ = e.vm.Set("base64Decode", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) == 0 {
			return e.vm.ToValue("")
		}
		dec, err := base64.StdEncoding.DecodeString(call.Arguments[0].String())
		if err != nil {
			return e.vm.ToValue("")
		}
		return e.vm.ToValue(string(dec))
	})

	// URL helpers
	_ = e.vm.Set("urlEncode", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) == 0 {
			return e.vm.ToValue("")
		}
		return e.vm.ToValue(url.QueryEscape(call.Arguments[0].String()))
	})
	_ = e.vm.Set("urlDecode", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) == 0 {
			return e.vm.ToValue("")
		}
		dec, _ := url.QueryUnescape(call.Arguments[0].String())
		return e.vm.ToValue(dec)
	})

	// Simple HTTP fetch helper inside scripts
	_ = e.vm.Set("httpFetch", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) == 0 {
			return e.vm.ToValue(nil)
		}
		targetURL := call.Arguments[0].String()
		method := "GET"
		if len(call.Arguments) > 1 {
			method = strings.ToUpper(call.Arguments[1].String())
		}
		var reqBody io.Reader
		if len(call.Arguments) > 2 {
			reqBody = strings.NewReader(call.Arguments[2].String())
		}
		httpReq, err := http.NewRequest(method, targetURL, reqBody)
		if err != nil {
			return e.vm.ToValue(map[string]any{"error": err.Error()})
		}
		resp, err := e.client.Do(httpReq)
		if err != nil {
			return e.vm.ToValue(map[string]any{"error": err.Error()})
		}
		defer resp.Body.Close()
		respBytes, _ := io.ReadAll(resp.Body)
		return e.vm.ToValue(map[string]any{
			"status": resp.StatusCode,
			"body":   string(respBytes),
		})
	})
}

func (e *Engine) log(level string, args []goja.Value) {
	var parts []string
	for _, a := range args {
		parts = append(parts, fmt.Sprint(a.Export()))
	}
	msg := strings.Join(parts, " ")
	if e.logHandler != nil {
		e.logHandler("script", level, msg)
	} else {
		fmt.Printf("[%s] %s\n", level, msg)
	}
}

// RunOnRequest executes the user script onRequest(context, request).
func (e *Engine) RunOnRequest(scriptCode string, req *proxy.HttpRequest, env map[string]string) (*proxy.HttpRequest, error) {
	e.sessionMu.RLock()
	contextObj := map[string]any{
		"session": e.session,
		"env":     env,
		"os":      runtime.GOOS,
	}
	e.sessionMu.RUnlock()

	requestObj := map[string]any{
		"id":         req.ID,
		"method":     string(req.Method),
		"url":        req.URL,
		"path":       req.Path,
		"query":      mapStringSliceToInterface(req.Query),
		"headers":    mapHeadersToInterface(req.Headers),
		"body":       req.BodyString,
		"clientAddr": req.ClientAddr,
	}

	fullScript := fmt.Sprintf(`
		%s
		(function() {
			if (typeof onRequest === 'function') {
				var ctx = %s;
				var r = %s;
				var res = onRequest(ctx, r);
				return { context: ctx, request: res || r };
			}
			return { request: %s };
		})()
	`, scriptCode, toJSON(contextObj), toJSON(requestObj), toJSON(requestObj))

	timer := time.AfterFunc(5*time.Second, func() {
		e.vm.Interrupt("script timeout: execution exceeded 5 seconds")
	})
	defer timer.Stop()

	val, err := e.vm.RunString(fullScript)
	e.vm.ClearInterrupt()
	if err != nil {
		return nil, fmt.Errorf("script execution error: %w", err)
	}

	resultMap, ok := val.Export().(map[string]any)
	if !ok {
		return req, nil
	}

	// Update session
	if ctxMap, ok := resultMap["context"].(map[string]any); ok {
		if sessMap, ok := ctxMap["session"].(map[string]any); ok {
			e.sessionMu.Lock()
			e.session = sessMap
			e.sessionMu.Unlock()
		}
	}

	// Apply request modifications
	if resReqMap, ok := resultMap["request"].(map[string]any); ok {
		if method, ok := resReqMap["method"].(string); ok && method != "" {
			req.Method = proxy.HttpMethod(method)
		}
		if u, ok := resReqMap["url"].(string); ok && u != "" {
			req.URL = u
			if parsed, err := url.Parse(u); err == nil {
				req.Path = parsed.Path
				req.Query = parsed.Query()
				req.HostPort.Host = parsed.Hostname()
				if parsed.Port() != "" {
					req.HostPort.Port, _ = strconv.Atoi(parsed.Port())
				}
				req.Headers.Set("Host", parsed.Host)
			}
		}
		if body, ok := resReqMap["body"].(string); ok {
			req.Body = []byte(body)
			req.BodyString = body
			req.BodyText = body
			req.BodyBase64 = base64.StdEncoding.EncodeToString([]byte(body))
		}
		if headers, ok := resReqMap["headers"].(map[string]any); ok {
			for k, v := range headers {
				req.Headers.Set(k, fmt.Sprint(v))
			}
		}
	}

	return req, nil
}

// RunOnResponse executes the user script onResponse(context, request, response).
func (e *Engine) RunOnResponse(scriptCode string, req *proxy.HttpRequest, resp *proxy.HttpResponse, env map[string]string) (*proxy.HttpResponse, error) {
	e.sessionMu.RLock()
	contextObj := map[string]any{
		"session": e.session,
		"env":     env,
		"os":      runtime.GOOS,
	}
	e.sessionMu.RUnlock()

	requestObj := map[string]any{
		"id":      req.ID,
		"method":  string(req.Method),
		"url":     req.URL,
		"path":    req.Path,
		"headers": mapHeadersToInterface(req.Headers),
		"body":    req.BodyString,
	}

	responseObj := map[string]any{
		"statusCode": resp.StatusCode,
		"headers":    mapHeadersToInterface(resp.Headers),
		"body":       resp.BodyString,
	}

	fullScript := fmt.Sprintf(`
		%s
		(function() {
			if (typeof onResponse === 'function') {
				var ctx = %s;
				var req = %s;
				var res = %s;
				var modified = onResponse(ctx, req, res);
				return { context: ctx, response: modified || res };
			}
			return { response: %s };
		})()
	`, scriptCode, toJSON(contextObj), toJSON(requestObj), toJSON(responseObj), toJSON(responseObj))

	timer := time.AfterFunc(5*time.Second, func() {
		e.vm.Interrupt("script timeout: execution exceeded 5 seconds")
	})
	defer timer.Stop()

	val, err := e.vm.RunString(fullScript)
	e.vm.ClearInterrupt()
	if err != nil {
		return nil, fmt.Errorf("script execution error: %w", err)
	}

	resultMap, ok := val.Export().(map[string]any)
	if !ok {
		return resp, nil
	}

	// Update session
	if ctxMap, ok := resultMap["context"].(map[string]any); ok {
		if sessMap, ok := ctxMap["session"].(map[string]any); ok {
			e.sessionMu.Lock()
			e.session = sessMap
			e.sessionMu.Unlock()
		}
	}

	// Apply response modifications
	if resRespMap, ok := resultMap["response"].(map[string]any); ok {
		switch sc := resRespMap["statusCode"].(type) {
		case int64:
			if sc > 0 {
				resp.StatusCode = int(sc)
				resp.StatusText = http.StatusText(int(sc))
			}
		case float64:
			if sc > 0 {
				resp.StatusCode = int(sc)
				resp.StatusText = http.StatusText(int(sc))
			}
		case int:
			if sc > 0 {
				resp.StatusCode = sc
				resp.StatusText = http.StatusText(sc)
			}
		}
		if body, ok := resRespMap["body"].(string); ok {
			resp.Body = []byte(body)
			resp.BodyString = body
			resp.BodyText = body
			resp.BodySize = int64(len(body))
		}
		if headers, ok := resRespMap["headers"].(map[string]any); ok {
			for k, v := range headers {
				resp.Headers.Set(k, fmt.Sprint(v))
			}
		}
	}

	return resp, nil
}

func toJSON(v any) string {
	data, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(data)
}

func mapHeadersToInterface(h http.Header) map[string]string {
	res := make(map[string]string)
	for k, v := range h {
		res[k] = strings.Join(v, ", ")
	}
	return res
}

func mapStringSliceToInterface(m map[string][]string) map[string]string {
	res := make(map[string]string)
	for k, v := range m {
		res[k] = strings.Join(v, ", ")
	}
	return res
}
