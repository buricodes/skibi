# SketchSabotage — Product Requirements Document

## 1. Concept

A real-time multiplayer party game. Everyone privately draws the same word.
Drawings are revealed to the room. Then each drawing is secretly handed to a
*different* player, who "sabotages" it with a forced, specific edit (e.g. "add
a hat," "set it on fire"). Players then see the sabotaged drawing and guess
who did it, using chat to accuse/bluff. A before/after reveal shows who was
right, points are awarded, and the game repeats for N rounds before a final
scoreboard.

This is not a live-stroke-sync drawing game (like Skribbl) — each player
draws privately and only submits the finished image when their timer ends.
That is a deliberate scope decision: it removes the hardest technical problem
(broadcasting every pen stroke to every other client in real time) while
keeping the fun (drawing + social deduction + reveal).

## 2. Goal & Constraints

- Ship a **live, publicly reachable, deployed** build within **2 days**.
- Solo build, college mini-project submission (5th semester). No domain
  constraint from faculty — judged on working demo + presentability.
- Must support a live in-room demo: several people on their own
  phones/laptops joining one game and playing it in front of an evaluator.

## 3. Non-Goals (explicitly out of scope for the 2-day build)

- Accounts / persistent user profiles / login.
- Persisting game history across server restarts (games are ephemeral,
  in-memory; a server restart wipes active rooms — acceptable for a demo).
- Horizontal scaling / multi-instance socket state (Redis adapter, etc.) —
  one server process is enough for a classroom demo.
- Mobile app / app store distribution — this is a responsive web app, played
  in a mobile browser.
- Real-time collaborative stroke sync (see Concept above — deliberately
  avoided).
- Content moderation / profanity filtering on chat or custom words — fine for
  a controlled classroom demo, flagged as future work.

## 4. Core Game Loop

1. **Lobby** — host creates a room, gets a 5-char room code + QR code.
   Players join with just a nickname (no auth). Host sees the player list
   fill in live, can kick a player, and starts the game once ≥3 players
   (configurable) have joined.
2. **Draw** (60s) — every player gets the *same* secret word and a private
   canvas. Nobody sees anyone else's drawing yet. Auto-submits current canvas
   state when the timer hits 0, even if unfinished.
3. **Gallery** (10s) — every submitted drawing is revealed to everyone at
   once, in a grid, labeled with its original artist. Players can drop emoji
   reactions on any drawing, live.
4. **Sabotage** (30s) — server assigns each drawing to exactly one other
   player (a derangement: nobody sabotages their own drawing, and pairing is
   otherwise random). Each saboteur gets the original image loaded into the
   canvas plus **one random forced prompt** ("add a hat," "make it on fire,"
   "add a second head," …) and edits on top of it. Auto-submits at 0.
5. **Guess** (45s) — for each drawing (one at a time, or all at once — see
   Open Questions), players see the *sabotaged* version only (not the
   original) and vote on who they think sabotaged it, via a button per
   player. Chat is open for accusing/bluffing/discussing. Reactions still
   work here too.
6. **Reveal** (15s) — before/after slider comparing original vs sabotaged
   image, the real saboteur's name, who guessed correctly, and the points
   awarded this round.
7. Repeat steps 2–6 for **3 rounds** (configurable), new word each round.
8. **Scoreboard** — final standings, crown for the winner, "Play Again"
   (same room, new game) and "Back to Lobby" options.

### Scoring (per round)

- Correct guess of the saboteur: **+3** for the guesser.
- Being the saboteur and *not* getting caught (majority of guesses wrong):
  **+2** for the saboteur.
- Being the saboteur and getting caught: **-1** for the saboteur (small
  penalty, keeps it light — this is a party game, not a punishing one).
- Original artist gets **+1** per reaction their drawing received in the
  Gallery phase (rewards effort/humor even if the sabotage plot doesn't
  involve them).

(Exact numbers are tunable during build/playtesting — the shape of the
scoring, not the constants, is the requirement.)

## 5. What Makes It Fun (beyond the base loop)

These three were chosen specifically to fix "is this actually fun" — see
build priority in `BUILD_PLAN.md`:

1. **Forced, specific sabotage prompts**, not free-form edits. A free-form
   sabotage is either too subtle to notice or an illegible scribble — neither
   is guessable or funny. A forced prompt ("give it a mustache") guarantees a
   visible, funny, guessable change every time. **Must-have.**
2. **Live emoji reactions** during Gallery and Guess — tap an emoji, it
   animates on that drawing for everyone in the room in real time. Cheap to
   build, and it's most of why party games feel alive (reacting together,
   not waiting silently for your turn). **Must-have.**
