import React from 'react';
import './GameStatsCard.scss';

export interface PlayerScore {
  score: number;
  lives: number;
}

interface GameStatsCardProps {
  playerScores: PlayerScore[];
  children?: React.ReactNode; // For additional stats
}

function GameStatsCard({ playerScores, children }: GameStatsCardProps) {
  const isMultiplayer = playerScores.length > 1;

  if (isMultiplayer) {
    return (
      <div className="game-stats-card game-stats-card--multiplayer">
        {playerScores.map((player, index) => (
          <div key={index} className="player-stats">
            <div className="player-label">Player {index + 1}</div>
            <div className="score">Score: {player.score}</div>
            <div className="lives">Lives: {player.lives}</div>
          </div>
        ))}
        {children}
      </div>
    );
  }

  // Single player
  const player = playerScores[0];
  return (
    <div className="game-stats-card game-stats-card--single">
      <div className="score">Score: {player.score}</div>
      <div className="lives">Lives: {player.lives}</div>
      {children}
    </div>
  );
}

export default GameStatsCard;
