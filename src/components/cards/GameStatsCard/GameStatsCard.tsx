import React from 'react';
import './GameStatsCard.scss';

interface GameStatsCardProps {
  score: number;
  lives: number;
  children?: React.ReactNode; // For additional stats
}

function GameStatsCard({ score, lives, children }: GameStatsCardProps) {
  return (
    <div className="game-stats-card">
      <div className="score">Score: {score}</div>
      <div className="lives">Lives: {lives}</div>
      {children}
    </div>
  );
}

export default GameStatsCard;
