import { useState } from 'react';

export function HelpToggle() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 whitespace-nowrap text-sm font-extrabold"
      >
        How to Play
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-panel-3 text-[13px] font-extrabold text-[#dfe4ff]">
          ?
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 w-[min(90vw,360px)] rounded-2xl bg-panel-2 p-4 text-sm leading-relaxed text-[#c9d0f0] shadow-[0_14px_30px_rgba(0,0,0,0.4)]">
          <b className="text-white">How to play.</b> Players take turns drawing. The
          current drawer privately picks a word, everyone else types guesses in chat.
          Guessing right scores you 3, 2, or 1 points depending on how fast you were —
          and the drawer scores 1 point for every player who gets it. Letters of the
          word reveal themselves as the clock runs down. Three rounds, highest total
          wins.
        </div>
      )}
    </div>
  );
}
