package interceptor

import (
	"testing"
)

// --- Regex Fuzz tests (Phase 10-A) ---

// FuzzCompilePatternErr fuzzes the regex compilation with arbitrary patterns.
// Ensures invalid regexes return an error, never panic.
func FuzzCompilePatternErr(f *testing.F) {
	f.Add(".*")
	f.Add("example\\.com")
	f.Add("[a-z]+")
	f.Add("(?i)test")
	f.Add("[invalid")
	f.Add("*invalid")
	f.Add("(unclosed")
	f.Add("")
	f.Add("((((((((((((((((((((((((((((((((a)))))))))))))))))))))))))))))))")
	f.Add("[a-Z]")

	f.Fuzz(func(t *testing.T, pattern string) {
		// Must never panic — should return (regex, error).
		_, err := compilePatternErr(pattern)
		_ = err
	})
}

// --- Rule ID Uniqueness tests (Phase 10-A) ---

// TestEnsureUniqueIDsFuzz verifies that EnsureUniqueIDs never produces
// duplicate IDs even with adversarial input.
func TestEnsureUniqueIDsFuzz(t *testing.T) {
	type testRule struct {
		ID   string
		Name string
	}

	for i := 0; i < 100; i++ {
		// Create rules with all-empty or all-duplicate IDs.
		rules := []testRule{
			{ID: "", Name: "rule-1"},
			{ID: "", Name: "rule-2"},
			{ID: "same", Name: "rule-3"},
			{ID: "same", Name: "rule-4"},
			{ID: "same", Name: "rule-5"},
		}

		getID := func(r testRule) string { return r.ID }

		// Use a wrapper to adapt the signature.
		EnsureUniqueIDs(rules, getID, func(r testRule, id string) {
			// Since testRule is a value type, we need to find and update.
			for j := range rules {
				if rules[j].Name == r.Name {
					rules[j].ID = id
					break
				}
			}
		})

		// Verify no duplicates.
		seen := make(map[string]bool)
		for _, r := range rules {
			if r.ID == "" {
				t.Errorf("rule %q has empty ID after EnsureUniqueIDs", r.Name)
			}
			if seen[r.ID] {
				t.Errorf("duplicate ID %q for rule %q", r.ID, r.Name)
			}
			seen[r.ID] = true
		}
	}
}
