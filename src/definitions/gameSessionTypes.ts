import WebSocket from 'ws';
import { ClientType } from './connectionTypes';
import { GamePhase } from './gameEngineTypes';
import { SnakeGameState } from './snakeGameTypes';
import { AuthoritativeGame } from '@/server/lib/games/AuthoritativeGame';

export interface Client {
  id: string;
  ws: WebSocket;
  type: ClientType;
  playerId?: number; // Assigned player ID
  gameSessionId?: string; // Which game session they're in
  tileSize?: number; // Validated TILE_SIZE (multiple of 8)
  validated: boolean; // Whether TILE_SIZE was accepted
}

export interface GameConfig {
  boardWidth: number;
  boardHeight: number;
  gameSpeed: number;
  maxPlayers: number;
  targetScore: number;
}

// Base player state that all games extend
export interface BasePlayerState {
  playerId: number; // Game-specific player number (1, 2, 3, etc.)
  alive: boolean;
}

// Base game state interface
export interface BaseGameState {
  gamePhase: GamePhase;
  players: Map<string, BasePlayerState>; // Base player structure mapped to client ID from web-socket connection
  scores: Record<number, number>; // 1: 5, 2: 10} where 1 --> player 1 and 2 --> player 2
}

export interface GameSession<TGameState extends BaseGameState = BaseGameState> {
  id: string; // game-session id
  players: Map<number, Client>; // playerId -> Client
  lastUpdate: number;
  gameLoop?: NodeJS.Timeout;
  game: AuthoritativeGame<TGameState>;
  stateBroadcastCounter: number;
}

// Type alias for Snake-specific session
export type SnakeGameSession = GameSession<SnakeGameState>;

export type AllGameSessions = SnakeGameSession;

export type GameType = 'snake' | 'pacman' | 'mario' | 'tetris';
