/* eslint-disable no-param-reassign */
import { PlayerSnakeState, SnakeGameState } from '@/definitions/snakeGameTypes';
import {
  BASE_SPEED,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DIR_DOWN,
  DIR_LEFT,
  DIR_RIGHT,
  DIR_UP,
  MAX_PLAYERS_IN_SESSION,
  SNAKE_GAME_OPPOSITES,
  TARGET_SCORE,
} from '../../../../constants/gameConstants';
import { GameConfig } from '../../../../definitions/gameSessionTypes';
import { AuthoritativeGame } from '../AuthoritativeGame';

export const initialSnakeGameConfig = {
  boardWidth: BOARD_WIDTH,
  boardHeight: BOARD_HEIGHT,
  gameSpeed: BASE_SPEED,
  maxPlayers: MAX_PLAYERS_IN_SESSION,
  targetScore: TARGET_SCORE,
};

/* export class AuthoritativeSnakeGame
  implements AuthoritativeGame<SnakeGameState>
{
  private gameState: SnakeGameState;
  private config: GameConfig;
  private eventCallback?: (
    event: string,
    data: Record<string, unknown>
  ) => void;
  private inputSequence: number = 0;

  constructor(
    config: Partial<GameConfig> = {},
    eventCallback?: (event: string, data: Record<string, unknown>) => void
  ) {
    this.config = {
      ...initialSnakeGameConfig,
      ...config,
    };

    this.eventCallback = eventCallback;

    // Initialize gameState first with a placeholder food
    this.gameState = {
      players: new Map(),
      food: { x: 0, y: 0 }, // Temporary placeholder
      scores: {},
      gamePhase: 'waiting',
      targetScore: this.config.targetScore,
    };

    // Now generate the actual food after gameState is initialized
    this.gameState.food = this.generateFood();
  }

  // Implementation of AuthoritativeGame interface
  addPlayer(
    clientId: string,
    playerId: number
  ): { success: boolean; playerId?: number } {
    if (this.gameState.players.size >= this.config.maxPlayers) {
      return { success: false };
    }

    const startX = playerId === 1 ? 5 : this.config.boardWidth - 6;
    const startY = Math.floor(this.config.boardHeight / 2);

    this.gameState.players.set(clientId, {
      id: clientId,
      playerId,
      x: startX,
      y: startY,
      direction: playerId === 1 ? DIR_RIGHT : DIR_LEFT, // right : left
      length: 3,
      body: [
        { x: startX, y: startY },
        { x: startX - (playerId === 1 ? 1 : -1), y: startY },
        { x: startX - (playerId === 1 ? 2 : -2), y: startY },
      ],
      alive: true,
      lastInputTime: Date.now(),
    });

    this.gameState.scores[playerId] = 0;

    // Status = player_assignment conveys this to the client
    // this.emitEvent('player_joined', { playerId });

    return { success: true, playerId };
  }

  removePlayer(clientId: string): void {
    const player = this.gameState.players.get(clientId);
    if (!player) return;

    const playerId = player.playerId;

    this.gameState.players.delete(clientId);
    delete this.gameState.scores[playerId];

    // Handled by endGame() in gameSessionManagement.ts and handleDisconnect in websocket.ts
    // this.emitEvent('player_left', { playerId });

    if (this.gameState.gamePhase === 'playing') {
      this.endGame();
    }
  }

  processPlayerInput(clientId: string, input: unknown): boolean {
    // Type guard for input validation
    if (typeof input !== 'number') return false;

    const direction = input;
    const player = this.gameState.players.get(clientId);
    if (!player || !player.alive || this.gameState.gamePhase !== 'playing') {
      return false;
    }

    // Validate direction
    if (direction < DIR_RIGHT || direction > DIR_UP) return false;

    // Validate direction change (can't reverse into self)
    if (direction === SNAKE_GAME_OPPOSITES[player.direction]) return false;

    // Anti-cheat: Rate limiting
    const now = Date.now();
    if (now - player.lastInputTime < 50) return false;

    player.direction = direction;
    this.inputSequence++;
    player.lastInputTime = now;

    this.emitEvent('direction_changed', {
      playerId: player.playerId,
      direction,
      sequence: this.inputSequence,
    });

    return true;
  }

  startGame(): void {
    if (this.gameState.gamePhase !== 'waiting') return;

    this.gameState.gamePhase = 'playing';
    // Removed game_started event emission - handled by gameSessionManagement

    console.log(
      'Snake game started with',
      this.gameState.players.size,
      'players'
    );
  }

  tick(): void {
    if (this.gameState.gamePhase === 'playing') {
      this.gameLoop();
    }
  }

  forceEndGame(): void {
    this.endGame();
  }

  // Type-safe state access methods
  getGameState(): SnakeGameState {
    return { ...this.gameState }; // Return deep copy
  }

  getGamePhase(): SnakeGameState['gamePhase'] {
    return this.gameState.gamePhase;
  }

  getPlayerCount(): number {
    return this.gameState.players.size;
  }

  isGameActive(): boolean {
    return this.gameState.gamePhase === 'playing';
  }

  getTargetScore(): number {
    return this.config.targetScore;
  }

  formatGameStateData(): string {
    const players = Array.from(this.gameState.players.entries()); // Get [clientId, player] pairs
    const p1Entry = players.find(
      ([_clientId, player]) => player.playerId === 1
    );
    const p2Entry = players.find(
      ([_clientId, player]) => player.playerId === 2
    );

    const p1Data = p1Entry
      ? `p1:x:${p1Entry[1].x},y:${p1Entry[1].y},dir:${p1Entry[1].direction},len:${p1Entry[1].length},alive:${p1Entry[1].alive ? 1 : 0}`
      : 'p1:x:0,y:0,dir:0,len:0,alive:0';

    const p2Data = p2Entry
      ? `p2:x:${p2Entry[1].x},y:${p2Entry[1].y},dir:${p2Entry[1].direction},len:${p2Entry[1].length},alive:${p2Entry[1].alive ? 1 : 0}`
      : 'p2:x:0,y:0,dir:0,len:0,alive:0';

    const foodData = `food:x:${this.gameState.food.x},y:${this.gameState.food.y}`;

    // Get scores using playerId
    const scores = players.map(
      ([_clientId, player]) => this.gameState.scores[player.playerId] || 0
    );
    const scoresData = `scores:${scores.join(',')}`;

    return `${p1Data};${p2Data};${foodData};${scoresData}`;
  }

  // Private methods - emits raw events only
  private emitEvent(event: string, data: Record<string, unknown>): void {
    if (this.eventCallback) {
      this.eventCallback(event, data);
    }
  }

  private endGame(): void {
    this.gameState.gamePhase = 'ended';
    // Removed game_ended event emission - handled by gameSessionManagement

    console.log('Snake game ended');
  }

  private gameLoop(): void {
    for (const [clientId, player] of this.gameState.players) {
      if (!player.alive) continue;

      this.movePlayer(player);
      this.checkCollisions(player, clientId);
    }

    // Check win conditions
    const alivePlayers = Array.from(this.gameState.players.values()).filter(
      (p) => p.alive
    );
    const hasScoreWinner = Object.values(this.gameState.scores).some(
      (score) => score >= this.gameState.targetScore
    );

    if (alivePlayers.length <= 1 || hasScoreWinner) {
      this.endGame();
      return;
    }
  }

  private movePlayer(player: PlayerSnakeState): void {
    const head = { x: player.x, y: player.y };

    // Calculate new head position based on direction
    switch (player.direction) {
      case DIR_UP:
        head.y--;
        break; // up
      case DIR_RIGHT:
        head.x++;
        break; // right
      case DIR_DOWN:
        head.y++;
        break; // down
      case DIR_LEFT:
        head.x--;
        break; // left
    }

    // Update player position
    player.x = head.x;
    player.y = head.y;

    // Add new head to body
    player.body.unshift({ ...head });

    // Remove tail (unless we just ate food)
    if (player.body.length > player.length) {
      player.body.pop();
    }
  }

  private checkCollisions(player: PlayerSnakeState, clientId: string): void {
    // Wall wrapping instead of collision
    if (player.x < 0) {
      player.x = this.config.boardWidth - 1;
    } else if (player.x >= this.config.boardWidth) {
      player.x = 0;
    }

    if (player.y < 0) {
      player.y = this.config.boardHeight - 1;
    } else if (player.y >= this.config.boardHeight) {
      player.y = 0;
    }

    // Update the head position in the body after wrapping
    if (player.body.length > 0) {
      player.body[0].x = player.x;
      player.body[0].y = player.y;
    }

    // Self collision (check against body except head)
    for (let i = 1; i < player.body.length; i++) {
      if (player.x === player.body[i].x && player.y === player.body[i].y) {
        player.alive = false;
        this.emitEvent('collision', {
          playerId: player.playerId,
          cause: 'self',
        });
        return;
      }
    }

    // Other player collision
    for (const [otherClientId, otherPlayer] of this.gameState.players) {
      if (otherClientId === clientId || !otherPlayer.alive) continue;

      for (const segment of otherPlayer.body) {
        if (player.x === segment.x && player.y === segment.y) {
          player.alive = false;
          this.emitEvent('collision', {
            playerId: player.playerId,
            cause: 'opponent',
          });
          return;
        }
      }
    }

    // Food collision
    if (
      player.x === this.gameState.food.x &&
      player.y === this.gameState.food.y
    ) {
      player.length++;
      this.gameState.scores[player.playerId]++; // Use playerId for score
      this.gameState.food = this.generateFood();
      this.emitEvent('food_eaten', {
        playerId: player.playerId,
        newFoodX: this.gameState.food.x, // Send new food position to server
        newFoodY: this.gameState.food.y,
      });
    }
  }

  private generateFood(): { x: number; y: number } {
    let food;
    let attempts = 0;

    do {
      food = {
        x: Math.floor(Math.random() * this.config.boardWidth),
        y: Math.floor(Math.random() * this.config.boardHeight),
      };
      attempts++;
    } while (this.isFoodOnSnake(food) && attempts < 100);

    return food;
  }

  private isFoodOnSnake(food: { x: number; y: number }): boolean {
    for (const player of this.gameState.players.values()) {
      for (const segment of player.body) {
        if (food.x === segment.x && food.y === segment.y) {
          return true;
        }
      }
    }
    return false;
  }
} */

