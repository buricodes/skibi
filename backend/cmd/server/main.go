package main

import (
	"io/fs"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/websocket"

	"sketchsabotage/backend/internal/app"
	"sketchsabotage/backend/internal/staticfiles"
	"sketchsabotage/backend/internal/ws"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// No cookies/credentials involved (PRD.md §10, no auth) and this is a
	// short-lived classroom demo, so any origin is fine — a real deployment
	// with persistent state would want to lock this down.
	CheckOrigin: func(r *http.Request) bool { return true },
}

func main() {
	a := app.New()

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("ws upgrade failed: %v", err)
			return
		}

		client := ws.NewClient(ws.NewID(), conn)
		go client.WritePump()
		go func() {
			client.ReadPump(a.HandleMessage)
			a.HandleDisconnect(client)
		}()
	})

	// Everything else falls through to the embedded frontend build. During
	// local dev this path is basically unused (Vite's dev server on :5173
	// serves the app directly and only proxies /ws here — see
	// frontend/vite.config.ts) — it's what actually matters once deployed
	// as the single production binary (BUILD_PLAN.md §6).
	distFS, err := fs.Sub(staticfiles.DistFS, "dist")
	if err != nil {
		log.Fatalf("static file setup: %v", err)
	}
	mux.Handle("/", http.FileServer(http.FS(distFS)))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port
	log.Printf("SketchSabotage backend listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
