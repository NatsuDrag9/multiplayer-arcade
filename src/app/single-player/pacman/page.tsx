import { Metadata } from 'next';
import './Pacman.scss';

export const metaData: Metadata = {
  title: 'Pacman',
};

function Pacman() {
  return (
    <div className="pacman">
      <h1 className="pacman__title heading-one">Welcome to pacman</h1>
    </div>
  );
}

export default Pacman;
