# HTTPeek Megaplan

## Purpose

This is an executable roadmap for finding and resolving HTTPeek bugs, reliability problems, security risks, missing features, Android issues, software compatibility gaps, TODOs, and remaining release work. It intentionally separates static evidence from hypotheses that require runtime, emulator, device, or cross-platform validation.

## Product/system map

HTTPeek consists of two related implementations:

```text
Desktop application
  Wails bootstrap (main.go)
    -> App lifecycle and bindings (app.go, app_*.go)
      -> proxy.Server / Handler
        -> HTTP, CONNECT/TLS MITM, SOCKS5, WebSocket/SSE
          -> interceptor.Chain
            -> proxy events
              -> SQLite sessions + Wails events
                -> React UI / HTTP-WebSocket fallback

Android application
  MainActivity + fragments
    -> HttpeekVpnService
      -> MitmProxyServer + DynamicCertAuthority + Android RulesEngine
        -> protected upstream sockets
          -> Android UI events + DesktopBridgeClient
            -> desktop /ws/events and /api/*
```

### Desktop ownership

- Proxy lifecycle, TCP listener, HTTP/CONNECT/SOCKS5 handling: `pkg/proxy/`, `app_proxy.go`.
- TLS CA/certificate/trust: `pkg/cert/`, `app_cert.go`, `internal/services/cert.go`.
- Rule execution: `pkg/interceptor/`, `app_rules.go`, `internal/services/rules.go`.
- Capture storage: `pkg/storage/`, `app_sessions.go`, `internal/services/sessions.go`.
- System proxy/process integration: `pkg/system/`.
- Mobile API/bridge: `pkg/proxy/mobile_api.go`, `app_mobile.go`, `app_mobile_bridge.go`.
- UI and state: `frontend/src/`, especially `App.tsx`, `store/apiAdapter.ts`, `store/useProxyStore.ts`.

### Android ownership

- VPN lifecycle and routing: `HttpeekVpnService.kt`.
- Local proxy protocol/TLS: `core/proxy/MitmProxyServer.kt`, `security/DynamicCertAuthority.kt`.
- Rules and persistence: `core/rules/RulesEngine.kt`.
- Desktop connection: `core/bridge/DesktopBridgeClient.kt`, pairing/history/discovery managers.
- UI: `ui/*`, `MainActivity.kt`.

## Evidence and priority model

Every finding must use one evidence tier:

- **Confirmed/static evidence:** Directly demonstrated by source, configuration, an existing failing test, or a reproducible command failure.
- **Likely risk:** Strong source-level signal, but impact or trigger still needs reproduction.
- **Open validation:** Requires a build, OS, network, emulator, physical Android device, certificate store, or release artifact.

Use these priority dimensions:

1. **Reliability and safety:** proxy correctness, TLS/CA handling, data integrity, auth, crashes, recovery, and system-proxy restoration.
2. **Feature completeness:** missing capabilities, parity gaps, usability failures, and incomplete workflows.
3. **Release readiness:** reproducible builds, CI gates, packaging, signing, compatibility, and supportability.

Suggested severity: `Blocker`, `Critical`, `High`, `Medium`, `Low`, or `Enhancement`. Severity must reflect user impact and exploitability, not implementation size.

## Baseline inventory

### Build/version evidence

- `README.md` advertises Go 1.22+.
- `.github/workflows/build.yml` configures Go 1.22.
- `go.mod` declares Go 1.25.0.
- Wails is pinned in `go.mod` to v2.14.0, while CI installs the latest CLI.
- Frontend uses Node/npm, React 19, TypeScript, Vite, Tailwind, Zustand, Monaco, and generated Wails runtime files.
- Android uses compile/target SDK 34, min SDK 24, Java/Kotlin 17, AGP 8.2.2, Kotlin plugin 1.9.22, and Gradle 8.2.
- Android release has `minifyEnabled false`, lint abort disabled, and `signingConfig signingConfigs.debug`.
- The repository inventory did not show `android/app/proguard-rules.pro` even though the release build references it; this needs a clean-build confirmation.
- `android/local.properties` contains a machine-specific SDK path and is not portable setup documentation.

### Test/CI evidence

Go tests exist under `pkg/cert`, `pkg/interceptor`, `pkg/proxy`, and `pkg/storage`. There are no repository frontend test files or Android Kotlin test files in the current inventory. The GitHub Actions workflow is manually dispatched and build/artifact oriented; it does not currently run a full Go test/race/static-analysis gate, frontend test gate, or Android lint/test gate.

## Workstream 0 — Establish reproducible baselines

### Tasks

1. Run `go test ./...` from the repository root.
2. Run `go test -race ./...` where supported.
3. Run `npm ci` and `npm run build` from `frontend`.
4. Run `android\\gradlew.bat assembleDebug` and `android\\gradlew.bat lint` with a clean Android SDK/JDK environment.
5. Attempt the documented Wails builds on Windows, macOS, and Linux runners or equivalent environments.
6. Record exact tool versions, command output, artifact paths, and environment prerequisites.

### Outputs

- Baseline build/test matrix.
- Reproduction notes for version or dependency failures.
- List of unsupported environments with evidence.

### Exit criteria

Each supported build target has a documented clean command, required tools, artifact expectation, and pass/fail result. Failures are preserved as findings rather than hidden by weakening CI.

## Workstream 1 — Desktop lifecycle and proxy correctness

### Scope

`main.go`, `app.go`, `app_proxy.go`, `pkg/proxy/server.go`, `pkg/proxy/handler.go`, `pkg/proxy/socks5.go`, `pkg/proxy/ws.go`, `pkg/proxy/sse.go`, `pkg/system/*`, and service wiring.

### Tests and investigations

- Verify DB/CA initialization failures and whether all exposed Wails methods remain safe after partial startup.
- Exercise repeated start, stop, restart, failed bind, port changes, external proxy changes, shutdown, forced termination, and pre-existing OS proxy settings.
- Verify server replacement preserves interceptor chain, event listeners, mobile API, bridge, upstream proxy transport, discovery, and status reporting.
- Test HTTP/1.0, HTTP/1.1, CONNECT/TLS, SOCKS5, keep-alive, chunked traffic, malformed requests, timeouts, cancellation, DNS/IPv6, and large bodies.
- Test WebSocket frame directions, SSE streaming, stream closure, backpressure, and event association.
- Verify process lookup behavior on Windows versus macOS/Linux and behavior when permissions or tools are unavailable.

### Expected outputs

- Lifecycle state diagram.
- Protocol support matrix.
- Regressions for restart, shutdown cleanup, malformed input, streaming, and body limits.
- Findings for connection leaks, races, stale state, or incorrect system-proxy restoration.

## Workstream 2 — TLS, CA, and trust safety

### Scope

`pkg/cert/*`, `app_cert.go`, Java installer code, Android `DynamicCertAuthority.kt`, root CA installer code, and certificate UI.

### Tests and investigations

- Verify root CA persistence, key permissions, leaf cache behavior, CA rotation, validity windows, SANs, IP/IPv6/IDN hostnames, and key usage/extensions.
- Test desktop and Android CA installation in user and system stores, Java keystores, Android certificate filename/hash generation, rooted/Magisk flows, and uninstall/recovery.
- Test certificate pinning fallback and ensure failed MITM does not corrupt or lose the original TLS stream.
- Test Android 7+ network security behavior, user CA limitations, modern Android trust policy, and apps with certificate pinning.
- Confirm no private CA key, token, or captured credential is emitted into logs, exports, crash reports, or bridge payloads.

### Exit criteria

TLS behavior is documented by platform/version, CA lifecycle has explicit failure states, and security-sensitive paths have regression tests or device test procedures.

## Workstream 3 — Interceptor/rule semantics

### Scope

`pkg/interceptor/*`, `internal/services/rules.go`, `app_rules.go`, Android `RulesEngine.kt`, and rules UI/sync.

### Tests and investigations

- Produce a priority/phase table for HostFilter, Hosts, throttle, block, mock/map, breakpoint, rewrite, script, crypto, and report interceptors.
- Verify filtered traffic is truly bypassed and that request/response mutations preserve body encoding, content length, headers, and status semantics.
- Test wildcard, regex, URL, malformed-regex, empty-rule, duplicate-ID, enabled/disabled, and precedence behavior.
- Test mock responses, redirects, body replacements, header add/remove, status overrides, crypto algorithms/padding/key sizes, script isolation/timeouts, reports, throttling, and breakpoint abort/resume/timeout/disconnect cleanup.
- Compare desktop and Android schemas; identify fields dropped or reinterpreted by `rules:sync`.
- Define explicit parity expectations instead of assuming Android supports every desktop rule.

### Exit criteria

Each rule type has a contract, test cases for normal/error/edge paths, persistence behavior, and a documented desktop/Android support status.

## Workstream 4 — Persistence, sessions, and exports

### Scope

`pkg/storage/*`, `app_sessions.go`, `internal/services/sessions.go`, mobile REST session endpoints, and export/import UI.

### Tests and investigations

- Verify SQLite schema, WAL settings, foreign-key behavior, transaction boundaries, concurrent writes, close/reopen recovery, and migration strategy.
- Test request-only rows, later response updates, errors, binary/compressed bodies, WebSocket/SSE data, large bodies, duplicate IDs, and session request counts/file sizes.
- Verify favorite migration when deleting sessions and behavior of the special `favorites` session ID.
- Test HAR 1.2, JSON, CSV, and cURL exports/imports for headers, cookies, timings, body encoding, malformed input, and empty input.
- Trace frontend drag/drop import versus backend import and identify inconsistent shapes.
- Investigate ignored save errors during import and event persistence; make failures visible and recoverable.

### Exit criteria

No accepted data-loss path remains silent; storage operations are tested under concurrency and partial failure; export formats have compatibility fixtures.

## Workstream 5 — Frontend state, API adapter, and UI contracts

### Scope

`frontend/src/App.tsx`, `store/apiAdapter.ts`, `store/useProxyStore.ts`, `store/useTrafficStore.ts`, types, and all major UI surfaces.

### Tests and investigations

- Build a Wails-versus-HTTP/WebSocket endpoint contract table, including method names, argument shapes, response shapes, event names, auth behavior, and reconnection.
- Resolve which traffic store is authoritative and test response/frame/SSE association, favorites, filtering, selection, max-request trimming, clear/delete, and breakpoints.
- Test browser/dev/mobile mode detection and WebSocket cleanup/reconnect behavior.
- Run strict TypeScript/build checks and manually test desktop/mobile responsive layouts, settings persistence, theme/i18n, logs, toolbox, composer/replay, HAR workflows, certificate UI, rules, and error states.
- Add frontend adapter contract tests and store transition tests before changing state behavior.

### Exit criteria

Wails and fallback modes behave consistently, state ownership is explicit, and core UI workflows have automated or repeatable manual coverage.

## Workstream 6 — Android VPN and standalone proxy

### Scope

`HttpeekVpnService.kt`, `MitmProxyServer.kt`, `DecompressUtils.kt`, `DynamicCertAuthority.kt`, `RulesEngine.kt`, app filter code, Android UI, and manifest/build configuration.

### Tests and investigations

- Test Android 10–14+ foreground service and notification requirements, VPN consent, process death, restart, orientation/state restoration, background restrictions, battery behavior, cleartext policy, package visibility, and app filtering.
- Test HTTP, HTTPS, bypassed hosts, pinning fallback, IPv4/IPv6, HTTP/2, keep-alive, chunked/unknown-length bodies, bodies over 10 MiB, binary/compressed responses, redirects, WebSockets/SSE, concurrent clients, and stop/restart.
- Verify Android socket protection prevents VPN recursion and does not accidentally bypass intended traffic.
- Compare Android proxy behavior to desktop and document unsupported or divergent protocol/rule semantics.
- Test dynamic CA loading/generation, cache growth, rotation, SANs, root/system installation, and rooted workflows.
- Replace silent catches only after reproducing their user impact; add observable failure states and diagnostics.

### Exit criteria

A device/emulator test matrix covers supported Android versions and identifies explicit limitations for unsupported traffic, trust models, and lifecycle cases.

## Workstream 7 — Pairing, bridge, discovery, and ADB

### Scope

`DesktopBridgeClient.kt`, pairing/history managers, `NsdDiscoveryManager.kt`, QR scanner/UI, `pkg/proxy/mobile_api.go`, `app_mobile.go`, and mobile sync UI.

### Tests and investigations

