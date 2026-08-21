package services

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"httpeek/pkg/interceptor"
	"httpeek/pkg/logger"
)

// rulesSchemaVersion is the persisted-rules schema version. Increment when
// the SavedRulesConfig shape changes in a backwards-incompatible way; Load
// will reject files with a newer schema than the binary understands.
const rulesSchemaVersion = 1

// SavedRulesConfig holds serialized interceptor rules for local disk persistence.
type SavedRulesConfig struct {
	SchemaVersion    int                              `json:"schemaVersion,omitempty"`
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

// Save persists all rule configurations to disk atomically. The previous
// rules.json (if any) is rotated to rules.json.bak before the new content
// is renamed into place, so a crash never leaves a truncated rules file.
func (s *RulesService) Save() {
	cfg := s.Snapshot()
	cfg.SchemaVersion = rulesSchemaVersion
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		logger.Warn("Rules", fmt.Sprintf("marshal rules failed: %v", err))
		return
	}
	if err := atomicWriteRulesFile(s.dataDir, data); err != nil {
		logger.Warn("Rules", fmt.Sprintf("atomic save rules failed: %v", err))
	}
}

// Load reads persisted rules from disk. If rules.json is missing or corrupt,
// it falls back to rules.json.bak. A schema-version mismatch logs a warning
// and still attempts to apply the file (forward-compat is rejected).
func (s *RulesService) Load() {
	cfg, err := loadRulesFile(s.dataDir)
	if err != nil {
		logger.Warn("Rules", fmt.Sprintf("load rules failed: %v", err))
		return
	}
	if cfg.SchemaVersion > rulesSchemaVersion {
		logger.Warn("Rules", fmt.Sprintf("rules.json schema version %d is newer than supported %d; ignoring", cfg.SchemaVersion, rulesSchemaVersion))
		return
	}
	s.Apply(*cfg)
}

// atomicWriteRulesFile writes data to a temp file in the same directory,
// then renames it over rules.json. The previous rules.json is backed up to
// rules.json.bak. The temp file uses 0600 to avoid leaking rule contents.
func atomicWriteRulesFile(dir string, data []byte) error {
	finalPath := filepath.Join(dir, "rules.json")
	backupPath := filepath.Join(dir, "rules.json.bak")
	tempPath := filepath.Join(dir, ".rules.json.tmp")

	if err := os.WriteFile(tempPath, data, 0600); err != nil {
		return fmt.Errorf("write temp rules file: %w", err)
	}

	// Back up the existing rules.json before replacing it.
	if _, err := os.Stat(finalPath); err == nil {
		_ = os.Rename(finalPath, backupPath)
	}

	if err := os.Rename(tempPath, finalPath); err != nil {
		// Attempt to restore from backup so we don't lose the old file.
		_ = os.Rename(backupPath, finalPath)
		return fmt.Errorf("rename temp rules file: %w", err)
	}
	return nil
}

// loadRulesFile reads rules.json, falling back to rules.json.bak if the
// primary file is missing or fails to parse.
func loadRulesFile(dir string) (*SavedRulesConfig, error) {
	primary := filepath.Join(dir, "rules.json")
	data, err := os.ReadFile(primary)
	if err != nil {
		// Try backup.
		backup := filepath.Join(dir, "rules.json.bak")
		data, err = os.ReadFile(backup)
		if err != nil {
			return nil, fmt.Errorf("read rules file: %w", err)
		}
	}
	var cfg SavedRulesConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		// Try backup before giving up.
		backup := filepath.Join(dir, "rules.json.bak")
		bData, bErr := os.ReadFile(backup)
		if bErr != nil {
			return nil, fmt.Errorf("parse rules.json: %w", err)
		}
		if err := json.Unmarshal(bData, &cfg); err != nil {
			return nil, fmt.Errorf("parse rules.json.bak: %w", err)
		}
	}
	return &cfg, nil
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
		cfg.ThrottleConfig = s.deps.ThrottleInt.GetConfig()
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
	if cfg.ThrottleConfig.Profile != nil && s.deps.ThrottleInt != nil {
		s.deps.ThrottleInt.SetConfig(cfg.ThrottleConfig)
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
