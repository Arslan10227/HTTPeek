package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	goRuntime "runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"httpeek/internal/services"
	"httpeek/pkg/cert"
	"httpeek/pkg/interceptor"
	"httpeek/pkg/logger"
	"httpeek/pkg/platform"
	"httpeek/pkg/proxy"
	"httpeek/pkg/storage"
	"httpeek/pkg/system"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct holds application state, engines, and Wails context.
type App struct {
	ctx         context.Context
	server      *proxy.Server
	certMgr     *cert.CertificateManager
	trust       *cert.TrustInstaller
	javaMgr     *cert.JavaManager
	chain       *interceptor.Chain
	db          *storage.DB
	sessionRepo *storage.SessionRepo
	currentSess *storage.Session
	hostsInt    *interceptor.HostsInterceptor
	rewriteInt  *interceptor.RequestRewriteInterceptor
	mockInt     *interceptor.RequestMapInterceptor
	breakInt    *interceptor.RequestBreakpointInterceptor
	blockInt    *interceptor.RequestBlockInterceptor
	throttleInt *interceptor.NetworkThrottleInterceptor
	cryptoInt   *interceptor.RequestCryptoInterceptor
	reportInt   *interceptor.ReportServerInterceptor
	scriptInt   *interceptor.ScriptInterceptor
	filterInt   *interceptor.HostFilterInterceptor
	dataDir     string
	httpClient  *http.Client
	proxySvc    *services.ProxyService
	certSvc     *services.CertService
	sessions    *services.SessionService
	rules       *services.RulesService
	mu          sync.RWMutex
}

