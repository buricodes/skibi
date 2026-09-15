# SketchSabotage — Build Plan

**Status:** The full round loop works end-to-end — Lobby → Draw → Gallery →
Sabotage → Guess → Reveal → back into the next round's Draw (or stays put
after the last round) — server-authoritative throughout, verified with a
15-check real multi-client WebSocket test run both directly against the Go
server and through the live Vite dev proxy path. Verified specifically:
the sabotage derangement never leaks in any broadcast (each player only
ever learns their own assignment, direct-messaged), forced sabotage prompts
are live, Guess targets never hint at the saboteur, and Reveal's scoring
(+3 correct guess, +2 saboteur escapes, -1 saboteur caught) is exactly
correct and persists across round boundaries. One real bug was caught and
fixed in this pass: an empty (nil) Go slice was serializing as JSON `null`
instead of `[]` for `correctGuesserIds`, which would have broken any client
calling `.length` on it.

**The full game loop is complete**: Lobby → Draw → Gallery → Sabotage →
Guess → Reveal → (next round, or Scoreboard after the last one) →
PlayAgain resets back to Lobby, same room, same players, scores cleared.
Verified two ways: a fast Go unit test (`internal/room/room_test.go`)
drives the state machine directly to check round-counting and the
PlayAgain reset without waiting on real timers, and a real ~3.5-minute,
3-round game played through actual WebSocket messages against a live
server confirmed the whole thing end-to-end, including a non-host's
`room:playAgain` being correctly rejected and the host's succeeding.

Not built yet: live reactions, the second "make it fun" mechanic (forced
sabotage prompts, the first one, are already in). A before/after **slider**
on Reveal was simplified to a plain side-by-side Before/After image pair —
same information, less interaction surface to get wrong in the time
available.

Companion to `PRD.md`. This is the order of operations and the concrete
engineering contract, written specifically so the real-time layer (the part
flagged as the risky one) gets solved first and in isolation, before any
game-phase UI is built on top of it.

## 0. Build Philosophy

**De-risk in this order:** rooms/sockets/chat → canvas → game phase state
machine → phase-specific screens → polish → deploy. The reasoning: the
real-time plumbing (a player joining a room, showing up in a live list,
sending a chat message everyone sees) is the same mechanism every later
phase depends on. Get that rock-solid across multiple browser tabs on day 1
before writing a single line of "Draw phase" UI. Everything after that is
just "another event on the same pipe."

## 1. Repo Structure

```
SketchSabotage/
  PRD.md
  BUILD_PLAN.md
  backend/
    go.mod
    cmd/server/main.go        # http server bootstrap, serves frontend/dist in prod, mounts /ws
    internal/
      ws/
        hub.go                  # room membership: map[roomCode][]*Client, broadcast helpers
        client.go                # per-connection readPump/writePump (standard gorilla pattern)
        protocol.go               # { type, payload } envelope + typed message structs
      room/
        room.go                   # one room's state + phase-transition methods
        manager.go                  # map[code]*Room, create/join/leave, code generation
        types.go                     # Room, Player, Drawing, Vote, etc. (mirrors PRD §8)
        words.go                      # word list for Draw phase
        sabotage.go                    # forced-prompt list + derangement assignment
        scoring.go                      # pure functions: votes+truth -> score deltas
        timer.go                         # time.AfterFunc-based phase advance, phaseEndsAt helper
  frontend/
    (vite react-ts scaffold)
    src/
      socket.ts                # single native WebSocket instance + typed send/on helpers
      state/
        GameContext.tsx        # holds latest `room:state` from server, exposes via context
      components/
        Canvas.tsx              # shared by Draw + Sabotage phases (pointer events)
        Timer.tsx                # renders countdown from a phaseEndsAt prop
        PlayerList.tsx
        Chat.tsx
        ReactionBar.tsx
      screens/
        Home.tsx
        Lobby.tsx
        Draw.tsx
        Gallery.tsx
        Sabotage.tsx
        Guess.tsx
        Reveal.tsx
        Scoreboard.tsx
      App.tsx                  # switches on room.phase -> renders the matching screen
```

## 2. The Socket Event Contract

This table *is* the answer to "how do we avoid the realtime stuff turning
into a mess": every event is listed up front, nothing improvised mid-build.

### Client → Server (intents)

