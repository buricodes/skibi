import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@/components/Canvas';
import type { CanvasHandle } from '@/components/Canvas';
import { Timer } from '@/components/Timer';
import { useCountdown } from '@/lib/useCountdown';
import { useGame } from '@/state/GameContext';

export function Sabotage() {
  const { room, sabotageTask, submitSabotage } = useGame();
  const canvasRef = useRef<CanvasHandle>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const remainingMs = useCountdown(room?.phaseEndsAt);
  const timeIsUp = remainingMs === 0;

  useEffect(() => {
    setHasSubmitted(false);
  }, [sabotageTask?.targetArtistId]);

  useEffect(() => {
    if (timeIsUp && !hasSubmitted && sabotageTask) handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeIsUp]);

  if (!room) return null;

  function handleSubmit() {
    if (hasSubmitted || !sabotageTask) return;
    const dataUrl = canvasRef.current?.getDataUrl();
    if (!dataUrl) return;
    submitSabotage(dataUrl);
    setHasSubmitted(true);
  }

  // Not the assigned saboteur this round (or already submitted): a waiting
  // screen, with the gallery grid still visible in the background (PRD.md
  // §6 screen 5) rather than a blank wait.
  if (!sabotageTask || hasSubmitted) {
    return (
      <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Sabotage in progress…</h2>
          <Timer phaseEndsAt={room.phaseEndsAt} />
        </div>
        <p className="text-white/50">
          {hasSubmitted
            ? 'Your sabotage is in. Waiting for everyone else…'
            : "Someone is secretly editing your drawing right now. You'll guess who, next."}
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {(room.drawings ?? []).map((d) => (
            <figure key={d.artistId} className="overflow-hidden rounded-lg border border-border bg-panel opacity-60">
              <img src={d.imageDataUrl} alt={`${d.nickname}'s drawing`} className="w-full bg-white" />
              <figcaption className="px-2 py-1.5 text-center text-sm text-white/70">{d.nickname}</figcaption>
            </figure>
          ))}
        </div>
        <p className="text-sm text-white/50">{room.submittedCount} sabotage(s) submitted so far</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col items-center gap-4 px-6 py-8">
      <div className="flex w-full items-center justify-between">
        <p className="text-sm text-white/50">Sabotaging {sabotageTask.targetNickname}'s drawing</p>
        <Timer phaseEndsAt={room.phaseEndsAt} />
      </div>

      <h2 className="text-2xl font-bold text-white">
        Your mission: <span className="text-accent-2">{sabotageTask.prompt}</span>
      </h2>

      <Canvas ref={canvasRef} backgroundImage={sabotageTask.originalImageDataUrl} disabled={hasSubmitted} />

      <button
        onClick={handleSubmit}
        className="w-full rounded-lg bg-accent-2 py-2.5 font-medium text-white hover:opacity-90"
      >
        Submit Sabotage
      </button>
    </div>
  );
}
