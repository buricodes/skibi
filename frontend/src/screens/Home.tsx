import { useEffect, useState } from 'react';
import { useGame } from '@/state/GameContext';

export function Home() {
  const { status, createRoom, joinRoom, lastError, clearError } = useGame();
  const [nickname, setNickname] = useState('');
  const [mode, setMode] = useState<'none' | 'join'>('none');
  const [code, setCode] = useState('');

  // A Lobby invite link is `<origin>?code=XXXXX` — jump straight to the
  // Join form with the code prefilled instead of making someone type a
  // 5-character code by hand.
  useEffect(() => {
    const url = new URL(window.location.href);
    const invited = url.searchParams.get('code');
    if (invited) {
      setCode(invited.toUpperCase());
      setMode('join');
      url.searchParams.delete('code');
      window.history.replaceState({}, '', url);
    }
  }, []);

  const canPlay = status === 'open' && nickname.trim().length > 0;

  function handleCreate() {
    if (!canPlay) return;
    clearError();
    createRoom(nickname.trim());
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!canPlay || code.trim().length === 0) return;
    clearError();
    joinRoom(code.trim().toUpperCase(), nickname.trim());
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div>
        <h1 className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-4xl font-bold text-transparent">
          Sketch Sabotage
        </h1>
        <p className="mt-2 text-white/60">
          Same word. Someone edits your drawing. Guess who.
        </p>
      </div>

      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="Your nickname"
        maxLength={20}
        className="w-full rounded-lg border border-border bg-panel px-4 py-2.5 text-center outline-none focus:border-accent"
      />

      {mode === 'none' && (
        <div className="flex w-full flex-col gap-3">
          <button
            onClick={handleCreate}
            disabled={!canPlay}
            className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create Room
          </button>
          <button
            onClick={() => setMode('join')}
            disabled={!canPlay}
            className="w-full rounded-lg border border-border py-2.5 font-medium text-white/90 transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Join Room
          </button>
        </div>
      )}

      {mode === 'join' && (
        <form onSubmit={handleJoin} className="flex w-full flex-col gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Room code"
            maxLength={5}
            className="w-full rounded-lg border border-border bg-panel px-4 py-2.5 text-center uppercase tracking-widest outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!canPlay || code.trim().length === 0}
            className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Join
          </button>
          <button
            type="button"
            onClick={() => setMode('none')}
            className="text-sm text-white/50 hover:text-white/80"
          >
            Back
          </button>
        </form>
      )}

      {status !== 'open' && (
        <p className="text-sm text-white/40">
          {status === 'connecting' ? 'Connecting to server…' : 'Disconnected — retrying…'}
        </p>
      )}
      {lastError && <p className="text-sm text-rose-400">{lastError.message}</p>}
    </div>
  );
}