| Event | Payload | Notes |
|---|---|---|
| `room:create` | `{ nickname }` | server generates room code, caller becomes host |
| `room:join` | `{ code, nickname }` | rejects if room full/started; on success server adds player |
| `room:start` | `{}` | host-only; validates min players; begins round 1 |
| `room:kick` | `{ playerId }` | host-only |
| `draw:submit` | `{ imageDataUrl }` | during Draw phase; one per player per round |
| `sabotage:submit` | `{ imageDataUrl }` | during Sabotage phase; only accepted from the assigned saboteur |
| `guess:vote` | `{ targetArtistId, suspectId }` | during Guess phase; last vote from a player overwrites their earlier one |
| `chat:send` | `{ text }` | any phase |
| `reaction:send` | `{ targetArtistId, emoji }` | Gallery/Guess phases |
| `room:playAgain` | `{}` | host-only, from Scoreboard |

### Server → Client (state broadcasts)

| Event | Payload | Notes |
|---|---|---|
| `room:state` | full `Room` (minus other players' in-progress canvases) | sent on join and after every mutation — simplest possible sync model: client always just re-renders from the latest full state rather than diffing/patching |
| `phase:change` | `{ phase, phaseEndsAt, round }` | authoritative; client starts its local countdown from this |
| `chat:message` | `{ id, senderId, nickname, text, ts }` | broadcast to whole room including sender |
| `reaction:broadcast` | `{ targetArtistId, emoji, fromId }` | ephemeral, client just animates it, not stored in `room:state` |
| `error` | `{ code, message }` | e.g. room full, room not found, wrong phase for this action |
| `self:info` | `{ playerId, roomCode }` | sent directly to one connection (not room-broadcast) right after `room:create`/`room:join`, so the client can tell which entry in `room:state.players` is itself |

Deliberate simplicity: `room:state` is the whole room, sent whole, every
time. For 3–10 players and small images this is fine on wifi and removes an
entire category of bugs (partial/patch state getting out of sync) that would
cost more time than the bandwidth it'd save. If this turns out to be too
chatty during testing, the fallback isn't a redesign — it's just trimming
what's included in `room:state` (e.g. omit other players' full chat history
after the first send).

**Go implementation shape:** `protocol.go` defines one envelope struct
(`type Message struct { Type string; Payload json.RawMessage }`) plus one Go
struct per message type listed in the tables above. `hub.go`'s
`Broadcast(roomCode string, msg any)` marshals once and writes to every
client's send channel in that room; each `client.go` has the standard
gorilla `readPump`/`writePump` goroutine pair (one goroutine reading off the
socket, one draining a buffered `chan []byte` to it) so a slow client can
never block the room's broadcast loop.

## 3. Phase State Machine (server-authoritative)

```
lobby --room:start--> draw --timeout/all-submitted--> gallery
  --timeout--> sabotage --timeout/submitted--> guess
  --timeout--> reveal --timeout--> (round < total? -> draw : scoreboard)
scoreboard --room:playAgain--> lobby
```

Implementation detail: `Room.ts` owns one method per transition
(`beginDraw()`, `beginGallery()`, `beginSabotage()`, `beginGuess()`,
`beginReveal()`, `beginScoreboard()`), each of which:
1. mutates `phase` and sets `phaseEndsAt`,
2. does any phase-entry computation (e.g. `beginSabotage()` computes the
   derangement assignment),
3. arms a `setTimeout` for the *next* transition,
4. broadcasts `phase:change` + a fresh `room:state`.

Early-advance (everyone submitted before the timer) just clears the pending
timeout and calls the next `begin*()` immediately — same function either way,
so there's exactly one code path per transition regardless of how it was
triggered.

## 4. Day-by-Day Schedule

### Day 1 — real-time core + drawing

1. Scaffold `backend/` (`go mod init`, `gorilla/websocket`, the
   `cmd/server` + `internal/ws` + `internal/room` layout above) and
   `frontend/` (Vite+React+TS+Tailwind). During dev, run
   `go run ./cmd/server` and `npm run dev` (Vite) side by side in two
   terminals, Vite proxying `/ws` to the Go server's port — no need for a
   root-level process manager the way the Node plan used `concurrently`.
