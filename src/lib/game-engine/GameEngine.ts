import { GameState } from '@/definitions/gameEngineTypes';

export abstract class GameEngine {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D | null;
  protected lastFrameTime: number = 0;
  protected animationFrameId: number = 0;
  protected gameState: GameState;

  // Keep track of which keys are currently pressed
  protected keysPressed: Set<string> = new Set();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Make sure canvas is properly sized
    this.resizeCanvas();

    // Set up initial game state
    this.gameState = {
      score: 0,
      lives: 3,
      paused: false,
      gameOver: false,
    };

    // Set up event listeners
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
    window.addEventListener('resize', this.resizeCanvas.bind(this));
  }

  // Make sure canvas is properly sized
  private resizeCanvas(): void {
    if (this.canvas) {
      this.canvas.width = this.canvas.clientWidth;
      this.canvas.height = this.canvas.clientHeight;
    }
  }

  // Game Loop
  protected gameLoop(timestamp: number): void {
    // Calculate delta time
    if (!this.lastFrameTime) {
      this.lastFrameTime = timestamp;
    }
    const deltaTime = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    // Only update game logic if not paused and not game over
    if (!this.gameState.paused && !this.gameState.gameOver) {
      this.update(deltaTime);
    }

    // Always render
    this.render();

    // Continue game loop
    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  // Start the game
  public start(): void {
    this.init();
    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  // Stop the game
  public stop(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.cleanup();

    // Remove event listeners
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));
    window.removeEventListener('resize', this.resizeCanvas.bind(this));
  }

  // Toggle pause state
  public togglePause(): void {
    this.gameState.paused = !this.gameState.paused;
  }

  // Reset the game
  public resetGame(): void {
    this.cleanup();
    this.init();
  }

  // Handle keyboard input
  protected handleKeyDown(e: KeyboardEvent): void {
    this.keysPressed.add(e.key);

    // Common key handling for all games
    switch (e.key) {
      case ' ': // Space bar
        if (!this.gameState.gameOver) {
          this.togglePause();
        }
        break;
      case 'r': // r key
      case 'R': // R key
        if (!this.gameState.gameOver) {
          this.resetGame();
        }
        break;
      case 'Escape': // Escape key
        // This could trigger a return to main menu
        this.handleEscapeKey();
        break;
    }
  }

  protected handleKeyUp(e: KeyboardEvent): void {
    this.keysPressed.delete(e.key);
  }

  // Check if a key is currently pressed
  protected isKeyPressed(key: string): boolean {
    return this.keysPressed.has(key);
  }

  // Abstract methods to be implemented by specific games
  protected abstract init(): void;
  protected abstract update(deltaTime: number): void;
  protected abstract render(): void;
  protected abstract cleanup(): void;
  protected abstract handleEscapeKey(): void;

  // Getters for game state
  public getScore(): number {
    return this.gameState.score;
  }

  public getLives(): number {
    return this.gameState.lives;
  }

  public isPaused(): boolean {
    return this.gameState.paused;
  }

  public isGameOver(): boolean {
    return this.gameState.gameOver;
  }
}
