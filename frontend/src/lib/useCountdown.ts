import { useEffect, useState } from 'react';

// Renders a countdown purely from a server-provided deadline, never a
// server tick — see PRD.md §9 "Timers, done the reliable way." The server
// independently owns when the phase actually advances; this is display
// only.
export function useCountdown(phaseEndsAt: number | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  if (!phaseEndsAt) return 0;
  return Math.max(0, phaseEndsAt - now);
}