2. `RoomManager` + `room:create`/`room:join`/`room:state` over the raw
   WebSocket. Prove it works with **two real browser tabs**: create in one,
   join in the other, see both show up in `room:state`. This is the
   checkpoint that de-risks everything else — don't move on until this is
   solid.
3. Chat (`chat:send` / `chat:message`) — same pattern, second real-time
   feature proves the pattern generalizes.
4. Lobby screen: room code + QR (use `qrcode` npm package server-side or
   `qrcode.react` client-side), player list, chat panel, Start button.
5. `Canvas.tsx` — pointer-events-based drawing (down/move/up), stroke
   color/size, clear, undo-last-stroke, exports current state as a
   `imageDataUrl` via `canvas.toDataURL()`. Build and test this standalone
   before wiring it to any socket event.
6. Wire Draw phase: `beginDraw()` on the server, `draw:submit` intent,
   `Timer.tsx` countdown from `phaseEndsAt`, auto-submit current canvas
   content when the countdown local-side hits 0 (server also force-advances
   independently — client auto-submit is a courtesy, not the safety net).

**End of Day 1 checkpoint:** two+ people can create/join a room, chat, and
both submit a drawing for the same word before a shared timer runs out.

### Day 2 — the rest of the loop, fun mechanics, polish, deploy

1. Gallery: grid of submitted drawings + artist labels + `ReactionBar`.
2. Sabotage: derangement assignment (`scoring.ts`/room logic — simple: shuffle
   player-id list, pair `i` with `i+1 mod n`, reroll if any self-pair, which
   can't happen with a proper cyclic shift), forced-prompt selection,
   saboteur's `Canvas.tsx` reused with the original image pre-loaded as
   background, non-saboteurs see a waiting screen.
3. Guess: show sabotaged images, per-drawing suspect buttons, `guess:vote`,
   chat still live, reactions still live.
4. Reveal: before/after slider (a simple draggable clip-path/overlay — no
   library needed), saboteur reveal, correct guessers, `scoring.ts` applies
   point deltas, `room:state.scores` updates.
5. Scoreboard: round-by-round table, crown, Play Again / Back to Lobby.
6. Must-have fun mechanics if not already folded in above: confirm forced
   sabotage prompts feel funny (swap/extend the prompt list from actual
   playtesting), confirm reactions are visibly live across two tabs.
7. Visual pass to match the reference mockup's dark theme, card styling,
   spacing — Tailwind, no custom design system needed for a 2-day build.
8. Multi-device test: real phones on real wifi, not just desktop browser
   tabs (see checklist below).
9. Deploy to Render: `render.yaml` or dashboard-configured single Go web
   service (`go build -o server ./cmd/server` then `./server`, with the
   frontend built via `npm run build` into `frontend/dist` ahead of the Go
   build so it can be embedded/served), confirm WebSocket upgrade works on
   the deployed URL, not just localhost.
10. Stretch (only if time remains, in this order): SQLite-backed past-games
    list, shareable recap card, custom word packs, kick-player UI polish.

## 5. Manual Test Checklist (before calling it done)

- [ ] Two tabs: create + join, both see each other in the player list live.
- [ ] Three tabs: chat message from one appears instantly in the other two.
- [ ] Draw phase: canvas works with mouse (desktop) and touch (phone).
- [ ] A player who never submits a drawing doesn't block the phase from
      advancing when the timer runs out.
- [ ] Sabotage never assigns a player their own drawing (run a few rounds
      with varying player counts, including edge case of exactly 3 players).
- [ ] A player who disconnects mid-round doesn't crash the room for others.
- [ ] Full 3-round game completes and lands on a correct Scoreboard.
- [ ] Same test, but on the **deployed** URL with real phones on real wifi,
      not localhost — this is the one that actually matters for the demo.

## 6. Deployment Notes

- Single Render "Web Service." Build command:
  `cd frontend && npm install && npm run build && cd ../backend && go build -o server ./cmd/server`.
  Start command: `./backend/server`.
- `cmd/server/main.go` serves `frontend/dist` as static files (via Go's
  `embed` package, so the built frontend ships inside the single binary —
  simplest possible deploy artifact) and mounts the `/ws` upgrade handler on
  the same `net/http` server — one URL, one process, nothing else to
  configure.
- No environment variables/secrets required for the MVP (see PRD §11), which
  removes an entire class of "it works locally but not deployed" failures.
