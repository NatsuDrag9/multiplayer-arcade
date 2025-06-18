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

export class AuthoritativeSnakeGame
  implements AuthoritativeGame<SnakeGameState>
{
  private gameState: SnakeGameState;
  private config: GameConfig;
  private eventCallback?: (
    event: string,
    data: Record<string, unknown>
  ) => void;

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
    player.lastInputTime = now;

    this.emitEvent('direction_changed', {
      playerId: player.playerId,
      direction,
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
      this.gameState.scores[player.playerId]++; // ← Use playerId for score
      this.gameState.food = this.generateFood();
      this.emitEvent('food_eaten', { playerId: player.playerId });
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
}
