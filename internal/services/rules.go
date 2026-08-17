package services

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"httpeek/pkg/interceptor"
)

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
	HostFilterConfig interceptor.HostFilterConfig      `json:"hostFilterConfig"`
	ReportConfigs    []*interceptor.ReportServerConfig `json:"reportConfigs,omitempty"`
}

// RulesDeps holds interceptor references for rule persistence.
type RulesDeps struct {
	HostsInt    *interceptor.HostsInterceptor
	RewriteInt  *interceptor.RequestRewriteInterceptor
	MockInt     *interceptor.RequestMapInterceptor
	BreakInt    *interceptor.RequestBreakpointInterceptor
	BlockInt    *interceptor.RequestBlockInterceptor
	CryptoInt   *interceptor.RequestCryptoInterceptor
	ScriptInt   *interceptor.ScriptInterceptor
	ThrottleInt *interceptor.NetworkThrottleInterceptor
	FilterInt   *interceptor.HostFilterInterceptor
	ReportInt   *interceptor.ReportServerInterceptor
}

// RulesService manages rule load/save and CRUD delegation.
type RulesService struct {
	dataDir string
	deps    RulesDeps
}

// NewRulesService creates a rules service.
func NewRulesService(dataDir string, deps RulesDeps) *RulesService {
	return &RulesService{dataDir: dataDir, deps: deps}
}

// Save persists all rule configurations to disk.
func (s *RulesService) Save() {
	cfg := s.Snapshot()
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err == nil {
		_ = os.WriteFile(filepath.Join(s.dataDir, "rules.json"), data, 0644)
	}
}

// Load reads persisted rules from disk.
func (s *RulesService) Load() {
	data, err := os.ReadFile(filepath.Join(s.dataDir, "rules.json"))
	if err != nil {
		return
	}
	var cfg SavedRulesConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return
	}
	s.Apply(cfg)
}

// Snapshot returns current in-memory rule state.
func (s *RulesService) Snapshot() SavedRulesConfig {
	cfg := SavedRulesConfig{}
	if s.deps.HostsInt != nil {
		cfg.HostsRules = s.deps.HostsInt.GetRules()
	}
	if s.deps.RewriteInt != nil {
		cfg.RewriteRules = s.deps.RewriteInt.GetRules()
	}
	if s.deps.MockInt != nil {
		cfg.MockRules = s.deps.MockInt.GetRules()
	}
	if s.deps.BreakInt != nil {
		cfg.BreakpointRules = s.deps.BreakInt.GetRules()
	}
	if s.deps.BlockInt != nil {
		cfg.BlockRules = s.deps.BlockInt.GetRules()
	}
	if s.deps.CryptoInt != nil {
		cfg.CryptoRules = s.deps.CryptoInt.GetRules()
	}
	if s.deps.ScriptInt != nil {
		cfg.ScriptRules = s.deps.ScriptInt.GetRules()
	}
	if s.deps.ThrottleInt != nil {
		cfg.ThrottleProfiles = s.deps.ThrottleInt.GetProfiles()
	}
	if s.deps.FilterInt != nil && s.deps.FilterInt.Filter() != nil {
		cfg.HostFilterConfig = s.deps.FilterInt.Filter().GetConfig()
	}
	if s.deps.ReportInt != nil {
		cfg.ReportConfigs = s.deps.ReportInt.GetConfigs()
	}
	return cfg
}

// Apply loads a saved config into interceptors.
func (s *RulesService) Apply(cfg SavedRulesConfig) {
	if len(cfg.HostsRules) > 0 && s.deps.HostsInt != nil {
		s.deps.HostsInt.SetRules(cfg.HostsRules)
	}
	if len(cfg.RewriteRules) > 0 && s.deps.RewriteInt != nil {
		s.deps.RewriteInt.SetRules(cfg.RewriteRules)
	}
	if len(cfg.MockRules) > 0 && s.deps.MockInt != nil {
		s.deps.MockInt.SetRules(cfg.MockRules)
	}
	if len(cfg.BreakpointRules) > 0 && s.deps.BreakInt != nil {
		s.deps.BreakInt.SetRules(cfg.BreakpointRules)
	}
	if len(cfg.BlockRules) > 0 && s.deps.BlockInt != nil {
		s.deps.BlockInt.SetRules(cfg.BlockRules)
	}
	if len(cfg.CryptoRules) > 0 && s.deps.CryptoInt != nil {
		s.deps.CryptoInt.SetRules(cfg.CryptoRules)
	}
	if len(cfg.ScriptRules) > 0 && s.deps.ScriptInt != nil {
		s.deps.ScriptInt.SetRules(cfg.ScriptRules)
	}
	if len(cfg.ThrottleProfiles) > 0 && s.deps.ThrottleInt != nil {
		s.deps.ThrottleInt.SetProfiles(cfg.ThrottleProfiles)
	}
	if s.deps.FilterInt != nil && s.deps.FilterInt.Filter() != nil {
		s.deps.FilterInt.Filter().SetConfig(cfg.HostFilterConfig)
	}
	if len(cfg.ReportConfigs) > 0 && s.deps.ReportInt != nil {
		s.deps.ReportInt.SetConfigs(cfg.ReportConfigs)
	}
}

