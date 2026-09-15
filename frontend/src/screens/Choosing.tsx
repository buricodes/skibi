import { Chat } from '@/components/Chat';
import { Timer } from '@/components/Timer';
import { useGame } from '@/state/GameContext';

export function Choosing() {
  const { room, self, isDrawer, wordChoices, chooseWord, sendChat } = useGame();
  if (!room) return null;

  const drawer = room.players.find((p) => p.id === room.drawerId);

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/50">
          Round {room.round} / {room.totalRounds}
        </p>
        <Timer phaseEndsAt={room.phaseEndsAt} />
      </div>

      {isDrawer && wordChoices ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <h2 className="text-xl font-bold text-white">Pick a word to draw</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {wordChoices.map((w) => (
              <button
                key={w}
                onClick={() => chooseWord(w)}
                className="rounded-lg border border-border bg-panel px-5 py-3 text-lg font-medium text-white transition hover:border-accent hover:bg-accent/10"
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <h2 className="text-xl font-bold text-white">
            {drawer?.nickname ?? 'Someone'} is choosing a word…
          </h2>
          <p className="text-white/50">Get ready to guess!</p>
        </div>
      )}

      <div className="h-64">
        <Chat messages={room.chat} selfId={self?.playerId ?? null} onSend={sendChat} />
      </div>
    </div>
  );
}
