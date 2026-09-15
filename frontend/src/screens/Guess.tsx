import { useState } from 'react';
import { Chat } from '@/components/Chat';
import { Timer } from '@/components/Timer';
import { useGame } from '@/state/GameContext';

export function Guess() {
  const { room, self, sendChat, submitVote } = useGame();
  const [myVotes, setMyVotes] = useState<Record<string, string>>({});

  if (!room) return null;

  function vote(targetArtistId: string, suspectId: string) {
    submitVote(targetArtistId, suspectId);
    setMyVotes((v) => ({ ...v, [targetArtistId]: suspectId }));
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Who sabotaged it?</h2>
        <Timer phaseEndsAt={room.phaseEndsAt} />
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {(room.guessTargets ?? []).map((t) => (
            <div key={t.targetArtistId} className="rounded-lg border border-border bg-panel p-3">
              <div className="flex gap-3">
                <img
                  src={t.imageDataUrl}
                  alt={`${t.targetNickname}'s sabotaged drawing`}
                  className="h-32 w-32 shrink-0 rounded-md bg-white object-cover"
                />
                <div className="flex flex-col justify-center gap-1">
                  <p className="text-sm text-white/50">{t.targetNickname}'s drawing</p>
                  <p className="text-white/80">
                    Sabotage prompt: <span className="text-accent-2">{t.prompt}</span>
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {room.players
                  // The original artist can never be their own saboteur
                  // (the derangement guarantees it) — every other player,
                  // self included, is a legitimate suspect.
                  .filter((p) => p.id !== t.targetArtistId)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => vote(t.targetArtistId, p.id)}
                      className={`rounded-full border px-3 py-1 text-sm transition ${
                        myVotes[t.targetArtistId] === p.id
                          ? 'border-accent bg-accent/20 text-white'
                          : 'border-border text-white/70 hover:border-accent'
                      }`}
                    >
                      {p.nickname}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="h-80 md:h-auto">
          <Chat messages={room.chat} selfId={self?.playerId ?? null} onSend={sendChat} />
        </div>
      </div>
    </div>
  );
}
