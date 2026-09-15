import { Face } from '@/components/Face';
import { playerColor } from '@/lib/playerColor';
import type { Player, PlayerScore } from '@/lib/types';

export function PlayerList({
  players,
  hostId,
  selfId,
  drawerId,
  scores,
}: {
  players: Player[];
  hostId: string;
  selfId: string | null;
  drawerId?: string;
  scores?: PlayerScore[];
}) {
  const scoreByPlayer = new Map((scores ?? []).map((s) => [s.playerId, s.score]));

  return (
    <ul className="flex flex-col gap-1">
      {players.map((p, i) => {
        const isHost = p.id === hostId;
        const isDrawer = p.id === drawerId;
        return (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
            style={{
              background: isHost ? '#1b2065' : 'transparent',
              boxShadow: isHost ? '0 0 0 1.5px var(--color-violet), 0 0 22px rgba(123,77,255,0.35)' : 'none',
            }}
          >
            <Face color={playerColor(i)} size={30} />
            <div className="min-w-0 flex-1">
              <div className={`truncate text-sm font-extrabold ${!p.connected ? 'opacity-40' : ''}`}>
                {p.nickname}
                {p.id === selfId ? ' (you)' : ''}
              </div>
              {scores && <div className="text-xs font-bold text-muted">{scoreByPlayer.get(p.id) ?? 0} pts</div>}
            </div>
            {isDrawer && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                <path d="M17 3l4 4-11 11-5 1 1-5z" />
              </svg>
            )}
            {isHost && (
              <svg width="20" height="16" viewBox="0 0 24 18" fill="#ffd94b" className="flex-none">
                <path d="M2 16L4 4l5 5 3-7 3 7 5-5 2 12z" />
              </svg>
            )}
          </li>
        );
      })}
    </ul>
  );
}
