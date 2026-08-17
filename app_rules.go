package main

import (
	"encoding/json"
	"os"
	"path/filepath"

	"httpeek/pkg/interceptor"
)

// GetHostsRules retrieves DNS mapping rules.
func (a *App) GetHostsRules() []*interceptor.HostRule {
	if a.hostsInt != nil {
		return a.hostsInt.GetRules()
	}
	return nil
}

// SetHostsRules updates DNS mapping rules.
func (a *App) SetHostsRules(rules []*interceptor.HostRule) {
	if a.hostsInt != nil {
		a.hostsInt.SetRules(rules)
		a.saveRules()
	}
}

// GetRewriteRules retrieves rewrite rules.
func (a *App) GetRewriteRules() []*interceptor.RewriteRule {
	if a.rewriteInt != nil {
		return a.rewriteInt.GetRules()
	}
	return nil
}

// SetRewriteRules updates request/response rewrite mutation rules.
func (a *App) SetRewriteRules(rules []*interceptor.RewriteRule) {
	if a.rewriteInt != nil {
		a.rewriteInt.SetRules(rules)
		a.saveRules()
	}
}

// GetMockRules retrieves request map mock rules.
func (a *App) GetMockRules() []*interceptor.MapRule {
	if a.mockInt != nil {
		return a.mockInt.GetRules()
	}
	return nil
}

// SetMockRules updates synthetic request map mock rules.
func (a *App) SetMockRules(rules []*interceptor.MapRule) {
	if a.mockInt != nil {
		a.mockInt.SetRules(rules)
		a.saveRules()
	}
}

// GetBreakpointRules retrieves breakpoint rules.
func (a *App) GetBreakpointRules() []*interceptor.BreakpointRule {
	if a.breakInt != nil {
		return a.breakInt.GetRules()
	}
	return nil
}

// SetBreakpointRules updates breakpoint pause interception rules.
func (a *App) SetBreakpointRules(rules []*interceptor.BreakpointRule) {
	if a.breakInt != nil {
		a.breakInt.SetRules(rules)
		a.saveRules()
	}
}

// GetBlockRules retrieves blocking rules.
func (a *App) GetBlockRules() []*interceptor.BlockRule {
	if a.blockInt != nil {
		return a.blockInt.GetRules()
	}
	return nil
}

// SetBlockRules updates request blocking rules.
func (a *App) SetBlockRules(rules []*interceptor.BlockRule) {
	if a.blockInt != nil {
		a.blockInt.SetRules(rules)
		a.saveRules()
	}
}

// GetCryptoRules retrieves decryption rules.
func (a *App) GetCryptoRules() []*interceptor.CryptoRule {
	if a.cryptoInt != nil {
		return a.cryptoInt.GetRules()
	}
	return nil
}

// SetCryptoRules updates auto-decryption rules.
func (a *App) SetCryptoRules(rules []*interceptor.CryptoRule) {
	if a.cryptoInt != nil {
		a.cryptoInt.SetRules(rules)
		a.saveRules()
	}
}

// GetScriptRules retrieves JavaScript scripting rules.
func (a *App) GetScriptRules() []*interceptor.ScriptRule {
	if a.scriptInt != nil {
		return a.scriptInt.GetRules()
	}
	return nil
}

// SetScriptRules updates dynamic JavaScript scripting rules.
func (a *App) SetScriptRules(rules []*interceptor.ScriptRule) {
	if a.scriptInt != nil {
		a.scriptInt.SetRules(rules)
		a.saveRules()
	}
}

// GetThrottleProfiles retrieves network throttling profiles.
func (a *App) GetThrottleProfiles() []*interceptor.ThrottleProfile {
	if a.throttleInt != nil {
		return a.throttleInt.GetProfiles()
	}
	return nil
}

// SetThrottleProfiles updates network throttling profiles.
func (a *App) SetThrottleProfiles(profiles []*interceptor.ThrottleProfile) {
	if a.throttleInt != nil {
		a.throttleInt.SetProfiles(profiles)
		a.saveRules()
	}
}

// GetThrottleConfig returns weak network global configuration.
func (a *App) GetThrottleConfig() interceptor.ThrottleConfig {
	if a.throttleInt != nil {
		return a.throttleInt.GetConfig()
	}
	return interceptor.ThrottleConfig{}
}

// SetThrottleConfig updates weak network global configuration.
func (a *App) SetThrottleConfig(cfg interceptor.ThrottleConfig) {
	if a.throttleInt != nil {
		a.throttleInt.SetConfig(cfg)
		a.saveRules()
	}
}

// AddBlockRule appends a new blocking rule.
func (a *App) AddBlockRule(rule *interceptor.BlockRule) {
	if a.blockInt != nil && rule != nil {
		rules := a.blockInt.GetRules()
		rules = append(rules, rule)
		a.blockInt.SetRules(rules)
		a.saveRules()
	}
}

// GetHostFilterConfig retrieves current whitelist and blacklist settings.
func (a *App) GetHostFilterConfig() interceptor.HostFilterConfig {
	if a.filterInt != nil && a.filterInt.Filter() != nil {
		return a.filterInt.Filter().GetConfig()
	}
	return interceptor.HostFilterConfig{
		Whitelist:        []string{},
		Blacklist:        []string{"*.apple.com", "*.icloud.com"},
		BlacklistEnabled: true,
	}
}

// SetHostFilterConfig updates whitelist and blacklist rules.
func (a *App) SetHostFilterConfig(cfg interceptor.HostFilterConfig) {
	if a.filterInt != nil && a.filterInt.Filter() != nil {
		a.filterInt.Filter().SetConfig(cfg)
	}
}

