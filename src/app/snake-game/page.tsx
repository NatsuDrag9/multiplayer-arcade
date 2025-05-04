import { Metadata } from 'next';
import './SnakeGame.scss';
import { SnakeGameClient } from '@/components/games';

export const metadata: Metadata = {
  title: 'Snake Game',
};

function SnakeGame() {
  return <SnakeGameClient />;
}

export default SnakeGame;
