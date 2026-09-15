import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/types';

export function Chat({
  messages,
  selfId,
  onSend,
}: {
  messages: ChatMessage[];
  selfId: string | null;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div className="flex h-full flex-col rounded-lg border border-border bg-panel">
      <div className="border-b border-border px-3 py-2 text-sm font-medium text-white/70">
        Chat
      </div>
      <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2 text-sm">
        {messages.length === 0 && <p className="text-white/30">No messages yet</p>}
        {messages.map((m) => (
          <p key={m.id} className={m.senderId === selfId ? 'text-accent' : 'text-white/80'}>
            <span className="font-medium">{m.nickname}: </span>
            <span className="text-white/70">{m.text}</span>
          </p>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-border p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          maxLength={300}
          className="min-w-0 flex-1 rounded-md border border-border bg-panel-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Send
        </button>
      </form>
    </div>
  );
}
