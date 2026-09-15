package room

import (
	"errors"
	"sort"
	"sync"
	"time"
)

const (
	maxPlayers     = 10 // PRD.md §11
	maxChatHistory = 200

	// minPlayersToStart is 2 rather than PRD.md §4's suggested 3 default —
	// makes local testing (two browser tabs) actually possible without
	// wrangling a third client. Bump it before a real multi-player demo if
	// 2-player rounds feel too thin.
	minPlayersToStart  = 2
	totalRoundsDefault = 3

	drawDuration     = 60 * time.Second
	galleryDuration  = 10 * time.Second
	sabotageDuration = 30 * time.Second
	guessDuration    = 45 * time.Second
	revealDuration   = 15 * time.Second

	// Scoring (PRD.md §4 "Scoring (per round)").
	pointsForCorrectGuess    = 3
	pointsForSaboteurCaught  = -1
	pointsForSaboteurEscaped = 2
)

var (
	ErrAlreadyInRoom    = errors.New("already in room")
	ErrRoomFull         = errors.New("room is full")
	ErrNotHost          = errors.New("only the host can do that")
	ErrAlreadyStarted   = errors.New("game already started")
	ErrNotEnoughPlayers = errors.New("need at least 2 players to start")
	ErrWrongPhase       = errors.New("not accepting that right now")
	ErrNotInRoom        = errors.New("you're not a player in this room")
	ErrNotASaboteur     = errors.New("you're not assigned to sabotage anything this round")
	ErrNoSuchTarget     = errors.New("no such drawing to guess on this round")
	ErrNoSuchPlayer     = errors.New("no such player")
)

// Room owns one game's state and is safe for concurrent use — every client
// goroutine that touches a room does so through these methods, never the
// fields directly.
type Room struct {
	mu sync.Mutex

	Code   string
	hostID string
	phase  Phase

	players map[string]*Player
	order   []string // join order, so the player list renders stably

	chat []ChatMessage

	round       int
	totalRounds int
	word        string
	drawings    map[string]Drawing
	phaseEndsAt time.Time
	timer       *time.Timer

	// Sabotage-phase state. sabotageAssignments maps originalArtistID ->
	// saboteurPlayerID (the derangement, PRD.md §4 step 4) — deliberately
	// never sent whole to clients, since it's the answer to the Guess phase.
	// Cleared and recomputed each round.
	sabotageAssignments map[string]string
	sabotagePrompts     map[string]string  // originalArtistID -> forced prompt
	sabotagedDrawings   map[string]Drawing // originalArtistID -> the edited version

	// Guess-phase state. votes[targetArtistID][voterID] = suspectPlayerID.
	votes map[string]map[string]string

	// revealResults is computed once at the start of Reveal (Room.beginReveal)
	// and cached, rather than recomputed on every State() call.
	revealResults []RevealResult

	// scores accumulate across the whole game (not reset between rounds),
	// keyed by player id. Initialized in Start().
	scores map[string]int

	// notify is called (unlocked) after any state change the timer itself
	// causes, so the app layer can broadcast — see SetNotifier and
	// BUILD_PLAN.md §3. Player join/chat/etc. are triggered by an explicit
	// client request, so the app layer broadcasts after those directly
	// instead of relying on this.
	notify func()

	// onEnterSabotage fires (unlocked) once, right after sabotageAssignments
	// is computed, so the app layer can send each player their own private
	// SabotageTaskFor(...) — a per-player message, not a room broadcast.
	onEnterSabotage func()
}

func newRoom(code, hostID string) *Room {
	return &Room{
		Code:     code,
		hostID:   hostID,
		phase:    PhaseLobby,
		players:  make(map[string]*Player),
		drawings: make(map[string]Drawing),
	}
}

// SetNotifier wires up the callback the phase timer uses to push state to
// clients without an explicit request driving it. Call once, right after
// the room is created.
func (r *Room) SetNotifier(fn func()) {
	r.mu.Lock()
	r.notify = fn
	r.mu.Unlock()
}

func (r *Room) fireNotify() {
	r.mu.Lock()
	fn := r.notify
	r.mu.Unlock()
	if fn != nil {
		fn()
	}
}

