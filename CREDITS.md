# Credits & Acknowledgments

**HTTPeek** is built on top of incredible open-source projects and inspired by the developer community. We extend our deepest gratitude to all creators, maintainers, and contributors whose work made this software possible.

---

## 💡 Original Inspiration

- **[ProxyPin](https://github.com/wanghongenpin/proxypin)** by **[WanghongLin (wanghongenpin)](https://github.com/wanghongenpin)**  
  The conceptual design, mobile companion bridge workflow, and interceptor feature set of HTTPeek were heavily inspired by the original ProxyPin project. We express our sincere appreciation for his innovative work in the HTTP debugging space.

---

## 🛠️ Core Frameworks & Runtimes

- **[Wails v2](https://github.com/wailsapp/wails)**  
  For providing the lightweight, blazing-fast native desktop runtime bridge between Go and modern web frontends.
- **[Go (Golang)](https://golang.org)**  
  For powering the high-concurrency, low-latency MITM proxy engine and TLS interception pipeline.
- **[React](https://react.dev)** & **[TypeScript](https://www.typescriptlang.org)**  
  For enabling a robust, reactive, and type-safe user interface.
- **[Vite](https://vitejs.dev)**  
  For modern frontend tooling and lightning-fast developer builds.

---

## 📦 Go Backend Libraries

| Library | Author / Organization | Purpose |
| :--- | :--- | :--- |
| **[goja](https://github.com/dop251/goja)** | Dmitri Pissarenko (@dop251) | Pure Go ECMAScript engine powering real-time JavaScript request/response scripting. |
| **[gorilla/websocket](https://github.com/gorilla/websocket)** | Gorilla Web Toolkit | High-performance WebSocket framing, upgrade, and bidirectional stream handling. |
| **[mattn/go-sqlite3](https://github.com/mattn/go-sqlite3)** | Yasuhiro Matsumoto (@mattn) | SQLite driver for persistent session history and request indexing. |
| **[google/uuid](https://github.com/google/uuid)** | Google LLC | Unique request, session, and WebSocket frame identifier generation. |
| **[wailsapp/wails/v2](https://github.com/wailsapp/wails)** | Lea Anthony & Wails Team | Desktop window management, asset server, and native IPC bindings. |

---

## 🎨 Frontend Libraries & UI Components

| Library | Purpose |
| :--- | :--- |
| **[@monaco-editor/react](https://github.com/suren-atoyan/monaco-react)** | In-app code editor for JavaScript interceptors, JSON payloads, and XML inspection. |
| **[lucide-react](https://lucide.dev)** | Modern, consistent icon library for all UI panels and navigation bars. |
| **[tailwindcss](https://tailwindcss.com)** | Utility-first CSS framework for fluid responsive design and dark/light themes. |
| **[zustand](https://github.com/pmndrs/zustand)** | High-performance, lightweight state management for live traffic streams. |
| **[@tanstack/react-virtual](https://tanstack.com/virtual)** | Virtual scrolling engine capable of rendering 100,000+ intercepted requests smoothly. |
| **[qrcode.react](https://github.com/zpao/qrcode.react)** | QR Code rendering for instant mobile device proxy pairing and certificate downloads. |
| **[lottie-web](https://github.com/airbnb/lottie-web)** & **[roughjs](https://roughjs.com)** | UI micro-animations and aesthetic visual accents. |

---

## 👤 Author & Maintainer

- **OneManByte** ([GitHub: @Arslan10227](https://github.com/Arslan10227))  
  Architected and rebuilt HTTPeek from scratch in Go.
