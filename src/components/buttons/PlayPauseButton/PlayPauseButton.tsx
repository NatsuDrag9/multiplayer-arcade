'use client';
import './PlayPauseButton.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause } from '@fortawesome/free-solid-svg-icons';

export interface PlayPauseButtonProps {
  isPaused: boolean;
  onButtonClick: (playState: boolean) => void;
}

function PlayPauseButton({ isPaused, onButtonClick }: PlayPauseButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        onButtonClick(!isPaused);
      }}
      className="pp-button"
    >
      <FontAwesomeIcon
        icon={isPaused ? faPause : faPlay}
        size="2x"
        className="pp-button__image"
      />
    </button>
  );
}

export default PlayPauseButton;
