package ws

import (
	"crypto/rand"
	"encoding/hex"
)

// NewID returns a random hex string, used as a connection/player id — good
// enough for a nickname-only, no-accounts 2-day demo (see PRD.md §3, §9).
func NewID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
