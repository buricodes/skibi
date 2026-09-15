# SketchSabotage — Product Requirements Document

*(Name kept from the project's original working title — the game itself is
now a straightforward Skribbl.io-style drawing-and-guessing game, not the
earlier "sabotage" twist. Renaming the repo is a cosmetic follow-up, not
required for the game to work.)*

## 1. Concept

A real-time multiplayer drawing-and-guessing game, in the mold of
Skribbl.io. Players take turns: the current drawer privately picks one of 3
offered words and draws it live, in real time, while everyone else watches
the canvas update stroke-by-stroke and types guesses in chat. The first to
guess correctly scores the most; the drawer scores per correct guesser.
Turns rotate through every player; once everyone has drawn the configured
number of rounds, the game ends on a scoreboard.

Unlike an earlier design considered for this project (a "sabotage" twist
where drawings were edited by other players), this version broadcasts every
pen stroke live to all viewers as it happens — the core technical
mechanism a real Skribbl-style game actually needs.

## 2. Goal & Constraints

- Ship a **live, publicly reachable, deployed** build.
- Solo build, college mini-project submission. No domain constraint from
  faculty — judged on working demo + presentability.
- Must support a live in-room demo: several people on their own
  phones/laptops joining one game and playing it in front of an evaluator.

## 3. Non-Goals

- Accounts / persistent user profiles / login.
- Persisting game history across server restarts (games are ephemeral,
  in-memory; a server restart wipes active rooms — acceptable for a demo).
- Horizontal scaling / multi-instance socket state — one server process is
  enough for a classroom demo.
- Mobile app / app store distribution — this is a responsive web app,
  played in a mobile browser.
- Word-guess fuzzy matching (typo tolerance, partial credit) — exact
  case-insensitive match only, for now.
- Progressive letter-reveal hints (e.g. showing one letter partway through
  the timer) — the word-length blanks are the only hint; a nice later
  addition, not required.

## 4. Core Game Loop

1. **Lobby** — host creates a room, gets a 5-char room code + QR code.
   Players join with just a nickname (no auth). Host starts once ≥2
   players have joined; the turn order is fixed at that moment (join
   order), so a later joiner can spectate/chat but won't get a turn until
   the next game (Play Again).
2. **Choosing** (10s) — the current drawer privately receives 3 word
   options and picks one. Everyone else sees "{drawer} is choosing a
   word…". If the drawer doesn't choose in time, the server picks one for
   them automatically — a turn can never stall waiting on a distracted
   drawer.
