import { PlayerList } from '@/components/PlayerList';
import { Chat } from '@/components/Chat';
import { useGame } from '@/state/GameContext';

export function Lobby() {
  const { room, self, isHost, sendChat, startGame } = useGame();
  if (!room) return null;

  const canStart = room.players.length >= 2;

  return (
    <div className="mx-auto flex min-h-svh max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-white/50">Room code</p>
          <p className="text-3xl font-bold tracking-[0.3em] text-white">{room.code}</p>
        </div>
        <p className="text-sm text-white/50">
          {room.players.length} player{room.players.length === 1 ? '' : 's'} • Waiting for more…
        </p>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-white/60">Players</h2>
          <PlayerList players={room.players} hostId={room.hostId} selfId={self?.playerId ?? null} />

          {isHost ? (
            <button
              onClick={startGame}
              disabled={!canStart}
              title={canStart ? undefined : 'Need at least 2 players to start'}
              className="mt-2 w-full rounded-lg bg-accent py-2.5 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start Game
            </button>
          ) : (
            <p className="mt-2 text-sm text-white/40">Waiting for the host to start…</p>
          )}
        </div>

        <div className="h-80 md:h-auto">
          <Chat messages={room.chat} selfId={self?.playerId ?? null} onSend={sendChat} />
        </div>
      </div>
    </div>
  );
}
