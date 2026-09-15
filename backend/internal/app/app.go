// Package app wires the generic ws transport (Hub/Client) to the
// game-specific room logic — this is where the socket event contract
// actually gets implemented, one handler per message type.
package app

import (
	"encoding/json"
	"log"

	"sketchsabotage/backend/internal/room"
	"sketchsabotage/backend/internal/ws"
)

type App struct {
	manager *room.Manager
	hub     *ws.Hub
}

func New() *App {
	return &App{
		manager: room.NewManager(),
		hub:     ws.NewHub(),
	}
}

// HandleMessage is the single entry point ws.Client.ReadPump calls for every
// decoded message from a connection.
func (a *App) HandleMessage(c *ws.Client, env ws.Envelope) {
	switch env.Type {
	case ws.TypeRoomCreate:
		a.handleRoomCreate(c, env)
	case ws.TypeRoomJoin:
		a.handleRoomJoin(c, env)
	case ws.TypeRoomStart:
		a.handleRoomStart(c, env)
	case ws.TypeRoomPlayAgain:
		a.handleRoomPlayAgain(c, env)
	case ws.TypeChatSend:
		a.handleChatSend(c, env)
	case ws.TypeWordChoose:
		a.handleWordChoose(c, env)
	case ws.TypeStrokeStart, ws.TypeStrokePoint, ws.TypeStrokeEnd, ws.TypeCanvasClear:
		a.handleDrawerRelay(c, env)
	default:
		a.sendError(c, "unknown_type", "unrecognized message type: "+env.Type)
	}
}

// HandleDisconnect must be called once a client's ReadPump returns.
func (a *App) HandleDisconnect(c *ws.Client) {
	if c.RoomCode == "" {
		return
	}
	r, ok := a.manager.GetRoom(c.RoomCode)
	if !ok {
		return
	}
	r.SetConnected(c.PlayerID, false)
	a.hub.Leave(c.RoomCode, c)
	a.broadcastState(r)
	a.manager.RemoveIfEmpty(c.RoomCode)
}

func (a *App) handleRoomCreate(c *ws.Client, env ws.Envelope) {
	var p ws.RoomCreatePayload
	if err := json.Unmarshal(env.Payload, &p); err != nil || p.Nickname == "" {
		a.sendError(c, "bad_request", "nickname is required")
		return
	}

	r := a.manager.CreateRoom(c.ID, p.Nickname)
	r.SetNotifier(func() { a.broadcastState(r) })
	r.SetOnEnterChoosing(func() { a.sendWordChoices(r) })
	r.SetOnEnterDrawing(func() { a.sendYourWord(r) })
	c.RoomCode = r.Code
	c.PlayerID = c.ID
	a.hub.Join(r.Code, c)
	a.sendSelfInfo(c)
	a.broadcastState(r)
}

func (a *App) handleRoomJoin(c *ws.Client, env ws.Envelope) {
	var p ws.RoomJoinPayload
	if err := json.Unmarshal(env.Payload, &p); err != nil || p.Nickname == "" || p.Code == "" {
		a.sendError(c, "bad_request", "code and nickname are required")
		return
	}

	r, ok := a.manager.GetRoom(p.Code)
	if !ok {
		a.sendError(c, "room_not_found", "no room with that code")
		return
	}
	if err := r.AddPlayer(c.ID, p.Nickname); err != nil {
		a.sendError(c, "join_failed", err.Error())
		return
	}

	c.RoomCode = r.Code
	c.PlayerID = c.ID
	a.hub.Join(r.Code, c)
	a.sendSelfInfo(c)
	a.broadcastState(r)
}

func (a *App) handleRoomStart(c *ws.Client, _ ws.Envelope) {
	if c.RoomCode == "" {
		a.sendError(c, "not_in_room", "join a room first")
		return
	}
	r, ok := a.manager.GetRoom(c.RoomCode)
	if !ok {
		return
	}
	if err := r.Start(c.PlayerID); err != nil {
		a.sendError(c, "start_failed", err.Error())
		return
	}
	// Start() transitions the room and fires the notifier -> broadcastState
	// itself; nothing further to do here.
}

func (a *App) handleRoomPlayAgain(c *ws.Client, _ ws.Envelope) {
	if c.RoomCode == "" {
		a.sendError(c, "not_in_room", "join a room first")
		return
	}
	r, ok := a.manager.GetRoom(c.RoomCode)
	if !ok {
		return
	}
	if err := r.PlayAgain(c.PlayerID); err != nil {
		a.sendError(c, "play_again_failed", err.Error())
		return
	}
}

