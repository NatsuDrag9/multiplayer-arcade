'use client';
import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/definitions/storeTypes';
import { SnakeGame } from '../../../lib/single-player-games/SnakeGame';
import './SnakeGameClient.scss';
import { logInDev } from '@/utils/logUtils';

// Define game colors using SASS variables
const GAME_COLORS = {
  background: 'rgba(0, 0, 0, 100%)', // Black background
  border: 'rgba(0, 255, 255, 100%)', // Cyan border
  snakeHead: 'rgba(0, 255, 0, 100%)', // Green snake head
  snakeBody: 'rgba(0, 200, 0, 100%)', // Slightly darker green body
  food: 'rgba(255, 0, 0, 100%)', // Red apple
  text: 'rgba(255, 255, 255, 100%)', // White text
};

function SnakeGameClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SnakeGame | null>(null);
  const dispatch = useDispatch();
  const { score, lives } = useSelector((state: RootState) => state.snakeGame);

  useEffect(() => {
    // Initialize game when component mounts
    if (canvasRef.current) {
      // Make sure the canvas is properly sized
      const canvas = canvasRef.current;
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;

      // Set focus to canvas immediately
      canvas.focus();

      // Create game instance
      const game = new SnakeGame(canvas, {
        dispatch,
        colors: GAME_COLORS,
        onGameOver: () => {
          // This would navigate back to main menu in a real app
          logInDev('Game over, returning to main menu');
          // Example navigation: router.push('/games');
        },
      });

      // Store reference and start game
      gameRef.current = game;
      game.start();

      // Prevent arrow keys from scrolling the window
      const preventDefaultForArrowKeys = (e: KeyboardEvent) => {
        if (
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(
            e.key
          )
        ) {
          e.preventDefault();
        }
      };

      // Add the event listener to the window to ensure it works even when canvas loses focus
      window.addEventListener('keydown', preventDefaultForArrowKeys);

      // Set up window click handler to refocus canvas
      const handleWindowClick = (e: MouseEvent) => {
        // Only refocus if clicking inside the game container
        const gameContainer = document.querySelector('.snake-game');
        if (gameContainer && gameContainer.contains(e.target as Node)) {
          canvas.focus();
        }
      };

      window.addEventListener('click', handleWindowClick);

      // Cleanup on unmount
      return () => {
        if (gameRef.current) {
          gameRef.current.stop();
        }
        window.removeEventListener('keydown', preventDefaultForArrowKeys);
        window.removeEventListener('click', handleWindowClick);
      };
    }
  }, [dispatch]);

  // Handler to focus the canvas when container is clicked
  const handleContainerClick = () => {
    if (canvasRef.current) {
      canvasRef.current.focus();
    }
  };

  return (
    <div className="snake-game" onClick={handleContainerClick}>
      <h1>Snake Game</h1>

      <div className="game-stats">
        <div className="score">Score: {score}</div>
        <div className="lives">Lives: {lives}</div>
      </div>

      <div className="game-canvas-container">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          tabIndex={0} // Make canvas focusable for keyboard events
        />
      </div>

      <div className="game-controls">
        <div className="control-item">
          <span className="key">↑ ↓ ← →</span>
          <span className="action">Move Snake</span>
        </div>
        <div className="control-item">
          <span className="key">Space</span>
          <span className="action">Pause / Resume</span>
        </div>
        <div className="control-item">
          <span className="key">R</span>
          <span className="action">Restart Game</span>
        </div>
        <div className="control-item">
          <span className="key">Esc</span>
          <span className="action">Return to Menu</span>
        </div>
      </div>
    </div>
  );
}

export default SnakeGameClient;
