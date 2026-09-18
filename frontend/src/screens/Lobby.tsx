import { useState } from 'react';
import { Chat } from '@/components/Chat';
import { Face } from '@/components/Face';
import { HelpToggle } from '@/components/HelpToggle';
import { playerColor } from '@/lib/playerColor';
import { useGame } from '@/state/GameContext';

export function Lobby() {
  const { room, self, isHost, sendChat, startGame, toggleReady } = useGame();
  const [copied, setCopied] = useState(false);
  if (!room) return null;

  const canStart = room.players.length >= 2;
  const roomCode = room.code;

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="relative z-1 mx-auto max-w-[1240px] px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-5 pb-5">
        <div className="font-display text-2xl font-extrabold">
          Tom<span className="bg-gradient-to-r from-[#c084fc] to-accent bg-clip-text text-transparent">Sheint</span>
        </div>
        <HelpToggle />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="rounded-[22px] bg-panel p-5 shadow-[0_0_0_1.5px_var(--color-violet),0_0_34px_rgba(109,59,245,0.3)]">
          <div className="flex flex-wrap items-center gap-3 px-1 pb-4">
            <span className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-gradient-to-br from-accent to-[#6d3bf5] shadow-[0_0_18px_rgba(139,92,246,0.5)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
                <circle cx="9" cy="8" r="3.4" />
                <circle cx="17" cy="9" r="2.6" />
                <path d="M2 19c0-3.6 3-6 7-6s7 2.4 7 6z" />
                <path d="M17 13c3 0 5 2 5 5h-5z" />
              </svg>
            </span>
            <div className="font-display text-2xl font-extrabold">Game Lobby</div>
            <div className="ml-auto flex items-center gap-2 whitespace-nowrap text-sm font-bold text-muted-2">
              {room.players.length} player{room.players.length === 1 ? '' : 's'} · Waiting for more…
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {room.players.map((p, i) => {
              const isHostRow = p.id === room.hostId;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3.5 rounded-2xl px-4 py-2.5"
                  style={{
                    background: isHostRow ? '#1b2065' : '#0e1540',
                    boxShadow: isHostRow ? '0 0 0 1.5px var(--color-violet), 0 0 22px rgba(123,77,255,0.35)' : 'none',
                  }}
                >
                  <Face color={playerColor(i)} size={34} />
                  {isHostRow && (
                    <svg width="20" height="16" viewBox="0 0 24 18" fill="#a855f7" className="flex-none">
                      <path d="M2 16L4 4l5 5 3-7 3 7 5-5 2 12z" />
                    </svg>
                  )}
                  <span className="text-base font-extrabold">
                    {p.nickname}
                    {p.id === self?.playerId ? ' (you)' : ''}
                  </span>
                  {isHostRow && (
                    <span className="rounded-lg bg-violet px-2.5 py-1 text-xs font-extrabold">Host</span>
                  )}
                  <span
                    className="ml-auto flex items-center gap-2"
                    style={{ cursor: p.id === self?.playerId ? 'pointer' : 'default' }}
                    onClick={p.id === self?.playerId ? toggleReady : undefined}
                  >
                    {p.ready ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round">
                        <rect x="9" y="3" width="6" height="11" rx="3" />
                        <path d="M6 12a6 6 0 0012 0M12 18v3" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2.2" strokeLinecap="round">
                        <rect x="9" y="3" width="6" height="11" rx="3" />
                        <path d="M6 12a6 6 0 0012 0M12 18v3M4 4l16 16" />
                      </svg>
                    )}
                    <span className="text-xs font-extrabold" style={{ color: p.ready ? '#4ade80' : '#f472b6' }}>
                      {p.ready ? 'Ready' : 'Not Ready'}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={p.connected ? '#4ade80' : '#8892c4'}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    >
                      <rect x="9" y="3" width="6" height="11" rx="3" />
                      <path d="M6 12a6 6 0 0012 0M12 18v3" />
                    </svg>
                    <span className="text-xs font-extrabold" style={{ color: p.connected ? '#4ade80' : '#8892c4' }}>
                      {p.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </span>
                </div>
              );
            })}

            {room.players.length < 2 && (
              <div className="flex items-center gap-3.5 rounded-2xl bg-panel-3 px-4 py-2.5">
                <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full border border-dashed border-[#46529a] text-lg font-bold text-muted">
                  +
                </span>
                <span className="text-sm font-bold text-muted">Waiting for another player…</span>
              </div>
            )}
          </div>

          {isHost ? (
            <button
              onClick={startGame}
              disabled={!canStart}
              title={canStart ? undefined : 'Need at least 2 players to start'}
              className="mt-4.5 flex w-full items-center justify-center gap-3.5 rounded-full bg-gradient-to-r from-violet to-[#c964f0] py-4.5 font-display text-2xl font-extrabold shadow-[0_0_34px_rgba(155,86,240,0.5),inset_0_2px_0_rgba(255,255,255,0.25)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="#ffd94b" className="flex-none">
                <path d="M3 1l11 7-11 7z" />
              </svg>
              Start Game
            </button>
          ) : (
            <p className="mt-4 text-center text-sm text-muted">Waiting for the host to start…</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-panel p-4 shadow-[0_0_0_1.5px_var(--color-blue),0_0_30px_rgba(56,189,248,0.22)]">
            <div>
              <p className="text-sm text-muted-2">Room code</p>
              <p className="font-display text-2xl font-extrabold tracking-widest text-white">{room.code}</p>
            </div>
            <button
              onClick={copyRoomCode}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-bold hover:opacity-90"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="h-[420px]">
            <Chat messages={room.chat} players={room.players} selfId={self?.playerId ?? null} onSend={sendChat} />
          </div>
        </div>
      </div>
    </div>
  );
}
