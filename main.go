package main

import (
	"embed"
	"fmt"

	"httpeek/pkg/logger"

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

	logger.Info("Main", "Starting HTTPeek - Next Gen HTTP Debugging Tool by OneManByte...")

	app := NewApp()

	err := wails.Run(&options.App{
		Title:     "HTTPeek - Next Gen HTTP Debugging Tool",
		Width:     1360,
		Height:    860,
		MinWidth:  1024,
		MinHeight: 700,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 255, G: 255, B: 255, A: 255},
		OnStartup:        app.startup,
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
