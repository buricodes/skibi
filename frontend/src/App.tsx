import { GameProvider, useGame } from '@/state/GameContext';
import { Backdrop } from '@/components/Backdrop';
import { SoundToggle } from '@/components/SoundToggle';
import { Home } from '@/screens/Home';
import { Lobby } from '@/screens/Lobby';
import { Draw } from '@/screens/Draw';
import { Scoreboard } from '@/screens/Scoreboard';

function Reconnecting() {
  return (
    <div className="relative z-1 mx-auto flex max-w-[1240px] flex-col items-center justify-center px-6 py-24 text-center">
      <div className="font-display text-2xl font-extrabold">Reconnecting to your game…</div>
      <p className="mt-2 text-sm text-muted">Hang tight, picking up right where you left off.</p>
    </div>
  );
}

function Router() {
  const { room, reconnecting } = useGame();
  if (!room) return reconnecting ? <Reconnecting /> : <Home />;

  switch (room.phase) {
    case 'lobby':
      return <Lobby />;
    case 'choosing':
    case 'drawing':
    case 'turnEnd':
      return <Draw />;
    case 'scoreboard':
      return <Scoreboard />;
    default:
      return <Lobby />;
  }
}

function App() {
  return (
    <GameProvider>
      <Backdrop />
      <SoundToggle />
      <Router />
    </GameProvider>
  );
}

export default App;