// GetByKind returns rules for a mobile API kind string.
func (s *RulesService) GetByKind(kind string) any {
	switch kind {
	case "hosts":
		if s.deps.HostsInt != nil {
			return s.deps.HostsInt.GetRules()
		}
	case "rewrite":
		if s.deps.RewriteInt != nil {
			return s.deps.RewriteInt.GetRules()
		}
	case "mock":
		if s.deps.MockInt != nil {
			return s.deps.MockInt.GetRules()
		}
	case "breakpoint":
		if s.deps.BreakInt != nil {
			return s.deps.BreakInt.GetRules()
		}
	case "block":
		if s.deps.BlockInt != nil {
			return s.deps.BlockInt.GetRules()
		}
	case "crypto":
		if s.deps.CryptoInt != nil {
			return s.deps.CryptoInt.GetRules()
		}
	case "script":
		if s.deps.ScriptInt != nil {
			return s.deps.ScriptInt.GetRules()
		}
	case "throttle":
		if s.deps.ThrottleInt != nil {
			return s.deps.ThrottleInt.GetConfig()
		}
	case "filter":
		if s.deps.FilterInt != nil && s.deps.FilterInt.Filter() != nil {
			return s.deps.FilterInt.Filter().GetConfig()
		}
	case "report":
		if s.deps.ReportInt != nil {
			return s.deps.ReportInt.GetConfigs()
		}
	}
	return nil
}

// SetByKind updates rules from JSON payload for a given kind.
func (s *RulesService) SetByKind(kind string, payload []byte) error {
	switch kind {
	case "hosts":
		var rules []*interceptor.HostRule
		if err := json.Unmarshal(payload, &rules); err != nil {
			return err
		}
		if s.deps.HostsInt != nil {
			s.deps.HostsInt.SetRules(rules)
		}
	case "rewrite":
		var rules []*interceptor.RewriteRule
		if err := json.Unmarshal(payload, &rules); err != nil {
			return err
		}
		if s.deps.RewriteInt != nil {
			s.deps.RewriteInt.SetRules(rules)
		}
	case "mock":
		var rules []*interceptor.MapRule
		if err := json.Unmarshal(payload, &rules); err != nil {
			return err
		}
		if s.deps.MockInt != nil {
			s.deps.MockInt.SetRules(rules)
		}
	case "breakpoint":
		var rules []*interceptor.BreakpointRule
		if err := json.Unmarshal(payload, &rules); err != nil {
			return err
		}
		if s.deps.BreakInt != nil {
			s.deps.BreakInt.SetRules(rules)
		}
	case "block":
		var rules []*interceptor.BlockRule
		if err := json.Unmarshal(payload, &rules); err != nil {
			return err
		}
		if s.deps.BlockInt != nil {
			s.deps.BlockInt.SetRules(rules)
		}
	case "crypto":
		var rules []*interceptor.CryptoRule
		if err := json.Unmarshal(payload, &rules); err != nil {
			return err
		}
		if s.deps.CryptoInt != nil {
			s.deps.CryptoInt.SetRules(rules)
		}
	case "script":
		var rules []*interceptor.ScriptRule
		if err := json.Unmarshal(payload, &rules); err != nil {
			return err
		}
		if s.deps.ScriptInt != nil {
			s.deps.ScriptInt.SetRules(rules)
		}
	case "throttle":
		// Handle both slice of profiles and single global config object
		var cfg interceptor.ThrottleConfig
		if err := json.Unmarshal(payload, &cfg); err == nil && cfg.Profile != nil {
			if s.deps.ThrottleInt != nil {
				s.deps.ThrottleInt.SetConfig(cfg)
			}
		} else {
			var profiles []*interceptor.ThrottleProfile
			if err := json.Unmarshal(payload, &profiles); err != nil {
				return err
			}
			if s.deps.ThrottleInt != nil {
				s.deps.ThrottleInt.SetProfiles(profiles)
			}
		}
	case "filter":
		var cfg interceptor.HostFilterConfig
		if err := json.Unmarshal(payload, &cfg); err != nil {
			return err
		}
		if s.deps.FilterInt != nil && s.deps.FilterInt.Filter() != nil {
			s.deps.FilterInt.Filter().SetConfig(cfg)
		}
	case "report":
		var rules []*interceptor.ReportServerConfig
		if err := json.Unmarshal(payload, &rules); err != nil {
			return err
		}
		if s.deps.ReportInt != nil {
			s.deps.ReportInt.SetConfigs(rules)
		}
	default:
		return fmt.Errorf("unsupported rule kind: %s", kind)
	}
	s.Save()
	return nil
}
