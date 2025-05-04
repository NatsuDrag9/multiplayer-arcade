'use client';
import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/definitions/storeTypes';
import { SnakeGame } from '../../../lib/game-engine/SnakeGame';
import './SnakeGameClient.scss';

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

  // Get score and lives from Redux store
  const { score, lives } = useSelector((state: RootState) => state.snakeGame);

  useEffect(() => {
    // Initialize game when component mounts
    if (canvasRef.current) {
      // Make sure the canvas is properly sized
      const canvas = canvasRef.current;
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;

      // Create game instance
      const game = new SnakeGame(canvas, {
        dispatch,
        colors: GAME_COLORS,
        onGameOver: () => {
          // This would navigate back to main menu in a real app
          console.log('Game over, returning to main menu');
          // Example navigation: router.push('/games');
        },
      });

      // Store reference and start game
      gameRef.current = game;
      game.start();
    }

    // Cleanup on unmount
    return () => {
      if (gameRef.current) {
        gameRef.current.stop();
      }
    };
  }, [dispatch]);

  return (
    <div className="snake-game">
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
