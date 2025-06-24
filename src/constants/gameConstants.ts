import { GameColors } from '@/definitions/gameEngineTypes';

// Game constants
export const TILE_SIZE_BASE = 8; // Base constraint: All TILE_SIZE values must be multiples of 8
export const TILE_SIZE_WEB_APP = 16;
export const BORDER_OFFSET = 20;
export const GAME_AREA_TOP = 60;
export const BASE_SPEED = 500; // Base speed in ms
export const BOARD_WIDTH = 40; // Server's virtual board width
export const BOARD_HEIGHT = 30; // Server's virtual board height
export const MAX_PLAYERS_IN_SESSION = 2; // Max players per session
export const TARGET_SCORE = 100;

// Direction constants
export const DIR_RIGHT = 0;
export const DIR_DOWN = 1;
export const DIR_LEFT = 2;
export const DIR_UP = 3;

// Snake Game Constants
export const SNAKE_GAME_OPPOSITES: Record<number, number> = {
  [DIR_RIGHT]: DIR_LEFT, // 0: 2 (right ↔ left)
  [DIR_DOWN]: DIR_UP, // 1: 3 (down ↔ up)
  [DIR_LEFT]: DIR_RIGHT, // 2: 0 (left ↔ right) ← FIXED!
  [DIR_UP]: DIR_DOWN, // 3: 1 (up ↔ down)
};

export const DEFAULT_COLORS: GameColors = {
  background: 'rgba(0, 0, 0, 100%)',
  border: 'rgba(0, 255, 255, 100%)', // Cyan
  snakeHead: 'rgba(0, 120, 0, 100%)', // Green
  snakeBody: 'rgba(0, 255, 0, 100%)', // Green
  food: 'rgba(255, 0, 0, 100%)', // Red
  text: 'rgba(255, 255, 255, 100%)', // White
};
