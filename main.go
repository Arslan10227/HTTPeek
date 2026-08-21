package main

import (
	"embed"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"httpeek/pkg/logger"
	"httpeek/pkg/system"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

const hostedBaseURL = "https://httpeek.web.app"

var (
	hostedClient = &http.Client{
		Timeout: 3 * time.Second,
	}
	isHostedAvailable = false
	hostedCheckOnce   sync.Once
)

func checkHostedAvailability() bool {
	req, err := http.NewRequest("GET", hostedBaseURL+"/index.html", nil)
	if err != nil {
		return false
	}
	// Avoid caching issues during health check
	req.Header.Set("Cache-Control", "no-cache")
	resp, err := hostedClient.Do(req)
	if err == nil && resp.StatusCode == http.StatusOK {
		resp.Body.Close()
		return true
	}
	if resp != nil && resp.Body != nil {
		resp.Body.Close()
	}
	return false
}

func dynamicAssetMiddleware(next http.Handler) http.Handler {
	hostedCheckOnce.Do(func() {
		isHostedAvailable = checkHostedAvailability()
		if isHostedAvailable {
			logger.Info("AssetServer", fmt.Sprintf("Using Hosted WebUI from %s (Online Mode)", hostedBaseURL))
		} else {
			logger.Info("AssetServer", "Hosted WebUI unavailable or offline. Using Embedded Local Assets (Offline Fallback)")
		}
	})

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Always delegate internal Wails runtime and IPC routes to local handler
		if strings.HasPrefix(path, "/wails/") || strings.HasPrefix(path, "/wails/runtime") {
			next.ServeHTTP(w, r)
			return
		}

		if isHostedAvailable {
			targetURL := hostedBaseURL + path
			req, err := http.NewRequestWithContext(r.Context(), r.Method, targetURL, r.Body)
			if err == nil {
				for k, v := range r.Header {
					req.Header[k] = v
				}
				resp, fetchErr := hostedClient.Do(req)
				if fetchErr == nil && (resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNotModified) {
					defer resp.Body.Close()
					for k, v := range resp.Header {
						w.Header()[k] = v
					}
					w.WriteHeader(resp.StatusCode)
					_, _ = io.Copy(w, resp.Body)
					return
				}
				if resp != nil && resp.Body != nil {
					resp.Body.Close()
				}
			}
		}

		// Seamless fallback to local embedded assets
		next.ServeHTTP(w, r)
	})
}

func main() {
	// 1. Initialize Centralized Logger immediately
	logger.Init()
	defer logger.Close()

	// Guaranteed failsafe: Always reset system proxy when process exits
	defer func() {
		_ = system.SetSystemProxy(false, "", 0, "")
	}()

	// Signal handling for graceful termination
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		<-sigChan
		_ = system.SetSystemProxy(false, "", 0, "")
		os.Exit(0)
	}()

	logger.Info("Main", "Starting HTTPeek - Next Gen HTTP Debugging Tool by OneManByte...")

	app := NewApp()

	err := wails.Run(&options.App{
		Title:            "HTTPeek - Next Gen HTTP Debugging Tool",
		Width:            1360,
		Height:           860,
		MinWidth:         1024,
		MinHeight:        700,
		WindowStartState: options.Maximised,
		AssetServer: &assetserver.Options{
			Assets:     assets,
			Middleware: dynamicAssetMiddleware,
		},
		BackgroundColour: &options.RGBA{R: 255, G: 255, B: 255, A: 255},
		OnStartup:        app.startup,
		OnBeforeClose:    app.beforeClose,
		OnShutdown:       app.shutdown,
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			BackdropType:         windows.None,
			DisableWindowIcon:    false,
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		logger.Fatal("Main", fmt.Sprintf("ProxyPin execution failed: %v", err))
	}
}