func (a *App) handleWordChoose(c *ws.Client, env ws.Envelope) {
	if c.RoomCode == "" {
		a.sendError(c, "not_in_room", "join a room first")
		return
	}
	var p ws.WordChoosePayload
	if err := json.Unmarshal(env.Payload, &p); err != nil || p.Word == "" {
		a.sendError(c, "bad_request", "word is required")
		return
	}
	r, ok := a.manager.GetRoom(c.RoomCode)
	if !ok {
		return
	}
	if err := r.ChooseWord(c.PlayerID, p.Word); err != nil {
		a.sendError(c, "choose_failed", err.Error())
		return
	}
	// ChooseWord transitions the room and fires its own notifications.
}

// handleDrawerRelay handles stroke:start/point/end and canvas:clear — the
// server never parses these, it just confirms the sender is the current
// drawer and re-broadcasts the exact same envelope to everyone else in the
// room. Silently ignored from anyone else (not an error state — a stray
// message from a drawer whose turn just ended, for instance).
func (a *App) handleDrawerRelay(c *ws.Client, env ws.Envelope) {
	if c.RoomCode == "" {
		return
	}
	r, ok := a.manager.GetRoom(c.RoomCode)
	if !ok || r.CurrentDrawerID() != c.PlayerID {
		return
	}
	data, err := json.Marshal(env)
	if err != nil {
		log.Printf("re-encode relay message: %v", err)
		return
	}
	a.hub.BroadcastExcept(r.Code, c, data)
}

func (a *App) handleChatSend(c *ws.Client, env ws.Envelope) {
	if c.RoomCode == "" {
		a.sendError(c, "not_in_room", "join a room before chatting")
		return
	}
	var p ws.ChatSendPayload
	if err := json.Unmarshal(env.Payload, &p); err != nil || p.Text == "" {
		return
	}
	r, ok := a.manager.GetRoom(c.RoomCode)
	if !ok {
		return
	}

	outcome := r.TrySubmitGuess(c.PlayerID, p.Text)
	if outcome.Attempted && outcome.Correct {
		// TrySubmitGuess already recorded a system chat message and scored
		// it — the guessed word itself is deliberately never broadcast as
		// this player's chat text, so anyone still guessing doesn't see it.
		a.broadcastState(r)
		if outcome.AllGuessed {
			r.AdvanceTurnEarly() // fires its own notifications
		}
		return
	}

	// Normal chat: a wrong guess (still shown, same as Skribbl), the
	// drawer talking, or any lobby/scoreboard chatter.
	msg := r.AddChat(c.PlayerID, p.Text)
	data, err := ws.Encode(ws.TypeChatMessage, msg)
	if err != nil {
		log.Printf("encode chat message: %v", err)
		return
	}
	a.hub.Broadcast(r.Code, data)
}

func (a *App) sendWordChoices(r *room.Room) {
	drawerID, choices := r.CurrentWordChoices()
	data, err := ws.Encode(ws.TypeWordChoices, ws.WordChoicesPayload{Choices: choices})
	if err != nil {
		log.Printf("encode word choices: %v", err)
		return
	}
	a.hub.SendToPlayer(r.Code, drawerID, data)
}

func (a *App) sendYourWord(r *room.Room) {
	drawerID := r.CurrentDrawerID()
	data, err := ws.Encode(ws.TypeYourWord, ws.YourWordPayload{Word: r.CurrentWord()})
	if err != nil {
		log.Printf("encode your word: %v", err)
		return
	}
	a.hub.SendToPlayer(r.Code, drawerID, data)
}

func (a *App) broadcastState(r *room.Room) {
	data, err := ws.Encode(ws.TypeRoomState, r.State())
	if err != nil {
		log.Printf("encode room state: %v", err)
		return
	}
	a.hub.Broadcast(r.Code, data)
}

func (a *App) sendSelfInfo(c *ws.Client) {
	data, err := ws.Encode(ws.TypeSelfInfo, ws.SelfInfoPayload{PlayerID: c.PlayerID, RoomCode: c.RoomCode})
	if err != nil {
		log.Printf("encode self info: %v", err)
		return
	}
	c.Send(data)
}

func (a *App) sendError(c *ws.Client, code, message string) {
	data, err := ws.Encode(ws.TypeError, ws.ErrorPayload{Code: code, Message: message})
	if err != nil {
		return
	}
	c.Send(data)
}
