package room

import (
	"crypto/rand"
	"sync"
)

// codeChars excludes visually ambiguous characters (0/O, 1/I) since the
// room code gets read off a phone screen or a projector.
const codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const codeLength = 5

// Manager tracks every live room by its join code. One process, one
// in-memory map — deliberately no multi-instance/Redis story, see PRD.md §3.
type Manager struct {
	mu    sync.Mutex
	rooms map[string]*Room
}

func NewManager() *Manager {
	return &Manager{rooms: make(map[string]*Room)}
}

func (m *Manager) CreateRoom(hostID, hostNickname string) (*Room, int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	code := m.generateUniqueCodeLocked()
	r := newRoom(code, hostID)
	epoch := r.addPlayerLocked(hostID, hostNickname)
	m.rooms[code] = r
	return r, epoch
}

func (m *Manager) GetRoom(code string) (*Room, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, ok := m.rooms[code]
	return r, ok
}

// RemoveIfEmpty garbage-collects a room once every player has disconnected,
// so an abandoned demo room doesn't sit in memory forever.
func (m *Manager) RemoveIfEmpty(code string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if r, ok := m.rooms[code]; ok && r.IsEmpty() {
		delete(m.rooms, code)
	}
}

func (m *Manager) generateUniqueCodeLocked() string {
	for {
		code := generateCode()
		if _, exists := m.rooms[code]; !exists {
			return code
		}
	}
}

func generateCode() string {
	b := make([]byte, codeLength)
	_, _ = rand.Read(b)
	out := make([]byte, codeLength)
	for i, v := range b {
		out[i] = codeChars[int(v)%len(codeChars)]
	}
	return string(out)
}
