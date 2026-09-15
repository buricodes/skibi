import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { socket } from '@/lib/socket';
import type { ConnectionStatus } from '@/lib/socket';
import { playCorrectGuess, playGameOver, playTurnEnd, playYourTurn } from '@/lib/sounds';
import {
  TYPE_CANVAS_CLEAR,
  TYPE_CHAT_SEND,
  TYPE_ERROR,
  TYPE_ROOM_CREATE,
  TYPE_ROOM_JOIN,
  TYPE_ROOM_PLAY_AGAIN,
  TYPE_ROOM_START,
  TYPE_ROOM_STATE,
  TYPE_SELF_INFO,
  TYPE_STROKE_END,
  TYPE_STROKE_POINT,
  TYPE_STROKE_START,
  TYPE_WORD_CHOICES,
  TYPE_WORD_CHOOSE,
  TYPE_YOUR_WORD,
} from '@/lib/types';
import type { ErrorPayload, RoomState, StrokePoint, StrokeStart, WordChoices, YourWord } from '@/lib/types';

interface SelfInfo {
  playerId: string;
  roomCode: string;
}

interface GameContextValue {
  status: ConnectionStatus;
  room: RoomState | null;
  self: SelfInfo | null;
  wordChoices: string[] | null;
  yourWord: string | null;
  lastError: ErrorPayload | null;
  clearError: () => void;
  createRoom: (nickname: string) => void;
  joinRoom: (code: string, nickname: string) => void;
  startGame: () => void;
  playAgain: () => void;
  chooseWord: (word: string) => void;
  sendChat: (text: string) => void;
  isHost: boolean;
  isDrawer: boolean;
  // Sent only when isDrawer is true — the backend silently ignores these
  // from anyone else, but there's no reason to even try.
  sendStrokeStart: (s: StrokeStart) => void;
  sendStrokePoint: (p: StrokePoint) => void;
  sendStrokeEnd: () => void;
  sendCanvasClear: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('closed');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [self, setSelf] = useState<SelfInfo | null>(null);
  const [wordChoices, setWordChoices] = useState<string[] | null>(null);
  const [yourWord, setYourWord] = useState<string | null>(null);
  const [lastError, setLastError] = useState<ErrorPayload | null>(null);
  const connected = useRef(false);

  // Both are only valid for the turn they arrived in.
  useEffect(() => {
    if (room?.phase !== 'choosing') setWordChoices(null);
    if (room?.phase !== 'drawing') setYourWord(null);
  }, [room?.phase]);

  // wordChoices only ever arrives via the private word:choices message, so
  // going from null -> an array here means "it's your turn to draw."
  useEffect(() => {
    if (wordChoices) playYourTurn();
  }, [wordChoices]);

  // Game-over fanfare, once, on the actual lobby->...->scoreboard transition
  // rather than every scoreboard-phase re-render (Play Again -> a later
  // game reaching scoreboard again should still play it, so this compares
  // against the previous phase rather than just checking equality once).
  const prevPhaseRef = useRef<RoomState['phase'] | undefined>(undefined);
  useEffect(() => {
    if (room?.phase === 'scoreboard' && prevPhaseRef.current !== 'scoreboard') {
      playGameOver();
    }
    prevPhaseRef.current = room?.phase;
  }, [room?.phase]);

  // Chat carries both real messages and system announcements (see
  // ChatMessage.system) — new system entries drive the correct-guess/
  // turn-end cues. Baseline starts at null so reconnecting into a room
  // with existing history doesn't replay every past sound at once.
  const chatBaselineRef = useRef<number | null>(null);
  useEffect(() => {
    if (!room) {
      chatBaselineRef.current = null;
      return;
    }
    if (chatBaselineRef.current === null) {
      chatBaselineRef.current = room.chat.length;
      return;
    }
    if (room.chat.length <= chatBaselineRef.current) return;

    const newMessages = room.chat.slice(chatBaselineRef.current);
    chatBaselineRef.current = room.chat.length;
    for (const m of newMessages) {
      if (!m.system) continue;
      if (m.text.includes('guessed the word')) playCorrectGuess();
      else if (m.text.startsWith("Time's up!")) playTurnEnd();
    }
  }, [room?.chat]);

  useEffect(() => {
    if (!connected.current) {
      connected.current = true;
      socket.connect();
    }

    const offStatus = socket.onStatusChange(setStatus);
    const offState = socket.on<RoomState>(TYPE_ROOM_STATE, setRoom);
    const offSelf = socket.on<SelfInfo>(TYPE_SELF_INFO, setSelf);
    const offChoices = socket.on<WordChoices>(TYPE_WORD_CHOICES, (p) => setWordChoices(p.choices));
    const offYourWord = socket.on<YourWord>(TYPE_YOUR_WORD, (p) => setYourWord(p.word));
    const offError = socket.on<ErrorPayload>(TYPE_ERROR, setLastError);

    return () => {
      offStatus();
      offState();
      offSelf();
      offChoices();
      offYourWord();
      offError();
    };
  }, []);

  const isDrawer = !!(room && self && room.drawerId === self.playerId);

  const value: GameContextValue = {
    status,
    room,
    self,
    wordChoices,
    yourWord,
    lastError,
    clearError: () => setLastError(null),
    createRoom: (nickname) => socket.send(TYPE_ROOM_CREATE, { nickname }),
    joinRoom: (code, nickname) => socket.send(TYPE_ROOM_JOIN, { code, nickname }),
    startGame: () => socket.send(TYPE_ROOM_START, {}),
    playAgain: () => socket.send(TYPE_ROOM_PLAY_AGAIN, {}),
    chooseWord: (word) => socket.send(TYPE_WORD_CHOOSE, { word }),
    sendChat: (text) => socket.send(TYPE_CHAT_SEND, { text }),
    isHost: !!(room && self && room.hostId === self.playerId),
    isDrawer,
    sendStrokeStart: (s) => socket.send(TYPE_STROKE_START, s),
    sendStrokePoint: (p) => socket.send(TYPE_STROKE_POINT, p),
    sendStrokeEnd: () => socket.send(TYPE_STROKE_END, {}),
    sendCanvasClear: () => socket.send(TYPE_CANVAS_CLEAR, {}),
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}
