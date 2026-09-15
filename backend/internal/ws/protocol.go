package ws

import "encoding/json"

// Envelope is the one message shape every client<->server message uses:
// { "type": "...", "payload": {...} }.
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

const (
	// Client -> Server
	TypeRoomCreate    = "room:create"
	TypeRoomJoin      = "room:join"
	TypeRoomStart     = "room:start"
	TypeRoomPlayAgain = "room:playAgain"
	TypeChatSend      = "chat:send"
	TypeWordChoose    = "word:choose"
	TypeStrokeStart   = "stroke:start"
	TypeStrokePoint   = "stroke:point"
	TypeStrokeEnd     = "stroke:end"
	TypeCanvasClear   = "canvas:clear"

	// Server -> Client (room broadcasts)
	TypeRoomState   = "room:state"
	TypeChatMessage = "chat:message"
	TypeError       = "error"

	// Server -> Client (direct to one connection, not broadcast) — tells a
	// client which entry in room:state.players is itself, since player ids
	// are otherwise meaningless random ids to the browser.
	TypeSelfInfo = "self:info"

	// Server -> Client (direct to the current drawer only, not broadcast) —
	// the 3 word options to choose from, then the confirmed word once
	// chosen (including when auto-picked by timeout). Never sent to anyone
	// else, since it's the answer to what everyone else is guessing.
	TypeWordChoices = "word:choices"
	TypeYourWord    = "word:yours"
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

type WordChoosePayload struct {
	Word string `json:"word"`
}

type WordChoicesPayload struct {
	Choices []string `json:"choices"`
}

type YourWordPayload struct {
	Word string `json:"word"`
}

// Stroke*/CanvasClear payloads are never decoded server-side — the server
// only checks that the sender is the current drawer, then re-broadcasts
// the envelope byte-for-byte to everyone else in the room. These structs
// exist purely so the frontend has a typed contract to match against.
type StrokeStartPayload struct {
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Color string  `json:"color"`
	Size  float64 `json:"size"`
}

type StrokePointPayload struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type SelfInfoPayload struct {
	PlayerID string `json:"playerId"`
	RoomCode string `json:"roomCode"`
}