- Verify handshake identity, token propagation, WebSocket framing, event ordering, request/response queue bounds, failed flush retention, heartbeat, reconnect deduplication, and disconnect cleanup.
- Test `rules:sync`, remote VPN start/stop, traffic clear, and response ID matching.
- Test QR parsing, pairing history, UDP discovery binding/stale pruning, Wi-Fi isolation, firewall behavior, changed ports, and USB ADB reverse.
- Verify REST fallback and desktop API auth for all mutating endpoints.
- Test multiple devices, targeted versus broadcast commands, device replacement, and stale device cleanup.

### Exit criteria

Pairing is secure and recoverable, queue behavior is loss-aware, discovery is optional and bounded, and all supported desktop/mobile commands have contract tests.

## Workstream 8 — Compatibility and release engineering

### Compatibility matrix

Track at least:

- Go version and module/toolchain behavior.
- Wails CLI/runtime version and native WebView prerequisites.
- Node/npm, TypeScript, Vite, and lockfile behavior.
- Windows WebView2, macOS WebKit, Linux GTK/WebKit dependencies.
- Android JDK, Gradle, AGP, Kotlin, compile/target/min SDK, device API levels, and architectures.
- Runtime OS/software compatibility for Windows, macOS, Linux, Android, browser/dev fallback, Java keystores, ADB, and upstream proxy types.

### Tasks

- Reconcile README, CI, `go.mod`, Wails CLI pinning, frontend versions, and Android configuration.
- Verify Windows/macOS/Linux packaging, file associations, system proxy implementations, Java installation, ARM/amd64 scope, signing, notarization, and artifact naming.
- Replace debug Android release signing with a documented secure release process; validate versioning, minification/ProGuard, permissions, privacy/data-safety, and Play-distribution requirements.
- Add non-manual CI gates for Go tests/race/static checks, frontend build, Android lint/tests/build, and platform smoke tests.
- Keep machine-specific SDK paths out of portable project guidance.

### Exit criteria

Every claimed platform has a reproducible build and compatibility status, release artifacts are correctly signed/configured, and CI blocks regressions rather than only producing artifacts manually.

## Workstream 9 — Missing features and remaining work inventory

Use this table format for every validated item:

| ID | Area | Evidence | Severity | Reproduction | Platforms | Source references | Proposed change | Regression test | Acceptance criteria | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| AUD-001 | Example | Likely risk | High | Not started | Desktop/Android | File and lines | Define after reproduction | Define after reproduction | Define after reproduction | Open |

Candidate themes to validate, not automatically confirmed bugs:

- Desktop/Android rule and protocol parity.
- Streaming and backpressure support.
- Body-size limits and memory/disk strategy.
- Persistent session switching and capture lifecycle.
- Breakpoint timeout, disconnect, and queue cleanup.
- Auth/configuration UX for mobile REST/WS.
- CA lifecycle, trust-store UX, rotation, and pinning documentation.
- System proxy restoration after crashes and pre-existing configuration preservation.
- Automated frontend/Android coverage.
- Accessibility, localization, responsive behavior, and error-state UX.
- Observability, diagnostics, support bundles, and safe redaction.
- CI, signing, packaging, release channels, and documentation.

Do not promote a candidate to “confirmed bug” without source proof, a failing test, or a reproducible runtime result.

## Initial findings register

| ID | Finding | Evidence | Next validation |
|---|---|---|---|
| AUD-001 | README/CI use Go 1.22 while `go.mod` declares Go 1.25.0. | Confirmed/static | Run clean builds with both versions and choose/pin the supported version. |
| AUD-002 | CI is manually dispatched and lacks complete test/lint gates. | Confirmed/static | Add baseline test/build commands and decide required PR gates. |
| AUD-003 | Android release uses debug signing and lint is non-blocking. | Confirmed/static | Define secure release signing, run release build, and review artifact metadata. |
| AUD-004 | Android release references `proguard-rules.pro`, not present in the repository inventory. | Confirmed/static pending clean build | Run clean release build and determine whether the default/reference file is required. |
| AUD-005 | `android/local.properties` contains a machine-local SDK path. | Confirmed/static | Ensure setup docs use environment variables/Android Studio configuration instead. |
| AUD-006 | Desktop and Android use separate proxy/MITM and rule implementations. | Confirmed/static | Build a parity matrix and run the same protocol/rule fixtures against both. |
| AUD-007 | `useProxyStore` and `useTrafficStore` overlap in traffic state behavior. | Confirmed/static | Trace imports/usages, select an authority, and add state contract tests. |
| AUD-008 | Android contains multiple intentionally empty exception handlers in networking/lifecycle paths. | Confirmed/static | Reproduce failures on emulator/device and add safe diagnostics/recovery. |
| AUD-009 | Server restart/configuration replaces server objects and may affect listeners, bridge, discovery, and transport continuity. | Likely risk | Exercise start/stop/port/external-proxy changes and inspect event/device continuity. |
| AUD-010 | Partial startup failures may leave methods dependent on nil services/managers. | Likely risk | Simulate DB/CA failures and test every exposed operation/UI error path. |
| AUD-011 | Imported session save/response errors are ignored in service fallback paths. | Confirmed/static | Add malformed/constraint/storage-failure tests and define transactional behavior. |
| AUD-012 | Actual Android version/device, certificate pinning, QUIC/UDP, streaming, and release compatibility are unknown. | Open validation | Execute emulator/physical-device matrix and record supported limitations. |

## Definition of done for each issue

A work item is complete only when:

1. The behavior is reproduced or explicitly disproven.
2. The source-level cause and affected data flow are documented.
3. A minimal fix is implemented without weakening security or lifecycle cleanup.
4. A regression test or repeatable device/manual test exists.
5. Desktop, Android, fallback API, persistence, and UI consumers are checked where applicable.
6. Compatibility and migration implications are documented.
7. The issue row records evidence, status, and acceptance results.

## Deep-dive findings from source tracing

The following items were identified by tracing the implementation beyond the initial repository inventory. They remain evidence-tiered: confirmed/static means the code path is directly visible; impact and exact user-facing behavior should still be reproduced before fixing.

### Desktop proxy and protocol correctness

| ID | Finding | Evidence tier | Impact/risk | Recommended validation or fix |
|---|---|---|---|---|
| DEEP-001 | `pkg/proxy/handler.go` reads every request body with `io.ReadAll` and every non-SSE response body with `io.ReadAll` before applying storage limits. | Confirmed/static | A large or malicious request/response can exhaust memory and stall the proxy. | Add configurable request/response byte limits, streaming-to-disk, cancellation, and explicit truncation metadata. Test large, slow, compressed, and unknown-length bodies. |
| DEEP-002 | `ServerConfig.StorageDir` is not set when the desktop server is initialized in `app.go`, so `PrepareBodyForStorage` cannot spill large response bodies to disk in the normal desktop path. | Confirmed/static | The intended body-storage safeguard is inactive; captures remain memory-heavy. | Wire the application data directory into server config and add a body-store lifecycle/cleanup policy. |
| DEEP-003 | `forwardHTTPRequest` reads `resp.Body` but does not visibly close it after normal response processing. | Confirmed/static | Upstream connections may not be reused and resources can accumulate under sustained capture. | Add `defer resp.Body.Close()` immediately after a successful round trip and test connection reuse/leak behavior. |
| DEEP-004 | Request inspection stores decoded body bytes in `httpReq.Body`, then forwards those bytes while retaining the original `Content-Encoding` header. | Confirmed/static | Upstreams may attempt to decompress an already-decoded body, causing corrupted requests or 4xx/5xx responses. | Preserve raw and decoded representations separately; either re-encode mutations or remove/update `Content-Encoding` and `Content-Length` consistently. |
| DEEP-005 | Normal response framing uses `resp.Proto` for the client status line, even though the upstream transport may negotiate HTTP/2 while the client connection is HTTP/1.x. | Likely risk / protocol correctness | A raw client may receive an invalid `HTTP/2.0` text status line. | Use the client/request protocol for downstream framing and test HTTP/2 upstream to HTTP/1.1 client translation. |
| DEEP-006 | SOCKS5 sends a success reply before dialing the target; connection failure is only discovered afterward and is not returned as a SOCKS error. | Confirmed/static | SOCKS clients believe the connection succeeded and then hang or fail unclearly. | Dial first, map errors to RFC 1928 reply codes, and add IPv4/IPv6/domain/connection-failure tests. |
| DEEP-007 | SOCKS5 HTTPS inspection calls `h.server.CertManager().TLSConfig()` without the nil guard used by CONNECT handling. | Confirmed/static | SSL-enabled SOCKS traffic can panic when CA initialization failed. | Return a safe passthrough/error when the certificate manager is unavailable; test partial startup. |
| DEEP-008 | WebSocket frame parsing allocates based on an untrusted 63-bit payload length with no maximum, validates no RSV bits, and does not reassemble continuation frames. | Confirmed/static | Memory exhaustion, protocol confusion, and incomplete message inspection are possible. | Add maximum frame/message sizes, RFC validation, fragmentation reassembly, close/ping/pong handling, and bounded event payloads. |
| DEEP-009 | WebSocket upstream connections use direct `tls.Dial`/`net.DialTimeout` instead of the configured HTTP/upstream proxy transport. | Confirmed/static | WebSocket traffic can bypass configured upstream proxy routing and policy. | Implement a shared dialer/proxy path for WS/WSS and test chained HTTP/SOCKS5 upstreams. |
| DEEP-010 | SSE streaming writes chunked output but has no explicit terminal zero chunk and does not preserve all SSE semantics such as comments and event IDs as distinct model fields. | Likely risk | Clients may see malformed termination; inspection loses protocol information. | Add standards-compliant SSE framing, cancellation, terminal chunking, comment/retry/ID semantics, and stream-duration metrics. |
| DEEP-011 | CA serving through `serveCACertificate` dereferences the CA manager without a nil check, while startup explicitly permits CA initialization failure. | Confirmed/static | `/ssl` or `/ca.crt` can panic after CA startup failure. | Return a typed 404/503 response when CA is unavailable and test all CA endpoints in degraded startup. |
| DEEP-012 | Proxy transport globally uses `InsecureSkipVerify: true`. | Confirmed/static / security design decision | Upstream identity is never verified, which weakens protection against upstream interception and misconfiguration. | Add an explicit “trust upstream certificates” policy, safe default, diagnostics, and tests for valid/invalid upstream certificates. |
| DEEP-013 | The response body is decoded and rewritten but response metadata may retain stale content type/body-size semantics after interceptor mutation. | Likely risk | Clients and export/UI consumers can disagree with bytes actually delivered. | Centralize response normalization: encoding, content length, body size, content type, status, and transfer headers. |

### Mobile API, auth, and bridge

| ID | Finding | Evidence tier | Impact/risk | Recommended validation or fix |
|---|---|---|---|---|
| DEEP-014 | `sendJSONResponse` returns `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true`. | Confirmed/static | Browser clients reject this CORS combination; it also broadens the apparent API trust boundary. | Use one validated origin, omit credentials when wildcard is intended, and test browser preflight/auth flows. |
| DEEP-015 | Origin validation uses string prefixes for localhost/private addresses and accepts any `http://172.` origin rather than parsing and validating the host/IP range. | Confirmed/static security risk | A crafted hostname can pass prefix checks; private-range validation is broader than intended. | Parse origins with `net/url`, compare exact hosts, validate RFC1918 ranges, and add hostile-origin tests. |
| DEEP-016 | Mobile API auth is optional and all control endpoints are available when `HTTPEEK_API_TOKEN` is unset. | Confirmed/static / deployment risk | Any reachable LAN client may start/stop the proxy, change upstream settings, alter rules, read sessions, or send commands. | Add first-run pairing authentication, mandatory local/LAN policy, scoped tokens, token rotation/revocation, and safe defaults. |
| DEEP-017 | QR payloads generated by desktop do not include the configured API token, while Android bridge code does not propagate a pairing token in its WebSocket URL or HTTP batch requests. | Confirmed/static | Authenticated deployments cannot pair successfully through the advertised QR/bridge path. | Define a versioned pairing envelope containing token or one-time bootstrap credential, transport security, expiry, and rotation. Never place long-lived secrets in logs. |
| DEEP-018 | Mobile WebSocket parser converts 64-bit frame lengths into an `int` using only the low four bytes and has no payload-size limit. | Confirmed/static | Large frames can be misread, allocate unexpectedly, or desynchronize the connection. | Use checked `uint64` lengths, maximum limits, protocol validation, and close-code handling. |
| DEEP-019 | `notifyDeviceChangeLocked` iterates device maps without taking a read lock and is called after unlocking despite its name. | Likely race / concurrency defect | Concurrent connect/disconnect/device polling can race or panic. | Split locked snapshot from callback dispatch; run `go test -race` with concurrent device events. |
| DEEP-020 | Device identity changes from connection ID to Android ID after handshake, but the connection map remains keyed by connection ID and duplicate device identities are not resolved. | Confirmed/static | Targeted commands and UI lists can show duplicate/stale devices. | Model connection ID and stable device ID separately, deduplicate sessions, and define replacement behavior. |
| DEEP-021 | Android batch flush polls queues before confirming HTTP success; failed requests/responses are not restored. | Confirmed/static | Temporary network failure can silently lose captured traffic. | Use durable spool files or transactional queue ack/retry with backoff, max age, and user-visible loss metrics. |
| DEEP-022 | The bridge batch fallback uses `Build.MODEL` as `deviceId`, while the WebSocket handshake uses Android ID where available. | Confirmed/static | Desktop identity and packet attribution differ between online and fallback paths. | Persist and reuse one privacy-reviewed stable device identifier. |
| DEEP-023 | Desktop device polling calls `EventsOff('mobile:devices_changed')` without removing only its own callback. | Likely lifecycle defect | Multiple UI mounts/components can remove listeners belonging to other consumers. | Track callback handles and use scoped unsubscribe semantics. |

