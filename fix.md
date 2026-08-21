# HTTPeek Codebase Fix Analysis

## Phase 1: Critical - Build/Environment Issues

### Issue 1: Go version 1.25.0 in go.mod (Critical)
- **File**: `go.mod:3`
- **Problem**: `go 1.25.0` is a future/leading-edge version that may not be compatible with the installed Go toolchain. This will cause build failures.
- **Fix**: Change to a stable Go version, e.g., `go 1.22.0` or `go 1.23.0`
- **Rationale**: Ensure build compatibility across development environments

### Issue 2: Server restart race conditions in mobile_api.go (High)
- **File**: `pkg/proxy/mobile_api.go:470-563`
- **Problem**: The `/proxy/start`, `/proxy/stop`, `/proxy/port`, `/proxy/ssl`, and `/proxy/system_proxy` endpoints modify server config and call `m.server.Restart(&cfg)`. The `Restart` function stops and restarts the server, but there's no mutex or atomic guarantee against concurrent restarts. Multiple simultaneous REST requests could cause:
  - Double-stop/start cycles
  - Lost connections
  - Inconsistent server state
- **Fix**: Add a `sync.Mutex` to the `App` struct or `Server` struct to serialize config/restart changes, or use `sync.Once` for initialization paths
- **Rationale**: Prevent server instability from concurrent configuration changes

### Issue 3: Body size limit bypass when ContentLength is -1 (High)
- **File**: `pkg/proxy/handler.go:280-293`
- **Problem**: The body size check `maxRequestBodyBytes > 0 && req.ContentLength > maxRequestBodyBytes` uses `req.ContentLength` which is -1 when not specified or using chunked transfer encoding. Bodies without a Content-Length header can bypass the 16 MiB limit.
- **Fix**: Also check for `req.ContentLength == -1` and apply body reading limits via `readLimitedBody` regardless of ContentLength value
- **Rationale**: Ensure body size limits are always enforced, not just when Content-Length is present

### Issue 4: Path traversal in rewrite interceptor file reads (High)
- **File**: `pkg/interceptor/rewrite.go:305-316, 351-364`
- **Problem**: `ActionReplaceBody` and `ActionReplaceBody` in both `applyRequestItem` and `applyResponseItem` use `os.ReadFile(item.BodyFile)` with user-controlled `BodyFile` paths. An attacker could specify `../../../etc/passwd` or other sensitive files.
- **Fix**: Add path validation to reject absolute paths, `..` sequences, and restrict to a safe directory. Only allow relative file paths within a configured body directory.
- **Rationale**: Prevent arbitrary file reading through rewrite rules

### Issue 5: AES key size not validated in crypto interceptor (High)
- **File**: `pkg/interceptor/crypto.go:197-203`
- **Problem**: The `decryptData` function passes `rule.Key` directly to `aes.NewCipher(key)` without validating key length. AES requires keys of 16, 24, or 32 bytes. An incorrectly sized key will cause a runtime error rather than a user-friendly message.
- **Fix**: Add key length validation before creating the cipher, return a descriptive error if key size is not 16, 24, or 32 bytes
- **Rationale**: Prevent cryptic runtime errors from misconfigured crypto rules

### Issue 6: Breakpoint request/response map leaks on disconnect (High)
- **File**: `pkg/interceptor/breakpoint.go:151-181, 204-235`
- **Problem**: The `OnRequest` and `OnResponse` methods store paused requests/responses in `b.pausedRequests` and `b.pausedResponses` maps keyed by request ID. If the client disconnects, the channel is never drained, and the map entries leak memory indefinitely. There's no cleanup on connection close.
- **Fix**: Add a mechanism to clean up paused entries when the context is cancelled or the connection closes. Use a goroutine with a timer or context watcher to periodically clean up stale entries.
- **Rationale**: Prevent memory leaks from abandoned breakpoint sessions

### Issue 7: sendJSONResponse unconditionally closes connection (High)
- **File**: `pkg/proxy/mobile_api.go:1447-1462`
- **Problem**: The `sendJSONResponse` function closes the connection after every response (`_ = conn.Close()`). This prevents keep-alive connections and could cause performance issues with multiple rapid API calls.
- **Fix**: Remove the `conn.Close()` call, or make it conditional based on the request's Connection header or a keep-alive flag
- **Rationale**: Allow persistent connections for mobile API clients

## Phase 2: Medium Priority - Functionality and Edge Cases