// NewApp creates a new App application struct.
func NewApp() *App {
	logger.Init()
	userConfigDir, _ := os.UserConfigDir()
	dataDir := filepath.Join(userConfigDir, "ProxyPin")
	_ = os.MkdirAll(dataDir, 0755)

	return &App{
		dataDir: dataDir,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// startup is called when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	logger.SetWailsContext(ctx)
	logger.Info("App", "ProxyPin desktop startup initiated")

	// 1. Initialize DB
	db, err := storage.OpenDB(a.dataDir)
	if err != nil {
		a.emitInitError("Database initialization failed: " + err.Error())
	} else {
		a.db = db
		a.sessionRepo = storage.NewSessionRepo(db)
		sess, sessErr := a.sessionRepo.CreateSession("Default Session")
		if sessErr != nil {
			a.emitInitError("Failed to create default session: " + sessErr.Error())
		} else {
			a.currentSess = sess
		}
	}

	// 2. Initialize CA & Cert Manager
	caCfg := cert.DefaultConfig()
	caCfg.StorageDir = filepath.Join(a.dataDir, "certs")
	ca, err := cert.NewCA(caCfg)
	if err != nil {
		a.emitInitError("Root CA initialization failed: " + err.Error() + ". HTTPS interception will be unavailable.")
	} else {
		certMgr, cmErr := cert.NewCertificateManager(ca)
		if cmErr != nil {
			a.emitInitError("Certificate manager initialization failed: " + cmErr.Error())
		} else {
			a.certMgr = certMgr
			a.trust = cert.NewTrustInstaller(ca)
			a.javaMgr = cert.NewJavaManager(ca)
		}
	}

	// 3. Initialize Interceptors
	a.chain = interceptor.NewChain()
	a.hostsInt = interceptor.NewHostsInterceptor()
	a.throttleInt = interceptor.NewNetworkThrottleInterceptor()
	a.blockInt = interceptor.NewRequestBlockInterceptor()
	a.mockInt = interceptor.NewRequestMapInterceptor()
	a.breakInt = interceptor.NewRequestBreakpointInterceptor(func(event *interceptor.BreakpointEvent) {
		runtime.EventsEmit(a.ctx, "breakpoint:paused", event)
	})
	a.rewriteInt = interceptor.NewRequestRewriteInterceptor()
	a.scriptInt = interceptor.NewScriptInterceptor(func(scriptName, level, message string) {
		runtime.EventsEmit(a.ctx, "script:log", map[string]string{
			"script":  scriptName,
			"level":   level,
			"message": message,
			"time":    time.Now().Format("15:04:05"),
		})
	})
	a.cryptoInt = interceptor.NewRequestCryptoInterceptor()
	a.reportInt = interceptor.NewReportServerInterceptor()
	a.filterInt = interceptor.NewHostFilterInterceptor(interceptor.NewHostFilter())

	a.chain.Add(a.filterInt)
	a.chain.Add(a.hostsInt)
	a.chain.Add(a.throttleInt)
	a.chain.Add(a.blockInt)
	a.chain.Add(a.mockInt)
	a.chain.Add(a.breakInt)
	a.chain.Add(a.rewriteInt)
	a.chain.Add(a.scriptInt)
	a.chain.Add(a.cryptoInt)
	a.chain.Add(a.reportInt)

	// 4. Initialize Proxy Server
	srvCfg := proxy.DefaultServerConfig()
	srvCfg.Port = 9099
	a.server = proxy.NewServer(srvCfg, a.certMgr)
	a.server.SetInterceptor(a.chain)

	// Attach listener to emit real-time events to React frontend
	a.server.AddListener(&appEventListener{app: a})

	a.wireServices()
	a.attachMobileBridge()

	// 5. Load persisted rules
	a.loadRules()

	// 6. Ensure system proxy is disabled by default on startup until capture begins
	_ = system.SetSystemProxy(false, "", 0, "")
}

func (a *App) emitInitError(message string) {
	if a.ctx == nil {
		return
	}
	runtime.EventsEmit(a.ctx, "app:init_error", map[string]string{
		"message": message,
		"time":    time.Now().Format(time.RFC3339),
	})
}

// shutdown is called when the app closes.
func (a *App) shutdown(ctx context.Context) {
	// Always cleanly disable system proxy on application exit
	_ = system.SetSystemProxy(false, "", 0, "")

	if a.server != nil && a.server.IsRunning() {
		_ = a.server.Stop()
	}
	if a.db != nil {
		_ = a.db.Close()
	}
}

// SendCustomRequest sends a custom HTTP request (Request Composer / Postman-style).
func (a *App) SendCustomRequest(reqJSON string) (*proxy.HttpResponse, error) {
	if strings.TrimSpace(reqJSON) == "" {
		return nil, fmt.Errorf("empty request payload")
	}

	var raw map[string]any
	if err := json.Unmarshal([]byte(reqJSON), &raw); err != nil {
		return nil, fmt.Errorf("invalid request json: %w", err)
	}

	method := "GET"
	if m, ok := raw["method"].(string); ok && strings.TrimSpace(m) != "" {
		method = strings.ToUpper(strings.TrimSpace(m))
	}

	rawURL := ""
	if u, ok := raw["url"].(string); ok {
		rawURL = strings.TrimSpace(u)
	}
	if rawURL == "" {
		return nil, fmt.Errorf("request URL is required")
	}
	if !strings.HasPrefix(strings.ToLower(rawURL), "http://") && !strings.HasPrefix(strings.ToLower(rawURL), "https://") {
		rawURL = "http://" + rawURL
	}

	headers := make(http.Header)
	if hRaw, ok := raw["headers"]; ok && hRaw != nil {
		switch hVal := hRaw.(type) {
		case map[string]any:
			for k, v := range hVal {
				switch val := v.(type) {
				case []any:
					for _, item := range val {
						headers.Add(k, fmt.Sprintf("%v", item))
					}
				case []string:
					for _, item := range val {
						headers.Add(k, item)
					}
				default:
					headers.Set(k, fmt.Sprintf("%v", val))
				}
			}
		case map[string][]string:
			for k, vList := range hVal {
				for _, v := range vList {
					headers.Add(k, v)
				}
			}
		}
	}

	bodyStr := ""
	if b, ok := raw["body"].(string); ok {
		bodyStr = b
	} else if bObj, ok := raw["body"]; ok && bObj != nil {
		if bBytes, err := json.Marshal(bObj); err == nil {
			bodyStr = string(bBytes)
		}
	}

	req := proxy.HttpRequest{
		ID:         uuid.NewString(),
		Method:     proxy.HttpMethod(method),
		URL:        rawURL,
		Headers:    headers,
		BodyString: bodyStr,
		Body:       []byte(bodyStr),
		StartTime:  time.Now(),
	}
	return a.ReplayRequest(req)
}

type appEventListener struct {
	app *App
}

func (l *appEventListener) OnRequest(ctx *proxy.Context, req *proxy.HttpRequest) {
	// Resolve process owner from client local port
	if req.ClientAddr != "" {
		if _, portStr, err := net.SplitHostPort(req.ClientAddr); err == nil {
			if localPort, err := strconv.Atoi(portStr); err == nil && localPort > 0 {
				if proc, err := system.GetProcessByLocalPort(localPort); err == nil && proc != nil {
					req.Process = proc
				}
			}
		}
	}

	runtime.EventsEmit(l.app.ctx, "proxy:request", req)
	if l.app.sessionRepo != nil && l.app.currentSess != nil {
		_ = l.app.sessionRepo.SaveRequest(l.app.currentSess.ID, req)
	}
}

func (l *appEventListener) OnResponse(ctx *proxy.Context, resp *proxy.HttpResponse) {
	runtime.EventsEmit(l.app.ctx, "proxy:response", resp)
	if l.app.sessionRepo != nil && resp != nil {
		_ = l.app.sessionRepo.SaveResponse(resp)
	}
}

func (l *appEventListener) OnWsFrame(ctx *proxy.Context, frame *proxy.WsFrame) {
	runtime.EventsEmit(l.app.ctx, "proxy:ws_frame", frame)
}

func (l *appEventListener) OnSSEEvent(ctx *proxy.Context, event *proxy.SSEEvent) {
	runtime.EventsEmit(l.app.ctx, "proxy:sse_event", event)
}

func (l *appEventListener) OnError(ctx *proxy.Context, req *proxy.HttpRequest, err error) {
	runtime.EventsEmit(l.app.ctx, "proxy:error", map[string]any{
		"requestId": func() string {
			if req != nil {
				return req.ID
			}
			return ""
		}(),
		"error": err.Error(),
	})
}

// GetLogFilePath returns the path of the centralized log file.
func (a *App) GetLogFilePath() string {
	return logger.GetLogFilePath()
}

// GetLogDir returns the path of the log directory.
func (a *App) GetLogDir() string {
	return logger.GetLogDir()
}

// GetRecentLogs returns the latest log entries from memory buffer.
func (a *App) GetRecentLogs(limit int) []logger.Entry {
	return logger.GetRecentLogs(limit)
}

// ClearLogs clears all log files and buffer.
func (a *App) ClearLogs() error {
	return logger.ClearLogs()
}

// WriteLog allows the frontend to write structured logs into the persistent log file.
func (a *App) WriteLog(level, category, message string) {
	lvl := logger.ParseLevel(level)
	logger.LogExplicit(lvl, category, "UI", message, nil)
}

// LogFromUI logs an event originating in the React UI with specific caller context.
func (a *App) LogFromUI(level, category, caller, message string) {
	lvl := logger.ParseLevel(level)
	logger.LogExplicit(lvl, category, caller, message, nil)
}

// OpenLogFolder opens the folder containing the log file in the OS file manager.
func (a *App) OpenLogFolder() {
	path := logger.GetLogFilePath()
	dir := filepath.Dir(path)
	_ = os.MkdirAll(dir, 0755)

	switch goRuntime.GOOS {
	case "windows":
		_ = exec.Command("explorer.exe", dir).Start()
	case "darwin":
		_ = exec.Command("open", dir).Start()
	default:
		_ = exec.Command("xdg-open", dir).Start()
	}
}

// DetectJavaInstallations returns all discovered Java JDK/JRE environments on the machine.
func (a *App) DetectJavaInstallations() []cert.JavaInstallation {
	if a.javaMgr == nil {
		if a.certMgr != nil && a.certMgr.CA() != nil {
			a.javaMgr = cert.NewJavaManager(a.certMgr.CA())
		} else {
			return nil
		}
	}
	return a.javaMgr.DetectInstallations()
}

// SelectJavaFolder opens a directory picker, inspects the selected Java home, and returns installation details.
func (a *App) SelectJavaFolder() (*cert.JavaInstallation, error) {
	if a.ctx == nil {
		return nil, fmt.Errorf("app context not ready")
	}
	if a.javaMgr == nil {
		if a.certMgr != nil && a.certMgr.CA() != nil {
			a.javaMgr = cert.NewJavaManager(a.certMgr.CA())
		} else {
			return nil, fmt.Errorf("CA certificate not initialized")
		}
	}

	selectedDir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Java Home Directory (e.g. jdk-17, jdk-21 or jre)",
	})
	if err != nil {
		return nil, err
	}
	if selectedDir == "" {
		return nil, fmt.Errorf("selection cancelled")
	}

	return a.javaMgr.InspectFolder(selectedDir)
}

