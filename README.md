# HTTPeek - Next Gen HTTP Debugging Tool
> **High-Performance Cross-Platform HTTP/HTTPS/WebSocket Interception Workbench**  
> *Developed by **OneManByte** • Completely Rebuilt from Scratch in **Go** (Inspired by ProxyPin)*

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?logo=go)](https://golang.org)
[![Wails](https://img.shields.io/badge/Wails-v2-DF1A55?logo=wails)](https://wails.io)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android-green)]()

---

## 🌟 Overview

**HTTPeek** is a next-generation, cross-platform HTTP/HTTPS/WebSocket traffic capture and debugging workbench designed for engineers, security researchers, and mobile application testers. 

Re-engineered completely from the ground up in **Go** and paired with a **React 19 + TypeScript + TailwindCSS** frontend via **Wails v2**, HTTPeek delivers raw native throughput, multi-gigabyte streaming capabilities, and an intuitive developer experience without the memory bloat or runtime overhead of legacy tools.

---

## 🚀 Key Features

### ⚡ 1. High-Performance Go Proxy Engine
- **Full MITM TLS Decryption**: Dynamic on-the-fly SSL/TLS certificate generation supporting HTTP/1.0, HTTP/1.1, and HTTP/2.
- **WebSocket & SSE Inspection**: Bidirectional inspection with live streaming frames, opcode decoding (Text, Binary, Ping/Pong), and Server-Sent Events viewer.
- **SOCKS5 & Upstream Support**: Built-in SOCKS5 proxy server alongside standard HTTP/HTTPS proxying, with chained upstream proxy support.
- **Automatic System Proxy Management**: Seamless OS system proxy automation that turns on when capture starts and cleanly restores when paused or closed.

### 🛠️ 2. Advanced Traffic Manipulation & Interception
- **JavaScript Scripting Engine**: Full ECMAScript execution (powered by Goja) with hooks (`onRequest`, `onResponse`), built-in crypto helpers, console forwarding, and mock responses.
- **Request & Response Rewrite**: Header addition/deletion, query parameter modification, regex URL redirection, body replacement, and status code overriding.
- **Interactive Breakpoints**: Pause requests or responses in real-time, inspect headers and payloads, modify values inline, or forward/abort with single clicks.
- **Mock & Map Rules**: Local mapping to disk files, remote URL mapping, and instant status/body mocking.
- **Request Blocking & Filtering**: Granular domain whitelist/blacklist matching, app-level filtering, and URL regex blocklists.
- **Network Throttling Profiles**: Simulate real-world network conditions including 2G, 3G, 4G, Slow DSL, custom bandwidth limits (up/down), latency jitter, and packet loss.
- **Crypto / Signature Interceptor**: Compute cryptographic signatures (MD5, SHA1, SHA256, SHA512, HMAC, AES encryption/decryption) automatically on outgoing requests.

### 🧰 3. Comprehensive Developer Toolbox
- **AES Encryptor / Decryptor**: Supports ECB/CBC/GCM/CTR modes with custom padding and key lengths (128, 192, 256).
- **Multi-Format Encoder / Decoder**: Base64, Hex, URL encoding, HTML entities, JWT Token decoder, and Unicode converter.
- **Regex Tester & Debugger**: Instant pattern matching with multi-flag evaluation and match extraction.
- **Timestamp Converter**: Bidirectional conversion between Unix timestamps (seconds/ms), ISO-8601, and local dates.
- **Certificate Hash & Inspector**: Compute Subject Key Identifier (SKI), SHA-256 fingerprint, and export Android 9+ root CA hashes (`c7a52f4b.0`).
- **Interactive WebSocket Client**: Test and benchmark WebSocket endpoints with custom headers, protocols, and message history.
- **Side-by-Side Text Diff**: Visual side-by-side and unified diff viewer for comparing requests, responses, and headers.
- **JavaScript Scratchpad**: Rapid isolated JS testing sandbox with standard output inspection.

### 📱 4. Mobile Companion Bridge & Remote Inspection
- Connect iOS and Android devices directly over local Wi-Fi or USB ADB.
- Scan QR codes on desktop to automatically configure mobile proxy and download root CA certificates.
- Automated Android root/user CA installation via ADB scripts.

### 📊 5. Structured Centralized Logging
- Unified logging architecture recording both Go backend operations and React frontend UI runtime errors synchronously to `logs/proxypin.log`.
- In-app log viewer with live log level filtering (Trace, Debug, Info, Warn, Error, Fatal).

---

## 🏗️ Architecture

```
HTTPeek (Go + Wails + React)
├── app.go / app_*.go       # Wails desktop bridge & OS integrations
├── pkg/
│   ├── proxy/              # Go MITM proxy engine, SOCKS5, WS, and SSE streams
│   ├── interceptor/        # Rule chains (Rewrite, Breakpoint, Map, Block, Throttle, Crypto)
│   ├── scriptengine/       # Goja ECMAScript engine for JS hooks
│   ├── cert/               # Root CA generator, cert manager & ADB installer
│   ├── storage/            # High-performance SQLite & disk body storage
│   ├── system/             # Windows / macOS / Linux system proxy lifecycle
│   └── logger/             # Centralized dual-engine synchronous logger
└── frontend/               # React 19 + TypeScript + TailwindCSS + Monaco UI
```

---

## 💻 Building from Source

### Prerequisites
- **Go**: 1.22 or higher ([Download](https://golang.org/dl/))
- **Node.js**: 20.x or higher & npm ([Download](https://nodejs.org/))
- **Wails CLI v2**:
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```

### Build Steps

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Arslan10227/HTTPeek.git
   cd HTTPeek
   ```

2. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

3. **Run in Development Mode (Live Reload)**:
   ```bash
   wails dev
   ```

4. **Build Production Release**:
   ```bash
   wails build
   ```
   *The compiled standalone binary will be generated inside `build/bin/`.*

---

## 🛠️ GitHub Actions CI / CD

Manual multi-platform builds can be triggered directly from the GitHub Actions tab:
- **Windows**: `build/bin/httpeek.exe`
- **macOS**: `build/bin/httpeek.app` / DMG
- **Linux**: `build/bin/httpeek` / Debian package
- **Android**: `android/app/build/outputs/apk/release/app-release.apk`

---

## 📜 Credits & Acknowledgments

HTTPeek is inspired by the architecture and concept of **ProxyPin** originally created by **WanghongLin**. Full attribution and acknowledgments for all open-source dependencies are documented in [CREDITS.md](CREDITS.md).

---

## 📄 License

This project is licensed under the [Apache License 2.0](LICENSE).