3. **Shareable end-of-game recap card** — an auto-generated image/screen
   summarizing "funniest sabotage," "most artistic," "biggest liar" (most
   wrongly-accused), rendered as one shareable card instead of a plain
   scoreboard. Great demo moment. **Stretch goal** if Day 2 has slack.

## 6. Screens (UX Flow)

Matches the reference mockup for Home/Lobby/Draw/Gallery/Reveal/Scoreboard,
plus one new screen (Sabotage) the mockup didn't show:

| # | Screen | Who sees it | Key elements |
|---|--------|-------------|---------------|
| 1 | Home | Everyone | "Create Room" / "Join Room", nickname input |
| 2 | Lobby | Everyone in room | Room code + QR, player list, chat, Start button (host only) |
| 3 | Draw | Everyone (private canvas) | Word prompt, canvas + tool palette (pen, colors, clear, undo), countdown |
| 4 | Gallery | Everyone | Grid of all drawings w/ artist name, tap-to-react |
| 5 | **Sabotage (new)** | Only the assigned saboteur; others see a "waiting" screen with live reactions from Gallery still visible | The original drawing loaded into canvas, the forced prompt shown prominently, countdown |
| 6 | Guess | Everyone | The sabotaged image, one button per player to accuse, chat panel, countdown |
| 7 | Reveal | Everyone | Before/after slider, saboteur revealed, who guessed right, points delta |
| 8 | Scoreboard | Everyone | Round-by-round table, crown for leader, Play Again / Back to Lobby |
| 9 | Recap card (stretch) | Everyone | Shareable auto-generated summary |

## 7. Functional Requirements

**Host**
- Create a room, get a shareable code + QR.
- Configure round count (default 3) and round-word difficulty/pack before
  starting (nice-to-have; default word list is fine if time-constrained).
- Start the game once minimum players have joined.
- Kick a player from the lobby.
- Trigger "Play Again" after Scoreboard.

**Player**
- Join a room by code, pick a nickname (no auth).
- Draw on a private canvas during Draw and Sabotage phases (pen tool,
  ~6 colors, brush size, clear, undo last stroke).
- See all drawings during Gallery; react with emoji.
- Vote for a suspect during Guess; send chat messages throughout.
- See personal + room scores at every Reveal and the final Scoreboard.

**System**
- Enforce room capacity (suggest 3–10 players).
- Server is the sole authority on game phase/timer/scores — clients only
  render what the server sends and emit intents (submit drawing, cast vote,
  send chat, react). No client trusts another client's state.
- Auto-advance every timed phase when the timer expires, regardless of
  whether all players submitted (missing submissions default to blank /
  no-vote / skip).
- Handle a player disconnecting mid-game without crashing the room for
  everyone else (their pending action is treated as a no-op/skip).

## 8. Data Model (server, in-memory)

```
Room
  code: string (5 chars, unguessable-enough for a classroom demo)
  hostSocketId: string
  players: Player[]
  settings: { rounds: number, drawSeconds, sabotageSeconds, guessSeconds }
  phase: 'lobby' | 'draw' | 'gallery' | 'sabotage' | 'guess' | 'reveal' | 'scoreboard'
  phaseEndsAt: epoch millis | null
  round: number
  currentWord: string
  drawings: Map<playerId, { imageDataUrl, artistId }>
  sabotageAssignments: Map<originalArtistId, saboteurId>   // derangement
  sabotagedDrawings: Map<originalArtistId, { imageDataUrl, saboteurId, prompt }>
  votes: Map<targetArtistId, Map<voterId, suspectId>>
  reactions: Map<targetArtistId, Reaction[]>
  chat: ChatMessage[]                       // capped ring buffer, in-memory
  scores: Map<playerId, number>

Player
  id: string (socket id or a stable session id, see Open Questions)
  nickname: string
  connected: boolean
```

