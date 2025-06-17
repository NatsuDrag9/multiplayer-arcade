import { useState, useEffect, useRef } from 'react';
import { GamePhase } from '@/definitions/gameEngineTypes';
import { ConnectionStatus } from '@/definitions/connectionTypes';
import { MultiplayerGame } from '@/definitions/snakeGameTypes';
import { logInDev } from '@/utils/logUtils';

export interface MultiplayerConnectionState {
  connectionStatus: ConnectionStatus;
  gamePhase: GamePhase;
  playerCount: number;
  networkLatency: number;
  reconnectAttempts: number;
  lastError: string;
}

export function useMultiplayerConnection(
  game: MultiplayerGame | null
): MultiplayerConnectionState {
  const [connectionState, setConnectionState] =
    useState<MultiplayerConnectionState>({
      connectionStatus: 'disconnected',
      gamePhase: 'waiting',
      playerCount: 0,
      networkLatency: 0,
      reconnectAttempts: 0,
      lastError: '',
    });

  // Use ref to track previous game instance to prevent unnecessary effect runs
  const prevGameRef = useRef<MultiplayerGame | null>(null);

  useEffect(() => {
    if (!game) {
      logInDev('No game instance available');

      // Reset state when game is null
      setConnectionState({
        connectionStatus: 'disconnected',
        gamePhase: 'waiting',
        playerCount: 0,
        networkLatency: 0,
        reconnectAttempts: 0,
        lastError: '',
      });
      return;
    }

    // Only log when game changes
    if (prevGameRef.current !== game) {
      logInDev('Game instance changed, starting stats polling');
      prevGameRef.current = game;
    }

    const interval = setInterval(() => {
      try {
        const stats = game.getNetworkStats();

        // Only log stats occasionally to prevent spam
        if (Math.random() < 0.001) {
          // Log ~1% of the time
          logInDev('Network stats sample:', stats);
        }

        setConnectionState((prevState) => {
          // Only update if something actually changed
          if (
            prevState.connectionStatus !== stats.status ||
            prevState.gamePhase !== stats.gamePhase ||
            prevState.playerCount !== stats.playerCount ||
            prevState.networkLatency !== stats.latency ||
            prevState.reconnectAttempts !== (stats.reconnectAttempts || 0)
          ) {
            return {
              connectionStatus: stats.status,
              gamePhase: stats.gamePhase,
              playerCount: stats.playerCount,
              networkLatency: stats.latency,
              reconnectAttempts: stats.reconnectAttempts || 0,
              lastError: '', // Clear errors when successfully getting stats
            };
          }
          return prevState; // No change, return same object to prevent re-renders
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to get network stats';
        logInDev('Error getting network stats:', errorMessage);

        setConnectionState((prev) => ({
          ...prev,
          lastError: errorMessage,
        }));
      }
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [game]); // Re-run when game instance changes

  return connectionState;
}
