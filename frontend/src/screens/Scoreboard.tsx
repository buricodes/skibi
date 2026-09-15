import { useGame } from '@/state/GameContext';

export function Scoreboard() {
  const { room, self, isHost, playAgain } = useGame();
  if (!room) return null;

  const ranked = [...room.scores].sort((a, b) => b.score - a.score);

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 px-6 py-12">
      <h1 className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-3xl font-bold text-transparent">
        Game Over
      </h1>

      <ol className="flex w-full flex-col gap-2">
        {ranked.map((s, i) => (
          <li
            key={s.playerId}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
              i === 0 ? 'border-accent bg-accent/10' : 'border-border bg-panel'
            }`}
          >
            <span className="flex items-center gap-2">
              {i === 0 && <span aria-hidden>👑</span>}
              <span className={s.playerId === self?.playerId ? 'font-semibold text-white' : 'text-white/90'}>
                {s.nickname}
                {s.playerId === self?.playerId ? ' (you)' : ''}
              </span>
            </span>
            <span className="font-mono text-lg">{s.score}</span>
          </li>
        ))}
      </ol>

      {isHost ? (
        <button
          onClick={playAgain}
          className="w-full rounded-lg bg-accent py-2.5 font-medium text-white hover:opacity-90"
        >
          Play Again
        </button>
      ) : (
        <p className="text-sm text-white/40">Waiting for the host to start a new game…</p>
      )}
    </div>
  );
}
