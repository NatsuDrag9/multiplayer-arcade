import { ControlItem } from '@/definitions/gameEngineTypes';
import React from 'react';

interface GameControlsProps {
  controls: ControlItem[];
}

export function GameControls({ controls }: GameControlsProps) {
  return (
    <div className="game-controls">
      {controls.map((control, index) => (
        <div key={index} className="control-item">
          <span className="key">{control.key}</span>
          <span className="action">
            {control.onClick ? (
              <button onClick={control.onClick} className="action-button">
                {control.action}
              </button>
            ) : (
              control.action
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
