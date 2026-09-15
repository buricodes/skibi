// Package app wires the generic ws transport (Hub/Client) to the
// game-specific room logic. This is where BUILD_PLAN.md's socket event
// contract actually gets implemented, one handler per message type.
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
	case ws.TypeDrawSubmit:
		a.handleDrawSubmit(c, env)
	case ws.TypeSabotageSubmit:
		a.handleSabotageSubmit(c, env)
	case ws.TypeGuessVote:
		a.handleGuessVote(c, env)
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
	r.SetOnEnterSabotage(func() { a.sendSabotageAssignments(r) })
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

func (a *App) handleDrawSubmit(c *ws.Client, env ws.Envelope) {
	if c.RoomCode == "" {
		a.sendError(c, "not_in_room", "join a room first")
		return
	}
	var p ws.DrawSubmitPayload
	if err := json.Unmarshal(env.Payload, &p); err != nil || p.ImageDataURL == "" {
		a.sendError(c, "bad_request", "imageDataUrl is required")
		return
	}
	r, ok := a.manager.GetRoom(c.RoomCode)
	if !ok {
		return
	}

	allSubmitted, err := r.SubmitDrawing(c.PlayerID, p.ImageDataURL)
	if err != nil {
		a.sendError(c, "submit_failed", err.Error())
		return
	}
	if allSubmitted {
		r.AdvanceToGalleryNow() // fires the notifier itself
	} else {
		a.broadcastState(r) // so everyone's live "submitted" count updates
	}
}

func (a *App) handleSabotageSubmit(c *ws.Client, env ws.Envelope) {
	if c.RoomCode == "" {
		a.sendError(c, "not_in_room", "join a room first")
		return
	}
	var p ws.SabotageSubmitPayload
	if err := json.Unmarshal(env.Payload, &p); err != nil || p.ImageDataURL == "" {
		a.sendError(c, "bad_request", "imageDataUrl is required")
		return
	}
	r, ok := a.manager.GetRoom(c.RoomCode)
	if !ok {
		return
	}

	allSubmitted, err := r.SubmitSabotage(c.PlayerID, p.ImageDataURL)
	if err != nil {
		a.sendError(c, "submit_failed", err.Error())
		return
	}
	if allSubmitted {
		r.AdvanceFromSabotageNow() // fires the notifier itself
	} else {
		a.broadcastState(r) // so everyone's live "submitted" count updates
	}
}

func (a *App) handleGuessVote(c *ws.Client, env ws.Envelope) {
	if c.RoomCode == "" {
		a.sendError(c, "not_in_room", "join a room first")
		return
	}
	var p ws.GuessVotePayload
	if err := json.Unmarshal(env.Payload, &p); err != nil || p.TargetArtistID == "" || p.SuspectID == "" {
		a.sendError(c, "bad_request", "targetArtistId and suspectId are required")
		return
	}
	r, ok := a.manager.GetRoom(c.RoomCode)
	if !ok {
		return
	}
	if err := r.SubmitVote(c.PlayerID, p.TargetArtistID, p.SuspectID); err != nil {
		a.sendError(c, "vote_failed", err.Error())
		return
	}
	// Votes stay secret until Reveal computes the answer — no broadcast
	// here on purpose (nothing public has changed yet).
}

// sendSabotageAssignments delivers each player's private SabotageTaskFor(...)
// directly — never a room broadcast, since it's the answer to Guess.
func (a *App) sendSabotageAssignments(r *room.Room) {
	for _, p := range r.State().Players {
		task, ok := r.SabotageTaskFor(p.ID)
		if !ok {
			continue // didn't submit a drawing this round, or room shrank mid-round
		}
		data, err := ws.Encode(ws.TypeSabotageAssignment, ws.SabotageAssignmentPayload{
			TargetArtistID:   task.TargetArtistID,
			TargetNickname:   task.TargetNickname,
			OriginalImageURL: task.OriginalImage,
			Prompt:           task.Prompt,
		})
		if err != nil {
			log.Printf("encode sabotage assignment: %v", err)
			continue
		}
		a.hub.SendToPlayer(r.Code, p.ID, data)
	}
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

	msg := r.AddChat(c.PlayerID, p.Text)
	data, err := ws.Encode(ws.TypeChatMessage, msg)
	if err != nil {
		log.Printf("encode chat message: %v", err)
		return
	}
	a.hub.Broadcast(r.Code, data)
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
