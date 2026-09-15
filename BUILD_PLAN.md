# SketchSabotage — Build Plan

**Status: the full Skribbl-style game loop is built and verified.**
Lobby → Choosing → Drawing (with live stroke broadcasting) → back to
Choosing for the next player's turn → Scoreboard after the configured
rounds → Play Again resets to Lobby. Verified with real multi-client
WebSocket tests, both directly against the Go server and through the live
Vite dev proxy path (the exact path the browser uses):
- Word choices are delivered only to the current drawer, never broadcast.
- Stroke events (`stroke:start`/`point`/`end`, `canvas:clear`) relay to
  every *other* client in the room, never echoed back to the sender, and
  are silently ignored if sent by anyone who isn't the current drawer.
- A wrong guess posts as ordinary chat; a correct guess never leaks the
  literal text — it becomes a system chat entry, scores immediately, and
  the secret word never appears anywhere in the public `room:state`.
- Turn rotation, scoring math, and the Scoreboard/Play Again reset are also
  covered by fast Go unit tests (`backend/internal/room/room_test.go`) that
  drive the state machine directly.
- Full production deploy path (embed the built frontend into the Go
  binary, serve everything on one port) verified by actually running the
  build sequence and hitting the resulting standalone binary — see §6.

Not built yet: progressive letter-reveal hints, and this session hasn't
done real-browser/visual/mobile-touch testing — everything above is
verified at the protocol/logic level, not by clicking through the UI.

## 1. Repo Structure

```
SketchSabotage/
  PRD.md
  BUILD_PLAN.md
  render.yaml                 # Render Blueprint — see §6
  backend/
    go.mod
    cmd/server/main.go        # http server bootstrap, serves the embedded
                               # frontend build, mounts /ws, /health
    internal/
      ws/
        hub.go                  # room membership + broadcast/relay helpers
        client.go                # per-connection readPump/writePump
        protocol.go               # { type, payload } envelope + typed messages
        id.go
      room/
        room.go                   # state machine: turns, choosing, drawing, scoring
        room_test.go                # unit tests driving the state machine directly
        manager.go                   # map[code]*Room, create/join/leave
        types.go                     # Room, Player, ChatMessage, PlayerScore, State
        words.go                      # word list + pickWordChoices
        id.go
      staticfiles/
        embed.go                       # //go:embed dist — the built frontend
        dist/index.html                 # placeholder until a real build runs
      app/
        app.go                          # wires ws transport <-> room logic
  frontend/
    (vite react-ts scaffold)
    src/
      lib/
        socket.ts               # native WebSocket wrapper + typed send/on
        types.ts                 # mirrors the Go protocol/room types by hand
        useCountdown.ts
      state/
        GameContext.tsx           # latest room:state + word:choices/word:yours +
                                   # stroke send helpers, exposed via context
      components/
        Canvas.tsx                 # interactive (drawer) or read-only (guesser,
                                    # driven by applyRemote* calls) — same component
        Chat.tsx                    # renders real messages + system announcements
        PlayerList.tsx
        Timer.tsx
      screens/
        Home.tsx
        Lobby.tsx                    # room code, QR, invite link, chat, Start
        Choosing.tsx                  # word-picker (drawer) / waiting (everyone else)
        Draw.tsx                       # the live drawing round, both roles
        Scoreboard.tsx
      App.tsx                          # switches on room.phase -> matching screen
```

## 2. The Socket Event Contract

### Client → Server (intents)

| Event | Payload | Notes |
|---|---|---|
| `room:create` | `{ nickname }` | server generates room code, caller becomes host |
| `room:join` | `{ code, nickname }` | rejects if room full/started |
| `room:start` | `{}` | host-only; snapshots turn order, begins turn 1 |
| `room:playAgain` | `{}` | host-only, from Scoreboard; resets to Lobby |
| `word:choose` | `{ word }` | current drawer only, during Choosing |
| `stroke:start` | `{ x, y, color, size }` | current drawer only; relayed as-is |
| `stroke:point` | `{ x, y }` | current drawer only; relayed as-is |
| `stroke:end` | `{}` | current drawer only; relayed as-is |
| `canvas:clear` | `{}` | current drawer only; relayed as-is |
| `chat:send` | `{ text }` | any phase — during Drawing, first checked as a guess |

### Server → Client (room broadcasts)

| Event | Payload | Notes |
|---|---|---|
| `room:state` | full `Room` state | sent whole, every time, to everyone in the room — see §3 |
| `chat:message` | `{ id, senderId?, nickname?, text, ts, system? }` | real messages *and* system announcements share one feed |
| `stroke:start`/`stroke:point`/`stroke:end`/`canvas:clear` | same shape as the client→server version | relayed to everyone except the drawer who sent it |
| `error` | `{ code, message }` | e.g. wrong phase, not your turn, invalid word choice |

### Server → Client (direct to one connection, never broadcast)