// SetOnEnterSabotage wires up the callback used to deliver each player's
// private sabotage assignment. Call once, right after the room is created.
func (r *Room) SetOnEnterSabotage(fn func()) {
	r.mu.Lock()
	r.onEnterSabotage = fn
	r.mu.Unlock()
}

func (r *Room) fireEnterSabotage() {
	r.mu.Lock()
	fn := r.onEnterSabotage
	r.mu.Unlock()
	if fn != nil {
		fn()
	}
}

// addPlayerLocked assumes the caller already holds r.mu.
func (r *Room) addPlayerLocked(id, nickname string) {
	r.players[id] = &Player{ID: id, Nickname: nickname, Connected: true}
	r.order = append(r.order, id)
}

func (r *Room) AddPlayer(id, nickname string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.players[id]; exists {
		return ErrAlreadyInRoom
	}
	if len(r.players) >= maxPlayers {
		return ErrRoomFull
	}
	r.addPlayerLocked(id, nickname)
	return nil
}

// SetConnected marks a player connected/disconnected without removing them
// from the room — a flaky phone shouldn't wreck a live game for everyone
// else (PRD.md §9, "Reconnection").
func (r *Room) SetConnected(id string, connected bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if p, ok := r.players[id]; ok {
		p.Connected = connected
	}
}

func (r *Room) AddChat(senderID, text string) ChatMessage {
	r.mu.Lock()
	defer r.mu.Unlock()

	nickname := "unknown"
	if p, ok := r.players[senderID]; ok {
		nickname = p.Nickname
	}
	msg := ChatMessage{
		ID:       randomID(),
		SenderID: senderID,
		Nickname: nickname,
		Text:     text,
		Ts:       time.Now().UnixMilli(),
	}
	r.chat = append(r.chat, msg)
	if len(r.chat) > maxChatHistory {
		r.chat = r.chat[len(r.chat)-maxChatHistory:]
	}
	return msg
}

// IsEmpty reports whether every known player is currently disconnected —
// the Manager uses this to garbage-collect abandoned rooms.
func (r *Room) IsEmpty() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, p := range r.players {
		if p.Connected {
			return false
		}
	}
	return true
}

// Start moves Lobby -> Draw for round 1. Host-only, and only from Lobby.
func (r *Room) Start(requesterID string) error {
	r.mu.Lock()
	if requesterID != r.hostID {
		r.mu.Unlock()
		return ErrNotHost
	}
	if r.phase != PhaseLobby {
		r.mu.Unlock()
		return ErrAlreadyStarted
	}
	if len(r.players) < minPlayersToStart {
		r.mu.Unlock()
		return ErrNotEnoughPlayers
	}
	r.totalRounds = totalRoundsDefault
	r.round = 0
	r.scores = make(map[string]int, len(r.players))
	r.mu.Unlock()

	r.beginDraw()
	return nil
}

// cancelTimerLocked assumes the caller holds r.mu.
func (r *Room) cancelTimerLocked() {
	if r.timer != nil {
		r.timer.Stop()
		r.timer = nil
	}
}

// beginDraw and beginGallery are each used both as the timeout-driven
// transition (passed straight to time.AfterFunc) and the early-advance path
// (called directly once everyone's submitted) — one code path either way,
// per BUILD_PLAN.md §3.
func (r *Room) beginDraw() {
	r.mu.Lock()
	r.cancelTimerLocked()
	r.phase = PhaseDraw
	r.round++
	r.word = pickWord()
	r.drawings = make(map[string]Drawing)
	r.phaseEndsAt = time.Now().Add(drawDuration)
	r.timer = time.AfterFunc(drawDuration, r.beginGallery)
	r.mu.Unlock()

	r.fireNotify()
}

func (r *Room) beginGallery() {
	r.mu.Lock()
	r.cancelTimerLocked()
	r.phase = PhaseGallery
	r.phaseEndsAt = time.Now().Add(galleryDuration)
	r.timer = time.AfterFunc(galleryDuration, r.afterGallery)
	r.mu.Unlock()

	r.fireNotify()
}

// AdvanceToGalleryNow lets the app layer skip straight to Gallery once every
// player has submitted a drawing, instead of waiting out the Draw timer.
func (r *Room) AdvanceToGalleryNow() {
	r.beginGallery()
}

