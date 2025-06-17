'use client';
import React, { useCallback, useState, useRef } from 'react';
import { MultiplayerSnakeGame } from '@/lib/multi-player-games/MultiplayerSnakeGame/MultiplayerSnakeGame';
import { useGameKeyboardHandler } from '@/hooks/useGameKeyboardHandler';
import { GameStats, MultiplayerGame } from '@/definitions/snakeGameTypes';
import { GameLayout } from '../shared/GameLayout/GameLayout';
import { ConnectionStatusCard, StatusMessageCard } from '@/components/cards';
import { GameControls } from '../shared/GameControl/GameControl';
import { GameCanvas } from '../shared/GameCanvas/GameCanvas';
import { useMultiplayerControls } from '@/hooks/useMultiplayerControls';
import { useMultiplayerGamePhase } from '@/hooks/useMultiplayerGamePhase';
import { useMultiplayerConnection } from '@/hooks/useMultiplayerConnection';
import { WEBSOCKET_URL } from '@/constants/appConstants';
import { logInDev } from '@/utils/logUtils';
import { DEFAULT_COLORS } from '@/constants/gameConstants';

interface MultiplayerSnakeGameClientProps {
  websocketUrl?: string;
  isSpectator?: boolean;
  onGameOver?: () => void;
  onConnectionError?: (error: string) => void;
}

function MultiplayerSnakeGameClient({
  websocketUrl = WEBSOCKET_URL,
  isSpectator = false,
  onGameOver,
}: MultiplayerSnakeGameClientProps) {
  const gameRef = useRef<MultiplayerGame | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [scores, setScores] = useState<GameStats>({
    p1Score: 0,
    p1Lives: 0,
    p2Score: 0,
    p2Lives: 0,
    targetScore: 10,
  });

  // Get connection state from the simplified hook
  const connectionState = useMultiplayerConnection(gameRef.current);

  // logInDev('Connection state: ', connectionState);

  // Get game phase info
  const gamePhaseInfo = useMultiplayerGamePhase(connectionState.gamePhase);

  // Game controls handlers
  const toggleDebugInfo = useCallback(() => {
    setShowDebugInfo((prev) => {
      const newState = !prev;
      gameRef.current?.setDebugMode(newState);
      return newState;
    });
  }, []);

  const requestGameState = useCallback(() => {
    if (gameRef.current?.isConnected()) {
      gameRef.current.requestGameState();
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    if (gameRef.current?.isConnected()) {
      gameRef.current.forceDisconnect();
      logInDev('Manual disconnect triggered');
    }
  }, []);

  // Get controls
  const controls = useMultiplayerControls({
    isSpectator,
    showDebugInfo,
    onToggleDebug: toggleDebugInfo,
    onRequestGameState: requestGameState,
    onDisconnect: handleDisconnect,
  });

  // Initialize game when canvas is ready
  const handleCanvasReady = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (gameRef.current) {
        gameRef.current.stop();
      }

      const game = new MultiplayerSnakeGame(canvas, {
        colors: DEFAULT_COLORS,
        websocketUrl,
        showDebugInfo,
        isSpectator,
        onGameOver,
        onScoreUpdate: (p1Score, p1Lives, p2Score, p2Lives, targetScore) => {
          setScores({ p1Score, p1Lives, p2Score, p2Lives, targetScore });
        },
      });

      gameRef.current = game;
      game.start();
    },
    [websocketUrl, showDebugInfo, isSpectator, onGameOver]
  );

  // Cleanup on unmount
  useGameKeyboardHandler({
    onUnmount: useCallback(() => {
      gameRef.current?.stop();
      gameRef.current = null;
    }, []),
  });

  return (
    <GameLayout title="Multiplayer Snake Game">
      {/* Connection Status */}
      <div className="game-stats">
        <ConnectionStatusCard status={connectionState.connectionStatus} />
        <div className="game-phase-card" style={{ color: gamePhaseInfo.color }}>
          {gamePhaseInfo.text}
        </div>
      </div>

      {/* Player Info */}
      <div className="multiplayer-info">
        <span>Players: {connectionState.playerCount}/2</span>
        {connectionState.networkLatency > 0 && (
          <span>Latency: {connectionState.networkLatency}ms</span>
        )}
        {connectionState.reconnectAttempts > 0 && (
          <span>Reconnect attempts: {connectionState.reconnectAttempts}</span>
        )}
      </div>

      {/* Game Canvas */}
      <GameCanvas
        onCanvasReady={handleCanvasReady}
        playerScores={[
          { lives: scores.p1Lives, score: scores.p1Score },
          { lives: scores.p2Lives, score: scores.p2Score },
        ]}
      />

      {/* Game Controls */}
      <GameControls controls={controls} />

      {/* Error Messages */}
      {connectionState.lastError && (
        <StatusMessageCard type="error" message={connectionState.lastError} />
      )}

      {connectionState.connectionStatus === 'connecting' && (
        <StatusMessageCard type="warning" message="Connecting to server..." />
      )}
    </GameLayout>
  );
}

export default MultiplayerSnakeGameClient;
