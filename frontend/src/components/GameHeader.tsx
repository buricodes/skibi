import { useCountdown } from '@/lib/useCountdown';
import { useGame } from '@/state/GameContext';

export function GameHeader({ phaseLabel }: { phaseLabel: string }) {
  const { room } = useGame();
  const remainingMs = useCountdown(room?.phaseEndsAt);
  const seconds = Math.ceil(remainingMs / 1000);
  const timerText = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  if (!room) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl bg-panel px-5 py-3.5 shadow-[0_0_0_1.5px_var(--color-ring)]">
      <span className="whitespace-nowrap font-display text-lg font-extrabold">
        Round {room.round}/{room.totalRounds}
      </span>
      <span className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-violet to-[#6d3bf5] px-4 py-2 text-[17px] font-extrabold shadow-[0_0_20px_rgba(123,77,255,0.45)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
          <path d="M17 3l4 4-11 11-5 1 1-5z" />
        </svg>
        {phaseLabel}
      </span>
      <span
        className="ml-auto flex items-center gap-2 whitespace-nowrap text-lg font-extrabold"
        style={{ color: seconds <= 5 ? '#f27aa0' : '#c9d0f0' }}
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#9fb0e6" strokeWidth="2.2">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l3 2M9 3h6" strokeLinecap="round" />
        </svg>
        {timerText}
      </span>
    </div>
  );
}
