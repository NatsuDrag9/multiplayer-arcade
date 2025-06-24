/* eslint-disable no-param-reassign */
import { GamePhase, Position } from '@/definitions/gameEngineTypes';
import { logErrorInDev, logInDev } from '@/utils/logUtils';
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

  // Device info
  private deviceTileSize: number;

  // Movement System - Pure server dependency
  private movementInterval?: NodeJS.Timeout;
  private lastProcessedSequence: number = 0;
  private lastServerReconciliation: number = 0;

  constructor(
    localPlayerId: number,
    clientId: string,
    config: MultiplayerGameConfig,
    deviceTileSize: number
  ) {
    this.localPlayerId = localPlayerId;
    this.clientId = clientId;
    this.config = config;
    this.deviceTileSize = deviceTileSize;

    // Validate device tile size
    if (deviceTileSize % 8 !== 0) {
      throw new Error(
        `Device TILE_SIZE must be multiple of 8, got ${deviceTileSize}`
      );
    }

    logInDev(`MultiplayerSnakeCore initialized for Player ${localPlayerId}`);
  }

  // All players move based on server events
  public startMovementSimulation(): void {
    if (this.movementInterval) {
      clearInterval(this.movementInterval);
    }

    // Move all players at same rate as server (100ms)
    this.movementInterval = setInterval(() => {
      this.moveAllPlayersLocally();
    }, 100);

    logInDev('Movement simulation started for all players');
  }

  public stopMovementSimulation(): void {
    if (this.movementInterval) {
      clearInterval(this.movementInterval);
      this.movementInterval = undefined;
    }
    logInDev('Movement simulation stopped');
  }

  // Move all players locally using identical server logic
  private moveAllPlayersLocally(): void {
    if (this.gamePhase !== 'playing') return;

    this.players.forEach((player) => {
      if (player.alive) {
        this.movePlayerLocally(player);
      }
    });
  }

  // Shared movement logic - identical to server
  private movePlayerLocally(player: MultiplayerPlayerState): void {
    const oldX = player.x;
    const oldY = player.y;

    // Move based on direction using device tile size
    switch (player.direction) {
      case DIR_UP:
        player.y -= this.deviceTileSize;
        break;
      case DIR_RIGHT:
        player.x += this.deviceTileSize;
        break;
      case DIR_DOWN:
        player.y += this.deviceTileSize;
        break;
      case DIR_LEFT:
        player.x -= this.deviceTileSize;
        break;
    }

    // Handle wall wrapping using device coordinates
    const maxX = this.config.boardWidth * this.deviceTileSize;
    const maxY = this.config.boardHeight * this.deviceTileSize;

    let wrapped = false;

    if (player.x < 0) {
      player.x = maxX - this.deviceTileSize;
      wrapped = true;
    } else if (player.x >= maxX) {
      player.x = 0;
      wrapped = true;
    }

    if (player.y < 0) {
      player.y = maxY - this.deviceTileSize;
      wrapped = true;
    } else if (player.y >= maxY) {
      player.y = 0;
      wrapped = true;
    }

    // Update body - add new head, remove tail if needed
    player.body.unshift({ x: player.x, y: player.y });
    if (player.body.length > player.length) {
      player.body.pop();
    }

    if (wrapped) {
      logInDev(
        `Player ${player.playerId} wrapped: (${oldX}, ${oldY}) → (${player.x}, ${player.y})`
      );
    }
  }

  // Game state management
  public reset(): void {
    this.players.clear();
    this.gamePhase = 'waiting';
    this.stopMovementSimulation();
    this.lastProcessedSequence = 0;
    this.lastServerReconciliation = 0;
    this.food = { x: 0, y: 0 };

    logInDev('Game state reset');
  }

  public setGamePhase(phase: GamePhase): void {
    const oldPhase = this.gamePhase;
    this.gamePhase = phase;

    if (oldPhase !== phase) {
      logInDev(`Game phase changed: ${oldPhase} → ${phase}`);

      if (phase === 'playing') {
        this.startMovementSimulation();
      } else {
        this.stopMovementSimulation();
      }
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

  // Player management - Only handle non-movement data
  public updatePlayer(
    playerId: number,
    playerData: Partial<MultiplayerPlayerState>
  ): void {
    const existingPlayer = this.players.get(playerId);

    if (existingPlayer) {
      // Update existing player - only non-movement data
      Object.assign(existingPlayer, playerData);

      // Adjust body length if needed (without changing positions)
      if (existingPlayer.body.length > existingPlayer.length) {
        existingPlayer.body = existingPlayer.body.slice(
          0,
          existingPlayer.length
        );
      }
    } else {
      // Create new player with default starting position
      const startX =
        playerId === 1
          ? 2 * this.deviceTileSize
          : this.config.boardWidth * this.deviceTileSize - 20;
      const startY =
        playerId === 1
          ? 2 * this.deviceTileSize
          : this.config.boardHeight * this.deviceTileSize - 20;

      const newPlayer: MultiplayerPlayerState = {
        id: `player${playerId}`,
        playerId,
        x: startX,
        y: startY,
        direction: playerId === 1 ? DIR_RIGHT : DIR_LEFT,
        length: 1,
        body: [{ x: startX, y: startY }],
        alive: true,
        score: 0,
        ...playerData,
      };

      this.players.set(playerId, newPlayer);
      logInDev(`Player ${playerId} added at (${newPlayer.x}, ${newPlayer.y})`);
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

  // Input validation - still needed for client-side validation
  public canChangeDirection(newDirection: number): boolean {
    const localPlayer = this.getLocalPlayer();
    if (!localPlayer) {
      logInDev('canChangeDirection: No local player found');
      return false;
    }

    if (!localPlayer.alive) {
      logInDev('canChangeDirection: Local player is dead');
      return false;
    }

    // Validate direction
    if (newDirection < DIR_RIGHT || newDirection > DIR_UP) return false;

    // Can't reverse into self
    if (newDirection === SNAKE_GAME_OPPOSITES[localPlayer.direction])
      return false;

    return true;
  }

  // Parse server data - only non-movement data
  public parsePlayerUpdate(data: string): void {
    const sections = data.split(';');

    sections.forEach((section) => {
      if (section.startsWith('p1:')) {
        this.parsePlayerNonMovementData(1, section);
      } else if (section.startsWith('p2:')) {
        this.parsePlayerNonMovementData(2, section);
      } else if (section.startsWith('food:')) {
        this.parseFoodData(section);
      } else if (section.startsWith('scores:')) {
        this.parseScoresData(section);
      }
    });

    // Reconcile non-movement data
    this.reconcileWithServer();
  }

  // Parse only non-movement data (length, alive)
  private parsePlayerNonMovementData(playerId: number, data: string): void {
    const parts = data.split(',');

    const playerData: Partial<MultiplayerPlayerState> = {
      length: this.parseValue(parts.find((p) => p.includes('len:'))) || 1,
      alive: this.parseValue(parts.find((p) => p.includes('alive:'))) === 1,
    };

    this.updatePlayer(playerId, playerData);
  }

  private parseFoodData(data: string): void {
    const parts = data.split(',');
    const serverX = this.parseValue(parts.find((p) => p.includes('x:'))) || 0;
    const serverY = this.parseValue(parts.find((p) => p.includes('y:'))) || 0;

    this.food = {
      x: this.serverToDeviceCoords(serverX),
      y: this.serverToDeviceCoords(serverY),
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

  private serverToDeviceCoords(serverCoord: number): number {
    return serverCoord * this.deviceTileSize;
  }

  // Handle direction_changed events from server
  private handleDirectionChange(
    eventData: Record<string, string | number>
  ): void {
    const playerId = Number(eventData.playerId);
    const direction = Number(eventData.direction);
    const sequence = Number(eventData.sequence);

    // Validate sequence to prevent old/duplicate inputs
    if (sequence <= this.lastProcessedSequence) {
      logInDev(
        `Ignoring old sequence ${sequence} (last: ${this.lastProcessedSequence})`
      );
      return;
    }

    this.lastProcessedSequence = sequence;

    const player = this.players.get(playerId);
    if (!player) {
      logInDev(`Player ${playerId} not found for direction change`);
      return;
    }

    // Apply direction change immediately
    player.direction = direction;
    logInDev(`Player ${playerId} direction changed to ${direction}`);
  }

  private handleFoodEaten(eventData: Record<string, string | number>): void {
    const playerId = Number(eventData.playerId);
    const player = this.players.get(playerId);

    if (player) {
      player.length++;
      player.score++;

      // Update food position
      if (
        eventData.newFoodX !== undefined &&
        eventData.newFoodY !== undefined
      ) {
        const serverX = Number(eventData.newFoodX);
        const serverY = Number(eventData.newFoodY);

        this.setFood({
          x: this.serverToDeviceCoords(serverX),
          y: this.serverToDeviceCoords(serverY),
        });
      }

      logInDev(`Player ${playerId} ate food, new length: ${player.length}`);
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

  // Game events handler
  public handleGameEvent(eventData: string): void {
    try {
      const parsedEvent: Record<string, string | number> =
        JSON.parse(eventData);
      const eventType = parsedEvent.event;

      switch (eventType) {
        case 'direction_changed':
          this.handleDirectionChange(parsedEvent);
          break;

        case 'food_eaten':
          this.handleFoodEaten(parsedEvent);
          break;

        case 'collision':
          this.handleCollision(parsedEvent);
          break;

        default:
          logInDev('Unknown event type:', eventType);
          break;
      }
    } catch (error) {
      logErrorInDev('Error parsing event data:', error);
    }
  }

  // Server reconciliation - only for non-movement data
  public reconcileWithServer(): void {
    const now = Date.now();
    logInDev(
      `[RECONCILIATION] Non-movement data sync (${now - this.lastServerReconciliation}ms since last)`
    );
    this.lastServerReconciliation = now;

    // Check for discrepancies in non-movement data between local and server state
    this.players.forEach((player, playerId) => {
      // Log current player state for debugging
      logInDev(
        `[RECONCILIATION] Player ${playerId}: length=${player.length}, alive=${player.alive}, score=${player.score}`
      );

      // Adjust body length if it doesn't match the length property
      if (player.body.length !== player.length) {
        if (player.body.length > player.length) {
          // Trim excess body segments
          player.body = player.body.slice(0, player.length);
          logInDev(
            `[RECONCILIATION] Trimmed Player ${playerId} body to ${player.length} segments`
          );
        } else if (
          player.body.length < player.length &&
          player.body.length > 0
        ) {
          // Add missing body segments behind the current body
          const lastSegment = player.body[player.body.length - 1];
          while (player.body.length < player.length) {
            // Add segments at the same position as the tail (they'll spread out naturally with movement)
            player.body.push({ x: lastSegment.x, y: lastSegment.y });
          }
          logInDev(
            `[RECONCILIATION] Extended Player ${playerId} body to ${player.length} segments`
          );
        }
      }

      // Validate alive status consistency
      if (!player.alive && player.body.length > 0) {
        logInDev(
          `[RECONCILIATION] Player ${playerId} is dead but still has body segments`
        );
        // Keep the body for visual purposes (dead snake remains visible)
      }
    });
  }
  // Utility methods
  public getLocalPlayerScore(): number {
    const localPlayer = this.getLocalPlayer();
    return localPlayer ? localPlayer.score : 0;
  }

  public setLocalPlayerId(playerId: number): void {
    this.localPlayerId = playerId;
    logInDev(`Local player ID updated to: ${playerId}`);
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

  // Remove prediction methods - no longer needed
  public getPredictedLocalPlayer(): MultiplayerPlayerState | null {
    // Return the actual local player since we no longer do prediction
    return this.getLocalPlayer() || null;
  }
}
