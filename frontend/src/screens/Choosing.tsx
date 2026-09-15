import { Chat } from '@/components/Chat';
import { GameHeader } from '@/components/GameHeader';
import { useGame } from '@/state/GameContext';

export function Choosing() {
  const { room, self, isDrawer, wordChoices, chooseWord, sendChat } = useGame();
  if (!room) return null;

  const drawer = room.players.find((p) => p.id === room.drawerId);

  return (
    <div className="relative z-1 mx-auto max-w-[900px] px-6 py-6">
      <GameHeader phaseLabel="Choosing" />

      {isDrawer && wordChoices ? (
        <div className="flex flex-col items-center gap-5 rounded-2xl bg-panel py-12 text-center shadow-[0_0_0_1.5px_var(--color-ring)]">
          <h2 className="font-display text-2xl font-extrabold text-white">Pick a word to draw</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {wordChoices.map((w) => (
              <button
                key={w}
                onClick={() => chooseWord(w)}
                className="rounded-2xl bg-panel-2 px-6 py-3.5 text-lg font-extrabold transition hover:bg-[#3a2f8f]"
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-panel py-12 text-center shadow-[0_0_0_1.5px_var(--color-ring)]">
          <h2 className="font-display text-2xl font-extrabold text-white">
            {drawer?.nickname ?? 'Someone'} is choosing a word…
          </h2>
          <p className="text-muted-2">Get ready to guess!</p>
        </div>
      )}

      <div className="mt-4 h-64">
        <Chat messages={room.chat} players={room.players} selfId={self?.playerId ?? null} onSend={sendChat} />
      </div>
    </div>
  );
}
