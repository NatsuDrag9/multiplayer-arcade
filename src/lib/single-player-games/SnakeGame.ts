import { GameEngine } from '../game-engine/GameEngine';
import { Dispatch } from '@reduxjs/toolkit';
import {
  BASE_SPEED,
  BORDER_OFFSET,
  DIR_DOWN,
  DIR_LEFT,
  DIR_RIGHT,
  DIR_UP,
  GAME_AREA_TOP,
  TILE_SIZE,
} from '../game-engine/constants';
import { updateLives, updateScore } from '@/store/slices/snakeGameSlice';
import { GameColors, Position } from '@/definitions/gameEngineTypes';

interface SnakeGameOptions {
  dispatch?: Dispatch;
  onGameOver?: () => void;
  colors?: GameColors;
}

// Default colors
const DEFAULT_COLORS: GameColors = {
  background: 'rgba(0, 0, 0, 100%)',
  border: 'rgba(0, 255, 255, 100%)', // Cyan
  snakeHead: 'rgba(0, 255, 0, 100%)', // Green
  snakeBody: 'rgba(0, 255, 0, 100%)', // Green
  food: 'rgba(255, 0, 0, 100%)', // Red
  text: 'rgba(255, 255, 255, 100%)', // White
};

export class SnakeGame extends GameEngine {
  // Snake specific state
  private headX: number = 0;
  private headY: number = 0;
  private direction: number = DIR_RIGHT;
  private nextDirection: number = DIR_RIGHT;
  private length: number = 1;
  private body: Position[] = [];
  private food: Position = { x: 0, y: 0 };

  // Animation state
  private headAnimation: boolean = false;
  private lastMoveTime: number = 0;
  private animationTimer: number = 0;
  private gameOverStartTime: number = 0;

  // Additional options
  private dispatch?: Dispatch;
  private onGameOver?: () => void;
  private colors: GameColors;

  constructor(canvas: HTMLCanvasElement, options: SnakeGameOptions = {}) {
    super(canvas);
    this.dispatch = options.dispatch;
    this.onGameOver = options.onGameOver;
    this.colors = options.colors || DEFAULT_COLORS;
  }

  protected init(): void {
    // Set up canvas and context
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false; // Keep pixel art crisp
    }

    // Reset game state
    this.gameState = {
      score: 0,
      lives: 3,
      paused: false,
      gameOver: false,
    };

    // Initialize snake position (center of screen)
    this.headX = Math.floor(this.canvas.width / 2);
    this.headY = Math.floor(this.canvas.height / 2);
    this.direction = DIR_RIGHT;
    this.nextDirection = DIR_RIGHT;
    this.length = 1;

    // Initialize body
    this.body = [
      {
        x: this.headX - TILE_SIZE,
        y: this.headY,
      },
    ];

    // Initialize food
    this.spawnFood();

    // Reset timing
    this.lastMoveTime = 0;
    this.animationTimer = 0;
    this.gameOverStartTime = 0;