### Android proxy and VPN behavior

| ID | Finding | Evidence tier | Impact/risk | Recommended validation or fix |
|---|---|---|---|---|
| DEEP-024 | Android TLS interception fallback calls `forwardRawTunnel` after the failed MITM handshake even though a helper named `forwardRawTunnelWithReplay` exists. | Confirmed/static | ClientHello bytes consumed during the failed handshake are not replayed; certificate-pinned apps may lose connectivity instead of bypassing MITM. | Use a recording/replay fallback, test Chrome/social apps/pinned clients, and ensure no duplicate or corrupted TLS bytes. |
| DEEP-025 | Android request body parsing only reads `Content-Length`; chunked/streamed request bodies are not handled. | Confirmed/static | POST/PUT uploads using chunked transfer can be truncated or forwarded empty. | Implement bounded chunked decoding and streaming request forwarding. |
| DEEP-026 | Android rewrite rules compute `newBody` but `MitmProxyServer` forwards the original `bodyBytes`. | Confirmed/static | The UI can report a body rewrite while the upstream receives the original body. | Rebuild request bytes from the mutated model, normalize encoding/length, and add a body-rewrite integration test. |
| DEEP-027 | Android `RewriteRule.overrideStatusCode` is declared but not applied; response-stage rewrite behavior is absent compared with desktop. | Confirmed/static | Android rule UI/schema advertises capabilities that do not work. | Either implement response mutation or remove/mark unsupported fields and show parity status in UI. |
| DEEP-028 | Android throttle profiles expose bandwidth fields but the proxy only applies drop rate and fixed latency. | Confirmed/static | Users cannot actually simulate configured upload/download bandwidth. | Implement token-bucket shaping for both directions or label unsupported fields and validate effective throughput. |
| DEEP-029 | Android receives `remote:vpn_start` but the `HttpeekVpnService` command callback handles stop and clear only. | Confirmed/static | Desktop “start remotely” capability is a no-op. | Implement permission-aware remote start with explicit user consent/state and acknowledgement events. |
| DEEP-030 | Android VPN start errors stop the service but do not expose a structured failure state to the UI; several socket paths swallow exceptions. | Confirmed/static | Users see a generic/inaccurate state and cannot diagnose VPN, bind, CA, or network failures. | Add typed state/error events, actionable remediation, diagnostics export, and lifecycle tests. |
| DEEP-031 | Android service uses static global callbacks and singleton current instance references. | Likely lifecycle risk | Fragment recreation, process death, and stale callbacks can leak views or lose events. | Move to lifecycle-aware state/Flow or a repository, clear callbacks on teardown, and test rotation/process recreation. |
| DEEP-032 | `HttpeekVpnService` starts a local proxy on fixed port 9099 and routes Android HTTP proxy traffic there, while pairing uses the desktop proxy port separately. | Likely compatibility risk | Port conflicts, simultaneous standalone/desktop modes, or changed desktop ports can create ambiguous routing. | Make local and remote ports explicit, validate conflicts, and expose connection mode/status. |
| DEEP-033 | Android local proxy handles only one request body/response model and does not provide a durable capture store; traffic is held in fragment memory. | Confirmed/static | Rotation/process death loses traffic; long sessions can grow memory without a bound. | Add bounded repository storage, paging, optional SQLite export, and a clear retention policy. |
| DEEP-034 | Android manifest enables cleartext traffic, broad package visibility, backup, camera, and special-use foreground permissions. | Confirmed/static / release review | Privacy, Play policy, and attack-surface review may block release or expose unnecessary data. | Minimize permissions, use network security configuration, document legitimate use, disable/limit backup for sensitive captures, and complete Play policy review. |
| DEEP-035 | Android CA key is stored as a raw private-key file in app files and root CA generation catches errors without propagating failure. | Confirmed/static security/reliability risk | Key protection and initialization state are weakly defined; later TLS operations fail indirectly. | Protect key material with Android Keystore where possible, verify file permissions, propagate initialization errors, and add rotation/recovery tests. |
| DEEP-036 | Android desktop pairing history stores host/port/token metadata; token lifecycle and secure storage policy need explicit review. | Likely security risk | A stolen backup or device can expose desktop API access if long-lived tokens are stored unprotected. | Use encrypted preferences, short-lived pairing credentials, revocation, and a visible “forget/revoke device” action. |

### Frontend and product workflow issues

| ID | Finding | Evidence tier | Impact/risk | Recommended validation or fix |
|---|---|---|---|---|
| DEEP-037 | API adapter methods generally do not check `response.ok` or normalize error payloads before returning JSON/text. | Confirmed/static | HTTP 401/404/500 responses can be treated as successful empty data or confusing parse failures. | Add a shared typed fetch wrapper with status checks, request IDs, timeout/cancellation, auth refresh, and structured errors. |
| DEEP-038 | Wails and fallback API method signatures are not fully uniform; e.g. repeat, breakpoint, composer, and export methods have compatibility branches with different arguments/shapes. | Confirmed/static | Desktop and browser/mobile modes can behave differently or silently return empty values. | Generate/maintain an API contract schema and run adapter contract tests against a local fake server and Wails mocks. |
| DEEP-039 | `App.tsx` installs event listeners without a corresponding cleanup for each registered callback, while Wails `EventsOff` removes an event globally in the adapter. | Likely lifecycle defect | Hot reload, remounts, or multiple consumers can duplicate events or remove unrelated listeners. | Return unsubscribe functions from `api.on`, clean up every subscription, and make Wails off callback-scoped if supported. |
| DEEP-040 | Frontend memory cleanup keeps `requests.slice(0, keepCount)` while requests are newest-first, but the configured threshold/max count and favorites/persistence are not coordinated. | Likely data/UX defect | User-selected/older requests can disappear unexpectedly and backend session data can diverge from the visible list. | Define retention semantics, preserve selected/favorite items, expose dropped-count telemetry, and separate UI cache from durable capture. |
| DEEP-041 | Startup file detection only reports a file path to the UI; the observed path does not itself load/import the HAR or JSON. | Confirmed/static | File association/double-click workflow appears supported but may stop at a toast. | Complete startup import with validation, session creation, duplicate prevention, and error feedback. |
| DEEP-042 | Mobile/desktop dialogs contain hard-coded fallback IP `192.168.1.100` and pairing payloads omit authentication/security metadata. | Confirmed/static | Users can receive unusable QR codes and authenticated desktop deployments fail to pair. | Use actual discovery results only, show interface/IPv6 selection, add secure versioned pairing, and remove fake defaults. |
| DEEP-043 | Frontend stores API tokens in `localStorage` and WebSocket URLs, making them accessible to renderer JavaScript and potentially browser history/logging. | Confirmed/static security concern | XSS or accidental URL/log capture can expose control-plane credentials. | Prefer in-memory/session-scoped credentials, secure Wails/native storage, short-lived tokens, and redaction. |
| DEEP-044 | Frontend displays and exports sensitive headers/body content by default, including JWT decoding and cookies, without an explicit redaction/safe-share mode. | Confirmed/static product/security gap | HAR files, screenshots, logs, and copied values can leak credentials. | Add secret detection, masking, selective export, redacted HAR, and “never log sensitive values” enforcement. |
| DEEP-045 | Android and desktop traffic lists use different retention, favorite, session, and response-association behavior. | Confirmed/static | Users see inconsistent results depending on capture mode and may lose mobile history. | Define a unified exchange model and capability matrix; add parity fixtures and migration rules. |

## Prioritized remediation sequence

### Phase A — Safety and data integrity

1. Bound all desktop, mobile API, WebSocket, Android proxy, HAR, composer, and script-engine reads.
2. Fix response-body closure, storage-directory wiring, body spill permissions, cleanup, and durable capture retention.
3. Fix Android failed-MITM replay, chunked request handling, body rewrite forwarding, and remote VPN start.
4. Fix SOCKS5 success-before-dial and nil-CA panic paths.
5. Add typed errors, cancellation, timeouts, and status handling across desktop/mobile APIs.

### Phase B — Control-plane security

1. Design versioned pairing with short-lived credentials and explicit device revocation.
2. Make control-plane auth mandatory or require an explicit local-only mode with warnings.
3. Correct CORS/origin parsing and remove wildcard-plus-credentials responses.
4. Remove token exposure from URLs/localStorage where feasible and redact logs/exports/UI sharing.
5. Review Android permissions, backup, cleartext, package visibility, CA key protection, and release signing.

### Phase C — Protocol and platform correctness

1. Add HTTP framing translation, request/response encoding normalization, stream cancellation, SSE standards behavior, and WS RFC validation.
2. Add upstream proxy support for WS/WSS and explicit certificate verification policy.
3. Implement Android bandwidth shaping, response-stage rules, HTTP chunked support, and bounded/paged traffic storage.
4. Stabilize lifecycle state across Wails remounts, Android rotation, process death, proxy restarts, and reconnects.

### Phase D — Product completeness and usability

1. Complete startup file import and persistent session switching.
2. Add unified desktop/Android capability and limitation reporting.
3. Add safe HAR/export redaction, request replay profiles, environment variables, and secret detection.
4. Add diagnostics/support bundle generation with redaction, health checks, and “test connection” workflows.
5. Add accessibility, keyboard navigation, localization completeness, and reliable empty/error/offline states.

## New feature and capability suggestions

These are proposals, not claims that the current product must implement all of them.

### Capture and analysis

- **Durable capture profiles:** per-profile body limits, disk spill, retention duration, excluded hosts, binary handling, and redaction rules.
- **Streaming exchange inspector:** incremental headers/body/frame views without waiting for full responses.
- **Timeline and waterfall view:** DNS/connect/TLS/TTFB/download timing with comparison across requests.
- **Request dependency graph:** identify redirects, API chains, initiator relationships, and repeated calls.
- **Advanced filters:** HTTP status classes, body size, duration, protocol, app/package, rule hits, headers, body regex, and time ranges.
- **Diff and replay sets:** compare two sessions, replay a selected collection with concurrency/rate limits, and export deterministic fixtures.
- **HAR redaction profiles:** redact cookies, authorization, JWTs, API keys, PII, and custom headers before export/share.
- **OpenTelemetry/trace correlation:** capture traceparent/span IDs and export timing metadata without collecting secrets.

### Rule and automation capabilities

- **Unified rule DSL:** one versioned schema translated to desktop and Android capabilities with validation and explicit unsupported-field warnings.
- **Rule simulation mode:** run a request fixture through the chain and show each match, mutation, priority, and final output without network access.
- **Rule versioning/rollback:** snapshots, diff, import/export, and safe rollback after a bad rule set.
- **Script sandbox controls:** execution timeout, memory/instruction budget, disabled network/filesystem by default, and per-script permissions.
- **Conditional rules:** method/status/header/body predicates, request counters, environment variables, and response-time conditions.
- **Webhook delivery controls:** queueing, retries, signing, dead-letter state, redaction, and per-destination health.

### Android capabilities

