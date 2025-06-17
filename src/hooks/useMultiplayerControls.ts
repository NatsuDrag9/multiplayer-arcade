import { ControlItem } from '@/definitions/gameEngineTypes';
import { useMemo } from 'react';

interface UseMultiplayerControlsOptions {
  isSpectator: boolean;
  showDebugInfo: boolean;
  onToggleDebug: () => void;
  onRequestGameState: () => void;
  onDisconnect: () => void; // Add this
}

export function useMultiplayerControls({
  isSpectator,
  showDebugInfo,
  onToggleDebug,
  onRequestGameState,
  onDisconnect, // Add this
}: UseMultiplayerControlsOptions): ControlItem[] {
  return useMemo(() => {
    const controls: ControlItem[] = [];

    // Player controls
    if (!isSpectator) {
      controls.push({ key: 'Arrow Keys', action: 'Move Snake' });
    }

    // Common controls
    controls.push(
      { key: 'R', action: 'Request Game State', onClick: onRequestGameState },
      { key: 'Esc', action: 'Exit and return to Menu' },
      {
        key: 'D',
        action: `${showDebugInfo ? 'Hide' : 'Show'} Debug`,
        onClick: onToggleDebug,
      },
      {
        key: 'X',
        action: 'Disconnect (Test)',
        onClick: onDisconnect,
      }
    );

    return controls;
  }, [
    isSpectator,
    onRequestGameState,
    showDebugInfo,
    onToggleDebug,
    onDisconnect,
  ]);
}
