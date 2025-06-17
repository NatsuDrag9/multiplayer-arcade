import { ConnectionStatus } from './connectionTypes';
import { GamePhase, Position } from './gameEngineTypes';
import { BaseGameState, GameConfig } from './gameSessionTypes';

export interface PlayerSnakeState {
  id: string;
  playerId: number; // 1 or 2
  x: number;
  y: number;
  direction: number;
  length: number;
  body: Position[];
  alive: boolean;
  lastInputTime: number;
}

export interface SnakeGameState extends BaseGameState {
  players: Map<string, PlayerSnakeState>; // Override with specific player type
  food: Position;
  targetScore: number;
}

export interface MultiplayerPlayerState
  extends Omit<PlayerSnakeState, 'lastInputTime'> {
  score: number;
}

export type MultiplayerGameConfig = Omit<GameConfig, 'gameSpeed'>;

export interface GameStats {
  p1Score: number;
  p2Score: number;
  targetScore: number;
}

export interface MultiplayerConnectionState {
  connectionStatus: ConnectionStatus;
  gamePhase: GamePhase;
  playerCount: number;
  networkLatency: number;
  showDebugInfo: boolean;
  lastError: string;
  isValidUrl: boolean;
}

export interface NetworkStats {
  status: ConnectionStatus;
  gamePhase: GamePhase;
  playerCount: number;
  latency: number;
  reconnectAttempts?: number;
}

export interface MultiplayerGame {
  start(): void;
  stop(): void;
  isConnected(): boolean;
  setDebugMode(enabled: boolean): void;
  requestGameState(): void;
  getNetworkStats(): NetworkStats;
  forceDisconnect(): void;
}

export interface MultiplayerConnectionActions {
  initializeGame: (
    canvas: HTMLCanvasElement,
    gameFactory: (canvas: HTMLCanvasElement) => MultiplayerGame
  ) => void;
  cleanup: () => void;
  toggleDebugInfo: () => void;
  requestGameState: () => void;
  clearError: () => void;
}

export interface GameStats {
  p1Score: number;
  p1Lives: number;
  p2Score: number;
  p2Lives: number;
  targetScore: number;
}
