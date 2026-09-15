package ws

import "sync"

// Hub is the hand-rolled equivalent of Socket.io's room broadcasting: a
// registry of which connections belong to which room code, and a way to
// write a message to all of them. See BUILD_PLAN.md §2.
type Hub struct {
	mu    sync.Mutex
	rooms map[string]map[*Client]bool
}

func NewHub() *Hub {
	return &Hub{rooms: make(map[string]map[*Client]bool)}
}

func (h *Hub) Join(roomCode string, c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[roomCode] == nil {
		h.rooms[roomCode] = make(map[*Client]bool)
	}
	h.rooms[roomCode][c] = true
}

func (h *Hub) Leave(roomCode string, c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.rooms[roomCode]; ok {
		delete(clients, c)
		if len(clients) == 0 {
			delete(h.rooms, roomCode)
		}
	}
}

// Broadcast writes data to every client currently in roomCode. A client
// whose send buffer is already full is dropped from the room rather than
// allowed to block everyone else's broadcast.
func (h *Hub) Broadcast(roomCode string, data []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.rooms[roomCode] {
		c.Send(data)
	}
}

// SendToPlayer writes data to just the one connection in roomCode whose
// PlayerID matches — used for messages that must stay private to one
// player, like a Sabotage assignment (never a room broadcast). A room of
// up to 10 players makes the linear scan a non-issue.
func (h *Hub) SendToPlayer(roomCode, playerID string, data []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.rooms[roomCode] {
		if c.PlayerID == playerID {
			c.Send(data)
			return
		}
	}
}
