import { useState } from 'react';
import { isMuted, setMuted } from '@/lib/sounds';

export function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      title={muted ? 'Unmute sounds' : 'Mute sounds'}
      className="fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-panel shadow-[0_0_0_1.5px_var(--color-ring)]"
    >
      {muted ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8892c4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 9v6h4l5 5V4L9 9H5z" />
          <path d="M17 9l6 6M23 9l-6 6" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dfe4ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 9v6h4l5 5V4L9 9H5z" />
          <path d="M16.5 8.5a5 5 0 010 7M19.5 5.5a9 9 0 010 13" />
        </svg>
      )}
    </button>
  );
}