// InstallCertToJava installs the Root CA certificate into the target Java keystore.
func (a *App) InstallCertToJava(javaPath string) error {
	if a.javaMgr == nil {
		if a.certMgr != nil && a.certMgr.CA() != nil {
			a.javaMgr = cert.NewJavaManager(a.certMgr.CA())
		} else {
			return fmt.Errorf("CA certificate not initialized")
		}
	}
	inst, err := a.javaMgr.InspectFolder(javaPath)
	if err != nil {
		return err
	}
	return a.javaMgr.InstallCert(*inst)
}

// UninstallCertFromJava removes the Root CA certificate from the target Java keystore.
func (a *App) UninstallCertFromJava(javaPath string) error {
	if a.javaMgr == nil {
		if a.certMgr != nil && a.certMgr.CA() != nil {
			a.javaMgr = cert.NewJavaManager(a.certMgr.CA())
		} else {
			return fmt.Errorf("CA certificate not initialized")
		}
	}
	inst, err := a.javaMgr.InspectFolder(javaPath)
	if err != nil {
		return err
	}
	return a.javaMgr.UninstallCert(*inst)
}

// RegisterHARAssociation associates .har files with HTTPeek on the OS.
func (a *App) RegisterHARAssociation() error {
	return platform.RegisterHARAssociation()
}

// UnregisterHARAssociation removes the .har file association from the OS.
func (a *App) UnregisterHARAssociation() error {
	return platform.UnregisterHARAssociation()
}

// IsHARAssociated checks whether .har files are currently associated with HTTPeek.
func (a *App) IsHARAssociated() bool {
	return platform.IsHARAssociated()
}

// GetStartupFile returns any .har or JSON session file passed in CLI arguments on launch.
func (a *App) GetStartupFile() string {
	if len(os.Args) > 1 {
		arg := os.Args[1]
		if strings.HasSuffix(strings.ToLower(arg), ".har") || strings.HasSuffix(strings.ToLower(arg), ".json") {
			if _, err := os.Stat(arg); err == nil {
				return arg
			}
		}
	}
	return ""
}

