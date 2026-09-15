import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@/components/Canvas';
import type { CanvasHandle } from '@/components/Canvas';
import { Timer } from '@/components/Timer';
import { useCountdown } from '@/lib/useCountdown';
import { useGame } from '@/state/GameContext';

export function Draw() {
  const { room, submitDrawing } = useGame();
  const canvasRef = useRef<CanvasHandle>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const remainingMs = useCountdown(room?.phaseEndsAt);
  const timeIsUp = remainingMs === 0;

  // A new round (server assigns a fresh word + resets phaseEndsAt) means a
  // fresh canvas and a fresh submit gate.
  useEffect(() => {
    setHasSubmitted(false);
    canvasRef.current?.clear();
  }, [room?.round]);

  useEffect(() => {
    if (timeIsUp && !hasSubmitted) handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeIsUp]);

  if (!room) return null;

  function handleSubmit() {
    if (hasSubmitted) return;
    const dataUrl = canvasRef.current?.getDataUrl();
    if (!dataUrl) return;
    submitDrawing(dataUrl);
    setHasSubmitted(true);
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col items-center gap-4 px-6 py-8">
      <div className="flex w-full items-center justify-between">
        <p className="text-sm text-white/50">
          Round {room.round} / {room.totalRounds}
        </p>
        <Timer phaseEndsAt={room.phaseEndsAt} />
      </div>

      <h2 className="text-2xl font-bold text-white">
        Draw: <span className="text-accent">{room.word}</span>
      </h2>

      <Canvas ref={canvasRef} disabled={hasSubmitted} />

      <p className="text-sm text-white/50">
        {room.submittedCount} / {room.players.length} submitted
      </p>

      {hasSubmitted ? (
        <p className="text-white/60">Waiting for everyone else…</p>
      ) : (
        <button
          onClick={handleSubmit}
          className="w-full rounded-lg bg-accent py-2.5 font-medium text-white hover:opacity-90"
        >
          Submit Drawing
        </button>
      )}
    </div>
  );
}
