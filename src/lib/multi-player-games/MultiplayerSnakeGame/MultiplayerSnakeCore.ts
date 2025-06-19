/* eslint-disable no-param-reassign */
import { GamePhase, Position } from '@/definitions/gameEngineTypes';
import { logInDev } from '@/utils/logUtils';
import {
  GameStats,
  MultiplayerGameConfig,
  MultiplayerPlayerState,
} from '@/definitions/snakeGameTypes';
import {
  DIR_DOWN,
  DIR_LEFT,
  DIR_RIGHT,
  DIR_UP,
  SNAKE_GAME_OPPOSITES,
  TILE_SIZE,
} from '@/constants/gameConstants';

export class MultiplayerSnakeCore {
  // Game state
  private players: Map<number, MultiplayerPlayerState> = new Map();
  private food: Position = { x: 0, y: 0 };
  private gamePhase: GamePhase = 'waiting';
  private config: MultiplayerGameConfig;

  // Local player info
  private localPlayerId: number;
  private clientId: string;

  // Client-side prediction
  private predictedLocalPlayer: MultiplayerPlayerState | null = null;
  private pendingInputs: Array<{ direction: number; timestamp: number }> = [];
  private lastInputTime: number = 0;
  private lastProcessedSequence: number = 0; // Track last processed sequence to handle out-of-order messages

  constructor(
    localPlayerId: number,
    clientId: string,
    config: MultiplayerGameConfig
  ) {
    this.localPlayerId = localPlayerId;
    this.clientId = clientId;
    this.config = config;

    logInDev(`MultiplayerSnakeCore initialized for Player ${localPlayerId}`);
  }

  // Game state management
  public reset(): void {
    this.players.clear();
    this.gamePhase = 'waiting';
    this.predictedLocalPlayer = null;
    this.pendingInputs = [];
    this.lastInputTime = 0;
    this.food = { x: 0, y: 0 };

    logInDev('Game state reset');
  }

  public setGamePhase(phase: GamePhase): void {
    const oldPhase = this.gamePhase;
    this.gamePhase = phase;

    if (oldPhase !== phase) {
      logInDev(`Game phase changed: ${oldPhase} → ${phase}`);
    }
  }

  public getGamePhase(): GamePhase {
    return this.gamePhase;
  }

  public getLocalPlayerId(): number {
    return this.localPlayerId;
  }

  public getClientId(): string {
    return this.clientId;
  }

  public getConfig(): MultiplayerGameConfig {
    return { ...this.config };
  }

  public updateConfig(config: MultiplayerGameConfig) {
    this.config = config;
  }

  // Player management
  public updatePlayer(
    playerId: number,
    playerData: Partial<MultiplayerPlayerState>
  ): void {
    const existingPlayer = this.players.get(playerId);

    if (existingPlayer) {
      // Update existing player
      const updatedPlayer = { ...existingPlayer, ...playerData };
      updatedPlayer.body = this.generateBodyFromHead(updatedPlayer);
      this.players.set(playerId, updatedPlayer);
    } else {
      // Create new player
      const newPlayer: MultiplayerPlayerState = {
        id: `player${playerId}`,
        playerId,
        x: 0,
        y: 0,
        direction: DIR_RIGHT,
        length: 1,
        body: [],
        alive: true,
        score: 0,
        ...playerData,
      };
      newPlayer.body = this.generateBodyFromHead(newPlayer);
      this.players.set(playerId, newPlayer);

      logInDev(`Player ${playerId} added/updated`);
    }
  }

  public removePlayer(playerId: number): void {
    if (this.players.delete(playerId)) {
      logInDev(`Player ${playerId} removed`);
    }
  }

  public getPlayer(playerId: number): MultiplayerPlayerState | undefined {
    return this.players.get(playerId);
  }

  public getLocalPlayer(): MultiplayerPlayerState | undefined {
    return this.players.get(this.localPlayerId);
  }

  public getAllPlayers(): MultiplayerPlayerState[] {
    return Array.from(this.players.values());
  }

  public getPlayerCount(): number {
    return this.players.size;
  }

  // Food management
  public setFood(position: Position): void {
    this.food = { ...position };
  }

  public getFood(): Position {
    return { ...this.food };
  }

  // Input handling and prediction
  public canChangeDirection(newDirection: number): boolean {
    logInDev(
      `canChangeDirection called: newDirection=${newDirection}, localPlayerId=${this.localPlayerId}`
    );

    const localPlayer = this.getLocalPlayer();
    if (!localPlayer) {
      logInDev(
        `canChangeDirection: No local player found for ID ${this.localPlayerId}`
      );
      logInDev(
        `Available players: ${Array.from(this.players.keys()).join(', ')}`
      );
      return false;
    }

    if (!localPlayer.alive) {
      logInDev('canChangeDirection: Local player is dead');
      return false;
    }

    // Validate direction (3=up, 0=right, 3=down, 4=left)
    if (newDirection < DIR_RIGHT || newDirection > DIR_UP) return false;

    // Can't reverse into self

    if (newDirection === SNAKE_GAME_OPPOSITES[localPlayer.direction])
      return false;

    // Rate limiting
    const now = Date.now();
    if (now - this.lastInputTime < 50) return false; // Max 20 inputs/second

    logInDev(
      `canChangeDirection: ALLOWED - ${localPlayer.direction} → ${newDirection}`
    );
    return true;
  }

