import { useEffect, useRef } from 'react';
import { Canvas } from '@/components/Canvas';
import type { CanvasHandle } from '@/components/Canvas';
import { Chat } from '@/components/Chat';
import { Timer } from '@/components/Timer';
import { socket } from '@/lib/socket';
import { TYPE_CANVAS_CLEAR, TYPE_STROKE_END, TYPE_STROKE_POINT, TYPE_STROKE_START } from '@/lib/types';
import type { StrokePoint, StrokeStart } from '@/lib/types';
import { useGame } from '@/state/GameContext';

export function Draw() {
  const {
    room,
    self,
    isDrawer,
    yourWord,
    sendChat,
    sendStrokeStart,
    sendStrokePoint,
    sendStrokeEnd,
    sendCanvasClear,
  } = useGame();
  const canvasRef = useRef<CanvasHandle>(null);

  // Guessers only: replay whatever the current drawer broadcasts. The
  // drawer doesn't subscribe to these — they ARE the source, their own
  // Canvas already rendered their strokes locally as they drew them.
  useEffect(() => {
    if (isDrawer) return;
    const offs = [
      socket.on<StrokeStart>(TYPE_STROKE_START, (s) => canvasRef.current?.applyRemoteStrokeStart(s)),
      socket.on<StrokePoint>(TYPE_STROKE_POINT, (p) => canvasRef.current?.applyRemoteStrokePoint(p)),
      socket.on(TYPE_STROKE_END, () => canvasRef.current?.applyRemoteStrokeEnd()),
      socket.on(TYPE_CANVAS_CLEAR, () => canvasRef.current?.applyRemoteClear()),
    ];
    return () => offs.forEach((off) => off());
  }, [isDrawer]);

  if (!room) return null;

  const blanks = Array.from({ length: room.wordLength ?? 0 })
    .map(() => '_')
    .join(' ');

  return (
    <div className="mx-auto flex min-h-svh max-w-4xl flex-col gap-4 px-6 py-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/50">
          Round {room.round} / {room.totalRounds}
        </p>
        <Timer phaseEndsAt={room.phaseEndsAt} />
      </div>

      <h2 className="text-center text-2xl font-bold tracking-widest text-white">
        {isDrawer ? (
          <>
            Draw: <span className="text-accent">{yourWord}</span>
          </>
        ) : (
          blanks
        )}
      </h2>

      <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-[1fr_320px]">
        <Canvas
          ref={canvasRef}
          interactive={isDrawer}
          onStrokeStart={sendStrokeStart}
          onStrokePoint={sendStrokePoint}
          onStrokeEnd={sendStrokeEnd}
          onClear={sendCanvasClear}
        />

        <div className="h-80 md:h-auto">
          <Chat
            messages={room.chat}
            selfId={self?.playerId ?? null}
            onSend={sendChat}
            placeholder={isDrawer ? 'Chat…' : 'Type your guess…'}
          />
        </div>
      </div>
    </div>
  );
}
