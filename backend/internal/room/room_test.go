package room

import (
	"strings"
	"testing"
	"time"
)

// This drives the state machine directly (calling begin*/after* methods
// instead of waiting out real timers) — the timing behavior itself is
// covered by the project's real multi-client WebSocket test scripts; this
// test is specifically about turn rotation, scoring, and the PlayAgain
// reset, which don't need real elapsed time to verify.
func TestFullGameRotatesTurnsAndReachesScoreboard(t *testing.T) {
	r := newRoom("TEST1", "p1")
	r.addPlayerLocked("p1", "Alice")
	r.addPlayerLocked("p2", "Bob")

	order := []string{"p1", "p2"}
	r.turnOrder = order
	r.totalTurns = 2 * len(order) // 2 rounds x 2 players = 4 turns
	r.turnsCompleted = 0
	// Bypassing Start() means drawDuration defaults to 0, which would arm a
	// real near-instant timer racing with this test's explicit
	// AdvanceTurnEarly() calls — set it long enough to never fire here.
	r.drawDuration = time.Hour
	r.scores = make(map[string]int)

	for turn := 0; turn < 4; turn++ {
		r.beginChoosing()
		if r.phase != PhaseChoosing {
			t.Fatalf("turn %d: expected choosing phase, got %s", turn, r.phase)
		}

		drawerID, choices := r.CurrentWordChoices()
		expectedDrawer := order[turn%len(order)]
		if drawerID != expectedDrawer {
			t.Fatalf("turn %d: expected drawer %s, got %s", turn, expectedDrawer, drawerID)
		}
		if len(choices) != wordChoicesCount {
			t.Fatalf("turn %d: expected %d word choices, got %d", turn, wordChoicesCount, len(choices))
		}

		if err := r.ChooseWord(drawerID, choices[0]); err != nil {
			t.Fatal(err)
		}
		if r.phase != PhaseDrawing {
			t.Fatalf("turn %d: expected drawing phase, got %s", turn, r.phase)
		}
		if r.CurrentWord() != choices[0] {
			t.Fatalf("turn %d: expected word %q, got %q", turn, choices[0], r.CurrentWord())
		}

		guesserID := "p2"
		if drawerID == "p2" {
			guesserID = "p1"
		}

		if outcome := r.TrySubmitGuess(drawerID, choices[0]); outcome.Attempted {
			t.Fatalf("turn %d: expected the drawer's own guess attempt to be ignored", turn)
		}
		if outcome := r.TrySubmitGuess(guesserID, "definitely wrong"); !outcome.Attempted || outcome.Correct {
			t.Fatalf("turn %d: expected a recorded, incorrect guess, got %+v", turn, outcome)
		}
		outcome := r.TrySubmitGuess(guesserID, choices[0])
		if !outcome.Attempted || !outcome.Correct {
			t.Fatalf("turn %d: expected a correct guess, got %+v", turn, outcome)
		}
		if !outcome.AllGuessed {
			t.Fatalf("turn %d: with only one eligible guesser, a correct guess should mean everyone's guessed", turn)
		}
		r.AdvanceTurnEarly()
		if r.phase != PhaseTurnEnd {
			t.Fatalf("turn %d: expected turnEnd phase after AdvanceTurnEarly, got %s", turn, r.phase)
		}
	}

	// The last iteration's AdvanceTurnEarly() left the room in TurnEnd
	// (bypassing its real 6s timer, same as drawDuration is bypassed
	// above) — finishTurnEnd is what that timer would have called.
	r.finishTurnEnd(true)
	if r.phase != PhaseScoreboard {
		t.Fatalf("after all 4 turns, expected scoreboard, got %s", r.phase)
	}

	state := r.State()
	for _, s := range state.Scores {
		if s.Score <= 0 {
			t.Fatalf("expected every player to have scored something across 2 turns each, got %s=%d", s.Nickname, s.Score)
		}
	}

	if err := r.PlayAgain("p2"); err != ErrNotHost {
		t.Fatalf("expected non-host PlayAgain to be rejected with ErrNotHost, got %v", err)
	}
	if err := r.PlayAgain("p1"); err != nil {
		t.Fatalf("expected host PlayAgain to succeed, got %v", err)
	}
	if r.phase != PhaseLobby {
		t.Fatalf("expected lobby after PlayAgain, got %s", r.phase)
	}
	if r.turnsCompleted != 0 || r.totalTurns != 0 {
		t.Fatalf("expected turn counters reset to 0, got turnsCompleted=%d totalTurns=%d", r.turnsCompleted, r.totalTurns)
	}
	state = r.State()
	for _, s := range state.Scores {
		if s.Score != 0 {
			t.Fatalf("expected scores reset to 0 after PlayAgain, got %s=%d", s.Nickname, s.Score)
		}
	}
}

