import { GameColors } from '@/definitions/gameEngineTypes';

// Game constants
export const TILE_SIZE = 24;
export const BORDER_OFFSET = 20;
export const GAME_AREA_TOP = 60;
export const BASE_SPEED = 500; // Base speed in ms

// Direction constants
export const DIR_RIGHT = 0;
export const DIR_DOWN = 1;
export const DIR_LEFT = 2;
export const DIR_UP = 3;

export const DEFAULT_COLORS: GameColors = {
  background: 'rgba(0, 0, 0, 100%)',
  border: 'rgba(0, 255, 255, 100%)', // Cyan
  snakeHead: 'rgba(0, 255, 0, 100%)', // Green
  snakeBody: 'rgba(0, 255, 0, 100%)', // Green
  food: 'rgba(255, 0, 0, 100%)', // Red
  text: 'rgba(255, 255, 255, 100%)', // White
};
