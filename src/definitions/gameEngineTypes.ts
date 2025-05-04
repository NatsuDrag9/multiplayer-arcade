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