// afterGallery is the Gallery timer's target: sabotage needs at least 2
// submitted drawings to cross-assign, so with fewer than that it skips
// straight to the next round (or stops, if this was the last one) — an edge
// case only reachable if a player disconnects mid-round.
func (r *Room) afterGallery() {
	r.mu.Lock()
	numDrawings := len(r.drawings)
	round, total := r.round, r.totalRounds
	r.mu.Unlock()

	if numDrawings >= 2 {
		r.beginSabotage()
		return
	}
	if round < total {
		r.beginDraw()
	}
}

// beginSabotage computes this round's derangement (who sabotages whose
// drawing) and forced prompts, then notifies twice: once with the public
// room:state (phase, timer, round — nothing secret), and once via
// onEnterSabotage so the app layer can deliver each player's own private
// SabotageTaskFor(...) directly, never broadcast.
func (r *Room) beginSabotage() {
	r.mu.Lock()
	r.cancelTimerLocked()
	r.phase = PhaseSabotage

	participantIDs := make([]string, 0, len(r.drawings))
	for _, id := range r.order {
		if _, ok := r.drawings[id]; ok {
			participantIDs = append(participantIDs, id)
		}
	}
	r.sabotageAssignments = derangedAssignment(participantIDs)
	r.sabotagePrompts = make(map[string]string, len(participantIDs))
	for _, id := range participantIDs {
		r.sabotagePrompts[id] = pickSabotagePrompt()
	}
	r.sabotagedDrawings = make(map[string]Drawing)

	r.phaseEndsAt = time.Now().Add(sabotageDuration)
	r.timer = time.AfterFunc(sabotageDuration, r.afterSabotage)
	r.mu.Unlock()

	r.fireNotify()
	r.fireEnterSabotage()
}

// afterSabotage is the Sabotage timer's target: every round now has a Guess
// phase, regardless of round number.
func (r *Room) afterSabotage() {
	r.beginGuess()
}

// AdvanceFromSabotageNow lets the app layer skip ahead once every assigned
// saboteur has submitted, instead of waiting out the Sabotage timer.
func (r *Room) AdvanceFromSabotageNow() {
	r.afterSabotage()
}

// SabotageTaskFor reports what playerID has been assigned to sabotage this
// round, if anything — the original drawing to edit and the forced prompt.
// Never exposed any other way; this is the one place that private data is
// readable, deliberately gated by playerID so the app layer can't leak it.
func (r *Room) SabotageTaskFor(playerID string) (SabotageTask, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for originalArtistID, saboteurID := range r.sabotageAssignments {
		if saboteurID != playerID {
			continue
		}
		d := r.drawings[originalArtistID]
		return SabotageTask{
			TargetArtistID: originalArtistID,
			TargetNickname: d.Nickname,
			OriginalImage:  d.ImageDataURL,
			Prompt:         r.sabotagePrompts[originalArtistID],
		}, true
	}
	return SabotageTask{}, false
}

// SubmitSabotage records playerID's edited drawing for whichever original
// they were assigned. allSubmitted tells the caller whether every assigned
// saboteur has now submitted, so it can trigger an early advance.
func (r *Room) SubmitSabotage(playerID, imageDataURL string) (allSubmitted bool, err error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.phase != PhaseSabotage {
		return false, ErrWrongPhase
	}

	var targetArtistID string
	found := false
	for originalArtistID, saboteurID := range r.sabotageAssignments {
		if saboteurID == playerID {
			targetArtistID = originalArtistID
			found = true
			break
		}
	}
	if !found {
		return false, ErrNotASaboteur
	}

	nickname := "unknown"
	if p, ok := r.players[playerID]; ok {
		nickname = p.Nickname
	}
	r.sabotagedDrawings[targetArtistID] = Drawing{ArtistID: playerID, Nickname: nickname, ImageDataURL: imageDataURL}
	return len(r.sabotagedDrawings) >= len(r.sabotageAssignments), nil
}

