'use client';
import React, { useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/definitions/storeTypes';
import './SnakeGameClient.scss';
import { logInDev } from '@/utils/logUtils';
import { DEFAULT_COLORS } from '@/lib/game-engine/constants';
import { SnakeGame } from '@/lib/single-player-games/SnakeGame';
import { useGameKeyboardHandler } from '@/hooks/useGameKeyboardHandler';
import { GameControls } from '../shared/GameControl/GameControl';
import { GameLayout } from '../shared/GameLayout/GameLayout';
import { GameCanvas } from '../shared/GameCanvas/GameCanvas';
import { ControlItem } from '@/definitions/gameEngineTypes';

function SnakeGameClient() {
  const gameRef = useRef<SnakeGame | null>(null);
  const dispatch = useDispatch();
  const { score, lives } = useSelector((state: RootState) => state.snakeGame);

  // Handle game initialization
  const handleCanvasReady = useCallback(
    (canvas: HTMLCanvasElement) => {
      const game = new SnakeGame(canvas, {
        dispatch,
        colors: DEFAULT_COLORS,
        onGameOver: () => {
          logInDev('Game over, returning to main menu');
          // Example navigation: router.push('/games');
        },
      });

      gameRef.current = game;
      game.start();
    },
    [dispatch]
  );

  // Handle cleanup
  const handleCleanup = useCallback(() => {
    if (gameRef.current) {
      gameRef.current.stop();
      gameRef.current = null; // Clear the ref
    }
  }, []);

  // Use keyboard handler hook
  useGameKeyboardHandler({ onUnmount: handleCleanup });

  // Define controls with proper text labels
  const controls: ControlItem[] = [
    // { key: '↑ ↓ ← →', action: 'Move Snake' }
    { key: 'Arrow Keys', action: 'Move Snake' },
    { key: 'Space', action: 'Pause / Resume' },
    { key: 'R', action: 'Restart Game' },
    { key: 'Esc', action: 'Return to Menu' },
  ];

  // Focus canvas when container is clicked
  const handleContainerClick = useCallback(() => {
    const canvas = document.querySelector('.game-canvas') as HTMLCanvasElement;
    if (canvas) canvas.focus();
  }, []);

  return (
    <GameLayout title="Snake Game" onContainerClick={handleContainerClick}>
      <GameCanvas
        playerScores={[{ score, lives }]}
        onCanvasReady={handleCanvasReady}
      />
      <GameControls controls={controls} />
    </GameLayout>
  );
}

export default SnakeGameClient;
