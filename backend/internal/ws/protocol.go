package ws

import "encoding/json"

// Envelope is the one message shape every client<->server message uses:
// { "type": "...", "payload": {...} }. See BUILD_PLAN.md §2 for the full
// event contract this implements.
type Envelope struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// Encode marshals payload and wraps it in an Envelope, ready to send on a
// Client's send channel or broadcast via the Hub.
func Encode(msgType string, payload any) ([]byte, error) {
	p, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return json.Marshal(Envelope{Type: msgType, Payload: p})
}

// Message types, matching BUILD_PLAN.md's event contract table.
const (
	// Client -> Server
	TypeRoomCreate     = "room:create"
	TypeRoomJoin       = "room:join"
	TypeRoomStart      = "room:start"
	TypeRoomPlayAgain  = "room:playAgain"
	TypeChatSend       = "chat:send"
	TypeDrawSubmit     = "draw:submit"
	TypeSabotageSubmit = "sabotage:submit"
	TypeGuessVote      = "guess:vote"

	// Server -> Client (room broadcasts)
	TypeRoomState   = "room:state"
	TypeChatMessage = "chat:message"
	TypeError       = "error"

	// Server -> Client (direct to one connection, not broadcast) — tells a
	// client which entry in room:state.players is itself, since player ids
	// are otherwise meaningless random ids to the browser.
	TypeSelfInfo = "self:info"

	// Server -> Client (direct to one connection, not broadcast) — the
	// assigned saboteur's private task for this round. Never sent to anyone
	// else, since it's the answer to the Guess phase.
	TypeSabotageAssignment = "sabotage:assignment"
)

type RoomCreatePayload struct {
	Nickname string `json:"nickname"`
}

type RoomJoinPayload struct {
	Code     string `json:"code"`
	Nickname string `json:"nickname"`
}

type ChatSendPayload struct {
	Text string `json:"text"`
}

type DrawSubmitPayload struct {
	ImageDataURL string `json:"imageDataUrl"`
}

type SabotageSubmitPayload struct {
	ImageDataURL string `json:"imageDataUrl"`
}

type GuessVotePayload struct {
	TargetArtistID string `json:"targetArtistId"`
	SuspectID      string `json:"suspectId"`
}

type SabotageAssignmentPayload struct {
	TargetArtistID   string `json:"targetArtistId"`
	TargetNickname   string `json:"targetNickname"`
	OriginalImageURL string `json:"originalImageDataUrl"`
	Prompt           string `json:"prompt"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type SelfInfoPayload struct {
	PlayerID string `json:"playerId"`
	RoomCode string `json:"roomCode"`
}