### Issue 8: Body size limit not enforced when ContentLength is absent (Medium)
- **File**: `pkg/proxy/handler.go:280-293` (revisited)
- **Problem**: Related to Issue 3 - the `readLimitedBody` call at line 286 only applies when `req.Body != nil`, but the initial ContentLength check at line 281-283 skips bodies without Content-Length. Combined with Go's http.ReadRequest, chunked transfer encoding bodies may not have ContentLength set.
- **Fix**: Always apply `readLimitedBody` to limit reading, regardless of ContentLength value
- **Rationale**: Consistent body size enforcement across all request types

### Issue 9: TLS config in SOCKS5 MITM path may lack proper settings (Medium)
- **File**: `pkg/proxy/socks5.go:114-123`
- **Problem**: The `tlsServerWrap` function creates a `tls.Server` with just the cert manager's TLS config. The config might be missing client authentication requirements, proper cipher suites, or other security settings needed for MITM TLS connections.
- **Fix**: Ensure the TLS config from the cert manager includes appropriate client auth settings and security criteria
- **Rationale**: Secure MITM TLS connections through SOCKS5

### Issue 10: Mobile API rate limiter is in-memory only (Medium)
- **File**: `pkg/proxy/mobile_api.go:52-59, 134`
- **Problem**: The `rateLimiter` in `MobileAPIManager` is initialized in `NewMobileAPIManager` and exists only in memory. If the proxy server restarts, rate limits reset. There's no persistent storage or distributed rate limiting.
- **Fix**: Optionally integrate with a Redis-based rate limiter or add persistence, or document this as a known limitation for single-node deployments
- **Rationale**: Consistent rate limiting across restarts

### Issue 11: Discovery broadcaster potential race conditions (Medium)
- **File**: `pkg/proxy/server.go:103-106, 262-277`
- **Problem**: The `DiscoveryBroadcaster` starts/stops in `Start()`/`Stop()` while the `acceptLoop` goroutine may already be running. There's no guarantee of atomic start/stop, which could cause the broadcaster to miss connections or emit events to closed listeners.
- **Fix**: Add proper synchronization using sync.Mutex or sync/atomic for discovery port state
- **Rationale**: Reliable discovery/broadcaster behavior during start/stop transitions

### Issue 12: HTTP/1.0 Connection header handling edge case (Medium)
- **File**: `pkg/proxy/handler.go:576-580`
- **Problem**: The code sets `Connection: keep-alive` by default but checks `req.Close` to override. However, Go's `http.ReadRequest` sets `req.Close` based on the header, not the HTTP version. For HTTP/1.0 without a Connection header, the default behavior should be close, but the current code may advertise keep-alive incorrectly.
- **Fix**: Explicitly check the HTTP version or simplify the logic to match Go's default behavior
- **Rationale**: Correct HTTP protocol compliance

### Issue 13: Context cancellation not propagated in throttle delay (Medium)
- **File**: `pkg/interceptor/throttle.go:248-254`
- **Problem**: The throttle interceptor creates a `time.NewTimer` and selects on `timer.C` or `bgCtx.Done()`. If the background context is cancelled (e.g., connection close), the timer is stopped but may have already fired or be pending. There's potential for timer leaks if connections close frequently.
- **Fix**: Use `time.After` with a shorter ticker for cleanup, or ensure timer.Stop is always called in a defer
- **Rationale**: Prevent timer goroutine leaks under rapid connection close/reopen

### Issue 14: CompileHostPattern lowercases patterns unexpectedly (Medium)
- **File**: `pkg/interceptor/filter.go:135-144`
- **Problem**: The `compileHostPattern` function lowercases the pattern before compiling the regex. This means whitelist/blacklist patterns are always case-insensitive, which may not match user expectations if they intentionally use case-specific patterns.
- **Fix**: Document the case-insensitive behavior, or add a flag to preserve case sensitivity
- **Rationale**: Manage user expectations about pattern matching

### Issue 15: HAR import/export deterministic IDs (Low)
- **File**: `pkg/storage/storage_test.go:342-363`
- **Problem**: The `TestHARDeterministicIDs` test verifies that re-importing the same HAR yields the same IDs. The implementation in the storage package must ensure deterministic ID generation. Need to verify the implementation matches the test expectation.
- **Fix**: Verify and potentially fix the HAR ID generation algorithm to ensure deterministic output
- **Rationale**: Consistent HAR import/export behavior

### Issue 16: CSV formula injection test coverage (Low)
- **File**: `pkg/storage/storage_test.go:18-38`
- **Problem**: The `TestExportToCSVFormulaInjection` test verifies formula characters are neutralized. Need to ensure the `ExportToCSV` function properly escapes `=`, `+`, `@`, and other formula-triggering characters.
- **Fix**: Verify the CSV export implementation matches the test expectations
- **Rationale**: Prevent spreadsheet formula injection through exported CSV data

