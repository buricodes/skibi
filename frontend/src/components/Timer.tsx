import { useCountdown } from '@/lib/useCountdown';

export function Timer({ phaseEndsAt }: { phaseEndsAt: number }) {
  const remainingMs = useCountdown(phaseEndsAt);
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <span className={`font-mono text-lg tabular-nums ${seconds <= 5 ? 'text-rose-400' : 'text-white/80'}`}>
      0:{String(seconds).padStart(2, '0')}
    </span>
  );
}