No database is required for the MVP — everything above lives in server
memory, keyed by room code, and is discarded when the room empties or the
server restarts. This is a deliberate simplicity choice for a 2-day, one-off
demo (see Non-Goals). If there's time left, a lightweight SQLite table just
for **final scoreboards** (for a "past games" flex) is a reasonable, low-risk
addition — see stretch goals.

## 9. Real-Time Architecture — this is the part to get right first

The user's own concern going in was "the problem is chat and all the
real-time stuff," so this section is intentionally the most detailed one.

**Transport:** a single raw WebSocket connection per client
(`gorilla/websocket` on the Go server, the native `WebSocket` API on the
frontend), carrying a JSON envelope `{ "type": "...", "payload": {...} }` for
every message in both directions — the same event names as the contract
below, just without a framework doing the room/broadcast bookkeeping for us.
The server's `Hub` keeps a `map[roomCode][]*Client` and broadcasting to a
room is just "write this JSON to every client in that map entry." No
automatic long-polling fallback the way Socket.io has, so if a browser can't
complete the WebSocket upgrade at all it can't play — acceptable for a
controlled classroom demo on normal wifi, flagged here as a known tradeoff
of dropping Socket.io.

**Authority model:** the server holds the only real game state. Clients never
compute "whose turn," "how much time is left" from their own guesses beyond
rendering a countdown — they render a countdown *locally* from a
server-provided `phaseEndsAt` timestamp (see Timers below), but every phase
transition, score, and reveal is decided and broadcast by the server.

**Timers, done the reliable way:** don't have the server tick every second
over the socket (chatty, and drifts under load). Instead, when the server
enters a new phase it computes `phaseEndsAt = Date.now() + phaseDurationMs`
once and broadcasts it in the phase-change event. Each client runs its own
local `setInterval` computing `phaseEndsAt - Date.now()` for the visible
countdown. The server independently sets its own `setTimeout` for
`phaseDurationMs` to actually advance the phase — the client's countdown is
just a display, never authoritative.

**Chat, specifically:** it's the simplest part, treated as no different from
any other room broadcast — `chat:send { text }` in, server stamps
sender+timestamp, `chat:message { id, senderId, nickname, text, ts }` out to
everyone in the room including the sender (so the UI doesn't need an
optimistic-local-echo special case). Capped at e.g. the last 200 messages
per room to bound memory.

**Socket event contract** (full table in `BUILD_PLAN.md`) — the key
discipline: every client→server event is an *intent*
(`draw:submit`, `sabotage:submit`, `guess:vote`, `chat:send`,
`reaction:send`), and every server→client event is a *state broadcast*
(`room:state`, `phase:change`, `gallery:reveal`, `reveal:result`, …). Clients
never emit "the game should now move to Gallery" — only the server decides
phase transitions, in one place (the phase-timeout handler + an
all-submitted-early-advance check).

**Reconnection:** out of scope to make bulletproof, but the minimum: if a
socket disconnects, mark that player `connected: false` and keep their score
and identity in the room (rejoin with the same nickname within the same room
code re-attaches to the same player record) rather than fabricating a new
player — prevents a flaky phone connection from wrecking a live demo.

## 10. Tech Stack

- **Backend:** Go, stdlib `net/http` + `gorilla/websocket`. One deployable
  binary that also serves the built frontend as static files — avoids
  CORS/two-service coordination during a time-boxed build. No Socket.io
  equivalent exists in Go, so "rooms" and event broadcasting are hand-rolled
  (a `Hub` that tracks which connections belong to which room code and
  writes JSON to all of them) — same event contract as originally
  Socket.io-shaped, just transported over a single raw WebSocket connection
  per client instead. See `BUILD_PLAN.md` for the concrete protocol.