- **Foreground capture dashboard:** service health, VPN permission, CA trust status, battery restrictions, queue depth, dropped packets, and desktop latency.
- **Per-app capture profiles:** saved app groups, include/exclude precedence, quick switching, and package metadata refresh.
- **Android durable history:** paged SQLite storage with retention controls and process-death recovery.
- **QUIC/HTTP/3 visibility policy:** detect unsupported UDP/QUIC traffic and clearly show bypassed/uninspectable traffic rather than silently omitting it.
- **Device fleet management:** multiple paired desktops, trust/revoke controls, last-seen diagnostics, and per-device rule/capture policies.
- **Secure root/user CA assistant:** explain user CA limitations, pinning, rooted installation, Android version behavior, and verification checks.
- **Offline-first bridge spool:** encrypted, bounded, resumable local queue with acknowledgements and user-visible dropped-data reporting.

### Desktop operations and integration

- **Proxy health center:** port availability, CA health, system-proxy ownership, upstream connectivity, DNS, WebView, ADB, and mobile bridge checks.
- **Safe system proxy transactions:** snapshot prior settings, apply changes atomically, restore only owned settings, and expose recovery if the app crashes.
- **Multi-profile environments:** named proxy/rule/CA/capture profiles for projects and teams, with encrypted secret storage.
- **Team collaboration:** share sanitized sessions/rules, signed rule bundles, and reviewable change history without exporting private keys.
- **CLI/headless mode:** start proxy, load rules, capture to HAR/SQLite, run replay suites, and integrate into CI without Wails UI.
- **Plugin/extension API:** versioned event and rule hooks with capability permissions, sandboxing, and compatibility negotiation.

## New test infrastructure suggestions

- Golden fixtures for HTTP, HTTPS, chunked, compressed, binary, HTTP/2, WS fragmentation, SSE, SOCKS5, and malformed traffic.
- Contract tests for every Wails method versus HTTP fallback endpoint.
- Android emulator matrix across API 24, 28, 29, 30, 33, and 34 plus at least one physical non-rooted and rooted device where available.
- Network fault injection for latency, packet loss, disconnects, captive portals, DNS failures, firewall isolation, and desktop restart.
- Fuzz tests for HTTP headers, proxy requests, HAR imports, WebSocket frames, pairing payloads, rule regexes, and JSON API bodies.
- Race/leak tests for server restart, mobile connect/disconnect, event subscriptions, breakpoint queues, and storage writes.
- Security tests for origin spoofing, missing/invalid/expired tokens, replayed pairing credentials, secret redaction, path traversal, oversized payloads, and unauthorized control endpoints.
- Release smoke tests that install/upgrade/uninstall desktop artifacts and Android APKs, validate CA cleanup, preserve sessions, and verify signed artifacts.

## Documentation and support improvements

- Publish a support matrix that distinguishes “captured,” “tunneled,” “decoded,” “modified,” and “not supported” traffic.
- Add troubleshooting guides for CA trust, certificate pinning, Android user/system CA behavior, VPN permission, QUIC, WebView prerequisites, Linux packages, ADB, and firewall/Wi-Fi isolation.
- Document data locations, retention, body spill cleanup, export redaction, and how to recover the system proxy after abnormal termination.
- Add an API/bridge protocol version document with message schemas, compatibility rules, error codes, authentication, and migration policy.
- Add a threat model covering local attackers, LAN attackers, malicious captured content, scripts, CA private keys, pairing credentials, and exported sessions.
- Add release notes and deprecation policy for rule fields, API endpoints, generated bindings, Android versions, and artifact formats.

## Phase A implementation status

The first execution slice has been applied without committing changes:

### Completed in this slice

- Added configurable desktop request/response body limits to `ServerConfig`, defaulting to 16 MiB each.
- Added bounded desktop body reads with 413 request-limit and 502 response-limit handling.
- Wired the desktop application data directory into server configuration so large response bodies can use the existing spill-to-disk path.
- Closed normal upstream response bodies after round trips.
- Removed stale request representation headers before forwarding decoded/intercepted request bodies.
- Corrected internal API routing so proxied application URLs such as `/api/v1/test` are not mistaken for HTTPeek control endpoints.
- Corrected downstream response status-line protocol selection to use the client request protocol rather than upstream transport protocol.
- Added SOCKS5 target dialing before success response and connection-failure reporting; added nil certificate-manager safety for SOCKS5 TLS inspection.
- Added Go regression tests for body limits, default limits, normal `/api/*` interception, and SOCKS5 connection failure behavior.
- Fixed Android request-body rewrite forwarding so a changed rewrite body is sent upstream.
- Added Android response rewrite handling for headers, body replacement, and status-code overrides.
- Implemented handling for the Android `remote:vpn_start` command.

### Baseline results

- `go test ./...`: **passed**.
- `go test ./pkg/proxy`: **passed**.
- `npm run build` from `frontend`: **passed**; Vite reports a large JavaScript chunk warning.
- `android\\gradlew.bat assembleDebug --stacktrace`: **passed** after Gradle used the Kotlin compiler fallback because the Kotlin daemon could not be contacted.
- `go test -race ./pkg/proxy`: **passed** after making logger initialization access use `sync.Once` consistently.
- `go test -race ./...`: **passed**.

### Remaining Phase A work

- Android TLS failed-MITM replay still requires a raw-byte recording design that accounts for bytes buffered by the HTTP reader; the existing replay helper is not yet wired because a partial implementation could corrupt pinned-app TLS.
- Android chunked request-body streaming and bounded Android body handling remain open.
- Desktop WebSocket frame limits, mobile API frame limits, CORS/auth, queue durability, and frontend error normalization remain open for later slices.

### Resolved validation item

| ID | Finding | Evidence | Resolution/next validation |
|---|---|---|---|
| DEEP-046 | `go test -race ./pkg/proxy` reported a data race between logger initialization in `logger.GetLogger.Init.func1` and discovery broadcaster logging from `pkg/proxy/discovery.go`. | Confirmed by race detector | Resolved by routing `GetLogger` through `sync.Once`; `go test -race ./...` now passes. Retain concurrent server-start/discovery coverage. |

## Phase B implementation status

The control-plane security slice has been applied without committing changes:

### Completed in this slice

- Replaced prefix-based Origin checks with parsed scheme/host/IP validation for localhost and RFC1918 IPv4 ranges.
- Removed wildcard-plus-credentials CORS behavior from mobile API responses.
- Added a desktop Wails method for retrieving the configured API token when generating pairing data.
- Added configured-token propagation to desktop pairing QR payloads and mobile sync payloads.
- Added Android bridge token propagation to WebSocket query authentication, REST batch synchronization headers, and connection testing.
- Added Android VPN intent token propagation through the pairing/session startup path.
- Prevented pairing history from persisting tokens in plaintext; saved history now retains host/port only, requiring a new secure pairing flow after restart.
- Added origin validation regression tests for trusted local origins and hostile lookalike origins.

### Security limitations retained intentionally

- `HTTPEEK_API_TOKEN` remains optional for backward compatibility; an explicit authenticated/LAN deployment mode and short-lived pairing credentials are still required before treating the control plane as secure by default.
- The current QR flow carries a configured token when present, so QR display/sharing must be treated as credential exposure. The next security slice should replace this with expiring one-time pairing credentials.
- Frontend fallback mode still reads tokens from `localStorage`; native secure storage and in-memory/session-scoped token handling remain open.
- Android history no longer persists tokens, but the active token remains in process memory and is passed through the VPN intent/bridge lifecycle.

### Verification

- `go test ./pkg/proxy`: **passed** with origin validation coverage.
- `go test -race ./...`: **passed**.
- `npm run build`: **passed**; Vite reports the existing large JavaScript chunk warning.
- `android\\gradlew.bat assembleDebug --stacktrace`: **passed**; Kotlin emits existing parameter/deprecation warnings.

## Connected app visibility and feature-improvement status

The desktop Connected section issue was traced to the internal request classifier. Android connects to a LAN desktop address such as `192.168.1.x:9099`, but the classifier only accepted loopback/localhost hostnames after the earlier `/api/*` routing fix. As a result, the Android `/ws/events` handshake could be routed as ordinary proxy traffic and never register in `MobileAPIManager`.

### Completed

- LAN requests addressed to the proxy listener port are recognized as internal mobile/API traffic without restoring the original bug that treated every proxied `/api/*` URL as an internal endpoint.
- Added a regression test proving a LAN pairing WebSocket host is recognized.
- Refactored mobile device-change notifications to snapshot device state under a read lock before invoking UI callbacks.
- Added a device snapshot regression test.
- Preserved the existing Wails `mobile:devices_changed` event and desktop polling fallback, so the Connected tab receives updates through both paths.

### Verification for connected devices

- `go test ./pkg/proxy`: **passed**.
- `go test -race ./pkg/proxy`: **passed**.
- The next manual acceptance test is: start desktop proxy, pair Android over LAN, start Android VPN, and confirm the device appears under Desktop → Connected without waiting for a page reload.

### Feature and function improvement backlog

These items are deliberately product-focused and exclude security/audit work:

- **Connection health panel:** show connected, reconnecting, last heartbeat, latency, queue depth, packets sent, packets dropped, and last error.
- **Explicit pairing states:** distinguish discovered, testing, paired, bridge-connected, VPN-active, and stale-device states.
- **Connected-device refresh controls:** add refresh, reconnect, forget device, and copy diagnostic details actions.
- **Mobile traffic synchronization:** display whether request/response streams are live, queued, or delayed; allow manual flush and pause/resume.
- **Device detail view:** show Android version, app version, root status, capture mode, selected-app filter, local proxy port, desktop target, and supported capabilities.
- **Cross-platform capability badges:** indicate support for rewrite, mock, breakpoints, throttling, WebSocket, SSE, HAR, and response mutation on each connected device.
- **Desktop/Android session continuity:** preserve mobile captures when the UI rotates, the bridge reconnects, or the desktop proxy restarts.
- **Unified traffic search:** filter mobile and desktop requests by host, method, status, package/app, body type, latency, rule hit, and connection source.
- **Feature parity fixtures:** run the same request/rule examples against desktop and Android and show differences in the UI.
- **Connection diagnostics wizard:** test LAN reachability, proxy port, WebSocket handshake, heartbeat, CA availability, VPN state, and response synchronization step by step.
- **Mobile profile presets:** save per-device app filters, rules, throttling profiles, capture limits, and preferred desktop targets.
- **Offline capture timeline:** show exactly when traffic was captured locally, queued, uploaded, acknowledged, or dropped after reconnect.
- **Persistent mobile history:** add paged local Android history with retention controls instead of keeping the entire list in a Fragment-owned memory collection.
- **Remote action acknowledgements:** show success/failure results for remote VPN start/stop, clear traffic, rule sync, and reconnect commands.
- **Startup/import completion:** make desktop startup-file handling actually load HAR/JSON files into a session rather than only displaying a notification.
- **Request replay improvements:** add named replay profiles, concurrency, delay, environment selection, and result comparison.
- **Streaming inspector:** render incremental response bodies, SSE events, and WebSocket frames without waiting for full exchanges.
- **Proxy health center:** expose port binding, upstream reachability, CA status, body limits, storage usage, and active client counts.
- **Accessible responsive UI:** keyboard navigation, screen-reader labels, high-contrast states, consistent loading/error/empty states, and better small-screen layouts.

## Final audit deliverables

- Architecture and data-flow guide in `AGENTS.md`.
- This roadmap with updated evidence, deep-dive findings, feature proposals, and issue rows.
- Desktop protocol/TLS/interceptor/storage test report.
- Android emulator/device compatibility report.
- Desktop/Android feature-parity matrix.
- Runtime/software compatibility matrix.
- Control-plane security and threat-model report.
- CI and release-readiness gap report.
- Prioritized implementation backlog with regression coverage and acceptance criteria.

---

# Consolidated implementation megaplan — 2026-08 refresh

This section supersedes the older Phase A–D remediation sequence as the executable plan. It was produced by a full working-tree audit (proxy core, mobile API/bridge, interceptor/script engine, storage, cert/system, frontend, Android core, Android build) and re-verifies every prior finding against the current uncommitted changes.

## 1. Current-state verification matrix (DEEP-001…046)

Status legend: ✅ FIXED in working tree · ⚠️ PARTIAL · ❌ STILL VALID · 🔄 SUPERSEDED (merged into a new finding).