## Phase 3: Low Priority - Code Quality and Documentation

### Issue 17: Go version 1.25.0 should be updated (Low)
- **File**: `go.mod:3`
- **Problem**: As noted in Issue 1, the Go version declaration should match the installed toolchain.
- **Fix**: Update to match the installed Go version
- **Rationale**: Build system consistency

### Issue 18: Comment about "KEY FIX" in mobile_api.go (Low)
- **File**: `pkg/proxy/mobile_api.go:1168-1176`
- **Problem**: The comment "KEY FIX" is informal and doesn't belong in production code. The logic it describes (draining buffered bytes before WebSocket read) is important but should have a professional comment.
- **Fix**: Replace "KEY FIX" with a descriptive comment explaining the purpose
- **Rationale**: Code professionalism and maintainability

### Issue 19: HideExec calls in trust_installer.go (Low)
- **File**: `pkg/cert/hide_exec_other.go`, `pkg/cert/hide_exec_windows.go`
- **Problem**: The `hideExec` function is called after executing certutil/securit commands to hide the process window on Windows and suppress output on other OS. Need to verify these functions work correctly across all target platforms.
- **Fix**: Review and test `hide_exec_*.go` implementations across platforms
- **Rationale**: Ensure cross-platform compatibility of CA trust installation

### Issue 20: No test for SOCKS5 with TLS MITM path (Low)
- **File**: `pkg/proxy/socks5.go:105-125`
- **Problem**: The SOCKS5 handler has a TLS MITM path for port 443/8443, but there's no test covering this path (only the passthrough test at `TestSocks5TunnelPassthrough`).
- **Fix**: Add a test for SOCKS5 CONNECT with TLS MITM path
- **Rationale**: Ensure SOCKS5 TLS interception works correctly

### Issue 21: Missing error handling for cert.Save file permissions (Low)
- **File**: `pkg/cert/ca.go:208-222`
- **Problem**: The `Save` method writes the CA key with 0600 permissions and cert with 0644, which is correct. But there's no error handling for the directory creation `os.MkdirAll` - the error is returned but the caller may not handle it properly.
- **Fix**: Ensure proper error propagation from `Save` method
- **Rationale**: Correct error handling for CA file operations

### Issue 22: HTTP/2 support in proxy (Low)
- **File**: `pkg/proxy/handler.go:57`
- **Problem**: The `Handler.NewHandler` creates an `http.Transport` with `http2.ConfigureTransport(tr)`, but the proxy primarily handles HTTP/1.1 and earlier. HTTP/2 support may have edge cases with the proxy's CONNECT tunneling and MITM TLS.
- **Fix**: Verify HTTP/2 passthrough works correctly, or add explicit HTTP/2 handling/detection
- **Rationale**: Ensure HTTP/2 compatibility if enabled

### Issue 23: Wails js bindings should not be hand-edited (Low)
- **File**: `frontend/wailsjs/` (referenced in AGENTS.md)
- **Problem**: The generated Wails bindings in `frontend/wailsjs/` should not be hand-edited as they're regenerated through the Wails workflow. Any changes to Go/Wails interfaces require regeneration.
- **Fix**: Follow the Wails regeneration workflow when modifying Go interfaces
- **Rationale**: Prevent build breaks from stale bindings

### Issue 24: No Android unit tests observed (Low)
- **File**: Android source tree
- **Problem**: The exploration reported no Android unit tests were found, only the build infrastructure is complete.
- **Fix**: Add Android unit tests for VPN service, certificate handling, and rule engine
- **Rationale**: Ensure Android app quality and prevent regressions

### Issue 25: Mobile API auth token from environment only (Low)
- **File**: `pkg/proxy/mobile_api.go:335-351`
- **Problem**: The `mobileAPIToken()` function reads from `HTTPEEK_API_TOKEN` environment variable only. There's no configuration file or alternative auth mechanism. This is intentional (optional auth) but should be documented.
- **Fix**: Document the token configuration requirement, or add support for config file fallback
- **Rationale**: Clear configuration documentation for operators

---

## Summary of Fixes by Phase

**Phase 1 (Critical)**: Go version compatibility, body size limits, path traversal, AES key validation, breakpoint map leaks, connection closing

**Phase 2 (Medium)**: Rate limiting persistence, TLS config, discovery broadcaster, HTTP/1.0 handling, throttle timer leaks, pattern case sensitivity, HAR/CSV tests

**Phase 3 (Low)**: Code quality, documentation, test coverage, platform-specific issues

Each fix should be implemented carefully, with tests added where possible, and verified against the existing test suite. The Go version change requires a full build verification. Path traversal and crypto key fixes have security implications and should be tested with edge cases.