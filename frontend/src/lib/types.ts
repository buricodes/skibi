// Mirrors backend/internal/room/types.go and backend/internal/ws/protocol.go.
// Keep these two in sync by hand — no shared-codegen step for a 2-day build.

export type Phase = 'lobby' | 'draw' | 'gallery' | 'sabotage' | 'guess' | 'reveal' | 'scoreboard';

export interface Player {
  id: string;
  nickname: string;
  connected: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  nickname: string;
  text: string;
  ts: number;
}

export interface Drawing {
  artistId: string;
  nickname: string;
  imageDataUrl: string;
}

// One sabotaged drawing shown during Guess — never carries who did it.
export interface GuessTarget {
  targetArtistId: string;
  targetNickname: string;
  imageDataUrl: string;
  prompt: string;
}

export interface RevealResult {
  targetArtistId: string;
  targetNickname: string;
  originalImageDataUrl: string;
  sabotagedImageDataUrl: string;
  prompt: string;
  saboteurId: string;
  saboteurNickname: string;
  correctGuesserIds: string[];
  saboteurCaught: boolean;
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
  word?: string;
  players: Player[];
  chat: ChatMessage[];
  drawings?: Drawing[]; // only present from gallery onward
  submittedCount: number;
  guessTargets?: GuessTarget[]; // only present during guess
  reveal?: RevealResult[]; // only present during reveal
  scores: PlayerScore[];
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// Delivered only to the assigned saboteur, direct (not broadcast) — never
// appears in RoomState, deliberately (it's the answer to Guess).
export interface SabotageTask {
  targetArtistId: string;
  targetNickname: string;
  originalImageDataUrl: string;
  prompt: string;
}

// Client -> Server message types
export const TYPE_ROOM_CREATE = 'room:create';
export const TYPE_ROOM_JOIN = 'room:join';
export const TYPE_ROOM_START = 'room:start';
export const TYPE_ROOM_PLAY_AGAIN = 'room:playAgain';
export const TYPE_CHAT_SEND = 'chat:send';
export const TYPE_DRAW_SUBMIT = 'draw:submit';
export const TYPE_SABOTAGE_SUBMIT = 'sabotage:submit';
export const TYPE_GUESS_VOTE = 'guess:vote';

// Server -> Client message types
export const TYPE_ROOM_STATE = 'room:state';
export const TYPE_CHAT_MESSAGE = 'chat:message';
export const TYPE_ERROR = 'error';
export const TYPE_SELF_INFO = 'self:info';
export const TYPE_SABOTAGE_ASSIGNMENT = 'sabotage:assignment';
