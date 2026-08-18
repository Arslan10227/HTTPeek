# AGENTS.md

## Project overview

HTTPeek is a cross-platform HTTP/HTTPS/WebSocket debugging workbench. It has two related applications:

- **Desktop:** Go + Wails v2 + React/TypeScript. The desktop owns the proxy engine, dynamic TLS CA, interceptor chain, SQLite capture sessions, OS integrations, Wails bindings, and the mobile companion bridge.
- **Android:** Native Kotlin. The Android app owns a VPN service, embedded HTTP/MITM proxy, dynamic CA, Android-side rules, app filtering, traffic UI, desktop pairing, LAN discovery, QR workflows, and ADB reverse support.

The desktop and Android implementations are separate proxy engines. Do not assume feature or protocol parity without checking both implementations.

## Repository map

- `main.go` — Wails application bootstrap, embedded frontend assets, shutdown cleanup.
- `app.go`, `app_*.go` — Wails-bound desktop application methods, startup lifecycle, OS integrations, rules, sessions, mobile commands, and service wiring.
- `pkg/proxy/` — Desktop TCP proxy, HTTP/CONNECT/TLS handling, SOCKS5, WebSocket/SSE support, mobile REST/WebSocket API, request/response models, and body handling.
- `pkg/interceptor/` — Ordered request/response rule chain: host mapping, filtering, throttling, blocking, mocking/mapping, breakpoints, rewriting, scripts, crypto, and reporting.
- `pkg/cert/` — Root CA generation, dynamic leaf certificates, trust installation, Java keystore support, Android certificate metadata, and ADB installation.
- `pkg/storage/` — SQLite schema, sessions, request/response persistence, favorites, HAR import/export, JSON/CSV/cURL export.
- `pkg/system/` — System proxy lifecycle and process lookup, with OS-specific implementations.
- `pkg/scriptengine/` — Goja JavaScript execution used by script rules and toolbox operations.
- `pkg/logger/` — Shared Go/frontend logging integration and log persistence.
- `internal/services/` — Service wrappers for proxy, certificates, sessions, and rules. `app.go` still contains some direct orchestration and compatibility methods.
- `frontend/src/` — React UI, Wails/HTTP API adapter, Zustand stores, inspector, request list, rules, sessions, certificate, mobile, settings, and toolbox screens.
- `frontend/wailsjs/` — Generated Wails bindings/runtime files. Regenerate through the Wails workflow when bindings change; do not hand-edit generated output unless required by the project workflow.
- `android/app/src/main/kotlin/com/httpeek/app/` — Android activity, VPN service, bridge, discovery, proxy, rules, CA/security, models, and UI.
- `android/` — Gradle wrapper and Android build configuration.
- `build/` — Wails packaging assets and platform installer metadata.
- `.github/workflows/build.yml` — Manually dispatched platform build workflow.
- `MEGAPLAN.md` — Evidence-tiered audit roadmap; keep detailed findings and hypotheses there rather than in this guide.

## Desktop startup and shutdown

`NewApp` initializes logging and chooses the per-user configuration directory (`ProxyPin`). Wails startup then:

1. Opens SQLite and creates a default session.
2. Creates the root CA, certificate manager, trust installer, and Java manager.
3. Creates interceptors and adds them to the chain in priority order.
4. Creates the proxy server on port `9099`, attaches the desktop event listener, and wires services/mobile bridge.
5. Loads persisted rules from `rules.json`.
6. Ensures the OS system proxy is disabled until capture starts.

The desktop listener emits Wails events and persists requests/responses. Shutdown and close hooks stop the server, disable the system proxy, and close SQLite. Preserve this cleanup behavior when changing lifecycle code. Test partial initialization failures because some application capabilities can be unavailable while the UI still starts.

## Desktop request/data flow

1. `pkg/proxy.Server` accepts TCP connections.
2. `Handler` detects SOCKS5 versus HTTP/CONNECT.
3. HTTP requests are forwarded; CONNECT requests either tunnel or enter TLS MITM depending on filtering, SSL configuration, and CA availability.
4. The interceptor chain runs pre-connect, request, execute/short-circuit, response, and error phases.
5. The handler forwards upstream traffic, handles body decoding/encoding and WebSocket/SSE events, and dispatches events to listeners.
6. `appEventListener` sends Wails events (`proxy:request`, `proxy:response`, `proxy:ws_frame`, `proxy:sse_event`, `proxy:error`) and writes capture data to SQLite.
7. `frontend/src/store/apiAdapter.ts` uses Wails methods inside the desktop app and HTTP/WebSocket fallback endpoints in browser/mobile modes.
8. `useProxyStore` is the primary store referenced by `App.tsx`; `useTrafficStore` contains overlapping behavior and must not be changed casually without resolving ownership and parity.