| ID | Status | Note |
|---|---|---|
| DEEP-001 | ✅ | Body limits enforced in `handler.go` before reads (413/502). Defensive `readLimitedBody(limit<=0)` path remains. |
| DEEP-002 | ✅ | `cfg.StorageDir = a.dataDir` wired in `app.go`/`app_proxy.go`. |
| DEEP-003 | ✅ | `defer resp.Body.Close()` present (`handler.go:431`). |
| DEEP-004 | ✅ | Content-Encoding/Content-Length/Transfer-Encoding removed before forwarding decoded body. |
| DEEP-005 | ⚠️ | Normal response status line fixed; **SSE path still writes `resp.Proto`** (`sse.go:22`) and HTTP/2 client negotiation is still unsupported. |
| DEEP-006 | ✅ | SOCKS5 dials before success reply; 0x04 on failure. |
| DEEP-007 | ✅ | Nil guard added for SOCKS5 CertManager. |
| DEEP-008 | ❌ | WS frames: no payload bound (up to 2^63-1 allocation), no RSV validation, no fragmentation reassembly (`ws.go:191-224`). |
| DEEP-009 | ❌ | WS upstream uses direct `tls.Dial`/`net.DialTimeout`, bypassing configured upstream proxy (`ws.go:61-67`). |
| DEEP-010 | ❌ | SSE: no terminal zero chunk, status line uses upstream proto, `id:`/comment/retry semantics incomplete (`sse.go`). |
| DEEP-011 | ❌ | `serveCACertificate` still dereferences `CertManager().CA()` without nil guard (`handler.go:585`); server can be created with nil certMgr (`app.go:151`). |
| DEEP-012 | ❌ | Global `InsecureSkipVerify: true` in transport and WS dial. By design for MITM; needs explicit policy + diagnostics. |
| DEEP-013 | ❌ | `BodySize`/content-type stale after interceptor mutation; Content-Length is recalculated but other metadata is not. |
| DEEP-014 | ✅ | Wildcard CORS without credentials. Wildcard origin still incompatible with token preflight; see IMP-01. |
| DEEP-015 | ✅ | `isLocalOrigin` now parses IPs and validates RFC1918 ranges with hostile-origin tests. |
| DEEP-016 | ❌ | Auth optional when `HTTPEEK_API_TOKEN` unset; all control endpoints reachable on LAN. |
| DEEP-017 | ⚠️ | Token now propagated into QR and bridge headers/query, but QR displays a long-lived token as plaintext and history strips it — pairing after restart requires full re-scan. Needs expiring one-time credentials. |
| DEEP-018 | ❌ | Mobile WS 64-bit length truncated to low 32 bits, no payload limit (`mobile_api.go:931`). |
| DEEP-019 | ✅ | Device-change notification snapshots under read lock. |
| DEEP-020 | ❌ | Devices keyed by connection ID while identity becomes Android ID; duplicates/stale entries unresolved. |
| DEEP-021 | ❌ | Android batch flush drops polled items on HTTP failure; no requeue/retry. |
| DEEP-022 | ❌ | Batch fallback uses `Build.MODEL`; WS handshake uses Android ID. |
| DEEP-023 | ❌ | `EventsOff('mobile:devices_changed')` removes all listeners (frontend `apiAdapter.ts:95`, `DesktopHome.tsx:121`). |
| DEEP-024 | ❌ | Android failed-MITM calls `forwardRawTunnel`; `forwardRawTunnelWithReplay` exists but is unused (`MitmProxyServer.kt:227-232`). |
| DEEP-025 | ❌ | Android reads only `Content-Length` bodies; no chunked decoding. |
| DEEP-026 | ✅ | Rewritten body now forwarded upstream (`MitmProxyServer.kt:358-362`). |
| DEEP-027 | ✅ | Response status/headers/body rewrite applied (`RulesEngine.kt:238-244`). |
| DEEP-028 | ❌ | Throttle bandwidth fields (kbpsDown/kbpsUp) ignored; only drop rate + latency applied. |
| DEEP-029 | ✅ | `remote:vpn_start` handled (`HttpeekVpnService.kt:125-127`). |
| DEEP-030 | ❌ | VPN start errors stop the service with no structured failure state to UI. |
| DEEP-031 | ❌ | Static companion callbacks + singleton service state; rotation/process-death unsafe. |
| DEEP-032 | ❌ | Android local proxy fixed at 9099, same as desktop default; no conflict handling. |
| DEEP-033 | ❌ | Android traffic held in Fragment memory; no durable store. |
| DEEP-034 | ❌ | Manifest: cleartext global, QUERY_ALL_PACKAGES, allowBackup, CAMERA, special-use foreground. |
| DEEP-035 | ❌ | Android CA key raw file, weak permissions, swallowed init errors. |
| DEEP-036 | ✅ | History no longer persists tokens (host/port only). Active token still in memory/intents. |
| DEEP-037 | ❌ | Adapter never checks `res.ok`; no error normalization. |
| DEEP-038 | ❌ | Wails vs HTTP fallback signatures still diverge (breakpoint, start, toolbox). |
| DEEP-039 | ❌ | `App.tsx` registers 7 event listeners with no cleanup; Wails `EventsOff` is global. |
| DEEP-040 | ❌ | Retention `slice(0, keepCount)` keeps newest-first; favorites/persistence uncoordinated. |
| DEEP-041 | ❌ | Startup file detection only toasts the path; never loads HAR/JSON. |
| DEEP-042 | ❌ | `192.168.1.100` hardcoded in PhoneConnectDialog/RulesModal/Toolbox/MobileCertDialog. |
| DEEP-043 | ❌ | Tokens in `localStorage` and WS query strings. |
| DEEP-044 | ❌ | No redaction mode for UI/export; JWTs auto-decoded. |
| DEEP-045 | ❌ | Desktop vs Android retention/session behavior differs; no parity contract. |
| AUD-003/004/005 | ❌ | Debug signing, missing `proguard-rules.pro`, machine-local `local.properties` not gitignored. |
| DEEP-046 | ✅ | Logger race resolved via `sync.Once`; `go test -race ./...` passes. |

## 2. New findings register (2026-08 audit)

New IDs by subsystem. Every row is verified against the working tree; severity is impact-based.

### 2.1 Proxy core (NEWP)

| ID | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| NEWP-000 | **CRITICAL** | **`passthroughTunnelWithRemote` panics on every tunnel**: `bufferPool.Get().([]byte)` asserts a `*[]byte` pool value to `[]byte`. Any filtered host, SSL-off CONNECT, no-CA mode, or SOCKS5 tunnel crashes the process. No test covers this path. | `handler.go:611,617`; `buffer_pool.go:11-14` | Use `GetBuffer()`/`CopyBuffer()` or `.(*[]byte)` + deref. Add CONNECT-passthrough + SOCKS5-tunnel integration tests. |
| NEWP-001 | Critical | SOCKS5 domain length byte used to allocate with no max (255-byte worst case is bounded but unvalidated; combined with per-conn goroutines it is a trivial amplification). | `socks5.go:70-74` | Enforce ≤253, reject with 0x08. |
| NEWP-002 | Critical | WS frame payload `make([]byte, payloadLen)` unbounded (63-bit). | `ws.go:224` | Max frame/message size + close code 1009. |
| NEWP-003 | Critical | Mobile API WS same unbounded allocation. | `mobile_api.go:942` | Shared frame-size limit. |
| NEWP-010 | High | `ReadTimeout`/`WriteTimeout` config never applied; no deadlines anywhere → slowloris/hung conns. | `server.go:21-22` (declared, unused) | Apply deadlines per phase; idle timeout on keep-alive loops. |
| NEWP-014 | Medium | No max-connection limit; unbounded goroutines per conn. | `server.go:272` | `MaxConnections` + active-conn tracking + 503 on excess. |
| NEWP-015 | Medium | Spill files (`bodies/*.bin`) never cleaned; written 0644. | `body_store.go:21-24` | 0600 + delete-on-session-delete + orphan sweep. |
| NEWP-006/007 | High | Bidirectional copy goroutines: only first error awaited; second goroutine can leak. | `handler.go:606-624`, `ws.go:175-187` | Context cancellation; close both conns on first error. |
| NEWP-008 | Medium | Discovery broadcaster Start/Stop races on stopCh recreation. | `discovery.go:42-64` | WaitGroup/lifecycle mutex. |
| NEWP-012/013/018 | Medium | No CONNECT authority / absolute-path / IPv6 validation. | `handler.go:166-171,129` | Validate authority with `net.SplitHostPort`+`net.ParseIP`/hostname rules. |
| NEWP-016 | High | 20+ mobile REST endpoints `io.ReadAll` unbounded. | `mobile_api.go` (many) | Shared `readJSONBody` with limit. |
| NEWP-017 | Low | HTTP/1.0 keep-alive semantics not honored (always sets `Connection: keep-alive`). | `handler.go:545` | Honor client proto/close. |
| NEWP-021/022 | Medium | `DecodeBody` unbounded decompression (zip-bomb) and no zstd; silent decode failure. | `decode.go:28-54` | Decompressed-size cap; zstd; decode-status flag. |
| NEWP-024 | Low | WS RSV bits ignored (RFC 6455 violation). | `ws.go:198` | Reject RSV≠0. |
| NEWP-025 | Low | No request-ID correlation across hops. | `types.go:76-77` | X-Request-ID propagation. |
| NEWH-01 | High | **Upstream `Host` header loses non-default port**: `outReq.Host` falls back to `HostPort.Host` (no port) because Go stores Host outside `Header`. Vhosts on `:8080`-style ports break. | `handler.go:414-417` | Preserve original authority; use `HostPort.String()` when port ≠ 80/443. |
| NEWH-02 | High | `SetSSLEnabled` mutates a copy of config and discards it — the toggle is a no-op. | `app_proxy.go:188-197` | Apply to server config + restart if running. |
| NEWH-03 | High | `StopProxy` unconditionally disables the OS system proxy, clobbering pre-existing user proxy settings. | `app_proxy.go:113` | Snapshot prior settings; only restore owned changes (see NEWT-026). |
| NEWH-04 | Medium | CONNECT TLS MITM uses raw `clientConn`, discarding any ClientHello bytes buffered by `bufio.Reader`; SOCKS5 already solves this with `bufferedConn`. | `handler.go:216`; `socks5.go:134-148` | Wrap CONNECT in `bufferedConn`. |
| NEWH-05 | Medium | Plain-HTTP (`ws://`) upgrades are forwarded through `http.Transport`, which rejects 101 → WS over non-TLS proxy is broken; only the decrypted-TLS path handles upgrades. | `handler.go:147-162`; `ws.go:47` | Detect `Upgrade: websocket` in HTTP path and route to `handleWebSocketUpgrade`. |
| NEWH-06 | Low | `SetExternalProxy` restarts the server even when it was stopped (starts capture unintentionally) and ignores restart failure (leaves server dead). | `app_proxy.go:227-238` | Only restart when running; surface failures. |

### 2.2 Mobile API / bridge (NEWM)

| ID | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| NEWM-001/005 | High | Unbounded REST bodies and unlimited `/api/mobile/sync` batch size. | `mobile_api.go:317…824, 794-818` | Limits on body size, item count, total payload. |
| NEWM-002 | Medium | CA endpoints (`/ca.crt`, `/ssl`, `/api/ca/cert`) served without auth. | `mobile_api.go:199-217`, `handler.go:141-144` | Optional token-gated CA download (one-time URL). |
| NEWM-003 | Medium | Internal classifier treats any request whose Host port equals the listener port as internal → LAN host-header spoofing reaches control plane. | `handler.go:92-120` | Require localhost host OR authenticated device registry; never port-only. |
| NEWM-004 | Medium | `/api/proxy/external` accepts arbitrary host/protocol → SSRF/misconfiguration. | `mobile_api.go:422-446` | Allowlist protocols; validate host; no private-IP upstreams unless user-confirmed. |
| NEWM-006 | Medium | `/api/rules/*` and `rules:sync` unmarshal without schema validation; script rules carry arbitrary code. | `mobile_api.go:631-643` | Versioned rule schema + per-kind validation. |
| NEWM-007 | Medium | Session IDs from paths unvalidated (semantic traversal). | `mobile_api.go:479-505` | UUID/format check. |
| NEWM-008 | Medium | WS upgrade lacks Origin validation (CSRF-style hijack when token present). | `mobile_api.go:220-227` | `isLocalOrigin` on WS too. |
| NEWM-009 | Low | Token in WS query string (logs/history). | `mobile_api.go:250`, `apiAdapter.ts:42` | Header-based token; one-time bootstrap. |
| NEWM-010 | Low | Heartbeats recorded but never enforced; stale devices linger. | `mobile_api.go:1009-1021` | Sweeper goroutine + disconnect. |
| NEWM-011 | Medium | `BroadcastEvent` writes synchronously to every WS conn; one slow client blocks all. | `mobile_api.go:138-158` | Per-conn bounded queues + write timeouts. |
| NEWM-012 | Low | `/api/logs` accepts arbitrary level/category/message → log injection. | `mobile_api.go:765-789` | Allowlist + length caps. |
| NEWM-013 | Medium | No rate limiting anywhere; no auth-failure throttling. | all endpoints | Per-IP limiter; auth backoff. |
| NEWM-014 | Medium | Composer endpoint is an open HTTP forwarder (SSRF). | `mobile_api.go:310-348` | Deny private/loopback targets by default; user override. |
| NEWM-015 | Medium | Android bridge queue: soft limit 500, no byte budget, possible overflow. | `DesktopBridgeClient.kt:45-46,176-195` | Hard cap + byte budget + drop/retain policy. |
| NEWM-016 | Low | Inconsistent error envelopes; raw `err.Error()` may leak internals. | `mobile_api.go` | Typed error codes + sanitized messages. |

