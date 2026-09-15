import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { socket } from '@/lib/socket';
import type { ConnectionStatus } from '@/lib/socket';
import {
  TYPE_CHAT_MESSAGE,
  TYPE_CHAT_SEND,
  TYPE_DRAW_SUBMIT,
  TYPE_ERROR,
  TYPE_ROOM_CREATE,
  TYPE_ROOM_JOIN,
  TYPE_ROOM_PLAY_AGAIN,
  TYPE_ROOM_START,
  TYPE_ROOM_STATE,
  TYPE_SABOTAGE_ASSIGNMENT,
  TYPE_SABOTAGE_SUBMIT,
  TYPE_SELF_INFO,
  TYPE_GUESS_VOTE,
} from '@/lib/types';
import type { ChatMessage, ErrorPayload, RoomState, SabotageTask } from '@/lib/types';

interface SelfInfo {
  playerId: string;
  roomCode: string;
}

interface GameContextValue {
  status: ConnectionStatus;
  room: RoomState | null;
  self: SelfInfo | null;
  sabotageTask: SabotageTask | null;
  lastError: ErrorPayload | null;
  clearError: () => void;
  createRoom: (nickname: string) => void;
  joinRoom: (code: string, nickname: string) => void;
  startGame: () => void;
  playAgain: () => void;
  submitDrawing: (imageDataUrl: string) => void;
  submitSabotage: (imageDataUrl: string) => void;
  submitVote: (targetArtistId: string, suspectId: string) => void;
  sendChat: (text: string) => void;
  isHost: boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('closed');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [self, setSelf] = useState<SelfInfo | null>(null);
  const [sabotageTask, setSabotageTask] = useState<SabotageTask | null>(null);
  const [lastError, setLastError] = useState<ErrorPayload | null>(null);
  const connected = useRef(false);

  // The assignment is only valid for the round it arrived in — clear it the
  // moment the room leaves Sabotage (whether that's this player advancing
  // into the next round's Draw or anything else), so a stale task never
  // lingers into a phase it doesn't belong to.
  useEffect(() => {
    if (room?.phase !== 'sabotage') setSabotageTask(null);
  }, [room?.phase]);

  useEffect(() => {
    if (!connected.current) {
      connected.current = true;
      socket.connect();
    }

    const offStatus = socket.onStatusChange(setStatus);
    const offState = socket.on<RoomState>(TYPE_ROOM_STATE, setRoom);
    const offSelf = socket.on<SelfInfo>(TYPE_SELF_INFO, setSelf);
    const offSabotageTask = socket.on<SabotageTask>(TYPE_SABOTAGE_ASSIGNMENT, setSabotageTask);
    const offChat = socket.on<ChatMessage>(TYPE_CHAT_MESSAGE, (msg) => {
      // room:state already carries the full chat log on every broadcast, so
      // this listener exists for future features (toast/sound on message)
      // rather than to build the log itself — avoids maintaining chat
      // history in two places that could drift apart.
      void msg;
    });
    const offError = socket.on<ErrorPayload>(TYPE_ERROR, setLastError);

    return () => {
      offStatus();
      offState();
      offSelf();
      offSabotageTask();
      offChat();
      offError();
    };
  }, []);

  const value: GameContextValue = {
    status,
    room,
    self,
    sabotageTask,
    lastError,
    clearError: () => setLastError(null),
    createRoom: (nickname) => socket.send(TYPE_ROOM_CREATE, { nickname }),
    joinRoom: (code, nickname) => socket.send(TYPE_ROOM_JOIN, { code, nickname }),
    startGame: () => socket.send(TYPE_ROOM_START, {}),
    playAgain: () => socket.send(TYPE_ROOM_PLAY_AGAIN, {}),
    submitDrawing: (imageDataUrl) => socket.send(TYPE_DRAW_SUBMIT, { imageDataUrl }),
    submitSabotage: (imageDataUrl) => socket.send(TYPE_SABOTAGE_SUBMIT, { imageDataUrl }),
    submitVote: (targetArtistId, suspectId) => socket.send(TYPE_GUESS_VOTE, { targetArtistId, suspectId }),
    sendChat: (text) => socket.send(TYPE_CHAT_SEND, { text }),
    isHost: !!(room && self && room.hostId === self.playerId),
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}
