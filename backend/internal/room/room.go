package room

import (
	"errors"
	"fmt"
	"math/rand/v2"
	"strings"
	"sync"
	"time"
)

const (
	maxPlayers     = 10
	maxChatHistory = 200

	// minPlayersToStart is 2: one drawer, one guesser is a perfectly valid
	// (if quiet) game, and it makes local testing (two browser tabs)
	// possible without wrangling a third client.
	minPlayersToStart  = 2
	totalRoundsDefault = 3 // one "round" = every player draws once
	wordChoicesCount   = 3

	chooseDuration  = 10 * time.Second
	turnEndDuration = 6 * time.Second

	// A full game (all rounds, all players) targets roughly this long —
	// see computeDrawDuration. More players means more turns, so each
	// turn's drawing time shrinks to compensate, clamped to stay playable.
	targetGameDuration = 10 * time.Minute
	minDrawDuration    = 30 * time.Second
	maxDrawDuration    = 80 * time.Second

	// Scoring: faster correct guesses score more; the drawer scores per
	// correct guesser, rewarding a drawing people can actually read.
	pointsForFirstGuess       = 3
	pointsForSecondGuess      = 2
	pointsForLaterGuess       = 1
	pointsForDrawerPerGuesser = 1
)

var (
	ErrAlreadyInRoom     = errors.New("already in room")
	ErrRoomFull          = errors.New("room is full")
	ErrNotHost           = errors.New("only the host can do that")
	ErrAlreadyStarted    = errors.New("game already started")
	ErrNotEnoughPlayers  = errors.New("need at least 2 players to start")
	ErrWrongPhase        = errors.New("not accepting that right now")
	ErrNotYourTurn       = errors.New("it's not your turn to draw")
	ErrInvalidWordChoice = errors.New("not one of the offered word choices")
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

	// Turn state. turnOrder is a snapshot of player IDs taken at Start() —
	// fixed for the whole game, so a mid-game disconnect doesn't reshuffle
	// whose turn it is.
	turnOrder      []string
	turnsCompleted int
	totalTurns     int
	drawDuration   time.Duration // computed once in Start(), see computeDrawDuration

	word            string   // secret — never put in State, only sent privately to the drawer
	wordChoices     []string // the 3 candidates offered to the current drawer
	correctGuessers map[string]bool
	guessOrder      []string

	revealOrder  []int
	revealCount  int
	revealTimers []*time.Timer

	turnStartScores map[string]int
	lastWord        string
	lastDrawerID    string
	turnGains       map[string]int

	phaseEndsAt time.Time
	timer       *time.Timer

	scores map[string]int

	// notify is called (unlocked) after any state change the timer itself
	// causes, so the app layer can broadcast. Player join/chat/etc. are
	// triggered by an explicit client request, so the app layer broadcasts
	// after those directly instead of relying on this.
	notify func()

	// onEnterChoosing/onEnterDrawing fire (unlocked) so the app layer can
	// deliver the current drawer's private messages (the 3 word choices,
	// then the confirmed word) — never broadcast, since they're secret.
	onEnterChoosing func()
	onEnterDrawing  func()

	connEpoch map[string]int
}

func newRoom(code, hostID string) *Room {
	return &Room{
		Code:      code,
		hostID:    hostID,
		phase:     PhaseLobby,
		players:   make(map[string]*Player),
		connEpoch: make(map[string]int),
	}
}

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

func (r *Room) SetOnEnterChoosing(fn func()) {
	r.mu.Lock()
	r.onEnterChoosing = fn
	r.mu.Unlock()
}

func (r *Room) SetOnEnterDrawing(fn func()) {
	r.mu.Lock()
	r.onEnterDrawing = fn
	r.mu.Unlock()
}

func (r *Room) fireEnterChoosing() {
	r.mu.Lock()
	fn := r.onEnterChoosing
	r.mu.Unlock()
	if fn != nil {
		fn()
	}
}

func (r *Room) fireEnterDrawing() {
	r.mu.Lock()
	fn := r.onEnterDrawing
	r.mu.Unlock()
	if fn != nil {
		fn()
	}
}

func (r *Room) addPlayerLocked(id, nickname string) int {
	r.players[id] = &Player{ID: id, Nickname: nickname, Connected: true, Ready: true}
	r.order = append(r.order, id)
	r.connEpoch[id]++
	return r.connEpoch[id]
}

func (r *Room) AddPlayer(id, nickname string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.players[id]; exists {
		return 0, ErrAlreadyInRoom
	}
	if len(r.players) >= maxPlayers {
		return 0, ErrRoomFull
	}
	return r.addPlayerLocked(id, nickname), nil
}

