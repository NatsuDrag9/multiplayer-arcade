import { Metadata } from 'next';
import './Pacman.scss';

export const metaData: Metadata = {
  title: 'Pacman',
};

function Pacman() {
  return (
    <div className="mp-pacman">
      <h1 className="mp-pacman__title heading-one">Welcome to MP Pacman</h1>
    </div>
  );
}

export default Pacman;
