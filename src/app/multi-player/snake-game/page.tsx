import { Metadata } from 'next';
import './SnakeGame.scss';
import { MultiplayerSnakeGameClient } from '@/components/games';

export const metadata: Metadata = {
  title: 'Multiplayer Snake Game',
};

function SnakeGame() {
  return <MultiplayerSnakeGameClient />;
}

export default SnakeGame;
