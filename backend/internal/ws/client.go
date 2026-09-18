package ws

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 1 << 20 // 1MB — generous enough for a base64 canvas PNG
)

// Client wraps one player's WebSocket connection. RoomCode/PlayerID are set
// once the player creates or joins a room; empty until then.
type Client struct {
	ID        string
	RoomCode  string
	PlayerID  string
	ConnEpoch int

	conn *websocket.Conn
	send chan []byte
}

func NewClient(id string, conn *websocket.Conn) *Client {
	return &Client{ID: id, conn: conn, send: make(chan []byte, 32)}
}

// Send queues a message for this client only. Never blocks — a client whose
// buffer is already full is treated as unhealthy and the message is
// dropped, so one slow connection can't stall the caller.
func (c *Client) Send(data []byte) {
	select {
	case c.send <- data:
	default:
	}
}

// WritePump owns the connection's writes and must run in its own goroutine
// for the lifetime of the connection (standard gorilla/websocket pattern).
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case data, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ReadPump owns the connection's reads and blocks until the connection
// closes or errors, dispatching each decoded Envelope to handle. Run it in
// its own goroutine; call HandleDisconnect once it returns.
func (c *Client) ReadPump(handle func(*Client, Envelope)) {
	defer c.conn.Close()
	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		var env Envelope
		if err := json.Unmarshal(data, &env); err != nil {
			log.Printf("client %s sent invalid message: %v", c.ID, err)
			continue
		}
		handle(c, env)
	}
}
