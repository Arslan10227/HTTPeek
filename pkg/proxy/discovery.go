package proxy

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"sync"
	"time"

	"httpeek/pkg/logger"
)

// DiscoveryBeacon represents service broadcast metadata for mobile companion discovery.
type DiscoveryBeacon struct {
	Service   string `json:"service"`
	Name      string `json:"name"`
	Port      int    `json:"port"`
	Version   string `json:"version"`
	HostName  string `json:"hostname"`
	Platform  string `json:"platform"`
	Timestamp int64  `json:"timestamp"`
}

// DiscoveryBroadcaster broadcasts mDNS / LAN discovery beacons to allow zero-config mobile pairing.
type DiscoveryBroadcaster struct {
	port    int
	stopCh  chan struct{}
	running bool
	mu      sync.Mutex
}

// NewDiscoveryBroadcaster creates a broadcaster for the specified proxy port.
func NewDiscoveryBroadcaster(port int) *DiscoveryBroadcaster {
	return &DiscoveryBroadcaster{
		port:   port,
		stopCh: make(chan struct{}),
	}
}

// Start begins broadcasting discovery packets on LAN multicast and broadcast.
func (d *DiscoveryBroadcaster) Start() {
	d.mu.Lock()
	if d.running {
		d.mu.Unlock()
		return
	}
	d.running = true
	d.stopCh = make(chan struct{})
	d.mu.Unlock()

	go d.broadcastLoop()
}

// Stop terminates the discovery broadcast loop.
func (d *DiscoveryBroadcaster) Stop() {
	d.mu.Lock()
	defer d.mu.Unlock()
	if !d.running {
		return
	}
	d.running = false
	close(d.stopCh)
}

func (d *DiscoveryBroadcaster) broadcastLoop() {
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "HTTPeek-Desktop"
	}

	broadcastAddr, err := net.ResolveUDPAddr("udp4", "255.255.255.255:9098")
	if err != nil {
		logger.Warn("Discovery", fmt.Sprintf("Failed to resolve broadcast address: %v", err))
		return
	}

	conn, err := net.ListenUDP("udp4", nil)
	if err != nil {
		logger.Warn("Discovery", fmt.Sprintf("Failed to open UDP discovery socket: %v", err))
		return
	}
	defer conn.Close()

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	logger.Info("Discovery", fmt.Sprintf("LAN Discovery Broadcaster active on port 9098 (Proxy Port: %d)", d.port))

	for {
		select {
		case <-d.stopCh:
			return
		case <-ticker.C:
			beacon := DiscoveryBeacon{
				Service:   "httpeek_companion",
				Name:      "HTTPeek (" + hostname + ")",
				Port:      d.port,
				Version:   "1.0.0",
				HostName:  hostname,
				Platform:  "desktop",
				Timestamp: time.Now().UnixMilli(),
			}

			data, err := json.Marshal(beacon)
			if err == nil {
				_, _ = conn.WriteTo(data, broadcastAddr)
			}
		}
	}
}