func TestComputeDrawDurationTargetsATenMinuteGame(t *testing.T) {
	cases := []struct {
		totalTurns int
		want       time.Duration
	}{
		{totalTurns: 6, want: maxDrawDuration},  // 2 players x 3 rounds: budget/turn (90s) clamps down to the 80s max
		{totalTurns: 8, want: 65 * time.Second}, // exact fit, no clamping: (600-80)/8 = 65s
		{totalTurns: 18, want: minDrawDuration}, // 6 players x 3 rounds: budget/turn (~23s) clamps up to the 30s min
	}
	for _, c := range cases {
		got := computeDrawDuration(c.totalTurns)
		if got != c.want {
			t.Errorf("computeDrawDuration(%d) = %v, want %v", c.totalTurns, got, c.want)
		}
	}
}

func TestPlayAgainRejectedOutsideScoreboard(t *testing.T) {
	r := newRoom("TEST2", "p1")
	r.addPlayerLocked("p1", "Alice")
	r.addPlayerLocked("p2", "Bob")

	if err := r.PlayAgain("p1"); err != ErrWrongPhase {
		t.Fatalf("expected ErrWrongPhase from Lobby, got %v", err)
	}
}

func TestChooseWordRejectsWrongPlayerAndInvalidWord(t *testing.T) {
	r := newRoom("TEST3", "p1")
	r.addPlayerLocked("p1", "Alice")
	r.addPlayerLocked("p2", "Bob")
	r.turnOrder = []string{"p1", "p2"}
	r.totalTurns = 2
	r.scores = make(map[string]int)

	r.beginChoosing()
	drawerID, choices := r.CurrentWordChoices()

	other := "p2"
	if drawerID == "p2" {
		other = "p1"
	}
	if err := r.ChooseWord(other, choices[0]); err != ErrNotYourTurn {
		t.Fatalf("expected ErrNotYourTurn, got %v", err)
	}
	if err := r.ChooseWord(drawerID, "not-a-real-choice"); err != ErrInvalidWordChoice {
		t.Fatalf("expected ErrInvalidWordChoice, got %v", err)
	}
}

func TestApplyRevealMasksWordProgressively(t *testing.T) {
	r := newRoom("TEST4", "p1")
	r.addPlayerLocked("p1", "Alice")
	r.addPlayerLocked("p2", "Bob")
	r.turnOrder = []string{"p1", "p2"}
	r.totalTurns = 2
	r.scores = make(map[string]int)
	// Long enough that this test's manual applyReveal calls, not the real
	// scheduled timers, are what drive the assertions below.
	r.drawDuration = time.Hour

	r.beginChoosing()
	drawerID, choices := r.CurrentWordChoices()
	word := choices[0]
	if err := r.ChooseWord(drawerID, word); err != nil {
		t.Fatal(err)
	}
	runes := []rune(word)

	state := r.State()
	if state.RevealedWord != strings.Repeat("_", len(runes)) {
		t.Fatalf("expected fully masked word before any reveal, got %q", state.RevealedWord)
	}

	countRevealed := func(revealedWord string) int {
		n := 0
		for i, ch := range []rune(revealedWord) {
			if ch == '_' {
				continue
			}
			if ch != runes[i] {
				t.Fatalf("revealed position %d shows %q, want %q", i, ch, runes[i])
			}
			n++
		}
		return n
	}

	r.applyReveal(r.turnsCompleted, 1)
	if n := countRevealed(r.State().RevealedWord); n != 1 {
		t.Fatalf("expected exactly 1 letter revealed, got %d", n)
	}

	// A stale turn token (as if a timer from an already-ended turn fired
	// late) must be a no-op.
	r.applyReveal(r.turnsCompleted+1, 2)
	if n := countRevealed(r.State().RevealedWord); n != 1 {
		t.Fatalf("expected stale reveal to be ignored, still want 1 revealed, got %d", n)
	}

	r.applyReveal(r.turnsCompleted, 2)
	if n := countRevealed(r.State().RevealedWord); n != 2 {
		t.Fatalf("expected exactly 2 letters revealed, got %d", n)
	}
}

