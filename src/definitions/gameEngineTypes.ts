export interface GameState {
  score: number;
  lives: number;
  paused: boolean;
  gameOver: boolean;
}

export interface GameColors {
  background: string;
  border: string;
  snakeHead: string;
  snakeBody: string;
  food: string;
  text: string;
}

export interface Position {
  x: number;
  y: number;
}

export type GamePhase = 'waiting' | 'playing' | 'ended';

export interface RenderConfig {
  boardWidth: number;
  boardHeight: number;
  colors: GameColors;
  showDebugInfo: boolean;
  onReconnectRequest?: () => void;
}

export interface ControlItem {
  key: string;
  action: string;
  onClick?: () => void;
}