// beginGuess always runs the full guessDuration — unlike Draw/Sabotage,
// there's no natural "everyone's done" signal for open-ended voting +
// discussion, so this phase is purely timer-driven.
func (r *Room) beginGuess() {
	r.mu.Lock()
	r.cancelTimerLocked()
	r.phase = PhaseGuess
	r.votes = make(map[string]map[string]string)
	r.phaseEndsAt = time.Now().Add(guessDuration)
	r.timer = time.AfterFunc(guessDuration, r.beginReveal)
	r.mu.Unlock()

	r.fireNotify()
}

// SubmitVote records voterID's accusation for one sabotaged drawing. A
// player may vote on as many targets as they want, and re-voting on the
// same target overwrites their earlier guess.
func (r *Room) SubmitVote(voterID, targetArtistID, suspectID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.phase != PhaseGuess {
		return ErrWrongPhase
	}
	if _, ok := r.sabotagedDrawings[targetArtistID]; !ok {
		return ErrNoSuchTarget
	}
	if _, ok := r.players[suspectID]; !ok {
		return ErrNoSuchPlayer
	}
	if r.votes[targetArtistID] == nil {
		r.votes[targetArtistID] = make(map[string]string)
	}
	r.votes[targetArtistID][voterID] = suspectID
	return nil
}

// beginReveal scores the round and computes the public RevealResult for
// every sabotaged drawing once, up front — State() just returns the cached
// slice for as long as the phase stays Reveal, rather than recomputing it
// (and re-mutating scores!) on every call.
func (r *Room) beginReveal() {
	r.mu.Lock()
	r.cancelTimerLocked()
	r.phase = PhaseReveal

	results := make([]RevealResult, 0, len(r.sabotagedDrawings))
	for targetID, sabotaged := range r.sabotagedDrawings {
		actualSaboteurID := r.sabotageAssignments[targetID]
		saboteurNickname := "unknown"
		if p, ok := r.players[actualSaboteurID]; ok {
			saboteurNickname = p.Nickname
		}
		original := r.drawings[targetID]

		// Initialized non-nil so it marshals as [] rather than JSON null when
		// nobody guessed correctly — a client-side .length on null would
		// throw.
		correctGuessers := []string{}
		totalVotes := 0
		for voterID, suspectID := range r.votes[targetID] {
			totalVotes++
			if suspectID == actualSaboteurID {
				correctGuessers = append(correctGuessers, voterID)
				r.scores[voterID] += pointsForCorrectGuess
			}
		}
		caught := totalVotes > 0 && len(correctGuessers)*2 > totalVotes
		if caught {
			r.scores[actualSaboteurID] += pointsForSaboteurCaught
		} else {
			r.scores[actualSaboteurID] += pointsForSaboteurEscaped
		}

		results = append(results, RevealResult{
			TargetArtistID:        targetID,
			TargetNickname:        original.Nickname,
			OriginalImageDataURL:  original.ImageDataURL,
			SabotagedImageDataURL: sabotaged.ImageDataURL,
			Prompt:                r.sabotagePrompts[targetID],
			SaboteurID:            actualSaboteurID,
			SaboteurNickname:      saboteurNickname,
			CorrectGuesserIDs:     correctGuessers,
			SaboteurCaught:        caught,
		})
	}
	sortRevealResultsByJoinOrder(results, r.order)
	r.revealResults = results

	r.phaseEndsAt = time.Now().Add(revealDuration)
	r.timer = time.AfterFunc(revealDuration, r.afterReveal)
	r.mu.Unlock()

	r.fireNotify()
}

func sortRevealResultsByJoinOrder(results []RevealResult, order []string) {
	rank := make(map[string]int, len(order))
	for i, id := range order {
		rank[id] = i
	}
	sort.Slice(results, func(i, j int) bool {
		return rank[results[i].TargetArtistID] < rank[results[j].TargetArtistID]
	})
}

// afterReveal is the Reveal timer's target: on to the next round's Draw, or
// the Scoreboard if that was the last one.
func (r *Room) afterReveal() {
	r.mu.Lock()
	round, total := r.round, r.totalRounds
	r.mu.Unlock()
	if round < total {
		r.beginDraw()
		return
	}
	r.beginScoreboard()
}

// beginScoreboard is the end of a game — no timer, it just waits for the
// host to call PlayAgain.
func (r *Room) beginScoreboard() {
	r.mu.Lock()
	r.cancelTimerLocked()
	r.phase = PhaseScoreboard
	r.phaseEndsAt = time.Time{}
	r.mu.Unlock()

	r.fireNotify()
}