func (r *Room) Rejoin(id string) (int, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, ok := r.players[id]
	if !ok {
		return 0, false
	}
	p.Connected = true
	r.connEpoch[id]++
	return r.connEpoch[id], true
}

func (r *Room) SetConnected(id string, connected bool, epoch int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.connEpoch[id] != epoch {
		return
	}
	if p, ok := r.players[id]; ok {
		p.Connected = connected
	}
}

func (r *Room) ToggleReady(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.phase != PhaseLobby {
		return
	}
	if p, ok := r.players[playerID]; ok {
		p.Ready = !p.Ready
	}
}

func (r *Room) appendChatLocked(msg ChatMessage) {
	r.chat = append(r.chat, msg)
	if len(r.chat) > maxChatHistory {
		r.chat = r.chat[len(r.chat)-maxChatHistory:]
	}
}

func (r *Room) addSystemMessageLocked(text string) {
	r.appendChatLocked(ChatMessage{ID: randomID(), Text: text, Ts: time.Now().UnixMilli(), System: true})
}

func (r *Room) AddChat(senderID, text string) ChatMessage {
	r.mu.Lock()
	defer r.mu.Unlock()

	nickname := "unknown"
	if p, ok := r.players[senderID]; ok {
		nickname = p.Nickname
	}
	msg := ChatMessage{ID: randomID(), SenderID: senderID, Nickname: nickname, Text: text, Ts: time.Now().UnixMilli()}
	r.appendChatLocked(msg)
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

// Start moves Lobby -> the first turn's word-choosing phase. Host-only.
// The turn order is a snapshot of current players — fixed for the game.
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

	order := make([]string, len(r.order))
	copy(order, r.order)
	r.turnOrder = order
	r.totalTurns = totalRoundsDefault * len(order)
	r.drawDuration = computeDrawDuration(r.totalTurns)
	r.turnsCompleted = 0
	r.scores = make(map[string]int, len(order))
	r.mu.Unlock()

	r.beginChoosing()
	return nil
}

// computeDrawDuration scales each turn's drawing time so a full game lands
// close to targetGameDuration regardless of player count.
func computeDrawDuration(totalTurns int) time.Duration {
	if totalTurns == 0 {
		return maxDrawDuration
	}
	budget := targetGameDuration - time.Duration(totalTurns)*chooseDuration
	per := budget / time.Duration(totalTurns)
	switch {
	case per < minDrawDuration:
		return minDrawDuration
	case per > maxDrawDuration:
		return maxDrawDuration
	default:
		return per
	}
}

func (r *Room) cancelTimerLocked() {
	if r.timer != nil {
		r.timer.Stop()
		r.timer = nil
	}
	for _, t := range r.revealTimers {
		t.Stop()
	}
	r.revealTimers = nil
}

// currentDrawerIDLocked assumes the caller holds r.mu.
func (r *Room) currentDrawerIDLocked() string {
	if len(r.turnOrder) == 0 {
		return ""
	}
	return r.turnOrder[r.turnsCompleted%len(r.turnOrder)]
}

func (r *Room) CurrentDrawerID() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.currentDrawerIDLocked()
}

func (r *Room) CurrentWord() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.word
}

// CurrentWordChoices reports the current drawer and their 3 offered words —
// used by the app layer to deliver the private word:choices message.
func (r *Room) CurrentWordChoices() (drawerID string, choices []string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.currentDrawerIDLocked(), append([]string(nil), r.wordChoices...)
}

// beginChoosing starts a turn: pick 3 word candidates, announce whose turn
// it is, arm an auto-pick timer in case the drawer doesn't choose in time.
func (r *Room) beginChoosing() {
	r.mu.Lock()
	r.cancelTimerLocked()
	r.phase = PhaseChoosing
	r.word = ""
	r.correctGuessers = make(map[string]bool)
	r.guessOrder = nil
	r.wordChoices = pickWordChoices(wordChoicesCount)
	r.lastWord = ""
	r.lastDrawerID = ""
	r.turnGains = nil
	r.revealCount = 0
	r.revealOrder = nil

	drawerID := r.currentDrawerIDLocked()
	drawerNickname := "someone"
	if p, ok := r.players[drawerID]; ok {
		drawerNickname = p.Nickname
	}
	r.addSystemMessageLocked(fmt.Sprintf("%s is choosing a word…", drawerNickname))

	r.phaseEndsAt = time.Now().Add(chooseDuration)
	r.timer = time.AfterFunc(chooseDuration, r.autoPickWord)
	r.mu.Unlock()

	r.fireNotify()
	r.fireEnterChoosing()
}