Preserve request/response IDs. Responses, WebSocket frames, SSE events, breakpoints, persistence, and UI state all depend on stable identifiers.

## Rules and persistence

Desktop rules are held by interceptor instances and persisted to `rules.json` through the rules service. Rule families include hosts, rewrite, mock/map, breakpoint, block, crypto, script, throttle, host filtering, and report configurations. The chain is priority ordered; inspect the concrete interceptor and priority before changing execution semantics.

SQLite stores sessions and captured request/response data. Favorites can outlive a session through the special `favorites` session ID behavior. Desktop proxy request and response capture is bounded by `ServerConfig.MaxRequestBodyBytes` and `MaxResponseBodyBytes` (16 MiB defaults); preserve those limits and the configured body spill directory when changing server construction. HAR import/export and JSON/CSV/cURL export are separate code paths and need format-specific tests. Do not ignore persistence errors in new code.

Android currently has a separate `RulesEngine` and only a subset/schema translation of desktop rules. Rule synchronization must be treated as a compatibility boundary, not as a transparent object copy.

## Mobile bridge and Android flow

The desktop proxy exposes mobile REST and WebSocket endpoints through `pkg/proxy/mobile_api.go`. Authentication is optional and controlled by `HTTPEEK_API_TOKEN`; when configured, use `X-HTTPeek-Token` for REST or the WebSocket query token. CA download endpoints are intentionally available for mobile installation flows and must be handled carefully.

Android pairing flow:

1. Android discovers or receives a desktop host/port/token through QR, pairing history, LAN discovery, or manual setup.
2. `DesktopBridgeClient` connects to `/ws/events`, sends `mobile:hello`, starts heartbeats, and queues traffic while disconnected.
3. Android sends `proxy:request` and `proxy:response` events; the desktop broadcasts desktop events and remote commands.
4. Desktop can sync rules with `rules:sync` and send `remote:vpn_start`, `remote:vpn_stop`, and `remote:traffic_clear`.
5. Android uses bounded in-memory queues and an HTTP batch fallback; failed flushes must be tested for loss/retention behavior.
6. Configured API tokens are propagated through pairing and bridge requests, but Android pairing history intentionally stores host/port without tokens. Do not add plaintext token persistence; use an expiring or encrypted credential design.

The Android `HttpeekVpnService` establishes a VPN, protects upstream sockets from VPN recursion, starts `MitmProxyServer`, applies per-app filters, and routes HTTP traffic to `127.0.0.1:9099`. Android 10+ direct proxy routing and older-version behavior must be tested separately. Certificate pinning, user/system CA trust, QUIC/UDP, lifecycle/process death, and background restrictions are not guaranteed by static inspection.

## Development and verification

Authoritative versions must be checked against the repository before changing setup documentation:

- Go dependencies are declared in `go.mod` (`go.mod` currently declares Go `1.25.0`).
- Desktop frontend uses Node/npm, Vite, React, TypeScript, and Wails v2.
- Android uses the Gradle wrapper, Android Gradle Plugin `8.2.2`, Kotlin Gradle plugin `1.9.22`, Java 17, compile/target SDK 34, and min SDK 24.

Typical commands:

```text
# Frontend
cd frontend
npm ci
npm run build

# Go tests
cd ..
go test ./...
go test -race ./...    # when supported by the environment

# Wails desktop development/build
wails dev
wails build

# Android (Windows)
cd android
gradlew.bat assembleDebug
gradlew.bat lint
```

The CI workflow currently performs manually dispatched platform builds and does not constitute a complete test gate. Linux Wails builds require GTK/WebKit development packages. Wails builds also require platform WebView prerequisites. `android/local.properties` is machine-specific and must not be copied into portable instructions.

## Safety and change invariants

- Never commit or expose CA private keys, API tokens, captured credentials, device identifiers, or generated runtime databases.
- Do not log request bodies, authorization headers, CA material, or token values unnecessarily.
- Preserve system-proxy restoration on stop, close, shutdown, startup failure, and process termination paths.
- Preserve event names, request/response IDs, JSON field names, and Wails/HTTP fallback contracts unless changing all consumers together.
- Treat TLS interception and trust installation as security-sensitive. Verify certificate validity, SANs, key usage, file permissions, and user/system trust behavior.
- Add regression tests for proxy protocol, TLS, interceptor, persistence, bridge, or API contract changes. Add Android device/emulator coverage for VPN and certificate behavior.
- Do not silently swallow errors in new code. Existing silent catches are audit candidates; document and reproduce their impact before changing behavior.
- Do not alter generated bindings manually as a substitute for the generation workflow.
- Avoid unrelated formatting or refactors. Keep changes focused and verify `git diff` before finishing.
