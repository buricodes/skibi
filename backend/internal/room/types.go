package room

// Phase is the server-authoritative game phase (PRD.md §9, BUILD_PLAN.md §3).
// Sabotage/guess/reveal/scoreboard land in a later pass — draw and gallery
// are enough to prove the phase-transition + timer machinery end to end.
type Phase string

const (
	PhaseLobby      Phase = "lobby"
	PhaseDraw       Phase = "draw"
	PhaseGallery    Phase = "gallery"
	PhaseSabotage   Phase = "sabotage"
	PhaseGuess      Phase = "guess"
	PhaseReveal     Phase = "reveal"
	PhaseScoreboard Phase = "scoreboard"
)

type Player struct {
	ID        string `json:"id"`
	Nickname  string `json:"nickname"`
	Connected bool   `json:"connected"`
}

type ChatMessage struct {
	ID       string `json:"id"`
	SenderID string `json:"senderId"`
	Nickname string `json:"nickname"`
	Text     string `json:"text"`
	Ts       int64  `json:"ts"`
}

// Drawing is only ever put into a State once the room reaches Gallery — see
// Room.State(), and PRD.md §4 step 2 ("Nobody sees anyone else's drawing
// yet"). Never populated during Draw.
type Drawing struct {
	ArtistID     string `json:"artistId"`
	Nickname     string `json:"nickname"`
	ImageDataURL string `json:"imageDataUrl"`
}

// SabotageTask is what one specific player privately needs to know during
// Sabotage — never broadcast, only handed to the assigned saboteur (see
// Room.SabotageTaskFor).
type SabotageTask struct {
	TargetArtistID string
	TargetNickname string
	OriginalImage  string
	Prompt         string
}

// GuessTarget is one sabotaged drawing shown during Guess — deliberately
// carries no hint of who the saboteur actually is (that's SaboteurID in
// RevealResult, only ever populated once the phase is Reveal).
type GuessTarget struct {
	TargetArtistID string `json:"targetArtistId"`
	TargetNickname string `json:"targetNickname"`
	ImageDataURL   string `json:"imageDataUrl"`
	Prompt         string `json:"prompt"`
}

// RevealResult is the fully-public answer for one drawing, computed once at
// the start of Reveal and cached — see Room.beginReveal.
type RevealResult struct {
	TargetArtistID        string   `json:"targetArtistId"`
	TargetNickname        string   `json:"targetNickname"`
	OriginalImageDataURL  string   `json:"originalImageDataUrl"`
	SabotagedImageDataURL string   `json:"sabotagedImageDataUrl"`
	Prompt                string   `json:"prompt"`
	SaboteurID            string   `json:"saboteurId"`
	SaboteurNickname      string   `json:"saboteurNickname"`
	CorrectGuesserIDs     []string `json:"correctGuesserIds"`
	SaboteurCaught        bool     `json:"saboteurCaught"`
}

// PlayerScore is one player's cumulative score across the whole game (not
// per round) — see Room.scores.
type PlayerScore struct {
	PlayerID string `json:"playerId"`
	Nickname string `json:"nickname"`
	Score    int    `json:"score"`
}

// State is the snapshot sent to clients as room:state (PRD.md §8). It's
// sent whole, every time something changes — no partial/patch updates, see
// BUILD_PLAN.md §2 for why that's a deliberate simplicity choice.
type State struct {
	Code        string `json:"code"`
	HostID      string `json:"hostId"`
	Phase       Phase  `json:"phase"`
	Round       int    `json:"round"`
	TotalRounds int    `json:"totalRounds"`
	// PhaseEndsAt is epoch milliseconds, 0 when the current phase has no
	// timer (e.g. Lobby). Clients render their own local countdown from
	// this rather than trusting a server tick — see PRD.md §9 "Timers."
	PhaseEndsAt int64 `json:"phaseEndsAt"`
	// Word is the shared word every player draws — not secret from other
	// players, so it's fine to always include once a round has started.
	Word    string        `json:"word,omitempty"`
	Players []Player      `json:"players"`
	Chat    []ChatMessage `json:"chat"`
	// Drawings is populated for Gallery and Sabotage (so a non-saboteur's
	// waiting screen can still show the gallery grid) — never for Draw, see
	// Drawing above. It never includes who's sabotaging what: that stays
	// private, delivered only via the direct sabotage:assignment message.
	Drawings []Drawing `json:"drawings,omitempty"`
	// SubmittedCount lets the Draw/Sabotage-phase UI show "3/5 submitted"
	// without revealing any actual image content early.
	SubmittedCount int `json:"submittedCount"`
	// GuessTargets is populated only during Guess — the sabotaged drawings,
	// with no hint of who did it.
	GuessTargets []GuessTarget `json:"guessTargets,omitempty"`
	// Reveal is populated only during Reveal — everything is public by then.
	Reveal []RevealResult `json:"reveal,omitempty"`
	// Scores is always present (empty before the game starts) so a
	// Scoreboard screen can show cumulative standings whenever it lands.
	Scores []PlayerScore `json:"scores"`
}