func (r *Room) autoPickWord() {
	r.mu.Lock()
	choices := r.wordChoices
	r.mu.Unlock()
	if len(choices) == 0 {
		return
	}
	r.startDrawingWithWord(choices[0])
}

// ChooseWord is the drawer picking one of their 3 offered words.
func (r *Room) ChooseWord(playerID, word string) error {
	r.mu.Lock()
	if r.phase != PhaseChoosing {
		r.mu.Unlock()
		return ErrWrongPhase
	}
	if playerID != r.currentDrawerIDLocked() {
		r.mu.Unlock()
		return ErrNotYourTurn
	}
	valid := false
	for _, w := range r.wordChoices {
		if w == word {
			valid = true
			break
		}
	}
	r.mu.Unlock()
	if !valid {
		return ErrInvalidWordChoice
	}

	r.startDrawingWithWord(word)
	return nil
}

func (r *Room) startDrawingWithWord(word string) {
	r.mu.Lock()
	r.cancelTimerLocked()
	r.phase = PhaseDrawing
	r.word = word
	r.phaseEndsAt = time.Now().Add(r.drawDuration)
	r.timer = time.AfterFunc(r.drawDuration, r.endTurn)

	r.turnStartScores = make(map[string]int, len(r.scores))
	for id, s := range r.scores {
		r.turnStartScores[id] = s
	}

	runes := []rune(word)
	order := make([]int, len(runes))
	for i := range order {
		order[i] = i
	}
	rand.Shuffle(len(order), func(i, j int) { order[i], order[j] = order[j], order[i] })
	r.revealOrder = order
	r.revealCount = 0

	turnToken := r.turnsCompleted
	half := r.drawDuration / 2
	threeQuarter := r.drawDuration * 3 / 4
	r.revealTimers = []*time.Timer{
		time.AfterFunc(half, func() { r.applyReveal(turnToken, 1) }),
		time.AfterFunc(threeQuarter, func() { r.applyReveal(turnToken, 2) }),
	}
	r.mu.Unlock()

	r.fireNotify()
	r.fireEnterDrawing()
}

func (r *Room) applyReveal(turnToken, count int) {
	r.mu.Lock()
	if r.phase != PhaseDrawing || r.turnsCompleted != turnToken {
		r.mu.Unlock()
		return
	}
	maxReveal := len(r.revealOrder) - 1
	if maxReveal < 0 {
		maxReveal = 0
	}
	if count > maxReveal {
		count = maxReveal
	}
	if count <= r.revealCount {
		r.mu.Unlock()
		return
	}
	r.revealCount = count
	r.mu.Unlock()

	r.fireNotify()
}

// GuessOutcome is what TrySubmitGuess found — Attempted tells the caller
// whether this message was even evaluated as a guess (false for chat sent
// by the drawer, outside the Drawing phase, or by someone who's already
// guessed correctly this turn — those are just normal chat).
type GuessOutcome struct {
	Attempted  bool
	Correct    bool
	AllGuessed bool
}

// TrySubmitGuess checks text against the secret word. A correct guess is
// scored immediately and announced as a system chat message right here
// (while still holding the lock, alongside the score mutation) — the
// caller just needs to broadcast the resulting state afterward. An
// incorrect guess is left for the caller to add as ordinary chat (visible
// to everyone, same as Skribbl shows wrong guesses).
func (r *Room) TrySubmitGuess(playerID, text string) GuessOutcome {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.phase != PhaseDrawing || playerID == r.currentDrawerIDLocked() || r.correctGuessers[playerID] {
		return GuessOutcome{}
	}

	if normalizeGuess(text) != normalizeGuess(r.word) {
		return GuessOutcome{Attempted: true}
	}

	r.correctGuessers[playerID] = true
	r.guessOrder = append(r.guessOrder, playerID)

	position := len(r.guessOrder)
	points := guessPointsForPosition(position)
	r.scores[playerID] += points
	r.scores[r.currentDrawerIDLocked()] += pointsForDrawerPerGuesser

	nickname := "unknown"
	if p, ok := r.players[playerID]; ok {
		nickname = p.Nickname
	}
	r.addSystemMessageLocked(fmt.Sprintf("%s guessed the word! (+%d)", nickname, points))

	eligible := len(r.turnOrder) - 1 // everyone except the drawer
	allGuessed := eligible > 0 && len(r.correctGuessers) >= eligible

	return GuessOutcome{Attempted: true, Correct: true, AllGuessed: allGuessed}
}

func normalizeGuess(s string) string {
	return strings.TrimSpace(strings.ToLower(s))
}

func guessPointsForPosition(position int) int {
	switch position {
	case 1:
		return pointsForFirstGuess
	case 2:
		return pointsForSecondGuess
	default:
		return pointsForLaterGuess
	}
}

