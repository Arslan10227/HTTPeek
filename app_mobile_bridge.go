package main

import (
	"encoding/json"
	"fmt"

	"httpeek/internal/services"
	"httpeek/pkg/interceptor"
	"httpeek/pkg/proxy"
)

// appMobileBridge implements proxy.MobileAPIBridge for embedded mobile REST.
type appMobileBridge struct {
	app *App
}

func (b *appMobileBridge) ExportHAR(requests []*proxy.HttpRequest) (string, error) {
	if b.app.sessions == nil {
		return "", fmt.Errorf("sessions service not initialized")
	}
	return b.app.sessions.ExportHAR(requests)
}

func (b *appMobileBridge) ImportHAR(harJSON, sessionName string) (any, error) {
	if b.app.sessions == nil {
		return nil, fmt.Errorf("sessions service not initialized")
	}
	return b.app.sessions.ImportHAR(harJSON, sessionName)
}

func (b *appMobileBridge) ListSessions() (any, error) {
	if b.app.sessions == nil {
		return nil, fmt.Errorf("sessions service not initialized")
	}
	return b.app.sessions.ListSessions()
}

func (b *appMobileBridge) GetSessionRequests(sessionID string) (any, error) {
	if b.app.sessions == nil {
		return nil, fmt.Errorf("sessions service not initialized")
	}
	return b.app.sessions.GetSessionRequests(sessionID)
}

func (b *appMobileBridge) DeleteSession(sessionID string) error {
	if b.app.sessions == nil {
		return fmt.Errorf("sessions service not initialized")
	}
	return b.app.sessions.DeleteSession(sessionID)
}

func (b *appMobileBridge) GetFavorites() (any, error) {
	if b.app.sessions == nil {
		return nil, fmt.Errorf("sessions service not initialized")
	}
	return b.app.sessions.GetFavorites()
}

func (b *appMobileBridge) ToggleFavorite(requestID string, isFavorite bool) error {
	if b.app.sessions == nil {
		return fmt.Errorf("sessions service not initialized")
	}
	return b.app.sessions.ToggleFavorite(requestID, isFavorite)
}

func (b *appMobileBridge) GetRules(kind string) (any, error) {
	if b.app.rules == nil {
		return nil, fmt.Errorf("rules service not initialized")
	}
	return b.app.rules.GetByKind(kind), nil
}

func (b *appMobileBridge) SetRules(kind string, payload []byte) error {
	if b.app.rules == nil {
		return fmt.Errorf("rules service not initialized")
	}
	return b.app.rules.SetByKind(kind, payload)
}

func (b *appMobileBridge) ResumeBreakpoint(requestID string, isResponse bool, modifiedJSON string) error {
	return b.app.ResumeBreakpoint(requestID, isResponse, modifiedJSON)
}

func (b *appMobileBridge) GetReportConfigs() (any, error) {
	if b.app.reportInt == nil {
		return []*interceptor.ReportServerConfig{}, nil
	}
	return b.app.reportInt.GetConfigs(), nil
}

func (b *appMobileBridge) SetReportConfigs(payload []byte) error {
	var configs []*interceptor.ReportServerConfig
	if err := json.Unmarshal(payload, &configs); err != nil {
		return err
	}
	if b.app.reportInt != nil {
		b.app.reportInt.SetConfigs(configs)
	}
	if b.app.rules != nil {
		b.app.rules.Save()
	}
	return nil
}

func (b *appMobileBridge) CreateSession(name string) (any, error) {
	return b.app.CreateNewSession(name)
}

func (b *appMobileBridge) RepeatRequest(requestID string) (any, error) {
	if b.app.sessionRepo == nil {
		return nil, fmt.Errorf("session repo not initialized")
	}
	reqs, err := b.app.sessionRepo.GetSessionRequests("")
	if err == nil {
		for _, r := range reqs {
			if r.ID == requestID {
				return b.app.ReplayRequest(*r)
			}
		}
	}
	return nil, fmt.Errorf("request %s not found", requestID)
}

func (b *appMobileBridge) GetAllRules() (map[string]any, error) {
	return b.app.GetAllRules(), nil
}

func (b *appMobileBridge) AbortBreakpoint(requestID string, isResponse bool) error {
	return b.app.AbortBreakpoint(requestID, isResponse)
}

func (b *appMobileBridge) SendCustomRequest(reqJSON string) (any, error) {
	return b.app.SendCustomRequest(reqJSON)
}

func (a *App) attachMobileBridge() {
	if a.server != nil {
		a.server.SetMobileAPIBridge(&appMobileBridge{app: a})
	}
}

// WireServices initializes extracted service layer helpers.
func (a *App) wireServices() {
	if a.server != nil && a.certMgr != nil && a.chain != nil {
		a.proxySvc = services.NewProxyService(a.server, a.certMgr, a.chain)
	}
	if a.certMgr != nil && a.certSvc == nil {
		a.certSvc = services.NewCertService(a.certMgr, a.trust)
	}
	if a.sessionRepo != nil && a.sessions == nil {
		a.sessions = services.NewSessionService(a.sessionRepo)
	}
	if a.rules == nil {
		a.rules = services.NewRulesService(a.dataDir, services.RulesDeps{
			HostsInt:    a.hostsInt,
			RewriteInt:  a.rewriteInt,
			MockInt:     a.mockInt,
			BreakInt:    a.breakInt,
			BlockInt:    a.blockInt,
			CryptoInt:   a.cryptoInt,
			ScriptInt:   a.scriptInt,
			ThrottleInt: a.throttleInt,
			FilterInt:   a.filterInt,
			ReportInt:   a.reportInt,
		})
	}
}