### 2.3 Interceptor / script engine (NEWI)

| ID | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| NEWI-001 | High | First interceptor error aborts the whole chain phase (one bad rule disables all rules). | `chain.go:165-166,184-185,208-209,230-231` | Continue-on-error policy with per-rule error events; aggregate. |
| NEWI-002 | Medium | No rule-ID uniqueness/empty-ID validation. | `hosts.go:60-74`, `block.go:74-82` | Validate on Set; generate UUIDs on import. |
| NEWI-003 | Medium | `SavedRulesConfig` has no version field; no migration. | `internal/services/rules.go:13-24` | Versioned schema + migrations. |
| NEWI-004/053/054 | High | `rules.json` written non-atomically (`os.WriteFile`); corrupt file silently ignored on load. | `internal/services/rules.go:52-71` | Temp+rename, backup, recovery UI. |
| NEWI-007/012/030 | High | Regex compile errors silently ignored in hosts/filter/rewrite → rules silently dead. | `hosts.go:64-71`, `filter.go:135-144`, `rewrite.go:156-160` | Validate at Set time; surface errors to UI. |
| NEWI-009 | Medium | Host matching ignores port. | `hosts.go:87-110` | Optional port matcher. |
| NEWI-011 | High | Filtered traffic is captured-skipped but still runs throttle/other OnRequest interceptors; "filtered" is not end-to-end bypass. | `handler.go:340`, `filter.go:44-71` | Bypass decision at chain entry. |
| NEWI-015 | Medium | `BlockAction(string(rune(StatusCode)))` panics/garble for multi-digit status. | `block.go:45-47` | `strconv.Itoa`. |
| NEWI-021/022/023 | High | Breakpoint channels can block resume (buffered-1 send before wait), paused items never cleaned on disconnect, unbounded maps. | `breakpoint.go:82-97,234-292` | Non-blocking send, ctx-cancel cleanup, max paused, configurable timeout. |
| NEWI-026/027 | Medium | Rewrite header ops case-sensitive; Go `$1` vs JS `${1}` confusion undocumented. | `rewrite.go:273-334` | CanonicalHeaderKey; docs. |
| NEWI-031/032 | High | Crypto: AES key sizes unvalidated; PKCS7 unpad panics on bad padding. | `crypto.go:188-194,243-258` | Validate; bounds-checked unpad. |
| NEWI-036/037 | Medium | Throttle uses `time.Sleep`/`WaitN` ignoring ctx cancellation. | `throttle.go:232-238,271` | ctx-aware select. |
| NEWI-040/041/042 | Critical/High | Scripts have network access (`httpFetch`) by default, no memory/call-stack budget, shared session map across scripts. | `scriptengine/engine.go:172-199`, `script.go:25,81,105` | Opt-in network, memory budget, per-script namespaces. |
| NEWI-043 | Medium | Shared session map leaks data between scripts. | `script.go:25` | Namespace by script ID. |
| NEWI-046/047 | Medium | Goja `Interrupt` via `time.AfterFunc` panic safety; session map replaced wholesale (lost concurrent writes). | `scriptengine/engine.go:249-252,266-272` | recover wrapper; merge semantics. |
| NEWI-050/051 | Medium | Report webhook sends full headers/bodies with no redaction; failures ignored silently. | `report.go:85-122` | Redaction profiles; retry/queue; visible errors. |

### 2.4 Storage / sessions (NEWS)

| ID | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| NEWS-001 | High | `PRAGMA foreign_keys=ON` never set — FK/cascade guarantees are inert. | `db.go:27` | Set pragma + test cascade. |
| NEWS-002 | Medium | No schema versioning/migrations. | `db.go:44-94` | `schema_version` + migration runner. |
| NEWS-003 | Medium | Missing composite indexes → slow large sessions. | `db.go:77-80` | Indexes (session_id,status),(session_id,host),(session_id,start_time). |
| NEWS-008 | Medium | `file_size` never updated (always 0). | `session_repo.go:112` | Track on save. |
| NEWS-009/036/037/038 | High | SaveRequest/SaveResponse/DeleteSession not transactional; error paths leave orphans/count drift. | `session_repo.go:55-184` | Transactions + rollback. |
| NEWS-016/017/018/019/020/021 | High | JSON marshal/unmarshal and DB errors ignored across repo, app listener, HAR import, service layer → silent data loss. | `session_repo.go:56-294`, `app.go:310-317`, `app_sessions.go:99-101`, `services/sessions.go:72-74` | Propagate/log; emit `proxy:capture_error`; transactional import. |
| NEWS-022 | Medium | HAR import `io.ReadAll` unbounded; path not validated. | `har.go:304-317` | Size cap + path policy. |
| NEWS-024 | Medium | Duplicate headers joined with `, ` (Set-Cookie semantics lost). | `har.go:147,183` | Per HAR 1.2: separate entries. |
| NEWS-027 | Medium | HAR import regenerates IDs, breaking correlation. | `har.go:416-417` | Preserve original IDs when present. |
| NEWS-029 | High | CSV export formula-injection (no `=`/`+`/`-`/`@` escaping). | `har.go:264-266` | Sanitize cells. |
| NEWS-031/032 | Medium | cURL export escaping incomplete; binary bodies broken. | `har.go:288-295` | Proper shell escaping; `--data-binary @file`. |
| NEWS-033/034 | Medium | Session requests loaded fully with all bodies; no pagination/lazy bodies. | `session_repo.go:197-303` | Pagination + on-demand body fetch. |

### 2.5 Cert / system / lifecycle (NEWT)

| ID | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| NEWT-001 | Medium | CA key 2048-bit RSA, 10-year validity. | `ca.go:85` | 3072-bit (or ECDSA P-256) + shorter validity + expiry warning. |
| NEWT-002 | Medium | Key file perms not verified after write; Windows ACLs unmanaged. | `ca.go:215-219` | Verify/0600 on Unix; user-only ACL on Windows. |
| NEWT-003/004/005 | Medium/High | No CA rotation, no corrupted-CA recovery, no concurrent-generation lock. | `ca.go:56-81,152-205` | Rotate API, backup+regenerate, file lock. |
| NEWT-006 | Medium | Leaf cache unbounded. | `cache.go:23-24,49-57` | Max entries + LRU eviction. |
| NEWT-008 | Medium | SNI/host parsing edge cases (empty, trailing dot, IDN). | `leaf.go:42-46,179-184` | idna + validation. |
| NEWT-009 | Medium | Desktop leaf certs lack AKID/SKID extensions (Android overlay has them). | `leaf.go:139-150` | Add SKID/AKID. |
| NEWT-013 | Medium | Windows trust installs to CurrentUser only. | `trust_installer.go:96-104` | Optional LocalMachine + elevation. |
| NEWT-018/019 | High/Medium | Java keystore password hardcoded "changeit"; keytool path escaping. | `java_installer.go:272-340` | Configurable password; robust arg handling. |
| NEWT-022/023/024 | High | ADB commands no timeout; root detection narrow; shell command injection risk via string concat. | `android_adb.go:34-39,88-94,203-230` | Timeouts, Magisk/SuperSU detection, arg-quoting. |
| NEWT-026 | High | Windows system proxy overwrites existing settings and never restores them. | `proxy_windows.go:32-64` | Snapshot/restore owned values only. |
| NEWT-028/029/030 | Medium | macOS hardcodes Wi-Fi/Ethernet; Unix proxy errors ignored; Linux GNOME-only. | `proxy_unix.go:38-79` | Enumerate services; surface errors; DE detection. |
| NEWT-033 | Low | Process lookup is a stub on macOS/Linux. | `process_other.go:6-13` | lsof//proc implementation. |
| NEWT-035/036 | High/Critical | Partial startup leaves nil services; server created with nil certMgr; many Wails methods unguarded. | `app.go:82-166`, `app_proxy.go:82,165` | Component readiness + nil guards + degraded-mode matrix. |
| NEWT-041 | Medium | Port-in-use yields generic error; no suggested ports. | `app_proxy.go:88-91` | Typed error + UI guidance. |

### 2.6 Frontend (NEWF)

| ID | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| NEWF-001 | High | `useTrafficStore` is dead code duplicating `useProxyStore` (only self-reference). | `store/useTrafficStore.ts:44` | Delete or consolidate with parity tests. |
| NEWF-002 | High | 7 event listeners registered without cleanup; stale closures. | `App.tsx:208-227` | Unsubscribe on unmount. |
| NEWF-003 | Medium | WS reconnect timer never cleared; no cleanup API. | `apiAdapter.ts:46-79` | `cleanup()` + strict-mode safe init. |
| NEWF-004 | Medium | 100+ `any` usages; no typed contract for Wails/bindings/HAR. | multiple | Generated/typed contract. |
| NEWF-005 | High | CSV export formula injection (mirrors NEWS-029). | `utils/exportHelper.ts:460-473` | Sanitize. |
| NEWF-006 | Medium | 30+ unguarded `JSON.parse` of untrusted text. | multiple | Try/catch + size caps + guards. |
| NEWF-007 | Medium | Monaco receives unbounded bodies (browser crash risk). | `HttpBodyViewer.tsx:139` etc. | Preview cap + download link. |
| NEWF-008 | Medium | `EventsOff` global removal in Wails mode. | `apiAdapter.ts:93-99` | Callback-scoped unsubscribe. |
| NEWF-010 | Low | Duplicate status fields (`caInstalled`/`isCaInstalled`). | `useProxyStore.ts:143-150` | Canonicalize. |
| NEWF-011 | Medium | No code splitting; Monaco in main bundle (Vite chunk warning). | `vite.config.ts` | manualChunks + React.lazy. |
| NEWF-012/013 | Low | Minimal a11y; hardcoded strings despite translations.ts. | multiple | aria/focus trap; i18n keys. |
| NEWF-014 | Low | `useMemo` on unstable function ref. | `ExchangeListPane.tsx:41` | Stable selectors. |
| NEWF-015 | Medium | JWTs auto-decoded and displayed without warning. | `GeneralTab.tsx:60-95` | Redaction-aware decode. |

### 2.7 Android core (NEWA)

