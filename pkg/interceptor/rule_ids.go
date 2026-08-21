package interceptor

import (
	"fmt"

	"github.com/google/uuid"
)

// EnsureUniqueIDs walks a slice of rule-like values and ensures every element
// has a non-empty, unique ID. Empty IDs are assigned a new UUID; duplicate IDs
// get a suffix. The mutate callback receives the element pointer and the ID
// to assign. This centralizes NEWI-002 (rule ID uniqueness) across all rule
// families without duplicating logic in every SetRules method.
func EnsureUniqueIDs[T any](rules []T, getID func(T) string, setID func(T, string)) {
	seen := make(map[string]bool, len(rules))
	for i := range rules {
		id := getID(rules[i])
		if id == "" {
			id = uuid.NewString()
		}
		// If this ID was already assigned, keep appending suffixes until unique.
		if seen[id] {
			base := id
			for n := 1; ; n++ {
				candidate := fmt.Sprintf("%s-%d", base, n)
				if !seen[candidate] {
					id = candidate
					break
				}
			}
		}
		seen[id] = true
		setID(rules[i], id)
	}
}