func (r *Room) endTurn() {
	r.mu.Lock()
	word := r.word
	r.lastDrawerID = r.currentDrawerIDLocked()
	r.turnsCompleted++
	done := r.turnsCompleted >= r.totalTurns
	r.addSystemMessageLocked(fmt.Sprintf(`Time's up! The word was "%s".`, word))

	r.lastWord = word
	gains := make(map[string]int, len(r.scores))
	for id, cur := range r.scores {
		gains[id] = cur - r.turnStartScores[id]
	}
	r.turnGains = gains
	r.mu.Unlock()

	r.beginTurnEnd(done)
}

// AdvanceTurnEarly lets the app layer end a turn immediately once every
// eligible guesser has guessed correctly, instead of waiting out the timer.
func (r *Room) AdvanceTurnEarly() {
	r.endTurn()
}

func (r *Room) beginTurnEnd(lastTurn bool) {
	r.mu.Lock()
	r.cancelTimerLocked()
	r.phase = PhaseTurnEnd
	r.phaseEndsAt = time.Now().Add(turnEndDuration)
	r.timer = time.AfterFunc(turnEndDuration, func() { r.finishTurnEnd(lastTurn) })
	r.mu.Unlock()

	r.fireNotify()
}

func (r *Room) finishTurnEnd(lastTurn bool) {
	if lastTurn {
		r.beginScoreboard()
	} else {
		r.beginChoosing()
	}
}

func (r *Room) beginScoreboard() {
	r.mu.Lock()
	r.cancelTimerLocked()
	r.phase = PhaseScoreboard
	r.phaseEndsAt = time.Time{}
	r.mu.Unlock()

	r.fireNotify()
}

// PlayAgain resets a finished game back to Lobby — same room, same
// players, scores and turn order cleared — so the host can Start a fresh
// game without everyone re-joining. Only valid from Scoreboard, host-only.
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
	r.turnOrder = nil
	r.turnsCompleted = 0
	r.totalTurns = 0
	r.drawDuration = 0
	r.word = ""
	r.wordChoices = nil
	r.correctGuessers = nil
	r.guessOrder = nil
	r.scores = make(map[string]int, len(r.players))
	r.phaseEndsAt = time.Time{}
	r.mu.Unlock()

	r.fireNotify()
	return nil
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

	scores := make([]PlayerScore, 0, len(r.order))
	for _, id := range r.order {
		if p, ok := r.players[id]; ok {
			scores = append(scores, PlayerScore{PlayerID: id, Nickname: p.Nickname, Score: r.scores[id]})
		}
	}

	var phaseEndsAtMillis int64
	if !r.phaseEndsAt.IsZero() {
		phaseEndsAtMillis = r.phaseEndsAt.UnixMilli()
	}

	round, totalRounds := 0, 0
	if n := len(r.turnOrder); n > 0 {
		round = r.turnsCompleted/n + 1
		totalRounds = r.totalTurns / n
	}

	wordLength := 0
	revealedWord := ""
	if r.phase == PhaseDrawing {
		runes := []rune(r.word)
		wordLength = len(runes)
		revealed := make(map[int]bool, r.revealCount)
		for i := 0; i < r.revealCount && i < len(r.revealOrder); i++ {
			revealed[r.revealOrder[i]] = true
		}
		cells := make([]rune, len(runes))
		for i, ch := range runes {
			if revealed[i] {
				cells[i] = ch
			} else {
				cells[i] = '_'
			}
		}
		revealedWord = string(cells)
	}

	lastWord := ""
	lastDrawerID := ""
	var turnGains []PlayerScore
	if r.phase == PhaseTurnEnd {
		lastWord = r.lastWord
		lastDrawerID = r.lastDrawerID
		turnGains = make([]PlayerScore, 0, len(r.order))
		for _, id := range r.order {
			if p, ok := r.players[id]; ok {
				turnGains = append(turnGains, PlayerScore{PlayerID: id, Nickname: p.Nickname, Score: r.turnGains[id]})
			}
		}
	}

	return State{
		Code:         r.Code,
		HostID:       r.hostID,
		Phase:        r.phase,
		Round:        round,
		TotalRounds:  totalRounds,
		PhaseEndsAt:  phaseEndsAtMillis,
		DrawerID:     r.currentDrawerIDLocked(),
		WordLength:   wordLength,
		RevealedWord: revealedWord,
		LastWord:     lastWord,
		LastDrawerID: lastDrawerID,
		TurnGains:    turnGains,
		Players:      players,
		Chat:         chat,
		Scores:       scores,
	}
}