// PlayAgain resets a finished game back to Lobby — same room, same
// players, scores and round cleared — so the host can Start a fresh game
// without everyone re-joining. Only valid from Scoreboard, host-only.
func (r *Room) PlayAgain(requesterID string) error {
	r.mu.Lock()
	if requesterID != r.hostID {
		r.mu.Unlock()
		return ErrNotHost
	}
	if r.phase != PhaseScoreboard {
		r.mu.Unlock()
		return ErrWrongPhase
	}

	r.cancelTimerLocked()
	r.phase = PhaseLobby
	r.round = 0
	r.totalRounds = 0
	r.word = ""
	r.drawings = make(map[string]Drawing)
	r.sabotageAssignments = nil
	r.sabotagePrompts = nil
	r.sabotagedDrawings = nil
	r.votes = nil
	r.revealResults = nil
	r.scores = make(map[string]int, len(r.players))
	r.phaseEndsAt = time.Time{}
	r.mu.Unlock()

	r.fireNotify()
	return nil
}

// SubmitDrawing records a player's finished drawing for the current round.
// allSubmitted tells the caller whether every current player has now
// submitted, so it can trigger an early Gallery advance.
func (r *Room) SubmitDrawing(playerID, imageDataURL string) (allSubmitted bool, err error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.phase != PhaseDraw {
		return false, ErrWrongPhase
	}
	p, ok := r.players[playerID]
	if !ok {
		return false, ErrNotInRoom
	}
	r.drawings[playerID] = Drawing{ArtistID: playerID, Nickname: p.Nickname, ImageDataURL: imageDataURL}
	return len(r.drawings) >= len(r.players), nil
}

func (r *Room) State() State {
	r.mu.Lock()
	defer r.mu.Unlock()

	players := make([]Player, 0, len(r.order))
	for _, id := range r.order {
		if p, ok := r.players[id]; ok {
			players = append(players, *p)
		}
	}
	chat := make([]ChatMessage, len(r.chat))
	copy(chat, r.chat)

	var drawings []Drawing
	if r.phase == PhaseGallery || r.phase == PhaseSabotage {
		drawings = make([]Drawing, 0, len(r.order))
		for _, id := range r.order {
			if d, ok := r.drawings[id]; ok {
				drawings = append(drawings, d)
			}
		}
	}

	var phaseEndsAtMillis int64
	if !r.phaseEndsAt.IsZero() {
		phaseEndsAtMillis = r.phaseEndsAt.UnixMilli()
	}

	submittedCount := len(r.drawings)
	if r.phase == PhaseSabotage {
		submittedCount = len(r.sabotagedDrawings)
	}

	var guessTargets []GuessTarget
	if r.phase == PhaseGuess {
		guessTargets = make([]GuessTarget, 0, len(r.sabotagedDrawings))
		for _, id := range r.order {
			sabotaged, ok := r.sabotagedDrawings[id]
			if !ok {
				continue
			}
			guessTargets = append(guessTargets, GuessTarget{
				TargetArtistID: id,
				TargetNickname: r.drawings[id].Nickname,
				ImageDataURL:   sabotaged.ImageDataURL,
				Prompt:         r.sabotagePrompts[id],
			})
		}
	}

	var reveal []RevealResult
	if r.phase == PhaseReveal {
		reveal = r.revealResults
	}

	scores := make([]PlayerScore, 0, len(r.order))
	for _, id := range r.order {
		if p, ok := r.players[id]; ok {
			scores = append(scores, PlayerScore{PlayerID: id, Nickname: p.Nickname, Score: r.scores[id]})
		}
	}

	return State{
		Code:           r.Code,
		HostID:         r.hostID,
		Phase:          r.phase,
		Round:          r.round,
		TotalRounds:    r.totalRounds,
		PhaseEndsAt:    phaseEndsAtMillis,
		Word:           r.word,
		Players:        players,
		Chat:           chat,
		Drawings:       drawings,
		SubmittedCount: submittedCount,
		GuessTargets:   guessTargets,
		Reveal:         reveal,
		Scores:         scores,
	}
}
