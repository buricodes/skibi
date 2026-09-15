import { Timer } from '@/components/Timer';
import { useGame } from '@/state/GameContext';

export function Reveal() {
  const { room, self } = useGame();
  if (!room) return null;

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Reveal</h2>
        <Timer phaseEndsAt={room.phaseEndsAt} />
      </div>

      <div className="flex flex-wrap gap-3">
        {[...room.scores]
          .sort((a, b) => b.score - a.score)
          .map((s) => (
            <div
              key={s.playerId}
              className={`rounded-full border px-3 py-1 text-sm ${
                s.playerId === self?.playerId ? 'border-accent text-white' : 'border-border text-white/70'
              }`}
            >
              {s.nickname}: {s.score}
            </div>
          ))}
      </div>

      <div className="flex flex-col gap-6">
        {(room.reveal ?? []).map((r) => {
          const iWasCorrect = self ? r.correctGuesserIds.includes(self.playerId) : false;
          const iWasSaboteur = self?.playerId === r.saboteurId;
          return (
            <div key={r.targetArtistId} className="rounded-lg border border-border bg-panel p-4">
              <p className="mb-2 text-white/80">
                {r.targetNickname}'s drawing — prompt was "<span className="text-accent-2">{r.prompt}</span>"
              </p>
              <div className="grid grid-cols-2 gap-3">
                <figure>
                  <img src={r.originalImageDataUrl} alt="original" className="w-full rounded-md bg-white" />
                  <figcaption className="mt-1 text-center text-xs text-white/40">Before</figcaption>
                </figure>
                <figure>
                  <img src={r.sabotagedImageDataUrl} alt="sabotaged" className="w-full rounded-md bg-white" />
                  <figcaption className="mt-1 text-center text-xs text-white/40">After</figcaption>
                </figure>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-accent">
                  Sabotaged by {r.saboteurNickname}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 ${
                    r.saboteurCaught ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/60'
                  }`}
                >
                  {r.saboteurCaught ? 'Caught!' : 'Got away with it'}
                </span>
                {iWasSaboteur && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">
                    You were the saboteur ({r.saboteurCaught ? '-1' : '+2'})
                  </span>
                )}
                {iWasCorrect && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">You guessed right (+3)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