- **Frontend:** Vite + React + TypeScript, plain HTML5 Canvas (no drawing
  library needed — the interaction is simple: pointer down/move/up strokes),
  the native browser `WebSocket` API (no client library needed either, since
  there's no Socket.io server on the other end).
- **Styling:** Tailwind CSS, dark theme matching the reference mockup.
- **Auth:** none. Nickname-only identity, no accounts, no provider — this
  was already the PRD's design (§3 Non-Goals), not a shortcut taken now.
- **Persistence:** none for MVP (see Data Model). SQLite (`mattn/go-sqlite3`
  or `modernc.org/sqlite`) only if the stretch "past games" feature gets
  built.
- **Deployment:** single Render (or Railway) free web service running the Go
  binary, which also serves the built React app. Chosen over Vercel
  specifically because Vercel's serverless functions don't hold persistent
  WebSocket connections the way this game needs.

## 11. Non-Functional Requirements

- Works on a recent Chrome/Safari mobile browser (players joining from
  phones) and desktop Chrome (host, likely presenting on a laptop/projector).
- Playable with 3–10 concurrent players in one room without visible lag on
  normal wifi.
- No account creation, no email, no cost to play — nothing that adds friction
  for a room full of classmates joining in 15 seconds during a demo.
- No secrets/API keys required to run this at all (no external AI/API
  dependency) — reduces what can go wrong live.

## 12. Success Criteria / Demo Script

1. Presenter opens the deployed URL, creates a room, projects the room code
   + QR.
2. 3+ evaluators/classmates join from their phones in under a minute.
3. Presenter starts the game; the room plays one full round (Draw → Gallery
   → Sabotage → Guess → Reveal) live, in front of the evaluator, start to
   finish, without a crash or stuck phase.
4. Scoreboard displays correctly after 3 rounds.
5. Bonus: someone's sabotage gets a laugh in the room. That's the actual
   success metric for "did we solve the fun problem."

## 13. Timeline

2 days total. High-level split (hour-by-hour breakdown in
`BUILD_PLAN.md`):

- **Day 1:** de-risk the real-time layer first — room/lobby/join/chat fully
  working across multiple browser tabs — then the Draw phase + canvas
  component + drawing submission.
- **Day 2:** Gallery → Sabotage → Guess → Reveal → Scoreboard phases, the two
  must-have fun mechanics (forced prompts, reactions), styling pass to match
  the mockup, deploy to Render, multi-device test, stretch goals if time
  remains.

## 14. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Realtime state bugs (players stuck in a phase) | Server is the single source of truth; every phase has a server-side timeout as a forced advance, so nothing can hang indefinitely even if a client never submits |
| Canvas doesn't work well on mobile touch | Use Pointer Events (not just mouse events) from the start — one code path for mouse + touch + stylus |
| Wifi during live demo is bad | Socket.io auto-falls-back to HTTP long-polling if WebSocket upgrade fails; keep payloads (canvas images) reasonably compressed |
| Running out of time for Sabotage/Guess/Reveal phases | Lobby+Draw+Gallery alone (skip Sabotage/Guess/Reveal) is still a demoable, if less interesting, fallback — build in phase order so there's always something working to show |
| Free-form sabotage isn't guessable | Solved by design already — forced prompts (§5.1) |

## 15. Open Questions (resolve during build, don't block starting)

- Guess phase: show all sabotaged drawings for guessing in parallel, or one
  at a time round-robin? (Parallel is simpler to build and keeps everyone
  engaged simultaneously — default to parallel unless it proves confusing.)
- Player identity across a refresh: fine to use the raw socket id for a
  2-day demo build; a persisted `sessionStorage` id for reconnect is a small
  upgrade if time allows.
- Minimum/maximum players: default 3 minimum, 10 maximum; adjust if the
  actual demo group size is known ahead of time.