| ID | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| NEWA-001 | Medium | Chunked request bodies unsupported (truncated uploads). | `MitmProxyServer.kt:300-311` | Chunked decoder. |
| NEWA-002 | Medium | No socket read timeouts on Android proxy. | `MitmProxyServer.kt:129-157` | soTimeout. |
| NEWA-003/004 | Medium | Raw tunnel: no half-close propagation; coroutine leaks on cancel. | `MitmProxyServer.kt:462-533` | try/finally + shutdownOutput. |
| NEWA-005 | Medium | Unbounded coroutines per connection. | `MitmProxyServer.kt:86,109` | Semaphore/bounded dispatcher. |
| NEWA-007 | Medium | No Host-header vs target validation (smuggling). | `MitmProxyServer.kt:372-376` | Validate/sanitize. |
| NEWA-008 | Medium | No response body size limit (request capped at 10 MiB hardcoded). | `MitmProxyServer.kt:389-396` | Configurable limits both directions. |
| NEWA-009 | Low | `Thread.sleep` inside coroutine. | `MitmProxyServer.kt:324` | `delay()`. |
| NEWA-010/011 | Low/Medium | VPN builder: no IPv6, no DNS config (DNS leaks). | `HttpeekVpnService.kt:161-165` | IPv6 + DNS servers. |
| NEWA-012 | Medium | POST_NOTIFICATIONS declared but never requested at runtime. | manifest:10 | Runtime request on API 33+. |
| NEWA-014 | Medium | VPN errors swallowed → generic state. | `HttpeekVpnService.kt:204-207` | Typed error events. |
| NEWA-015 | Medium | RulesEngine unsynchronized. | `RulesEngine.kt:60-63,196-248` | Lock/concurrent structures. |
| NEWA-016 | Low | Desktop `rules:sync` overwrites local rules without merge/confirm. | `RulesEngine.kt:97-108` | Merge + confirm. |
| NEWA-017/018 | Low | WS reconnect fixed 3s; no heartbeat timeout. | `DesktopBridgeClient.kt:135-158` | Exponential backoff + pong watchdog. |
| NEWA-019 | Low | Pending queue not persisted; crash loses queued traffic. | `DesktopBridgeClient.kt:45-46,176-196` | Durable spool (see offline-first feature). |
| NEWA-021 | High | CA key file world-readable on some devices. | `DynamicCertAuthority.kt:120` | 0600 + Keystore option. |
| NEWA-023/024 | Medium | su output drainage/timeouts. | `RootCAInstaller.kt:191-224` | Timeouts + bounded drains. |
| NEWA-026 | Medium | Global cleartext. | manifest:22 | networkSecurityConfig. |

### 2.8 Android build/release (NEWB)

| ID | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| NEWB-001 | Blocker | Release signs with debug keystore. | `build.gradle:24` | Secure signing config from env/keystore.properties. |
| NEWB-002 | Blocker | `proguard-rules.pro` referenced but missing. | `build.gradle:23` | Create rules; verify clean release build. |
| NEWB-003 | High | `android/local.properties` not gitignored. | `.gitignore` | Add + remove from repo. |
| NEWB-004 | High | Bouncy Castle 1.77 has known CVEs (CVE-2024-14041 etc.). | `build.gradle:70` | Upgrade ≥1.78/1.79. |
| NEWB-005/006/007 | Medium | AndroidX/CameraX/MLKit/Lottie outdated. | `build.gradle:51-74` | Update with regression build. |
| NEWB-008 | High | Unbounded `allRequests` list → OOM on long captures. | `TrafficFragment.kt:45,132` | Bounded list + Paging. |
| NEWB-009 | Medium | `notifyDataSetChanged` on full refreshes (ANR risk). | `RulesFragment.kt:163`, `AppsFragment.kt:102-131` | DiffUtil/ListAdapter. |
| NEWB-010/011 | Medium | No contentDescription; 89+ hardcoded strings. | layouts | a11y + strings.xml. |
| NEWB-012/013 | Medium | No state preservation; no back handling. | MainActivity, fragments | ViewModel/saved state + back stack. |
| NEWB-015 | High | `allowBackup=true` without rules → CA key/traffic leak via backup. | manifest:16 | Backup rules excluding sensitive data. |
| NEWB-017 | High | QUERY_ALL_PACKAGES without Play justification. | manifest:11 | `<queries>` scoping + declaration form. |
| NEWB-019 | Medium | Lint disabled (`checkReleaseBuilds false`, `abortOnError false`). | `build.gradle:31-34` | Enable as PR gate. |
| NEWB-020 | Low | No unit/instrumentation test setup. | `build.gradle` | Add test deps + infra. |

## 3. Phase-by-phase implementation plan

Cross-cutting rule: each phase lands with regression tests, and no phase weakens lifecycle cleanup, security posture, or error visibility. Phases are ordered by risk; a phase may start once its predecessor's exit criteria pass.

### Phase 0 — Baseline and CI gates (foundation)

**Goal:** Reproducible builds and automated gates so every later phase is verifiable.

- Commit the current working-tree Phase A/B work (body limits, storage wiring, SOCKS5 dial-first, origin validation, token propagation, Android rewrite/vpn_start fixes) with its tests.
- Reconcile versions: `go.mod` (Go 1.25.0) vs README/CI (Go 1.22) → pin one supported version everywhere (AUD-001).
- Add CI gates (AUD-002): `go vet`, `go test ./...`, `go test -race ./...`, `staticcheck` (or golangci-lint), `npm ci && npm run build && tsc --noEmit`, `android gradlew assembleDebug + lint`.
- Add `local.properties` to `.gitignore`; remove it from the repo (AUD-005, NEWB-003).
- Add baseline protocol fixtures: HTTP/1.0/1.1, CONNECT, SOCKS5, chunked, compressed, binary, WS frames, SSE, malformed inputs (golden files).

**Deliverables:** CI matrix, version reconciliation commit, baseline fixtures.
**Exit:** All gates green on a clean checkout; failures are findings, not disabled checks.

### Phase 1 — Crash, memory, and resource bounds (safety)

**Goal:** No remotely reachable panic, OOM, or unbounded resource.

1. Fix NEWP-000 (buffer pool panic) + CONNECT-passthrough/SOCKS5-tunnel tests. **Do first; highest user impact.**
2. DEEP-011 / NEWT-036: nil-guard CA endpoints and all Wails methods; degraded-startup matrix (NEWT-035).
3. NEWH-04: wrap CONNECT TLS MITM in `bufferedConn` (consistency with SOCKS5).
4. Bounds: WS frame/message size + RSV + fragmentation (DEEP-008, NEWP-002), mobile WS length (DEEP-018, NEWP-003), SOCKS5 domain length (NEWP-001), mobile REST bodies + sync batches (NEWM-001/005, NEWP-016), HAR import size (NEWS-022), decompression caps (NEWP-021).
5. Timeouts: apply `ReadTimeout`/`WriteTimeout` + keep-alive idle timeout (NEWP-010); SOCKS5/CONNECT dial already 10s.
6. NEWP-014 max connections; NEWP-006/007 copy-goroutine cancellation; NEWP-008 discovery lifecycle.
7. Breakpoint: non-blocking resume, disconnect cleanup, bounded paused maps, configurable timeout (NEWI-021/022/023/024).
8. Crypto unpad/key-size (NEWI-031/032); block rune panic (NEWI-015).
9. NEWH-02 `SetSSLEnabled` no-op; NEWH-06 `SetExternalProxy` side effects.
10. Android: CA key perms (NEWA-021), chunked bodies (DEEP-025/NEWA-001), response limits (NEWA-008), connection semaphore (NEWA-005), socket timeouts (NEWA-002), coroutine cleanup (NEWA-003/004), `delay()` (NEWA-009).
11. Spill files: 0600 + delete-on-session-delete + orphan sweep (NEWP-015, NEWS-012).

**Exit:** `go test -race ./...` clean; fuzz targets for WS frames, SOCKS5, HAR import, rule regex run with no panics; Android crash-free smoke on emulator with chunked POST + large response.

### Phase 2 — Control-plane security (trust)

**Goal:** The mobile/control plane is safe by default; secrets are short-lived and never logged.

1. Mandatory-auth policy: when `HTTPEEK_API_TOKEN` unset, require explicit local-only mode with a UI warning (DEEP-016); rate-limit auth failures (NEWM-013).
2. Expiring one-time pairing credentials replacing long-lived tokens in QR/bridge (DEEP-017); header-based WS auth instead of `?token=` (NEWM-009); stop storing tokens in `localStorage` (DEEP-043) — session-scoped memory + native secure storage.
3. WS Origin validation (NEWM-008); tighten internal classifier so LAN host-header spoofing cannot reach the control plane (NEWM-003).
4. Auth-gate CA download endpoints via one-time URLs (NEWM-002); validate session IDs (NEWM-007); rule schema validation (NEWM-006); composer + upstream-proxy SSRF controls (NEWM-004/014); log-injection allowlist (NEWM-012); typed error envelope (NEWM-016).
5. Script sandbox: network off by default, memory/call-stack budget, per-script session namespaces (NEWI-040/041/042/043/046).
6. Redaction: report webhook redaction profiles (NEWI-050); CSV formula injection (NEWS-029, NEWF-005); redacted HAR/export mode (DEEP-044); JWT decode warning (NEWF-015).
7. Android: backup rules excluding CA keys/tokens/traffic (NEWB-015), network security config / cleartext scoping (NEWB-016/018, NEWA-026), QUERY_ALL_PACKAGES justification or scoped queries (NEWB-017).

**Exit:** Hostile-origin/token/CSV/SSRF regression tests green; no long-lived secret in any URL, log, or persistent store; threat-model section updated.

### Phase 3 — Protocol correctness and reliability

**Goal:** Bytes delivered to clients and upstreams are correct and consistent.

1. NEWH-01 preserve Host authority (port) upstream; NEWH-05 route plain-HTTP WS upgrades; NEWH-04 buffered CONNECT (moved earlier if Phase 1).
2. SSE: terminal chunk, client-proto status line, `id:`/comment/retry semantics preserved, cancellation (DEEP-010).
3. WS: fragmentation reassembly for inspection, close/ping/pong handling, upstream-proxy chaining (DEEP-008/009).
4. Response normalization: recalculate BodySize/content-type/encoding after interceptor mutation (DEEP-013); honor client `Connection: close` and HTTP/1.0 semantics (NEWP-017).
5. Upstream TLS policy: explicit "trust upstream certs" toggle with safe default and diagnostics (DEEP-012); add zstd (NEWP-022).
6. Real timings: measure DNS/TLS/TTFB instead of `connectMs/2` heuristics; X-Request-ID correlation (NEWP-025).
7. Graceful shutdown with in-flight draining and connection tracking (NEWP-014 + server lifecycle).
8. Android: half-close, Host validation, throttle bandwidth shaping via token bucket (DEEP-028, NEWA-007, NEWA-003).

**Exit:** Golden protocol fixtures pass for HTTP/1.0/1.1/2-upstream, CONNECT, SOCKS5, WS (incl. fragmentation), SSE, chunked, compressed; upstream-proxy chaining test for WS; client sees standards-compliant framing in all modes.

### Phase 4 — Persistence and capture integrity

**Goal:** No silent data loss; storage is safe under concurrency and partial failure.

1. `PRAGMA foreign_keys=ON` + WAL tuning + migrations + composite indexes (NEWS-001/002/003/005).
2. Transactions for SaveRequest/SaveResponse/DeleteSession/HAR import (NEWS-009/036/037/038, NEWS-020/021); propagate/emit capture-save errors to UI (NEWS-019, AUD-011).
3. `file_size` tracking (NEWS-008); header marshal/unmarshal error handling (NEWS-016/017); scan-error visibility (NEWS-035).
4. Pagination + lazy body loading for session requests (NEWS-033/034); favorites/session consistency (NEWS-010).
5. HAR: duplicate headers per spec (NEWS-024), preserve original IDs (NEWS-027), strict validation + size caps (NEWS-022/026); cURL escaping + binary handling (NEWS-031/032); export streaming for large sessions.
6. Session rename, per-session quotas, retention policies (NEWS-006/007 + feature backlog).

**Exit:** Concurrency tests (proxy capture + UI reads + session delete) pass without lost rows; corruption-recovery tests for DB and HAR; no ignored-error path remains in storage callers.

### Phase 5 — Rule engine hardening and rule features

**Goal:** Rules are predictable, validated, observable, and safe to change.

1. Atomic `rules.json` writes + backup + recovery UI (NEWI-053/054); schema versioning (NEWI-003); ID uniqueness (NEWI-002).
2. Regex validation surfaced at rule-save time (NEWI-007/012/030); IDN/port matching (NEWI-008/009); deterministic ordering (NEWI-005).
3. Chain semantics: continue-on-error policy + per-rule error events + per-rule match counters (NEWI-001, backlog); filtered = true end-to-end bypass (NEWI-011).
4. Rewrite: header canonicalization, encoding-aware body rewrite (NEWI-027/028); mock Content-Length sync (NEWI-018); block Content-Length (NEWI-016).
5. Script: exec timeout config, memory budget, sandbox controls (from Phase 2), per-script rate limits (NEWI-048).
6. Throttle: ctx-aware, bandwidth units clarified (NEWI-036/037/038).
7. Feature slice: conditional rules (method/status/body predicates), rule dry-run/simulation, rule import/export, per-rule stats, pattern tester UI.

