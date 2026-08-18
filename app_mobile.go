package main

import (
	"httpeek/pkg/proxy"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// GetConnectedMobileDevices returns a list of active Android/iOS devices paired with desktop.
func (a *App) GetConnectedMobileDevices() []proxy.MobileDeviceInfo {
	if a.server != nil && a.server.MobileAPI() != nil {
		return a.server.MobileAPI().GetConnectedDevices()
	}
	return []proxy.MobileDeviceInfo{}
}

// DisconnectMobileDevice disconnects a target mobile device.
func (a *App) DisconnectMobileDevice(deviceID string) {
	if a.server != nil && a.server.MobileAPI() != nil {
		a.server.MobileAPI().DisconnectDevice(deviceID)
	}
}

// WireMobileEvents registers real-time device change callbacks with Wails runtime.
func (a *App) wireMobileEvents() {
	if a.server != nil && a.server.MobileAPI() != nil {
		a.server.MobileAPI().SetOnDeviceChange(func(devices []proxy.MobileDeviceInfo) {
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "mobile:devices_changed", devices)
			}
		})
	}
}
