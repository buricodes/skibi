import { GameProvider, useGame } from '@/state/GameContext';
import { Backdrop } from '@/components/Backdrop';
import { Home } from '@/screens/Home';
import { Lobby } from '@/screens/Lobby';
import { Choosing } from '@/screens/Choosing';
import { Draw } from '@/screens/Draw';
import { Scoreboard } from '@/screens/Scoreboard';

function Router() {
  const { room } = useGame();
  if (!room) return <Home />;

  switch (room.phase) {
    case 'lobby':
      return <Lobby />;
    case 'choosing':
      return <Choosing />;
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
      <Router />
    </GameProvider>
  );
}

export default App;
