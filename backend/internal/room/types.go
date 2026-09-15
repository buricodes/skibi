package room

// Phase is the server-authoritative game phase.
type Phase string

const (
	PhaseLobby      Phase = "lobby"
	PhaseChoosing   Phase = "choosing"   // current drawer is picking a word
	PhaseDrawing    Phase = "drawing"    // live round: drawer draws, others guess
	PhaseScoreboard Phase = "scoreboard" // game over
)

type Player struct {
	ID        string `json:"id"`
	Nickname  string `json:"nickname"`
	Connected bool   `json:"connected"`
}

// ChatMessage is either a real player message (SenderID/Nickname set) or a
// server announcement (System true, no sender) — e.g. "X guessed the
// word!" or "Time's up! The word was ...". Both live in the same list so
// the frontend renders one continuous feed with zero extra plumbing.
type ChatMessage struct {
	ID       string `json:"id"`
	SenderID string `json:"senderId,omitempty"`
	Nickname string `json:"nickname,omitempty"`
	Text     string `json:"text"`
	Ts       int64  `json:"ts"`
	System   bool   `json:"system,omitempty"`
}

// PlayerScore is one player's cumulative score across the whole game.
type PlayerScore struct {
	PlayerID string `json:"playerId"`
	Nickname string `json:"nickname"`
	Score    int    `json:"score"`
}

// State is the snapshot sent to clients as room:state. It's sent whole,
// every time something changes — no partial/patch updates. The secret word
// itself is never in here — only WordLength (a blanks hint) — the drawer
// learns the real word via a direct, non-broadcast message (word:yours).
type State struct {
	Code        string `json:"code"`
	HostID      string `json:"hostId"`
	Phase       Phase  `json:"phase"`
	Round       int    `json:"round"`
	TotalRounds int    `json:"totalRounds"`
	// PhaseEndsAt is epoch milliseconds, 0 when the current phase has no
	// timer (e.g. Lobby). Clients render their own local countdown from
	// this rather than trusting a server tick.
	PhaseEndsAt int64 `json:"phaseEndsAt"`
	// DrawerID is whose turn it is — empty in Lobby/Scoreboard.
	DrawerID string `json:"drawerId,omitempty"`
	// WordLength is the guessers' only hint about the secret word (e.g. 7
	// for "penguin") — 0 outside the Drawing phase.
	WordLength int           `json:"wordLength,omitempty"`
	Players    []Player      `json:"players"`
	Chat       []ChatMessage `json:"chat"`
	Scores     []PlayerScore `json:"scores"`
}