  public addPendingInput(direction: number): void {
    const timestamp = Date.now();
    this.pendingInputs.push({ direction, timestamp });
    this.lastInputTime = timestamp;

    // Keep only recent inputs (1 second window)
    const cutoffTime = timestamp - 1000;
    this.pendingInputs = this.pendingInputs.filter(
      (input) => input.timestamp > cutoffTime
    );

    // Update local prediction immediately for responsiveness
    this.updateLocalPrediction(direction);
  }

  private updateLocalPrediction(direction: number): void {
    const localPlayer = this.getLocalPlayer();
    if (!localPlayer) return;

    if (!this.predictedLocalPlayer) {
      this.predictedLocalPlayer = { ...localPlayer };
    }

    this.predictedLocalPlayer.direction = direction;
  }

  public getPredictedLocalPlayer(): MultiplayerPlayerState | null {
    return this.predictedLocalPlayer ? { ...this.predictedLocalPlayer } : null;
  }

  public reconcileWithServer(): void {
    if (!this.predictedLocalPlayer) return;

    const serverPlayer = this.getLocalPlayer();
    if (!serverPlayer) return;

    // Check for significant position mismatch
    const positionDiff =
      Math.abs(this.predictedLocalPlayer.x - serverPlayer.x) +
      Math.abs(this.predictedLocalPlayer.y - serverPlayer.y);

    if (positionDiff > TILE_SIZE) {
      // Snap to server state
      this.predictedLocalPlayer = { ...serverPlayer };
      this.pendingInputs = [];
      logInDev('Client prediction corrected by server');
    } else {
      // Minor differences - smooth interpolation
      this.predictedLocalPlayer = { ...serverPlayer };
    }
  }

  // Data parsing from server
  public parsePlayerUpdate(data: string): void {
    // This method now primarily handles periodic state synchronization
    // Most real-time updates come through handleGameEvent

    // Parse: "p1:x:45,y:67,len:8,alive:1;p2:x:23,y:34,len:5,alive:1;food:x:12,y:56;scores:4,7"
    const sections = data.split(';');

    sections.forEach((section) => {
      if (section.startsWith('p1:')) {
        this.parsePlayerData(1, section);
      } else if (section.startsWith('p2:')) {
        this.parsePlayerData(2, section);
      } else if (section.startsWith('food:')) {
        this.parseFoodData(section);
      } else if (section.startsWith('scores:')) {
        this.parseScoresData(section);
      }
    });

    // Reconcile prediction after server update
    this.reconcileWithServer();
  }

  private parsePlayerData(playerId: number, data: string): void {
    const parts = data.split(',');
    const playerData: Partial<MultiplayerPlayerState> = {
      x: this.parseValue(parts.find((p) => p.includes('x:'))) || 0,
      y: this.parseValue(parts.find((p) => p.includes('y:'))) || 0,
      direction:
        this.parseValue(parts.find((p) => p.includes('dir:'))) || DIR_RIGHT,
      length: this.parseValue(parts.find((p) => p.includes('len:'))) || 1,
      alive: this.parseValue(parts.find((p) => p.includes('alive:'))) === 1,
    };

    // Convert server coordinates (grid) to client coordinates (pixels)
    if (playerData.x !== undefined) playerData.x *= TILE_SIZE;
    if (playerData.y !== undefined) playerData.y *= TILE_SIZE;

    this.updatePlayer(playerId, playerData);
  }

  private parseFoodData(data: string): void {
    const parts = data.split(',');
    this.food = {
      x: this.parseValue(parts.find((p) => p.includes('x:'))) || 0,
      y: this.parseValue(parts.find((p) => p.includes('y:'))) || 0,
    };
  }

  private parseScoresData(data: string): void {
    const scores = data.replace('scores:', '').split(',');
    scores.forEach((scoreStr, index) => {
      const playerId = index + 1;
      const score = parseInt(scoreStr) || 0;
      const player = this.players.get(playerId);
      if (player) {
        player.score = score;
      }
    });
  }

