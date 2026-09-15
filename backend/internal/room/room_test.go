package room

import "testing"

// This drives the state machine directly (calling begin*/after* methods
// instead of waiting out real timers) — the timing behavior itself was
// already verified with real multi-client WebSocket tests during
// development (see the project's scratchpad test scripts); this test is
// specifically about round-counting and the PlayAgain reset, which don't
// need real elapsed time to verify.
func TestFullGameReachesScoreboardThenPlayAgainResets(t *testing.T) {
	r := newRoom("TEST1", "p1")
	r.addPlayerLocked("p1", "Alice")
	r.addPlayerLocked("p2", "Bob")
	r.scores = make(map[string]int)
	r.totalRounds = 2 // small on purpose, this test is about the round boundary, not gameplay
	r.round = 0

	playRound := func() {
		r.beginDraw()
		if r.phase != PhaseDraw {
			t.Fatalf("expected draw phase, got %s", r.phase)
		}

		allSubmitted, err := r.SubmitDrawing("p1", "data:img1")
		if err != nil {
			t.Fatal(err)
		}
		if allSubmitted {
			t.Fatal("should not be all-submitted after just one player")
		}
		allSubmitted, err = r.SubmitDrawing("p2", "data:img2")
		if err != nil {
			t.Fatal(err)
		}
		if !allSubmitted {
			t.Fatal("expected all-submitted once both players have")
		}
		r.AdvanceToGalleryNow()
		if r.phase != PhaseGallery {
			t.Fatalf("expected gallery, got %s", r.phase)
		}

		r.afterGallery() // normally timer-driven; called directly to skip the wait
		if r.phase != PhaseSabotage {
			t.Fatalf("expected sabotage, got %s", r.phase)
		}

		taskP1, ok1 := r.SabotageTaskFor("p1")
		taskP2, ok2 := r.SabotageTaskFor("p2")
		if !ok1 || !ok2 {
			t.Fatal("expected both players to have a sabotage assignment")
		}

		allSubmitted, err = r.SubmitSabotage("p1", "data:sab1")
		if err != nil {
			t.Fatal(err)
		}
		if allSubmitted {
			t.Fatal("should not be all-submitted after just one saboteur")
		}
		allSubmitted, err = r.SubmitSabotage("p2", "data:sab2")
		if err != nil {
			t.Fatal(err)
		}
		if !allSubmitted {
			t.Fatal("expected all-submitted once both saboteurs have")
		}
		r.AdvanceFromSabotageNow()
		if r.phase != PhaseGuess {
			t.Fatalf("expected guess, got %s", r.phase)
		}

		// Scoring correctness itself is covered by the WebSocket-level test;
		// here we just need any valid votes to exercise the path.
		if err := r.SubmitVote("p1", taskP1.TargetArtistID, r.sabotageAssignments[taskP1.TargetArtistID]); err != nil {
			t.Fatal(err)
		}
		if err := r.SubmitVote("p2", taskP2.TargetArtistID, r.sabotageAssignments[taskP2.TargetArtistID]); err != nil {
			t.Fatal(err)
		}

		r.beginReveal() // normally timer-driven; called directly to skip the wait
		if r.phase != PhaseReveal {
			t.Fatalf("expected reveal, got %s", r.phase)
		}

		r.afterReveal() // normally timer-driven; called directly to skip the wait
	}

	playRound()
	if r.phase != PhaseDraw || r.round != 2 {
		t.Fatalf("after round 1 of 2, expected draw/round 2, got %s/round %d", r.phase, r.round)
	}

	playRound()
	if r.phase != PhaseScoreboard {
		t.Fatalf("after the final round, expected scoreboard, got %s", r.phase)
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
	if r.round != 0 || r.totalRounds != 0 {
		t.Fatalf("expected round/totalRounds reset to 0, got round=%d totalRounds=%d", r.round, r.totalRounds)
	}

	state := r.State()
	if len(state.Scores) != 2 {
		t.Fatalf("expected both players still present with scores, got %d", len(state.Scores))
	}
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