func TestToggleReadyOnlyInLobby(t *testing.T) {
	r := newRoom("TEST5", "p1")
	r.addPlayerLocked("p1", "Alice")

	if !r.players["p1"].Ready {
		t.Fatalf("expected a new player to default ready=true")
	}
	r.ToggleReady("p1")
	if r.players["p1"].Ready {
		t.Fatalf("expected ready to flip to false")
	}
	r.ToggleReady("p1")
	if !r.players["p1"].Ready {
		t.Fatalf("expected ready to flip back to true")
	}

	r.turnOrder = []string{"p1"}
	r.totalTurns = 1
	r.scores = make(map[string]int)
	r.drawDuration = time.Hour
	r.beginChoosing()

	r.ToggleReady("p1")
	if !r.players["p1"].Ready {
		t.Fatalf("expected ToggleReady to no-op outside Lobby")
	}
}

func TestEndTurnPopulatesLastWordAndTurnGains(t *testing.T) {
	r := newRoom("TEST6", "p1")
	r.addPlayerLocked("p1", "Alice")
	r.addPlayerLocked("p2", "Bob")
	r.turnOrder = []string{"p1", "p2"}
	r.totalTurns = 2
	r.scores = make(map[string]int)
	r.drawDuration = time.Hour

	r.beginChoosing()
	drawerID, choices := r.CurrentWordChoices()
	word := choices[0]
	if err := r.ChooseWord(drawerID, word); err != nil {
		t.Fatal(err)
	}
	guesserID := "p2"
	if drawerID == "p2" {
		guesserID = "p1"
	}
	if outcome := r.TrySubmitGuess(guesserID, word); !outcome.Correct {
		t.Fatalf("expected a correct guess, got %+v", outcome)
	}

	r.AdvanceTurnEarly()
	if r.phase != PhaseTurnEnd {
		t.Fatalf("expected turnEnd phase, got %s", r.phase)
	}

	state := r.State()
	if state.LastWord != word {
		t.Fatalf("expected lastWord %q, got %q", word, state.LastWord)
	}
	if state.LastDrawerID != drawerID {
		t.Fatalf("expected lastDrawerId %q (the turn that just ended), got %q — note DrawerID itself has already moved to the next turn", drawerID, state.LastDrawerID)
	}
	gains := map[string]int{}
	for _, g := range state.TurnGains {
		gains[g.PlayerID] = g.Score
	}
	if gains[guesserID] != pointsForFirstGuess {
		t.Fatalf("expected guesser to gain %d, got %d", pointsForFirstGuess, gains[guesserID])
	}
	if gains[drawerID] != pointsForDrawerPerGuesser {
		t.Fatalf("expected drawer to gain %d, got %d", pointsForDrawerPerGuesser, gains[drawerID])
	}

	// Once the recap's over, LastWord/TurnGains must stop being public.
	r.finishTurnEnd(false)
	if r.phase != PhaseChoosing {
		t.Fatalf("expected choosing phase, got %s", r.phase)
	}
	state = r.State()
	if state.LastWord != "" || state.TurnGains != nil {
		t.Fatalf("expected lastWord/turnGains cleared outside TurnEnd, got %q %+v", state.LastWord, state.TurnGains)
	}
}

func TestRejoinReactivatesExistingPlayerOrFallsBack(t *testing.T) {
	r := newRoom("TEST7", "p1")
	firstEpoch := r.addPlayerLocked("p1", "Alice")

	// A page refresh: the browser remembers "p1", disconnects the old
	// connection, and reconnects with a new one before the old one's
	// disconnect has actually been processed server-side.
	if _, ok := r.players["p1"]; !ok || !r.players["p1"].Connected {
		t.Fatalf("sanity: p1 should exist and start connected")
	}
	newEpoch, ok := r.Rejoin("p1")
	if !ok {
		t.Fatalf("expected Rejoin to find existing player p1")
	}
	if newEpoch == firstEpoch {
		t.Fatalf("expected a fresh epoch on rejoin, got the same one: %d", newEpoch)
	}
	if !r.players["p1"].Connected {
		t.Fatalf("expected p1 to be connected after Rejoin")
	}

	// The stale old connection's disconnect (carrying the OLD epoch)
	// arrives after the rejoin — it must not mark the reconnected player
	// disconnected.
	r.SetConnected("p1", false, firstEpoch)
	if !r.players["p1"].Connected {
		t.Fatalf("a stale disconnect (old epoch) must not affect the newer connection")
	}

	// A disconnect carrying the CURRENT epoch, though, must still work.
	r.SetConnected("p1", false, newEpoch)
	if r.players["p1"].Connected {
		t.Fatalf("a disconnect matching the current epoch should apply")
	}

	// Rejoin for an id that was never in this room at all falls back —
	// the caller (app.go) is expected to AddPlayer in that case.
	if _, ok := r.Rejoin("never-here"); ok {
		t.Fatalf("expected Rejoin to report false for an unknown player id")
	}
}
