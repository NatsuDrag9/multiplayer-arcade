export interface SnakeGameState {
  score: number;
  lives: number;
}

export interface RootState {
  snakeGame: SnakeGameState;
}
