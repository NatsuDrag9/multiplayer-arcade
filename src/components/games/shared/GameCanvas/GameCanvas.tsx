'use client';
import { GameStatsCard } from '@/components/cards';
import { PlayerScore } from '@/components/cards/GameStatsCard/GameStatsCard';
import React, { useRef, useEffect, forwardRef } from 'react';

interface GameCanvasProps {
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onContainerClick?: () => void;
  className?: string;
  playerScores: PlayerScore[];
}

export const GameCanvas = forwardRef<HTMLCanvasElement, GameCanvasProps>(
  (
    {
      onCanvasReady,
      onContainerClick,
      playerScores,
      className = 'game-canvas',
    },
    ref
  ) => {
    const internalRef = useRef<HTMLCanvasElement>(null);
    const canvasRef =
      (ref as React.RefObject<HTMLCanvasElement>) || internalRef;

    useEffect(() => {
      if (canvasRef.current && onCanvasReady) {
        const canvas = canvasRef.current;
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        canvas.focus();
        onCanvasReady(canvas);
      }
    }, [onCanvasReady, canvasRef]);

    return (
      <div className="game-canvas-container" onClick={onContainerClick}>
        <GameStatsCard playerScores={playerScores} />
        <canvas ref={canvasRef} className={className} tabIndex={0} />
      </div>
    );
  }
);

GameCanvas.displayName = 'GameCanvas';