    // Update Redux store
    if (this.dispatch) {
      this.dispatch(updateScore(0));
      this.dispatch(updateLives(3));
    }
  }

  protected update(deltaTime: number): void {
    const timestamp = performance.now();

    // Update snake head animation
    this.animationTimer += deltaTime;
    if (this.animationTimer > 500) {
      // Toggle every 500ms
      this.headAnimation = !this.headAnimation;
      this.animationTimer = 0;
    }

    // Calculate current speed based on score
    const currentSpeed = this.calculateSpeed();

    // Move snake at appropriate intervals
    if (timestamp - this.lastMoveTime >= currentSpeed) {
      // Apply buffered direction change
      this.direction = this.nextDirection;

      // Move snake
      this.moveSnake();

      // Check for food collision
      this.checkFoodCollision();

      // Check for self collision
      this.checkCollision();

      this.lastMoveTime = timestamp;
    }

    // Handle game over countdown
    if (this.gameState.gameOver) {
      if (this.gameOverStartTime === 0) {
        this.gameOverStartTime = timestamp;
      }

      const elapsedTime = timestamp - this.gameOverStartTime;
      if (elapsedTime >= 5000 && this.onGameOver) {
        // 5 seconds after game over
        this.onGameOver();
      }
    }
  }

  protected render(): void {
    if (!this.ctx) return;

    // Clear canvas
    this.ctx.fillStyle = this.colors.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw border
    this.ctx.strokeStyle = this.colors.border;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      BORDER_OFFSET,
      GAME_AREA_TOP,
      this.canvas.width - BORDER_OFFSET * 2,
      this.canvas.height - GAME_AREA_TOP - BORDER_OFFSET
    );

    // Draw score and lives
    this.renderStatus();

    // Draw snake
    this.renderSnake();

    // Draw food
    this.renderFood();

    // Draw pause or game over message if needed
    if (this.gameState.gameOver) {
      this.renderGameOver();
    } else if (this.gameState.paused) {
      this.renderPaused();
    }
  }

  private renderStatus(): void {
    if (!this.ctx) return;

    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = '16px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    const statusText = `Score: ${this.gameState.score} Lives: ${this.gameState.lives}`;
    this.ctx.fillText(statusText, 10, 10);
  }

  private renderSnake(): void {
    if (!this.ctx) return;

    // Draw snake body segments
    this.ctx.fillStyle = this.colors.snakeBody;
    for (let i = 0; i < this.length; i++) {
      this.ctx.fillRect(this.body[i].x, this.body[i].y, TILE_SIZE, TILE_SIZE);
    }

    // Draw snake head with proper rotation
    this.ctx.save();
    this.ctx.fillStyle = this.colors.snakeHead;

    // Translate to the center of the head
    this.ctx.translate(this.headX + TILE_SIZE / 2, this.headY + TILE_SIZE / 2);

    // Rotate based on direction
    switch (this.direction) {
      case DIR_RIGHT:
        this.ctx.rotate(0);
        break;
      case DIR_DOWN:
        this.ctx.rotate(Math.PI / 2);
        break;
      case DIR_LEFT:
        this.ctx.rotate(Math.PI);
        break;
      case DIR_UP:
        this.ctx.rotate(-Math.PI / 2);
        break;
    }

    // Draw head at the origin (adjusted for rotation)
    this.ctx.fillRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);

    // Draw eyes (white)
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(
      -TILE_SIZE / 4,
      -TILE_SIZE / 4,
      TILE_SIZE / 6,
      TILE_SIZE / 6
    );
    this.ctx.fillRect(
      TILE_SIZE / 8,
      -TILE_SIZE / 4,
      TILE_SIZE / 6,
      TILE_SIZE / 6
    );

    // Draw pupils (black)
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(
      -TILE_SIZE / 4,
      -TILE_SIZE / 4,
      TILE_SIZE / 12,
      TILE_SIZE / 12
    );
    this.ctx.fillRect(
      TILE_SIZE / 8,
      -TILE_SIZE / 4,
      TILE_SIZE / 12,
      TILE_SIZE / 12
    );

    // Draw tongue if in animation frame
    if (this.headAnimation) {
      this.ctx.fillStyle = 'red';
      this.ctx.fillRect(TILE_SIZE / 2 - 2, 0, TILE_SIZE / 4, TILE_SIZE / 4);
    }

    this.ctx.restore();
  }

  private renderFood(): void {
    if (!this.ctx) return;

    // Draw food as an apple
    this.ctx.fillStyle = this.colors.food;
    this.ctx.beginPath();
    this.ctx.arc(
      this.food.x + TILE_SIZE / 2,
      this.food.y + TILE_SIZE / 2,
      TILE_SIZE / 2,
      0,
      Math.PI * 2
    );
    this.ctx.fill();

    // Draw stem
    this.ctx.fillStyle = 'rgba(0, 100, 0, 100%)'; // Dark green
    this.ctx.fillRect(this.food.x + TILE_SIZE / 2 - 2, this.food.y, 4, 5);
  }

  private renderGameOver(): void {
    if (!this.ctx) return;

    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = '24px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.ctx.fillText(
      'GAME OVER',
      this.canvas.width / 2,
      this.canvas.height / 2
    );

    const elapsed = performance.now() - this.gameOverStartTime;
    if (elapsed > 2000 && elapsed < 5000) {
      this.ctx.font = '16px monospace';
      const countdown = Math.ceil((5000 - elapsed) / 1000);
      this.ctx.fillText(
        `Returning to main menu in: ${countdown}`,
        this.canvas.width / 2,
        this.canvas.height / 2 + 30
      );
    }
  }

  private renderPaused(): void {
    if (!this.ctx) return;

    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = '24px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
  }

  private moveSnake(): void {
    // Calculate new head position
    let newHeadX = this.headX;
    let newHeadY = this.headY;

    switch (this.direction) {
      case DIR_RIGHT:
        newHeadX += TILE_SIZE;
        break;
      case DIR_LEFT:
        newHeadX -= TILE_SIZE;
        break;
      case DIR_UP:
        newHeadY -= TILE_SIZE;
        break;
      case DIR_DOWN:
        newHeadY += TILE_SIZE;
        break;
    }

    // Wrap around screen borders
    if (newHeadX >= this.canvas.width - BORDER_OFFSET) newHeadX = BORDER_OFFSET;
    if (newHeadX < BORDER_OFFSET)
      newHeadX = this.canvas.width - BORDER_OFFSET - TILE_SIZE;
    if (newHeadY >= this.canvas.height - BORDER_OFFSET)
      newHeadY = GAME_AREA_TOP;
    if (newHeadY < GAME_AREA_TOP)
      newHeadY = this.canvas.height - BORDER_OFFSET - TILE_SIZE;

    // Update body segments (move each segment to position of segment in front)
    let prevX = this.headX;
    let prevY = this.headY;
    let tempX, tempY;

    for (let i = 0; i < this.length; i++) {
      tempX = this.body[i].x;
      tempY = this.body[i].y;
      this.body[i] = { x: prevX, y: prevY };

      if (i < this.length - 1) {
        prevX = tempX;
        prevY = tempY;
      }
    }

    // Update head position
    this.headX = newHeadX;
    this.headY = newHeadY;
  }

  private checkFoodCollision(): void {
    if (
      Math.abs(this.headX - this.food.x) < TILE_SIZE &&
      Math.abs(this.headY - this.food.y) < TILE_SIZE
    ) {
      // Grow snake
      this.length++;

      // Add new segment at the end (temporarily at same position as last segment)
      if (this.body.length > 0) {
        const lastSegment = this.body[this.body.length - 1];
        this.body.push({ x: lastSegment.x, y: lastSegment.y });
      } else {
        this.body.push({ x: this.headX, y: this.headY });
      }

      // Update score
      this.gameState.score += 10;
      if (this.dispatch) {
        this.dispatch(updateScore(this.gameState.score));
      }

      // Spawn new food
      this.spawnFood();
    }
  }

  private checkCollision(): void {
    // Check collision with self
    for (let i = 1; i < this.length; i++) {
      if (
        Math.abs(this.headX - this.body[i].x) < TILE_SIZE / 2 &&
        Math.abs(this.headY - this.body[i].y) < TILE_SIZE / 2
      ) {
        // Collision detected
        this.gameState.lives--;

        if (this.dispatch) {
          this.dispatch(updateLives(this.gameState.lives));
        }

        if (this.gameState.lives <= 0) {
          this.gameState.gameOver = true;
          this.gameOverStartTime = performance.now();
        } else {
          // Reset snake but keep score
          this.resetSnake();
        }

        break;
      }
    }
  }

  private resetSnake(): void {
    // Reset snake position but keep score
    this.headX = Math.floor(this.canvas.width / 2);
    this.headY = Math.floor(this.canvas.height / 2);
    this.direction = DIR_RIGHT;
    this.nextDirection = DIR_RIGHT;
    this.length = 1;

    // Reset body
    this.body = [
      {
        x: this.headX - TILE_SIZE,
        y: this.headY,
      },
    ];

    // Spawn new food
    this.spawnFood();
  }

  private spawnFood(): void {
    // Find bounds to spawn food while maintaining distance from borders
    const minX = BORDER_OFFSET + 5;
    const maxX = this.canvas.width - BORDER_OFFSET - TILE_SIZE - 5;
    const minY = GAME_AREA_TOP + 5;
    const maxY = this.canvas.height - BORDER_OFFSET - TILE_SIZE - 5;

    // Align to tile grid
    const gridX = Math.floor((maxX - minX) / TILE_SIZE);
    const gridY = Math.floor((maxY - minY) / TILE_SIZE);

    let newFoodX = minX + Math.floor(Math.random() * gridX) * TILE_SIZE;
    let newFoodY = minY + Math.floor(Math.random() * gridY) * TILE_SIZE;

    // Ensure food doesn't spawn on snake
    let collision;
    do {
      collision = false;

      // Check collision with head
      if (
        Math.abs(newFoodX - this.headX) < TILE_SIZE &&
        Math.abs(newFoodY - this.headY) < TILE_SIZE
      ) {
        collision = true;
      }

      // Check collision with body
      for (let i = 0; i < this.length; i++) {
        if (
          Math.abs(newFoodX - this.body[i].x) < TILE_SIZE &&
          Math.abs(newFoodY - this.body[i].y) < TILE_SIZE
        ) {
          collision = true;
          break;
        }
      }

      if (collision) {
        newFoodX = minX + Math.floor(Math.random() * gridX) * TILE_SIZE;
        newFoodY = minY + Math.floor(Math.random() * gridY) * TILE_SIZE;
      }
    } while (collision);

    this.food = { x: newFoodX, y: newFoodY };
  }

  private calculateSpeed(): number {
    // Every 20 points, reduce delay by 20ms (speed up)
    const speedReduction = Math.floor(this.gameState.score / 20) * 20;
    return Math.max(BASE_SPEED - speedReduction, 100); // Minimum 100ms
  }

  // Override base class method to handle arrow keys for snake movement
  protected handleKeyDown(e: KeyboardEvent): void {
    super.handleKeyDown(e); // Call parent to track keys and handle common keys

    if (this.gameState.gameOver || this.gameState.paused) return;

    // Handle snake movement
    switch (e.key) {
      case 'ArrowRight':
        if (this.direction !== DIR_LEFT) {
          this.nextDirection = DIR_RIGHT;
        }
        break;
      case 'ArrowDown':
        if (this.direction !== DIR_UP) {
          this.nextDirection = DIR_DOWN;
        }
        break;
      case 'ArrowLeft':
        if (this.direction !== DIR_RIGHT) {
          this.nextDirection = DIR_LEFT;
        }
        break;
      case 'ArrowUp':
        if (this.direction !== DIR_DOWN) {
          this.nextDirection = DIR_UP;
        }
        break;
    }
  }

  // Return to main menu
  protected handleEscapeKey(): void {
    if (this.onGameOver) {
      this.onGameOver();
    }
  }

  protected cleanup(): void {
    // Reset all game state
    this.headX = 0;
    this.headY = 0;
    this.direction = DIR_RIGHT;
    this.nextDirection = DIR_RIGHT;
    this.length = 1;
    this.body = [];
    this.food = { x: 0, y: 0 };
    this.lastMoveTime = 0;
    this.animationTimer = 0;
    this.gameOverStartTime = 0;

    // Reset game state
    this.gameState = {
      score: 0,
      lives: 3,
      paused: false,
      gameOver: false,
    };

    // Update Redux store
    if (this.dispatch) {
      this.dispatch(updateScore(0));
      this.dispatch(updateLives(3));
    }
  }
}
