import { useEffect, useRef, useState } from 'react';
import { Face } from '@/components/Face';
import { playerColor } from '@/lib/playerColor';
import type { ChatMessage, Player } from '@/lib/types';

function timeLabel(ts: number) {
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function Chat({
  messages,
  players,
  selfId,
  onSend,
  placeholder = 'Type a message...',
}: {
  messages: ChatMessage[];
  players: Player[];
  selfId: string | null;
  onSend: (text: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const colorFor = (senderId?: string) => {
    const i = players.findIndex((p) => p.id === senderId);
    return playerColor(i < 0 ? 0 : i);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  }

  return (
    <div className="flex h-full flex-col rounded-2xl bg-panel p-4 shadow-[0_0_0_1.5px_var(--color-ring)]">
      <div className="flex items-center gap-2.5 pb-3.5">
        <span className="flex h-9.5 w-9.5 items-center justify-center rounded-[11px] bg-gradient-to-br from-accent to-[#6d3bf5] shadow-[0_0_16px_rgba(139,92,246,0.5)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
            <path d="M12 3a9 9 0 00-7 14.6L4 22l4.6-1.2A9 9 0 1012 3z" />
          </svg>
        </span>
        <div className="font-display text-xl font-extrabold">Chat</div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && <p className="text-sm text-muted">No messages yet</p>}
        {messages.map((m) =>
          m.system ? (
            <p key={m.id} className="text-center text-xs italic text-muted">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <Face color={colorFor(m.senderId)} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2.5 text-xs">
                  <span className="font-extrabold" style={{ color: colorFor(m.senderId) }}>
                    {m.nickname}
                  </span>
                  <span className="font-bold text-faint">{timeLabel(m.ts)}</span>
                </div>
                <div
                  className={`mt-0.5 text-sm ${m.senderId === selfId ? 'text-white' : 'text-[#dbe2ff]'}`}
                >
                  {m.text}
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2.5 rounded-2xl bg-panel-2 p-2.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          maxLength={300}
          className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
        />
        <button
          type="submit"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#6d3bf5] shadow-[0_0_16px_rgba(139,92,246,0.5)]"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l18-8-7 18-3-7z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
