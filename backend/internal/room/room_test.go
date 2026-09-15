package room

import "testing"

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
	}

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
