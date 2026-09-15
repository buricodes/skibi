package room

import "math/rand/v2"

// Forced sabotage prompts (PRD.md §5.1) — a free-form edit is either too
// subtle to notice or an illegible scribble, neither of which is guessable
// or funny. A forced, visible prompt fixes both.
var sabotagePrompts = []string{
	"Add a hat",
	"Set it on fire",
	"Give it a mustache",
	"Add a second head",
	"Make it cry",
	"Add sunglasses",
	"Turn it into a monster",
	"Add wings",
	"Give it a crown",
	"Add googly eyes",
	"Make it look furious",
	`Add a speech bubble that says "help"`,
}

func pickSabotagePrompt() string {
	return sabotagePrompts[rand.IntN(len(sabotagePrompts))]
}

// derangedAssignment maps each id to a *different* id from the same list —
// a cyclic shift of a random shuffle, so nobody ever sabotages their own
// drawing (PRD.md §4 step 4). Requires len(ids) >= 2.
func derangedAssignment(ids []string) map[string]string {
	n := len(ids)
	shuffled := append([]string(nil), ids...)
	rand.Shuffle(n, func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })

	assignment := make(map[string]string, n)
	for i, originalID := range shuffled {
		assignment[originalID] = shuffled[(i+1)%n]
	}
	return assignment
}