**Exit:** Rule contract table documented; desktop/Android parity matrix row for each rule type; simulation tests for every rule family including error/edge paths.

### Phase 6 — Frontend hardening and state contract

**Goal:** Frontend behaves identically in Wails and browser modes and never loses events or state.

1. Typed fetch wrapper: `res.ok` checks, structured errors, timeouts, cancellation (DEEP-037); API contract tests for every Wails-vs-HTTP pair (DEEP-038).
2. Event lifecycle: scoped unsubscribe, cleanup in `App.tsx` and all consumers (DEEP-039, NEWF-002/008); WS cleanup/reconnect with jitter + strict-mode safety (NEWF-003).
3. Resolve store ownership: delete or consolidate `useTrafficStore` (NEWF-001, AUD-007); retention semantics that preserve favorites/selection with visible dropped-count (DEEP-040).
4. Startup file import completes (DEEP-041); dynamic IP detection replacing `192.168.1.100` (DEEP-042); session-aware retention UI.
5. Robustness: JSON.parse guards (NEWF-006), Monaco body caps (NEWF-007), null guards (NEWF-009), canonical status fields (NEWF-010), bundle splitting for Monaco (NEWF-011), a11y + i18n pass (NEWF-012/013), stable selectors (NEWF-014).

**Exit:** Adapter contract test suite green in both modes; manual desktop/browser parity checklist; no unguarded JSON/body rendering in core surfaces.

### Phase 7 — Android engine, lifecycle, and bridge

**Goal:** Android capture is durable, lifecycle-safe, and error-transparent.

1. Failed-MITM replay: wire `forwardRawTunnelWithReplay` with byte accounting for the HTTP reader buffer (DEEP-024); test with pinned apps.
2. Durable capture store: bounded repository + SQLite/paging + retention (DEEP-033, NEWB-008); traffic survives rotation/process death.
3. VPN/service: typed error/state events to UI (DEEP-030, NEWA-014), lifecycle-aware state replacing static callbacks (DEEP-031), port-conflict handling (DEEP-032), IPv6 + DNS (NEWA-010/011), POST_NOTIFICATIONS runtime request (NEWA-012).
4. Bridge: exponential backoff + heartbeat watchdog (NEWA-017/018), durable spool with ack/retry (DEEP-021, NEWA-019), consistent device ID (DEEP-022), bounded queue with byte budget (NEWM-015), rules sync merge/confirm (NEWA-016).
5. RulesEngine thread safety (NEWA-015); WebSocket/SSE capture parity slice; device registry cleanup (NEWM-010).

**Exit:** Emulator matrix (API 24/28/29/30/33/34) for VPN lifecycle, process death, rotation, reconnect, pinned-app TLS; bridge loss/retention tests; parity report updated.

### Phase 8 — Android release readiness

**Goal:** Ship-safe, policy-clean release artifacts.

1. Release signing from env/keystore (NEWB-001); create `proguard-rules.pro` + verify minified release build (NEWB-002/023, AUD-004); keep lint blocking (NEWB-019).
2. Dependency/CVE pass: Bouncy Castle ≥1.78 (NEWB-004), AndroidX/CameraX/MLKit/Lottie updates (NEWB-005/006/007).
3. Policy review: backup rules (NEWB-015), network security config (NEWB-018), QUERY_ALL_PACKAGES decision (NEWB-017), foreground-service type justification (NEWA-013), data-safety form inputs.
4. UI quality: bounded lists + DiffUtil (NEWB-008/009), strings.xml + a11y (NEWB-010/011), state preservation + back handling (NEWB-012/013).
5. Unit/instrumentation test scaffold (NEWB-020).

**Exit:** Clean `assembleRelease` with real signing; `lint` green; Play pre-launch report reviewed; upgrade/uninstall smoke tests pass.

### Phase 9 — Product features and capabilities

**Goal:** New capabilities from the validated backlog (each with acceptance criteria and regression tests).

1. **Capture & analysis:** streaming inspector; timeline/waterfall with real timings; request dependency graph; advanced filters (status class, size, duration, protocol, rule hits, body regex); diff & replay sets; durable capture profiles (limits, retention, redaction, excluded hosts).
2. **Rules & automation:** unified rule DSL with desktop/Android capability translation; rule simulation mode; versioning/rollback; conditional rules; webhook delivery controls (retry, signing, dead-letter); rule templates.
3. **Desktop ops:** proxy health center (port, CA, system-proxy ownership, upstream, ADB, bridge); safe system-proxy transactions (snapshot/restore); multi-profile environments; diagnostics/support bundle with redaction; startup import completion; request replay profiles (concurrency, delay, env vars); CLI/headless capture mode (start proxy, load rules, capture HAR, replay suites); plugin/extension API design.
4. **Mobile/companion:** connection health panel (heartbeat, latency, queue depth, dropped); explicit pairing states + device detail + capability badges; per-app capture profiles; QUIC/UDP visibility policy; offline-first encrypted bridge spool; remote action acknowledgements; unified desktop/mobile search; session continuity across reconnects.
5. **Security/product:** HAR redaction profiles; OpenTelemetry trace correlation (traceparent capture, no secrets); secret detection in bodies; trusted-cert verification helper; CA expiry warnings and rotation UX.

**Exit:** Each feature has a spec, acceptance test, and parity note; no new secrets in logs/exports.

### Phase 10 — Test infrastructure and observability

**Goal:** The plan's guarantees are continuously verified.

1. Fuzz: HTTP headers, proxy requests, HAR import, WS frames, pairing payloads, rule regex, JSON API bodies.
2. Race/leak tests: server restart, mobile connect/disconnect, event subscriptions, breakpoint queues, storage writes, discovery.
3. Security tests: origin spoofing, token replay, path traversal, oversized payloads, unauthorized control endpoints, CSV injection.
4. Contract tests: Wails-vs-HTTP adapter, event names, mobile sync schema, HAR fixtures from Chrome/Firefox/Charles/Fiddler.
5. Android matrix: API 24–34 emulator + ≥1 physical non-rooted and rooted device; network fault injection (latency, loss, captive portal, DNS failure, desktop restart).
6. Observability: redacted diagnostics bundle, health endpoints, storage metrics, per-rule counters, capture-error events, slow-query log.

**Exit:** Coverage report; CI runs fuzz/race/security suites; known-limitations doc (QUIC, pinning, background restrictions, Linux DEs) published.

## 4. Quick wins (can ship immediately, individually low-risk)

- NEWP-000 buffer pool fix (one-line + tests).
- NEWH-02 `SetSSLEnabled` apply-config fix.
- NEWI-015 block rune → `strconv.Itoa`.
- NEWI-032 PKCS7 unpad bounds check.
- NEWS-029 / NEWF-005 CSV formula escaping.
- NEWB-003 gitignore `local.properties` + remove file.
- NEWP-022 zstd decode support.
- NEWH-04 CONNECT `bufferedConn` wrapper.
- NEWT-009 leaf AKID/SKID.
- NEWF-010 canonical `caInstalled` field.

## 5. Definition of done (unchanged, applies to every work item)

1. Behavior reproduced or disproven with evidence. 2. Root cause + data flow documented. 3. Minimal fix without weakening security/lifecycle cleanup. 4. Regression test or repeatable manual test. 5. Desktop/Android/fallback/persistence/UI consumers checked. 6. Compatibility + migration impact documented. 7. Issue row updated with evidence, status, acceptance results.

## 6. Phase 0 + Phase 1 implementation status (2026-08-18)

### Completed in this slice

| Item | Work done | Verification |
|---|---|---|
| Phase 0 | Committed the pre-existing Phase A/B working-tree changes with `AGENTS.md`/`MEGAPLAN.md` as `1305912`. | Clean `git status` |
| NEWP-000 (CRITICAL) | Replaced panicking `bufferPool.Get().([]byte)` assertions with `GetBuffer()`/`PutBuffer()` helpers in `passthroughTunnelWithRemote`. | `TestConnectTunnelPassthrough`, `TestSocks5TunnelPassthrough` (new) |
| NEWH-04 | CONNECT tunnels now wrap the client conn in `bufferedConn`, preserving bytes the `bufio.Reader` buffered beyond the request line (pipelined TLS ClientHello/payload) for both MITM and passthrough paths. | Covered by pipelined payload in `TestConnectTunnelPassthrough` |
| DEEP-011 / NEWT-036 | `serveCACertificate` nil-guards server/cert-manager/CA and returns 404 instead of panicking. | Existing suite |
| NEWP-001 | SOCKS5 domain length capped at 253 with ADDRESS_TYPE_NOT_SUPPORTED reply. | Existing suite |
| NEWP-002 / DEEP-008 (bounds part) | WS frames: 16 MiB frame cap (incl. int64 overflow guard), RSV-bit rejection, control-frame validation, close frames 1002/1009. Fragmentation reassembly remains Phase 3. | Existing suite |
| NEWP-003 / DEEP-018 | Mobile WS 64-bit length parsed correctly and capped at 32 MiB. | Existing suite |
| NEWM-001/005 (bounds part) | `readJSONBody` with 64 MiB cap replaces all 19 unbounded `io.ReadAll(req.Body)` REST reads; `Content-Length` pre-check returns 413; composer upstream response body bounded. Per-endpoint/sync-batch item limits remain Phase 2/4. | Existing suite |
| NEWP-010 | `ReadTimeout`/`WriteTimeout` now applied: read deadline per keep-alive request, write deadline around all response writes, deadlines cleared for long-lived tunnels. | Existing suite |
| NEWP-014 | `MaxConnections` config (default 1000) with atomic active-connection accounting and reject-on-overflow. | Existing suite |
| NEWH-02 | `SetSSLEnabled` now applies config (restarting a running server) instead of silently discarding it. | Existing suite |
| NEWI-015 | Block rule status action uses `strconv.Itoa` instead of `string(rune())`. | Existing suite |
| NEWI-032 | `pkcs7Unpad` returns errors on invalid padding (bounds-checked, block-size-limited) instead of returning raw ciphertext. | Existing suite |
| NEWS-029 / NEWF-005 | CSV export (Go `ExportToCSV` + frontend `generateCSV`) neutralizes `=`/`+`/`-`/`@` formula injection and quotes cells correctly. | `TestExportToCSVFormulaInjection`, `TestCSVFieldQuoting` (new); `npm run build` green |
| NEWT-009 | Leaf certificates now carry an explicit `SubjectKeyId` (SHA-1 of SPKI); Go already auto-fills AKID from the CA. | `TestLeafCertificateExtensions` (new) |
| vet/copylocks | `RepeatRequest`/`ReplayRequest` take `*proxy.HttpRequest` instead of copying a mutex-bearing struct. Wails JSON contract unchanged. | `go vet ./...` clean |

### Verification for this slice

- `go vet ./...`: **passed**.
- `go test ./...`: **passed**.
- `go test -race ./pkg/proxy ./pkg/interceptor ./pkg/storage ./pkg/cert`: **passed**.
- `npm run build` (frontend): **passed**; existing 705 kB chunk warning remains (Phase 6 code-splitting backlog).

### Remaining Phase 1 work

- Mobile sync batch item-count/total-size limits (NEWM-005 refinement, with Android).
- WS fragmentation reassembly + ping/pong lifecycle (moved to Phase 3 with DEEP-008 full scope).
- Spill-file cleanup policy on session delete + orphan sweep (permissions done — 0600/0700).
- Copy-goroutine cancellation in tunnels/WS (NEWP-006/007; analysis shows lifetimes are bounded by connection close — revisit with Phase 3 graceful shutdown).
- Discovery broadcaster lifecycle (NEWP-008).
- Android: chunked request bodies (DEEP-025/NEWA-001), Android Keystore key protection (NEWA-021 refinement), failed-MITM replay wiring (DEEP-024 — Phase 7).

### Android Phase 1 slice (completed 2026-08-18)

- NEWA-005: connection semaphore (100) bounds concurrent handler coroutines.
- NEWA-002: 30 s client socket read timeout at accept; cleared for long-lived raw tunnels.
- NEWA-008: bounded request and response body reads (10 MiB) with truncation logging; replaced unbounded `body.bytes()`.
- NEWA-009: throttle latency uses `delay()` instead of `Thread.sleep`.
- NEWA-003: raw tunnel propagates half-close via `shutdownOutput`; failure logging added.
- NEWA-021: CA private key file restricted to owner-only on generation.
- Verification: `gradlew assembleDebug` BUILD SUCCESSFUL (Kotlin compile + package).
