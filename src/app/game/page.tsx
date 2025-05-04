import { Metadata } from 'next';
import './Game.scss';

export const metaData: Metadata = {
  title: 'Multiplayer Game',
};

function Game() {
  return (
    <div className="game">
      <h1 className="game__title">Welcome</h1>
    </div>
  );
}

export default Game;
