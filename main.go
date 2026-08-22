package main

import (
	"embed"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"httpeek/pkg/logger"
	"httpeek/pkg/system"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

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

	logger.Info("Main", "Starting HTTPeek - Next Gen HTTP Debugging Tool by OneManByte (Local Embedded UI)...")

	app := NewApp()

	err := wails.Run(&options.App{
		Title:            "HTTPeek - Next Gen HTTP Debugging Tool",
		Width:            1360,
		Height:           860,
		MinWidth:         1024,
		MinHeight:        700,
		WindowStartState: options.Maximised,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 8, G: 11, B: 16, A: 255},
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
		logger.Fatal("Main", fmt.Sprintf("HTTPeek execution failed: %v", err))
	}
}