3. **Drawing** (30–80s, scaled — see below) — the drawer draws live; every
   stroke is broadcast to everyone else in the room as it's drawn (not a
   single submitted image at the end — genuinely real-time, stroke by
   stroke). Guessers see the canvas updating live, plus a word-length hint
   ("_ _ _ _ _ _") and can type guesses in the same chat box used for
   regular chat. A correct guess is never shown as the literal chat text
   (that would spoil it for anyone still guessing) — it's replaced with a
   system announcement naming the points earned ("Riya guessed the word!
   (+3)") visible to everyone, and that player is locked out of guessing
   again this turn. A wrong guess is shown as ordinary chat, exactly like
   real Skribbl. The turn ends the instant every eligible guesser (everyone
   except the drawer) has guessed correctly, or the timer runs out —
   whichever comes first.
4. Turn passes to the next player in turn order, looping back to
   **Choosing**. Once every player has drawn **3** times (3 full rounds,
   configurable), the game moves to **Scoreboard**.

**Total game length targets ~10 minutes**, regardless of player count.
More players means more turns (`3 rounds × player count`), so each turn's
Drawing duration is computed once at game start to fit that budget —
clamped between 30s and 80s so it never gets so short it's unplayable, or
so long a big lobby's game drags well past 10 minutes anyway. A 2-player
game lands at the 80s max (its budget-per-turn is roomier than that); a
6-player game clamps down to the 30s min. See `computeDrawDuration` in
`backend/internal/room/room.go`.
5. **Scoreboard** — final standings, crown for the winner. Host can hit
   "Play Again" to reset the same room (same players, scores/turns
   cleared) back to Lobby, no re-joining needed.

### Scoring (per correct guess)

- 1st correct guesser: **+3**
- 2nd correct guesser: **+2**
- 3rd and later correct guessers: **+1**
- The drawer gets **+1** for every player who guessed correctly that turn
  (rewards a drawing people can actually read).

(Exact numbers are tunable — the shape of the scoring, not the constants,
is the requirement.)

## 5. Screens (UX Flow)

| # | Screen | Who sees it | Key elements |
|---|--------|-------------|---------------|
| 1 | Home | Everyone | "Create Room" / "Join Room", nickname input |
| 2 | Lobby | Everyone in room | Room code + QR + shareable invite link, player list, chat, Start button (host only) |
| 3 | Choosing | Everyone | Drawer: 3 word buttons to pick from. Everyone else: "{drawer} is choosing…", chat visible |
| 4 | Drawing | Everyone | Drawer: interactive canvas + the real word + timer. Guessers: read-only canvas replaying live strokes + word-length blanks + chat-as-guess-box + timer |
| 5 | Scoreboard | Everyone | Ranked standings, crown for the leader, Play Again (host only) |

## 6. Functional Requirements

**Host**
- Create a room, get a shareable code + QR + invite link (`?code=` auto-fills
  the Join form for whoever opens it).
- Start the game once ≥2 players have joined.
- Trigger "Play Again" from the Scoreboard.

**Player**
- Join a room by code, or via an invite link, with just a nickname.
- On their turn: pick one of 3 offered words, then draw on an interactive
  canvas (pen tool, 6 colors, 3 brush sizes, clear) — every stroke goes out
  live as it's drawn.
- On someone else's turn: watch their canvas update live (read-only), see
  the word-length hint, and type guesses in chat.
- See scores update live and the final Scoreboard.

**System**
- Enforce room capacity (3–10 players suggested; 2 minimum to actually
  start, so local testing doesn't need a third client).
- Server is the sole authority on game phase/timer/turn order/scores/the
  secret word — clients only render what the server sends and emit
  intents (choose a word, draw a stroke, send a chat message). No client
  trusts another client's state, and the secret word is never sent to
  anyone but the current drawer.
- Auto-advance every timed phase when its timer expires, regardless of
  whether the drawer chose a word or anyone guessed (auto-pick word,
  reveal-and-move-on if nobody guessed).
- Handle a player disconnecting mid-game without crashing the room for
  everyone else.

## 7. Data Model (server, in-memory)

```
Room
  code: string
  hostSocketId: string
  players: Player[]
  phase: 'lobby' | 'choosing' | 'drawing' | 'scoreboard'
  phaseEndsAt: epoch millis | null
  turnOrder: string[]        // fixed snapshot of player ids at Start()
  turnsCompleted: number
  totalTurns: number          // totalRounds * len(turnOrder)
  word: string                 // secret — never serialized to clients
  wordChoices: string[]         // the 3 candidates offered to the current drawer
  correctGuessers: Set<playerId>
  chat: ChatMessage[]           // includes both real messages and system announcements
  scores: Map<playerId, number>

Player
  id: string (socket id — no accounts, see Non-Goals)
  nickname: string
  connected: boolean
```

No database is required — everything lives in server memory, keyed by
room code, discarded when the room empties or the server restarts.

## 8. Real-Time Architecture

**Transport:** raw WebSockets (`gorilla/websocket` on the Go server, the
browser's native `WebSocket` API on the frontend — no Socket.io anywhere).
One JSON envelope shape both directions: `{ "type": "...", "payload": {...} }`.
A hand-rolled `Hub` tracks which connections belong to which room code and
broadcasts by writing the same JSON to every connection in that room.

**Live stroke broadcasting — the part that makes this a real Skribbl clone
and not a "submit a final image" game:** the drawer emits `stroke:start`,
`stroke:point` (many of these per stroke), `stroke:end`, and `canvas:clear`
as they draw. The server does not parse or store these — it just confirms
the sender is the current drawer, then relays the exact same message to
every *other* connection in the room (never back to the sender, who
already rendered it locally). This keeps the server simple and the latency
low: one hop, no server-side canvas reconstruction.

**Guessing is layered onto ordinary chat**, not a separate mechanism: every
`chat:send` is first checked against the secret word (only during Drawing,
only from non-drawers who haven't already guessed correctly this turn). A
match is scored immediately, announced as a system chat entry ("X guessed
the word!"), and — critically — never broadcasts the literal guessed text,
so players still guessing never see the answer leak through chat. A
non-match falls through to being posted as an ordinary chat message,
exactly like Skribbl shows wrong guesses.

**Word privacy:** the secret word is never in the broadcast `room:state` —
only `wordLength` (the blanks hint) is public. The current drawer alone
receives their 3 word options (`word:choices`) and then the confirmed word
(`word:yours`) via a direct, non-broadcast message — the same pattern used
for "which player in the list is me" (`self:info`).

**Timers, done the reliable way:** the server computes
`phaseEndsAt = Date.now() + phaseDurationMs` once per phase and broadcasts
it — clients render their own local countdown from that timestamp, never
trusting a server tick, while the server independently owns a `setTimeout`
to actually advance the phase. Early-advance (everyone's guessed) and
timeout-driven advance both funnel through the exact same function, so
there's exactly one code path per transition regardless of what triggered
it.

## 9. Tech Stack

- **Backend:** Go, stdlib `net/http` + `gorilla/websocket`. One deployable
  binary that also serves the built frontend as static files (via
  `//go:embed`) — single-process deploy, no CORS between two services.
- **Frontend:** Vite + React + TypeScript, plain HTML5 Canvas (Pointer
  Events, so mouse/touch/stylus all work identically), the native browser
  `WebSocket` API, `qrcode.react` for the Lobby's invite QR code.
- **Styling:** Tailwind CSS v4, dark theme.
- **Auth:** none. Nickname-only identity.
- **Persistence:** none. Everything is in-memory, ephemeral per game.
- **Deployment:** single Render free web service running the Go binary
  (see `render.yaml`) — Vercel's serverless functions don't hold the
  persistent WebSocket connections this needs.

## 10. Non-Functional Requirements

- Works on a recent Chrome/Safari mobile browser and desktop Chrome.
- Playable with 3–10 concurrent players in one room without visible lag on
  normal wifi.
- No account creation, no email, no cost to play.
- No secrets/API keys required to run this at all.

## 11. Success Criteria / Demo Script

1. Presenter opens the deployed URL, creates a room, projects the room
   code + QR.
2. 2+ evaluators/classmates join from their phones in under a minute
   (either typing the code, or via the invite link/QR).
3. Presenter starts the game; the room plays through at least one full
   turn — word choice, live drawing, a correct guess, the turn ending —
   live, in front of the evaluator, without a crash or stuck phase.
4. Turns rotate to the next player automatically.
5. After the configured rounds, the Scoreboard displays correctly and
   Play Again resets the room.

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Realtime state bugs (players stuck in a phase) | Server is the single source of truth; every phase has a server-side timeout as a forced advance |
| Canvas doesn't work well on mobile touch | Pointer Events from the start — one code path for mouse + touch + stylus |
| A distracted drawer never picks a word | Auto-pick timer (10s) |
| Stroke event volume on slow wifi | Payloads are tiny (a few numbers + a color per point); Go's WebSocket write path is non-blocking per client (a stuck client is dropped from the room rather than stalling the broadcast for everyone else) |