// Fixed AuthoritativeSnakeGame.ts with diagonal starting positions and slower start

export class AuthoritativeSnakeGame
  implements AuthoritativeGame<SnakeGameState>
{
  private gameState: SnakeGameState;
  private config: GameConfig;
  private eventCallback?: (
    event: string,
    data: Record<string, unknown>
  ) => void;
  private inputSequence: number = 0;

  // Game timing control
  private gameSpeed: number = 250; // Start slower (250ms per move)
  private baseSpeed: number = 100; // Target speed
  private speedIncrement: number = 3; // Speed increase per tick
  private tickCounter: number = 0;

  // Game operates in 8-pixel units
  private readonly BASE_TILE_SIZE = 8;

  constructor(
    config: Partial<GameConfig> = {},
    eventCallback?: (event: string, data: Record<string, unknown>) => void
  ) {
    this.config = {
      ...initialSnakeGameConfig,
      ...config,
    };

    this.eventCallback = eventCallback;

    // Initialize gameState - all coordinates in 8-pixel units
    this.gameState = {
      players: new Map(),
      food: { x: 0, y: 0 },
      scores: {},
      gamePhase: 'waiting',
      targetScore: this.config.targetScore,
    };

    // Generate food in 8-pixel grid coordinates
    this.gameState.food = this.generateFood();

    console.log(
      `AuthoritativeSnakeGame initialized: ${this.config.boardWidth}x${this.config.boardHeight} tiles (8px units)`
    );
  }

  // Add player with optimized starting positions for 40x30 grid
  addPlayer(
    clientId: string,
    playerId: number
  ): { success: boolean; playerId?: number } {
    if (this.gameState.players.size >= this.config.maxPlayers) {
      return { success: false };
    }

    // Diagonal starting positions with maximum separation
    const startPositions = {
      1: {
        x: 2,
        y: 2,
        direction: DIR_RIGHT, // Move away from opponent
        length: 1,
      },
      2: {
        x: 37,
        y: 27,
        direction: DIR_LEFT, // Move away from opponent
        length: 1,
      },
    };

    const position = startPositions[playerId as 1 | 2];
    if (!position) {
      return { success: false };
    }

    console.log(
      `Adding Player ${playerId} at grid position (${position.x}, ${position.y}) facing direction ${position.direction}`
    );

    this.gameState.players.set(clientId, {
      id: clientId,
      playerId,
      x: position.x,
      y: position.y,
      direction: position.direction,
      length: position.length,
      body: [
        { x: position.x, y: position.y }, // Just the head initially
      ],
      alive: true,
      lastInputTime: Date.now(),
    });

    this.gameState.scores[playerId] = 0;

    console.log(
      `Player ${playerId} separation: ${this.calculatePlayerSeparation()} tiles`
    );

    return { success: true, playerId };
  }

  // Calculate initial separation between players (for debugging)
  private calculatePlayerSeparation(): number {
    const players = Array.from(this.gameState.players.values());
    if (players.length < 2) return 0;

    const p1 = players.find((p) => p.playerId === 1);
    const p2 = players.find((p) => p.playerId === 2);

    if (!p1 || !p2) return 0;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  removePlayer(clientId: string): void {
    const player = this.gameState.players.get(clientId);
    if (!player) return;

    const playerId = player.playerId;
    this.gameState.players.delete(clientId);
    delete this.gameState.scores[playerId];

    console.log(`Player ${playerId} removed from game`);

    if (this.gameState.gamePhase === 'playing') {
      this.endGame();
    }
  }

  processPlayerInput(clientId: string, input: unknown): boolean {
    if (typeof input !== 'number') return false;

    const direction = input;
    const player = this.gameState.players.get(clientId);
    if (!player || !player.alive || this.gameState.gamePhase !== 'playing') {
      return false;
    }

    // Validate direction
    if (direction < DIR_RIGHT || direction > DIR_UP) return false;

    // Prevent reversing into self
    if (direction === SNAKE_GAME_OPPOSITES[player.direction]) return false;

    // Rate limiting
    const now = Date.now();
    if (now - player.lastInputTime < 50) return false;

    player.direction = direction;
    this.inputSequence++;
    player.lastInputTime = now;

    console.log(`Player ${player.playerId} changed direction to ${direction}`);

    this.emitEvent('direction_changed', {
      playerId: player.playerId,
      direction,
      sequence: this.inputSequence,
    });

    return true;
  }

  startGame(): void {
    if (this.gameState.gamePhase !== 'waiting') return;

    this.gameState.gamePhase = 'playing';
    this.tickCounter = 0;
    this.gameSpeed = 250; // Reset to slower start speed

    console.log(
      `Snake game started with ${this.gameState.players.size} players`
    );
    console.log(
      `Initial separation: ${this.calculatePlayerSeparation().toFixed(1)} tiles`
    );
  }

  tick(): void {
    if (this.gameState.gamePhase === 'playing') {
      this.gameLoop();
    }
  }

  forceEndGame(): void {
    this.endGame();
  }

  getGameState(): SnakeGameState {
    return { ...this.gameState };
  }

  getGamePhase(): SnakeGameState['gamePhase'] {
    return this.gameState.gamePhase;
  }

  getPlayerCount(): number {
    return this.gameState.players.size;
  }

  isGameActive(): boolean {
    return this.gameState.gamePhase === 'playing';
  }

  getTargetScore(): number {
    return this.config.targetScore;
  }

  // Format game state data - coordinates in 8-pixel units
  formatGameStateData(): string {
    const players = Array.from(this.gameState.players.entries());
    const p1Entry = players.find(
      ([_clientId, player]) => player.playerId === 1
    );
    const p2Entry = players.find(
      ([_clientId, player]) => player.playerId === 2
    );

    // Send coordinates in 8-pixel units (grid coordinates)
    // const p1Data = p1Entry
    //   ? `p1:x:${p1Entry[1].x},y:${p1Entry[1].y},dir:${p1Entry[1].direction},len:${p1Entry[1].length},alive:${p1Entry[1].alive ? 1 : 0}`
    //   : 'p1:x:0,y:0,dir:0,len:0,alive:0';

    // const p2Data = p2Entry
    //   ? `p2:x:${p2Entry[1].x},y:${p2Entry[1].y},dir:${p2Entry[1].direction},len:${p2Entry[1].length},alive:${p2Entry[1].alive ? 1 : 0}`
    //   : 'p2:x:0,y:0,dir:0,len:0,alive:0';

    // Send non-movement data in 8-pixel units
    const p1Data = p1Entry
      ? `p1:len:${p1Entry[1].length},alive:${p1Entry[1].alive ? 1 : 0}`
      : 'p1:len:0,alive:0';

    const p2Data = p2Entry
      ? `p2:len:${p2Entry[1].length},alive:${p2Entry[1].alive ? 1 : 0}`
      : 'p2:len:0,alive:0';

    // Food coordinates in 8-pixel units
    const foodData = `food:x:${this.gameState.food.x},y:${this.gameState.food.y}`;

    const scores = players.map(
      ([_clientId, player]) => this.gameState.scores[player.playerId] || 0
    );
    const scoresData = `scores:${scores.join(',')}`;

    return `${p1Data};${p2Data};${foodData};${scoresData}`;
  }

  // Private game logic methods
  private emitEvent(event: string, data: Record<string, unknown>): void {
    if (this.eventCallback) {
      this.eventCallback(event, data);
    }
  }

  private endGame(): void {
    this.gameState.gamePhase = 'ended';
    console.log('Snake game ended');
  }

  private gameLoop(): void {
    // this.tickCounter++;

    // // Gradually increase speed every 10 ticks
    // if (this.tickCounter % 10 === 0 && this.gameSpeed > this.baseSpeed) {
    //   this.gameSpeed = Math.max(
    //     this.baseSpeed,
    //     this.gameSpeed - this.speedIncrement
    //   );
    //   console.log(`Game speed increased to ${this.gameSpeed}ms per tick`);
    // }

    for (const [clientId, player] of this.gameState.players) {
      if (!player.alive) continue;

      this.movePlayer(player);
      this.checkCollisions(player, clientId);
    }

    // Check win conditions
    const alivePlayers = Array.from(this.gameState.players.values()).filter(
      (p) => p.alive
    );
    const hasScoreWinner = Object.values(this.gameState.scores).some(
      (score) => score >= this.gameState.targetScore
    );

    if (alivePlayers.length <= 1 || hasScoreWinner) {
      const winner =
        alivePlayers.length === 1
          ? alivePlayers[0].playerId
          : Object.entries(this.gameState.scores).reduce((a, b) =>
              a[1] > b[1] ? a : b
            )[0];
      console.log(`Game ending - Winner: Player ${winner}`);
      this.endGame();
      return;
    }
  }

  private movePlayer(player: PlayerSnakeState): void {
    const oldX = player.x;
    const oldY = player.y;
    const oldDirection = player.direction;

    // Move by 1 grid unit
    switch (player.direction) {
      case DIR_UP:
        player.y--;
        break;
      case DIR_RIGHT:
        player.x++;
        break;
      case DIR_DOWN:
        player.y++;
        break;
      case DIR_LEFT:
        player.x--;
        break;
    }

    // Handle wrapping IMMEDIATELY after movement
    let wrappedX = false;
    let wrappedY = false;

    if (player.x < 0) {
      console.log(
        `[SERVER] Player ${player.playerId} wrapped LEFT: ${player.x} → ${this.config.boardWidth - 1}`
      );
      player.x = this.config.boardWidth - 1;
      wrappedX = true;
    } else if (player.x >= this.config.boardWidth) {
      console.log(
        `[SERVER] Player ${player.playerId} wrapped RIGHT: ${player.x} → 0`
      );
      player.x = 0;
      wrappedX = true;
    }

    if (player.y < 0) {
      console.log(
        `[SERVER] Player ${player.playerId} wrapped UP: ${player.y} → ${this.config.boardHeight - 1}`
      );
      player.y = this.config.boardHeight - 1;
      wrappedY = true;
    } else if (player.y >= this.config.boardHeight) {
      console.log(
        `[SERVER] Player ${player.playerId} wrapped DOWN: ${player.y} → 0`
      );
      player.y = 0;
      wrappedY = true;
    }

    // Add new head to body  wrapping is complete
    player.body.unshift({ x: player.x, y: player.y });

    // Remove tail unless we just ate food
    if (player.body.length > player.length) {
      player.body.pop();
    }

    // Calculate jump correctly for wrapped movement
    let jumpX, jumpY;
    if (wrappedX) {
      jumpX = 1; // Wrapping is logically a 1-tile move
    } else {
      jumpX = Math.abs(player.x - oldX);
    }

    if (wrappedY) {
      jumpY = 1; // Wrapping is logically a 1-tile move
    } else {
      jumpY = Math.abs(player.y - oldY);
    }

    // Only flag as bug if it's NOT a wrapping move
    if ((jumpX > 1 || jumpY > 1) && !wrappedX && !wrappedY) {
      console.error(
        `SERVER BUG: Player ${player.playerId} jumped ${jumpX},${jumpY} tiles!`
      );
      console.error(
        `  Movement: (${oldX}, ${oldY}) → (${player.x}, ${player.y}), direction=${oldDirection}`
      );
      console.error(
        `  Board size: ${this.config.boardWidth} x ${this.config.boardHeight}`
      );
    }
  }

  private checkCollisions(player: PlayerSnakeState, clientId: string): void {
    // Self collision (only check if snake is longer than 1)
    if (player.length > 1) {
      for (let i = 1; i < player.body.length; i++) {
        if (player.x === player.body[i].x && player.y === player.body[i].y) {
          player.alive = false;
          console.log(
            `Player ${player.playerId} self collision at (${player.x}, ${player.y})`
          );
          this.emitEvent('collision', {
            playerId: player.playerId,
            cause: 'self',
          });
          return;
        }
      }
    }

    // Other player collision
    for (const [otherClientId, otherPlayer] of this.gameState.players) {
      if (otherClientId === clientId || !otherPlayer.alive) continue;

      for (const segment of otherPlayer.body) {
        if (player.x === segment.x && player.y === segment.y) {
          player.alive = false;
          console.log(
            `Player ${player.playerId} hit Player ${otherPlayer.playerId} at (${player.x}, ${player.y})`
          );
          this.emitEvent('collision', {
            playerId: player.playerId,
            cause: 'opponent',
          });
          return;
        }
      }
    }

    // Food collision
    if (
      player.x === this.gameState.food.x &&
      player.y === this.gameState.food.y
    ) {
      player.length++;
      this.gameState.scores[player.playerId]++;
      const oldFood = { ...this.gameState.food };
      this.gameState.food = this.generateFood();

      console.log(
        `Player ${player.playerId} ate food at (${oldFood.x}, ${oldFood.y}), grew to length ${player.length}, new food at (${this.gameState.food.x}, ${this.gameState.food.y})`
      );

      this.emitEvent('food_eaten', {
        playerId: player.playerId,
        newFoodX: this.gameState.food.x,
        newFoodY: this.gameState.food.y,
      });
    }
  }

  private generateFood(): { x: number; y: number } {
    let food;
    let attempts = 0;

    do {
      // Generate food in grid coordinates (8-pixel units)
      food = {
        x: Math.floor(Math.random() * this.config.boardWidth),
        y: Math.floor(Math.random() * this.config.boardHeight),
      };
      attempts++;
    } while (this.isFoodOnSnake(food) && attempts < 100);

    // If we can't find a spot after 100 attempts, just use the last generated position
    if (attempts >= 100) {
      console.warn('Could not find empty spot for food after 100 attempts');
    }

    return food;
  }

  private isFoodOnSnake(food: { x: number; y: number }): boolean {
    for (const player of this.gameState.players.values()) {
      for (const segment of player.body) {
        if (food.x === segment.x && food.y === segment.y) {
          return true;
        }
      }
    }
    return false;
  }

  // Get current game speed for debugging
  public getCurrentGameSpeed(): number {
    return this.gameSpeed;
  }
}
