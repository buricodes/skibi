import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { PlayerList } from '@/components/PlayerList';
import { Chat } from '@/components/Chat';
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

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-panel p-4">
        <div className="rounded-md bg-white p-2">
          <QRCodeSVG value={inviteUrl} size={96} marginSize={0} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm text-white/60">Scan to join, or share the link:</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 truncate rounded-md border border-border bg-panel-2 px-2 py-1.5 text-sm text-white/70 outline-none"
            />
            <button
              onClick={copyInviteLink}
              className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

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
