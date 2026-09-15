import { Face } from '@/components/Face';
import { playerColor } from '@/lib/playerColor';
import { useGame } from '@/state/GameContext';

export function Scoreboard() {
  const { room, self, isHost, playAgain } = useGame();
  if (!room) return null;

  const colorByPlayer = new Map(room.players.map((p, i) => [p.id, playerColor(i)]));
  const ranked = [...room.scores].sort((a, b) => b.score - a.score);
  const winner = ranked[0];

  return (
    <div className="relative z-1 mx-auto max-w-[900px] px-6 py-10">
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1fr_340px]">
        <div className="rounded-2xl bg-panel-alt p-5">
          <div className="flex items-center gap-3">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#f8d84b">
              <path d="M7 4h10v3a5 5 0 01-10 0z" />
              <path d="M10 12h4l1 5h-6z" />
              <rect x="7" y="18" width="10" height="3" rx="1.5" />
            </svg>
            <div>
              <div className="text-lg font-extrabold">Game Over</div>
              <div className="text-sm text-muted">Final Score</div>
            </div>
          </div>

          <div className="mt-3.5 overflow-hidden rounded-xl">
            <div className="grid grid-cols-[1fr_80px] bg-panel-3 px-3.5 py-2.5 text-xs font-extrabold text-muted">
              <span>Player</span>
              <span className="text-center">Total</span>
            </div>
            {ranked.map((s, i) => (
              <div
                key={s.playerId}
                className="grid grid-cols-[1fr_80px] items-center px-3.5 py-2.5 text-sm font-bold"
                style={{ background: i % 2 ? '#0f1745' : '#0c1238' }}
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex w-[18px]">
                    {i === 0 && (
                      <svg width="16" height="13" viewBox="0 0 24 18" fill="#f8d84b">
                        <path d="M2 16L4 4l5 5 3-7 3 7 5-5 2 12z" />
                      </svg>
                    )}
                  </span>
                  <Face color={colorByPlayer.get(s.playerId) ?? '#8b7ff0'} size={20} />
                  <span className={s.playerId === self?.playerId ? 'text-white' : 'text-[#dfe4ff]'}>
                    {s.nickname}
                    {s.playerId === self?.playerId ? ' (you)' : ''}
                  </span>
                </span>
                <span className="text-center font-extrabold" style={{ color: i === 0 ? '#f8d84b' : '#dfe4ff' }}>
                  {s.score}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-panel-alt px-6 py-7 text-center">
          <svg width="46" height="34" viewBox="0 0 24 18" fill="#f8d84b" className="mx-auto">
            <path d="M2 16L4 4l5 5 3-7 3 7 5-5 2 12z" />
          </svg>
          <div className="mt-2 font-display text-4xl font-extrabold leading-tight">
            <span style={{ color: colorByPlayer.get(winner?.playerId ?? '') ?? '#fff' }}>{winner?.nickname}</span>{' '}
            wins!
          </div>
          <div className="mt-2 text-sm text-muted">Great drawings, even better guesses!</div>

          <div className="mt-6 flex flex-col gap-3">
            {isHost ? (
              <button onClick={playAgain} className="rounded-xl bg-violet py-3.5 text-base font-extrabold">
                Play Again
              </button>
            ) : (
              <p className="text-sm text-muted">Waiting for the host to start a new game…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
