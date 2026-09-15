import { GameProvider, useGame } from '@/state/GameContext';
import { Home } from '@/screens/Home';
import { Lobby } from '@/screens/Lobby';
import { Draw } from '@/screens/Draw';
import { Gallery } from '@/screens/Gallery';
import { Sabotage } from '@/screens/Sabotage';
import { Guess } from '@/screens/Guess';
import { Reveal } from '@/screens/Reveal';
import { Scoreboard } from '@/screens/Scoreboard';

function Router() {
  const { room } = useGame();
  if (!room) return <Home />;

  // One case per phase; Sabotage/Guess/Reveal/Scoreboard land next
  // (BUILD_PLAN.md §4 Day 2).
  switch (room.phase) {
    case 'lobby':
      return <Lobby />;
    case 'draw':
      return <Draw />;
    case 'gallery':
      return <Gallery />;
    case 'sabotage':
      return <Sabotage />;
    case 'guess':
      return <Guess />;
    case 'reveal':
      return <Reveal />;
    case 'scoreboard':
      return <Scoreboard />;
    default:
      return <Lobby />;
  }
}

function App() {
  return (
    <GameProvider>
      <Router />
    </GameProvider>
  );
}

export default App;
