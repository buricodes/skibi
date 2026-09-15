import { GameProvider, useGame } from '@/state/GameContext';
import { Backdrop } from '@/components/Backdrop';
import { SoundToggle } from '@/components/SoundToggle';
import { Home } from '@/screens/Home';
import { Lobby } from '@/screens/Lobby';
import { Draw } from '@/screens/Draw';
import { Scoreboard } from '@/screens/Scoreboard';

function Router() {
  const { room } = useGame();
  if (!room) return <Home />;

  switch (room.phase) {
    case 'lobby':
      return <Lobby />;
    // Choosing and Drawing share one screen — the word picker/waiting
    // message appears right where the canvas will be, in the same layout,
    // rather than a separate full-screen interstitial (see screens/Draw.tsx).
    case 'choosing':
    case 'drawing':
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