| Event | Payload | Notes |
|---|---|---|
| `self:info` | `{ playerId, roomCode }` | so a client can tell which entry in `room:state.players` is itself |
| `word:choices` | `{ choices: string[] }` | sent only to the current drawer, right as Choosing begins |
| `word:yours` | `{ word }` | sent only to the current drawer, right as Drawing begins (covers both manual choice and the auto-pick-on-timeout case) |

Deliberate simplicity, same as before: `room:state` is the whole public
room, sent whole, every time. The one thing that's genuinely never in
there is the secret word — that's the actual thing that must never leak,
so it doesn't ride on the same "send everything" channel at all.

## 3. Turn State Machine (server-authoritative)

```
lobby --room:start--> choosing(turn 1)
  --word:choose/timeout--> drawing
  --all-guessed/timeout--> choosing(next turn)
  ... repeats totalRounds * playerCount times ...
  --last turn ends--> scoreboard
scoreboard --room:playAgain--> lobby
```

`turnsCompleted` and a fixed `totalTurns = totalRounds * len(turnOrder)`
drive this — `currentDrawer = turnOrder[turnsCompleted % len(turnOrder)]`,
`round = turnsCompleted/len(turnOrder) + 1`. Early-advance (word chosen
before the choose-timer expires; everyone's guessed before the draw-timer
expires) and timeout-driven advance both call the exact same
`beginDrawing()`/`endTurn()` functions — one code path per transition
regardless of what triggered it, the same discipline used throughout.

## 4. Stroke Relay — the mechanism that makes this a real Skribbl clone

The server does not understand drawing. `internal/app/app.go`'s
`handleDrawerRelay` does exactly one thing for all four stroke/clear event
types: confirm `r.CurrentDrawerID() == c.PlayerID`, then re-marshal the
already-decoded envelope and `hub.BroadcastExcept(roomCode, sender, data)`.
No stroke data is ever stored server-side or inspected — it's a pure,
stateless relay. This is the deliberate opposite of the earlier
"submit-a-final-image" design: it's more real-time-correct (what Skribbl
actually needs) and, because the server never parses stroke content,
genuinely simpler to implement than image-based submission was.

On the frontend, `components/Canvas.tsx` is the same component for both
roles — `interactive={true}` (the drawer) wires pointer events to
`onStrokeStart`/`onStrokePoint`/`onStrokeEnd`/`onClear` callbacks that the
`Draw` screen forwards to the socket; `interactive={false}` (everyone else)
never accepts pointer input and is driven purely by
`applyRemoteStrokeStart`/`applyRemoteStrokePoint`/`applyRemoteStrokeEnd`/`applyRemoteClear`
calls wired to the incoming relayed events. Coordinates are portable
between clients because the canvas's internal pixel resolution
(480×360) is fixed and identical for every client regardless of how large
it's displayed via CSS.

## 5. Manual Test Checklist (before calling it done)

- [x] Two tabs: create + join, live player list, chat.
- [x] Word choices arrive only at the drawer; the word itself never
      appears in `room:state` or leaks through chat.
- [x] Stroke events relay live to the other tab and never echo back to the
      drawer; a non-drawer's stroke attempt is silently ignored.
- [x] A wrong guess shows as normal chat; a correct guess scores, posts a
      system message, and ends the turn early if it was the last eligible
      guesser.
- [x] Turn rotates to the next player; after all rounds, lands on
      Scoreboard; Play Again resets scores/turns and returns to Lobby.
- [ ] Real phones on real wifi, not just localhost tabs — needs a human
      with a phone, not something this session can verify alone.
- [ ] Actually looks right / feels right — no browser-automation tool is
      available in this session; only protocol-level and build-level
      verification has been done on the frontend.

## 6. Deployment Notes

**Status: done and verified.** `render.yaml` at the repo root is a
ready-to-use Blueprint — Render's dashboard → "New" → "Blueprint" → point
it at this repo picks it up automatically. It runs:

```
cd frontend && npm install && npm run build && cd ..
rm -rf backend/internal/staticfiles/dist
cp -r frontend/dist backend/internal/staticfiles/dist
cd backend && go build -o server ./cmd/server
```

then starts `./backend/server`. `backend/internal/staticfiles/embed.go`
embeds that copied `dist/` directory into the binary via `//go:embed` (a
placeholder `dist/index.html` is committed so `go build`/`go run` keep
working before a frontend build has ever run locally). `cmd/server/main.go`
serves the embedded frontend at `/` and mounts `/ws` and `/health` on the
same `net/http` server. It reads the `PORT` env var (Render sets this
automatically), falling back to `8080` for local dev.

**Verified locally** by running the exact sequence above by hand and
hitting the resulting standalone binary directly — it served the real
built app and the WebSocket flow worked on the same port, no Vite dev
server involved.

No environment variables/secrets required.

**Remaining manual step**: push the local git repo to GitHub, then connect
it on Render's dashboard as a Blueprint — needs an account, so it's on the
project owner, not something this session can do.