// AddHostToWhitelist adds a domain to capture whitelist.
func (a *App) AddHostToWhitelist(domain string) {
	if a.filterInt != nil && a.filterInt.Filter() != nil {
		a.filterInt.Filter().AddWhitelist(domain)
	}
}

// AddHostToBlacklist adds a domain to capture blacklist.
func (a *App) AddHostToBlacklist(domain string) {
	if a.filterInt != nil && a.filterInt.Filter() != nil {
		a.filterInt.Filter().AddBlacklist(domain)
	}
}

// GetReportConfigs returns webhook report server configurations.
func (a *App) GetReportConfigs() []*interceptor.ReportServerConfig {
	if a.reportInt != nil {
		return a.reportInt.GetConfigs()
	}
	return []*interceptor.ReportServerConfig{}
}

// SetReportConfigs updates webhook report server configurations.
func (a *App) SetReportConfigs(configs []*interceptor.ReportServerConfig) {
	if a.reportInt != nil {
		a.reportInt.SetConfigs(configs)
	}
	a.saveRules()
}

// GetAllRules returns all interceptor rule configurations in one call.
func (a *App) GetAllRules() map[string]any {
	return map[string]any{
		"hostsRules":       a.GetHostsRules(),
		"rewriteRules":     a.GetRewriteRules(),
		"mockRules":        a.GetMockRules(),
		"breakpointRules":  a.GetBreakpointRules(),
		"blockRules":       a.GetBlockRules(),
		"cryptoRules":      a.GetCryptoRules(),
		"scriptRules":      a.GetScriptRules(),
		"throttleProfiles": a.GetThrottleProfiles(),
		"throttleConfig":   a.GetThrottleConfig(),
		"hostFilterConfig": a.GetHostFilterConfig(),
		"reportConfigs":    a.GetReportConfigs(),
	}
}

func (a *App) loadRules() {
	if a.rules != nil {
		a.rules.Load()
		return
	}
	rulesPath := filepath.Join(a.dataDir, "rules.json")
	data, err := os.ReadFile(rulesPath)
	if err != nil {
		return
	}
	var cfg SavedRulesConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		a.emitInitError("Failed to parse rules.json: " + err.Error())
		return
	}
	if len(cfg.HostsRules) > 0 && a.hostsInt != nil {
		a.hostsInt.SetRules(cfg.HostsRules)
	}
	if len(cfg.RewriteRules) > 0 && a.rewriteInt != nil {
		a.rewriteInt.SetRules(cfg.RewriteRules)
	}
	if len(cfg.MockRules) > 0 && a.mockInt != nil {
		a.mockInt.SetRules(cfg.MockRules)
	}
	if len(cfg.BreakpointRules) > 0 && a.breakInt != nil {
		a.breakInt.SetRules(cfg.BreakpointRules)
	}
	if len(cfg.BlockRules) > 0 && a.blockInt != nil {
		a.blockInt.SetRules(cfg.BlockRules)
	}
	if len(cfg.CryptoRules) > 0 && a.cryptoInt != nil {
		a.cryptoInt.SetRules(cfg.CryptoRules)
	}
	if len(cfg.ScriptRules) > 0 && a.scriptInt != nil {
		a.scriptInt.SetRules(cfg.ScriptRules)
	}
	if len(cfg.ThrottleProfiles) > 0 && a.throttleInt != nil {
		a.throttleInt.SetProfiles(cfg.ThrottleProfiles)
	}
	if cfg.ThrottleConfig.Profile != nil && a.throttleInt != nil {
		a.throttleInt.SetConfig(cfg.ThrottleConfig)
	}
	if len(cfg.ReportConfigs) > 0 && a.reportInt != nil {
		a.reportInt.SetConfigs(cfg.ReportConfigs)
	}
	if a.filterInt != nil && a.filterInt.Filter() != nil {
		a.filterInt.Filter().SetConfig(cfg.HostFilterConfig)
	}
}

func (a *App) saveRules() {
	if a.rules != nil {
		a.rules.Save()
		return
	}
	cfg := SavedRulesConfig{
		HostsRules:       a.GetHostsRules(),
		RewriteRules:     a.GetRewriteRules(),
		MockRules:        a.GetMockRules(),
		BreakpointRules:  a.GetBreakpointRules(),
		BlockRules:       a.GetBlockRules(),
		CryptoRules:      a.GetCryptoRules(),
		ScriptRules:      a.GetScriptRules(),
		ThrottleProfiles: a.GetThrottleProfiles(),
		ThrottleConfig:   a.GetThrottleConfig(),
		HostFilterConfig: a.GetHostFilterConfig(),
		ReportConfigs:    a.GetReportConfigs(),
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err == nil {
		_ = os.WriteFile(filepath.Join(a.dataDir, "rules.json"), data, 0644)
	}
}

// SavedRulesConfig holds serialized interceptor rules for local disk persistence.
type SavedRulesConfig struct {
	HostsRules       []*interceptor.HostRule           `json:"hostsRules"`
	RewriteRules     []*interceptor.RewriteRule        `json:"rewriteRules"`
	MockRules        []*interceptor.MapRule            `json:"mockRules"`
	BreakpointRules  []*interceptor.BreakpointRule     `json:"breakpointRules"`
	BlockRules       []*interceptor.BlockRule          `json:"blockRules"`
	CryptoRules      []*interceptor.CryptoRule         `json:"cryptoRules"`
	ScriptRules      []*interceptor.ScriptRule         `json:"scriptRules"`
	ThrottleProfiles []*interceptor.ThrottleProfile    `json:"throttleProfiles"`
	ThrottleConfig   interceptor.ThrottleConfig        `json:"throttleConfig"`
	HostFilterConfig interceptor.HostFilterConfig      `json:"hostFilterConfig"`
	ReportConfigs    []*interceptor.ReportServerConfig `json:"reportConfigs,omitempty"`
}
