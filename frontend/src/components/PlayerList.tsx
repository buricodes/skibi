import type { Player } from '@/lib/types';

export function PlayerList({
  players,
  hostId,
  selfId,
}: {
  players: Player[];
  hostId: string;
  selfId: string | null;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {players.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between rounded-lg border border-border bg-panel px-3 py-2"
        >
          <span className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${p.connected ? 'bg-emerald-400' : 'bg-white/20'}`}
              title={p.connected ? 'connected' : 'disconnected'}
            />
            <span className={p.id === selfId ? 'font-semibold text-white' : 'text-white/90'}>
              {p.nickname}
              {p.id === selfId ? ' (you)' : ''}
            </span>
          </span>
          {p.id === hostId && (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">
              Host
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
