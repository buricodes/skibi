import { Timer } from '@/components/Timer';
import { useGame } from '@/state/GameContext';

export function Gallery() {
  const { room } = useGame();
  if (!room) return null;

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          Gallery — Round {room.round} / {room.totalRounds}
        </h2>
        <Timer phaseEndsAt={room.phaseEndsAt} />
      </div>

      <p className="text-white/50">
        Everyone drew "<span className="text-accent">{room.word}</span>"
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {(room.drawings ?? []).map((d) => (
          <figure key={d.artistId} className="overflow-hidden rounded-lg border border-border bg-panel">
            <img src={d.imageDataUrl} alt={`${d.nickname}'s drawing`} className="w-full bg-white" />
            <figcaption className="px-2 py-1.5 text-center text-sm text-white/70">{d.nickname}</figcaption>
          </figure>
        ))}
      </div>

      <p className="text-center text-sm text-white/30">
        Sabotage, Guess, and Reveal come next — see BUILD_PLAN.md Day 2.
      </p>
    </div>
  );
}
