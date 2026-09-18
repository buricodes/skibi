// Mirrors backend/internal/room/types.go and backend/internal/ws/protocol.go.
// Keep these two in sync by hand — no shared-codegen step for a 2-day build.

export type Phase = 'lobby' | 'choosing' | 'drawing' | 'turnEnd' | 'scoreboard';

export interface Player {
  id: string;
  nickname: string;
  connected: boolean;
  ready: boolean;
}

// A real player message (senderId/nickname set) or a server announcement
// (system: true, no sender) — e.g. "X guessed the word!". Both render in
// one continuous feed.
export interface ChatMessage {
  id: string;
  senderId?: string;
  nickname?: string;
  text: string;
  ts: number;
  system?: boolean;
}

export interface PlayerScore {
  playerId: string;
  nickname: string;
  score: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  phase: Phase;
  round: number;
  totalRounds: number;
  phaseEndsAt: number; // epoch ms, 0 when the phase has no timer
  drawerId?: string;
  wordLength?: number; // guessers' only hint about the secret word
  revealedWord?: string;
  lastWord?: string;
  lastDrawerId?: string;
  turnGains?: PlayerScore[];
  players: Player[];
  chat: ChatMessage[];
  scores: PlayerScore[];
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// Delivered only to the current drawer, direct (not broadcast).
export interface WordChoices {
  choices: string[];
}

export interface YourWord {
  word: string;
}

export interface StrokeStart {
  x: number;
  y: number;
  color: string;
  size: number;
}

export interface StrokePoint {
  x: number;
  y: number;
}

// Client -> Server message types
export const TYPE_ROOM_CREATE = 'room:create';
export const TYPE_ROOM_JOIN = 'room:join';
export const TYPE_ROOM_REJOIN = 'room:rejoin';
export const TYPE_ROOM_START = 'room:start';
export const TYPE_ROOM_PLAY_AGAIN = 'room:playAgain';
export const TYPE_CHAT_SEND = 'chat:send';
export const TYPE_WORD_CHOOSE = 'word:choose';
export const TYPE_STROKE_START = 'stroke:start';
export const TYPE_STROKE_POINT = 'stroke:point';
export const TYPE_STROKE_END = 'stroke:end';
export const TYPE_CANVAS_CLEAR = 'canvas:clear';
export const TYPE_PLAYER_READY = 'player:ready';

// Server -> Client message types
export const TYPE_ROOM_STATE = 'room:state';
export const TYPE_CHAT_MESSAGE = 'chat:message';
export const TYPE_ERROR = 'error';
export const TYPE_SELF_INFO = 'self:info';
export const TYPE_WORD_CHOICES = 'word:choices';
export const TYPE_YOUR_WORD = 'word:yours';
