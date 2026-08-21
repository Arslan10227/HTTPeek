package services

import (
	"os"
	"strings"
	"testing"

	"httpeek/pkg/interceptor"
)

// TestAtomicRulesSaveAndBackup verifies the rules service writes atomically
// and creates a backup of the previous file.
func TestAtomicRulesSaveAndBackup(t *testing.T) {
	tmpDir := t.TempDir()
	svc := NewRulesService(tmpDir, RulesDeps{})

	// First save.
	svc.deps.BlockInt = interceptor.NewRequestBlockInterceptor()
	svc.deps.BlockInt.SetRules([]*interceptor.BlockRule{
		{ID: "r1", Name: "first", Enabled: true, URLPattern: "https://a.test/*"},
	})
	svc.Save()

	primary := tmpDir + "/rules.json"
	if _, err := os.Stat(primary); err != nil {
		t.Fatalf("rules.json not written: %v", err)
	}

	// Second save — backup should appear.
	svc.deps.BlockInt.SetRules([]*interceptor.BlockRule{
		{ID: "r2", Name: "second", Enabled: true, URLPattern: "https://b.test/*"},
	})
	svc.Save()

	backup := tmpDir + "/rules.json.bak"
	backupData, err := os.ReadFile(backup)
	if err != nil {
		t.Fatalf("rules.json.bak not created: %v", err)
	}
	if !strings.Contains(string(backupData), "first") {
		t.Error("backup should contain the previous rules content")
	}
	primaryData, _ := os.ReadFile(primary)
	if !strings.Contains(string(primaryData), "second") {
		t.Error("primary should contain the new rules content")
	}
}

// TestRulesLoadFallsBackToBackup verifies that a corrupt rules.json falls
// back to the backup file.
func TestRulesLoadFallsBackToBackup(t *testing.T) {
	tmpDir := t.TempDir()
	svc := NewRulesService(tmpDir, RulesDeps{BlockInt: interceptor.NewRequestBlockInterceptor()})

	// First save — creates rules.json.
	svc.deps.BlockInt.SetRules([]*interceptor.BlockRule{
		{ID: "r0", Name: "initial", Enabled: true, URLPattern: "https://init.test/*"},
	})
	svc.Save()

	// Second save — rotates the first to rules.json.bak.
	svc.deps.BlockInt.SetRules([]*interceptor.BlockRule{
		{ID: "r1", Name: "backup-rule", Enabled: true, URLPattern: "https://a.test/*"},
	})
	svc.Save()

	// Corrupt the primary file.
	if err := os.WriteFile(tmpDir+"/rules.json", []byte("{not valid json"), 0600); err != nil {
		t.Fatalf("corrupt write: %v", err)
	}

	// Load should fall back to backup, which contains the *first* save.
	svc.deps.BlockInt = interceptor.NewRequestBlockInterceptor()
	svc.Load()
	rules := svc.deps.BlockInt.GetRules()
	if len(rules) != 1 {
		t.Fatalf("expected 1 backup rule, got %d: %+v", len(rules), rules)
	}
	if rules[0].Name != "initial" {
		t.Errorf("expected name 'initial' (from backup), got %q (ID=%q)", rules[0].Name, rules[0].ID)
	}
}

// TestRulesSchemaVersionRejectsFuture verifies a newer schema version is
// ignored rather than blindly applied.
func TestRulesSchemaVersionRejectsFuture(t *testing.T) {
	tmpDir := t.TempDir()
	// Write a file with a future schema version.
	future := `{"schemaVersion":999,"blockRules":[{"id":"x","name":"future","enabled":true,"urlPattern":"https://x.test/*"}]}`
	if err := os.WriteFile(tmpDir+"/rules.json", []byte(future), 0600); err != nil {
		t.Fatalf("write: %v", err)
	}

	svc := NewRulesService(tmpDir, RulesDeps{BlockInt: interceptor.NewRequestBlockInterceptor()})
	svc.Load()
	if rules := svc.deps.BlockInt.GetRules(); len(rules) != 0 {
		t.Errorf("future schema should be ignored, got %d rules", len(rules))
	}
}

// TestRulesSchemaVersionInSave verifies the schema version is written.
func TestRulesSchemaVersionInSave(t *testing.T) {
	tmpDir := t.TempDir()
	svc := NewRulesService(tmpDir, RulesDeps{})
	svc.Save()
	data, err := os.ReadFile(tmpDir + "/rules.json")
	if err != nil {
		t.Fatalf("read rules.json: %v", err)
	}
	if !strings.Contains(string(data), `"schemaVersion"`) {
		t.Error("saved rules.json should include schemaVersion")
	}
}

// TestRulesThrottleConfigPersisted verifies ThrottleConfig is saved and
// restored (previously missing from the services SavedRulesConfig).
func TestRulesThrottleConfigPersisted(t *testing.T) {
	tmpDir := t.TempDir()
	svc := NewRulesService(tmpDir, RulesDeps{ThrottleInt: interceptor.NewNetworkThrottleInterceptor()})
	svc.deps.ThrottleInt.SetConfig(interceptor.ThrottleConfig{
		Enabled: true,
		Profile: &interceptor.ThrottleProfile{ID: "p1", Name: "3G", Enabled: true, LatencyMs: 100},
	})
	svc.Save()

	svc2 := NewRulesService(tmpDir, RulesDeps{ThrottleInt: interceptor.NewNetworkThrottleInterceptor()})
	svc2.Load()
	cfg := svc2.deps.ThrottleInt.GetConfig()
	if !cfg.Enabled || cfg.Profile == nil || cfg.Profile.Name != "3G" {
		t.Errorf("throttle config not restored: %+v", cfg)
	}
}