  private parseValue(str: string | undefined): number {
    if (!str) return 0;
    const match = str.match(/:(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private generateBodyFromHead(player: MultiplayerPlayerState): Position[] {
    const body: Position[] = [];
    for (let i = 0; i < player.length; i++) {
      body.push({
        x: player.x - i * TILE_SIZE,
        y: player.y,
      });
    }
    return body;
  }

  // This method is intended to mutate the player object.
  // Hence, disabled the param no re-assign ESLint rule
  private mutatePlayerPosition(player: MultiplayerPlayerState): void {
    const head = { x: player.x, y: player.y };

    // Move based on direction (same logic as server)
    switch (player.direction) {
      case DIR_UP:
        head.y -= TILE_SIZE;
        break;
      case DIR_RIGHT:
        head.x += TILE_SIZE;
        break;
      case DIR_DOWN:
        head.y += TILE_SIZE;
        break;
      case DIR_LEFT:
        head.x -= TILE_SIZE;
        break;
    }

    // Update player position
    player.x = head.x;
    player.y = head.y;

    // Update body - add new head
    player.body.unshift({ ...head });

    // Remove tail (unless we just ate food)
    if (player.body.length > player.length) {
      player.body.pop();
    }

    // Handle wall wrapping (same as server)
    if (player.x < 0) player.x = (this.config.boardWidth - 1) * TILE_SIZE;
    if (player.x >= this.config.boardWidth * TILE_SIZE) player.x = 0;
    if (player.y < 0) player.y = (this.config.boardHeight - 1) * TILE_SIZE;
    if (player.y >= this.config.boardHeight * TILE_SIZE) player.y = 0;

    // Update body after wrapping
    if (player.body.length > 0) {
      player.body[0].x = player.x;
      player.body[0].y = player.y;
    }
  }

  private handleDirectionChange(
    eventData: Record<string, string | number>
  ): void {
    const playerId = Number(eventData.playerId);
    const direction = Number(eventData.direction);
    const sequence = Number(eventData.sequence);

    if (playerId && direction !== undefined) {
      this.handlePlayerInput(playerId, direction, sequence);
    }
  }

  private handleFoodEaten(eventData: Record<string, string | number>): void {
    const playerId = Number(eventData.playerId);
    const player = this.players.get(playerId);

    if (player) {
      // Increase snake length
      player.length++;
      player.score++;

      // Generate new food position (if provided by server)
      if (
        eventData.newFoodX !== undefined &&
        eventData.newFoodY !== undefined
      ) {
        this.setFood({
          x: Number(eventData.newFoodX) * TILE_SIZE,
          y: Number(eventData.newFoodY) * TILE_SIZE,
        });
      }

      logInDev(
        `Player ${playerId} ate food, new length: ${player.length}, score: ${player.score}`
      );
    }
  }

  private handleCollision(eventData: Record<string, string | number>): void {
    const playerId = Number(eventData.playerId);
    const cause = eventData.cause as string;
    const player = this.players.get(playerId);

    if (player) {
      player.alive = false;
      logInDev(`Player ${playerId} died due to ${cause} collision`);
    }
  }

  // Game events
  public handleGameEvent(eventData: string): void {
    logInDev('Event data: ', eventData);

    try {
      // Parse the JSON string to extract event data
      const parsedEvent: Record<string, string | number> =
        JSON.parse(eventData);
      const eventType = parsedEvent.event;

      // Use switch case based on event type
      switch (eventType) {
        case 'food_eaten':
          logInDev('Food eaten by player: ', parsedEvent.playerId);
          this.handleFoodEaten(parsedEvent);
          break;

        case 'collision':
          logInDev('Player collision: ', parsedEvent);
          logInDev('Collision cause: ', parsedEvent.cause);
          this.handleCollision(parsedEvent);
          break;

        case 'direction_changed':
          logInDev(
            'Direction changed for player: ',
            parsedEvent,
            'New direction: ',
            parsedEvent.direction
          );
          this.handleDirectionChange(parsedEvent);
          break;

        default:
          logInDev('Unknown event type: ', eventType);
          break;
      }
    } catch (error) {
      logInDev('Error parsing event data: ', error);
    }
  }

  public handlePlayerInput(
    playerId: number,
    direction: number,
    sequence: number
  ): void {
    // Ensure inputs are processed in server order
    if (sequence <= this.lastProcessedSequence) {
      logInDev(
        `Ignoring old input sequence ${sequence} (last: ${this.lastProcessedSequence})`
      );
      return;
    }

    this.lastProcessedSequence = sequence;

    const player = this.players.get(playerId);
    if (!player) {
      logInDev(`handlePlayerInput: Player ${playerId} not found`);
      return;
    }

    // Apply the direction change
    player.direction = direction;
    // Simulate the movement
    this.mutatePlayerPosition(player);

    logInDev(
      `Player ${playerId} direction changed to ${direction}, sequence: ${sequence}`
    );
  }

  // Utility methods
  public getLocalPlayerScore(): number {
    const localPlayer = this.getLocalPlayer();
    return localPlayer ? localPlayer.score : 0;
  }

  public setLocalPlayerId(playerId: number): void {
    this.localPlayerId = playerId;
    logInDev(`Local player ID in SnakeCore updated to: ${playerId}`);
  }

  public isLocalPlayerAlive(): boolean {
    const localPlayer = this.getLocalPlayer();
    return localPlayer ? localPlayer.alive : false;
  }

  public getGameStats(): GameStats {
    const player1 = this.players.get(1);
    const player2 = this.players.get(2);

    return {
      p1Score: player1?.score || 0,
      p1Lives: player1?.alive ? 1 : 0,
      p2Score: player2?.score || 0,
      p2Lives: player2?.alive ? 1 : 0,
      targetScore: this.config.targetScore,
    };
  }
}
