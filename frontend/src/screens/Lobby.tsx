import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Chat } from '@/components/Chat';
import { Face } from '@/components/Face';
import { playerColor } from '@/lib/playerColor';
import { useGame } from '@/state/GameContext';

export function Lobby() {
  const { room, self, isHost, sendChat, startGame } = useGame();
  const [copied, setCopied] = useState(false);
  if (!room) return null;

  const canStart = room.players.length >= 2;
  const inviteUrl = `${window.location.origin}${window.location.pathname}?code=${room.code}`;

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API needs a secure context (https, or localhost) and can
      // be blocked by permissions — the QR code and visible link are the
      // fallback, so this failing silently is fine.
    }
  }

  return (
    <div className="relative z-1 mx-auto max-w-[1240px] px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-5 pb-5">
        <div className="font-display text-2xl font-extrabold">
          Tom<span className="bg-gradient-to-r from-[#c084fc] to-accent bg-clip-text text-transparent">Sheint</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-muted">Room Code</span>
          <span className="flex items-center gap-2.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-accent to-[#6d3bf5] px-4 py-2 text-[15px] font-extrabold tracking-wide shadow-[0_0_22px_rgba(139,92,246,0.45)]">
            {room.code}
          </span>
        </div>
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
                  <span className="ml-auto flex items-center gap-2">
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
          <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-panel p-4 shadow-[0_0_0_1.5px_var(--color-blue),0_0_30px_rgba(56,189,248,0.22)]">
            <div className="rounded-md bg-white p-2">
              <QRCodeSVG value={inviteUrl} size={80} marginSize={0} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-sm text-muted-2">Scan to join, or share the link:</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 truncate rounded-lg bg-panel-2 px-2.5 py-1.5 text-sm text-muted-2 outline-none"
                />
                <button
                  onClick={copyInviteLink}
                  className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-bold hover:opacity-90"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          <div className="h-[420px]">
            <Chat messages={room.chat} players={room.players} selfId={self?.playerId ?? null} onSend={sendChat} />
          </div>
        </div>
      </div>
    </div>
  );
}
