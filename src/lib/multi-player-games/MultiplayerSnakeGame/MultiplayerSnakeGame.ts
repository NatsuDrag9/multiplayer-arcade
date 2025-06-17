import { GameEngine } from '../../game-engine/GameEngine';
import {
  DEFAULT_COLORS,
  DIR_DOWN,
  DIR_LEFT,
  DIR_RIGHT,
  DIR_UP,
} from '@/constants/gameConstants';
import {
  GameColors,
  GamePhase,
  RenderConfig,
} from '@/definitions/gameEngineTypes';
import {
  GameDataMessage,
  CommandMessage,
  ConnectionStatus,
  ConnectionMessage,
  StatusMessage,
  PlayerAssignmentData,
  OpponentConnectionData,
} from '@/definitions/connectionTypes';
import { logInDev } from '@/utils/logUtils';
import { MultiplayerSnakeCore } from './MultiplayerSnakeCore';
import {
  MultiplayerSnakeNetwork,
  NetworkConfig,
  NetworkEventCallbacks,
} from './MultiplayerSnakeNetwork';
import { MultiplayerSnakeRenderer } from './MultiplayerSnakeRender';
import {
  MultiplayerGame,
  MultiplayerGameConfig,
  NetworkStats,
} from '@/definitions/snakeGameTypes';
import { WEBSOCKET_URL } from '@/constants/appConstants';
import { isDevMode } from '@/utils/envUtils';

interface MultiplayerSnakeOptions {
  onGameOver?: () => void;
  colors?: GameColors;
  websocketUrl?: string;
  isSpectator?: boolean;
  showDebugInfo?: boolean;
  onScoreUpdate?: (
    p1Score: number,
    p1Lives: number,
    p2Score: number,
    p2Lives: number,
    targetScore: number
  ) => void;
}

export class MultiplayerSnakeGame
  extends GameEngine
  implements MultiplayerGame
{
  // Core components
  private core: MultiplayerSnakeCore; // Optional until we get client and player id from backend
  private network: MultiplayerSnakeNetwork;
  private renderer: MultiplayerSnakeRenderer;
  private onScoreUpdate?: (
    p1Score: number,
    p1Lives: number,
    p2Score: number,
    p2Lives: number,
    targetScore: number
  ) => void;

  // Configuration - Will be set by websocket messages from backend
  private localPlayer = {
    playerId: 0,
    clientId: '',
    sessionId: '',
  };

  private opponentPlayer = {
    playerId: 0,
    clientId: '',
    sessionId: '',
  };

  // UI input from user
  private isSpectator: boolean;

  // External callbacks
  private onGameOver?: () => void;

  // Animation state
  private animationTimer: number = 0;
  private loadingFrame: number = 0;

  constructor(
    canvas: HTMLCanvasElement,
    options: MultiplayerSnakeOptions = {}
  ) {
    super(canvas);

    // Setup configuration
    this.isSpectator = options.isSpectator || false;
    this.onGameOver = options.onGameOver;
    this.onScoreUpdate = options.onScoreUpdate;

    // Initialize game config
    const gameConfig: MultiplayerGameConfig = {
      boardWidth: 320,
      boardHeight: 240,
      targetScore: 10,
      maxPlayers: 2,
    };

    // Initialize network manager
    const networkConfig: NetworkConfig = {
      websocketUrl: options.websocketUrl || WEBSOCKET_URL,
      maxReconnectAttempts: 5,
      reconnectDelay: 2000,
    };

    const networkCallbacks: NetworkEventCallbacks = {
      onConnected: (connectionMessage?: ConnectionMessage) => {
        if (connectionMessage) {
          this.localPlayer.clientId = connectionMessage.id;
        }
      },
      onStatusMessage: (message: StatusMessage) => {
        this.handleStatusMessage(message);
      },
      onDisconnected: () => this.handleNetworkDisconnected(),
      onGameData: (message) => this.handleGameData(message),
      onCommand: (message) => this.handleCommand(message),
      onError: (error) => this.handleNetworkError(error),
    };

    this.network = new MultiplayerSnakeNetwork(networkConfig, networkCallbacks);

    // Initialize core game logic
    this.core = new MultiplayerSnakeCore(
      this.localPlayer.playerId,
      this.localPlayer.clientId,
      gameConfig
    );

    // Initialize renderer
    const renderConfig: RenderConfig = {
      boardWidth: gameConfig.boardWidth,
      boardHeight: gameConfig.boardHeight,
      colors: options.colors || DEFAULT_COLORS,
      showDebugInfo: options.showDebugInfo || false,
      onReconnectRequest: () => this.handleReconnectRequest(),
    };

    this.renderer = new MultiplayerSnakeRenderer(canvas, renderConfig);

    logInDev(
      `MultiplayerSnakeGame initialized for Player ${this.localPlayer.playerId}`
    );
  }

  // GameEngine implementation
  protected async init(): Promise<void> {
    // Set up canvas
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }

    // // Reset base game state
    // this.gameState = {
    //   score: 0,
    //   lives: 1,
    //   paused: false,
    //   gameOver: false,
    // };

    // Reset core game logic
    this.core.reset();

    // Reset animation state
    this.animationTimer = 0;
    this.loadingFrame = 0;

    // Connect to server
    await this.network.connect();

    logInDev('Multiplayer snake game initialized');
  }

  protected update(deltaTime: number): void {
    // Update animation timers
    this.animationTimer += deltaTime;

    // Update loading animation frame
    if (this.animationTimer > 500) {
      this.loadingFrame = (this.loadingFrame + 1) % 8;
      this.animationTimer = 0;
    }

    // Core game logic updates happen in response to server messages
    // No local game loop needed for multiplayer
  }

  protected render(): void {
    if (!this.ctx) return;

    const gamePhase = this.core.getGamePhase();
    const players = this.core.getAllPlayers();
    const food = this.core.getFood();
    const gameStats = this.core.getGameStats();
    const connectionStatus = this.network.getConnectionStatus();
    const networkLatency = this.network.getNetworkLatency();
    const predictedPlayer = this.core.getPredictedLocalPlayer();

    this.renderer.render(
      gamePhase,
      players,
      food,
      gameStats,
      connectionStatus,
      networkLatency,
      this.localPlayer.playerId,
      predictedPlayer,
      this.isSpectator
    );
  }

  protected handleKeyDown(e: KeyboardEvent): void {
    super.handleKeyDown(e);

    // Only handle input if playing and not spectating
    if (this.core.getGamePhase() !== 'playing' || this.isSpectator) return;

    let newDirection: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
        newDirection = DIR_RIGHT;
        break;
      case 'ArrowDown':
        newDirection = DIR_DOWN;
        break;
      case 'ArrowLeft':
        newDirection = DIR_LEFT;
        break;
      case 'ArrowUp':
        newDirection = DIR_UP;
        break;
    }

    if (newDirection !== null && this.core.canChangeDirection(newDirection)) {
      // Add to pending inputs for prediction
      this.core.addPendingInput(newDirection);

      logInDev('Sending newDirection to server: ', newDirection);
      // Send to server
      this.network.sendPlayerInput(newDirection);
    }
  }

  protected handleEscapeKey(): void {
    if (this.onGameOver) {
      this.onGameOver();
    }
    this.cleanup();
  }

  protected cleanup(): void {
    // // Cleanup renderer
    this.renderer.destroy();

    // Cleanup network connection
    this.network.destroy();

    // Reset core state
    this.core.reset();

    // // Reset base game state
    // this.gameState = {
    //   score: 0,
    //   lives: 1,
    //   paused: false,
    //   gameOver: false,
    // };

    logInDev('Multiplayer snake game cleaned up');
  }

  // Network event handlers
  private handleNetworkConnected(): void {
    logInDev('Network connected, sending player ready signal');
  }

  private handleReconnectRequest(): void {
    logInDev('Reconnect button clicked - restarting game');
    this.reconnect();
  }

  private handleStatusMessage(message: StatusMessage): void {
    logInDev('Status message received', message);

    switch (message.status) {
      case 'player_assignment':
        const assignmentData = message.data as PlayerAssignmentData;

        // Update local player info
        this.localPlayer.playerId = assignmentData.playerId;
        this.localPlayer.sessionId = assignmentData.sessionId;

        // Update the core with the real player ID
        this.core.setLocalPlayerId(assignmentData.playerId);

        logInDev(`Player assigned ID: ${assignmentData.playerId}`);
        break;
      case 'opponent_connected':
        const data = message.data as OpponentConnectionData;

        this.opponentPlayer.playerId = data.playerId;
        this.opponentPlayer.sessionId = data.sessionId;
        break;

      case 'opponent_disconnected':
        this.opponentPlayer = {
          playerId: 0,
          clientId: '',
          sessionId: '',
        };
        break;
      default:
        logInDev('Unknown status in StatusMessage', message);
    }

    // Send ready signal after we have a player ID
    if (this.localPlayer.playerId > 0 && !this.isSpectator) {
      logInDev(`Sending player ${this.localPlayer.playerId} ready message`);
      const config = this.core.getConfig();
      this.network.sendPlayerReady(config.targetScore);
    }
  }

  private handleNetworkDisconnected(): void {
    logInDev('Network disconnected');
    // Game continues to render last known state
  }

  private handleGameData(message: GameDataMessage): void {
    switch (message.data_type) {
      case 'game_event':
        this.core.handleGameEvent(message.data);
        break;

      case 'game_state':
        this.core.parsePlayerUpdate(message.data);
        this.updateLocalScore();
        break;

      case 'player_action':
        break;

      default:
        logInDev('Unknown game data type:', message.data_type);
    }
  }

  private handleCommand(message: CommandMessage): void {
    switch (message.command) {
      case 'game_start':
        this.core.setGamePhase('playing');
        logInDev('Game started!');
        break;

      case 'game_end':
        this.core.setGamePhase('ended');
        // this.gameState.gameOver = true;
        logInDev('Game ended');

        // Auto-return to menu after delay
        if (this.onGameOver) {
          setTimeout(() => this.onGameOver!(), 3000);
        }
        break;

      case 'restart':
        this.resetGame();
        break;
      case 'sleep':
        break;
      case 'update':
        break;
      case 'requestGameState':
        this.requestGameState();
        break;

      default:
        logInDev('Unknown command:', message.command);
    }
  }

  private handleNetworkError(error: string): void {
    logInDev('Network error:', error);
    // Could show error message to user
  }

  // Helper methods
  private updateLocalScore(): void {
    if (this.onScoreUpdate) {
      const gameStats = this.core.getGameStats();
      this.onScoreUpdate(
        gameStats.p1Score,
        gameStats.p1Lives,
        gameStats.p2Score,
        gameStats.p2Lives,
        gameStats.targetScore
      );
    }
  }

  // Public API for external control

  public reconnect(): void {
    logInDev('Simple reconnect - restarting game...');

    this.network.connect();
  }

  public isConnected(): boolean {
    return this.network.isConnected();
  }

  public forceDisconnect(): void {
    if (isDevMode()) {
      logInDev('Force disconnect for testing...');
      this.network.disconnect();
    }
  }

  public getGamePhase(): GamePhase {
    return this.core.getGamePhase();
  }

  public getConnectionStatus(): ConnectionStatus {
    return this.network.getConnectionStatus();
  }

  public getNetworkLatency(): number {
    return this.network.getNetworkLatency();
  }

  public getPlayerCount(): number {
    return this.core.getPlayerCount();
  }

  public getLocalClientId(): string {
    return this.localPlayer.clientId;
  }

  public getLocalPlayerId(): number {
    return this.localPlayer.playerId;
  }

  public sendChatMessage(message: string): void {
    this.network.sendChatMessage(message);
  }

  public requestGameState(): void {
    this.network.requestGameState();
  }

  public setDebugMode(enabled: boolean): void {
    this.renderer.updateConfig({ showDebugInfo: enabled });
  }

  // Override pause functionality for multiplayer
  public togglePause(): void {
    // In multiplayer, pause is server-controlled
    logInDev('Pause not available in multiplayer mode');
  }

  public resetGame(): void {
    // In multiplayer, reset is server-controlled
    this.network.requestGameState();
  }

  // Network statistics
  public getNetworkStats(): NetworkStats {
    const networkStats = this.network.getNetworkStats();
    return {
      status: networkStats.status, // ← Make sure this returns the correct status
      gamePhase: this.core.getGamePhase(),
      playerCount: this.core.getPlayerCount(),
      latency: networkStats.latency,
      reconnectAttempts: networkStats.reconnectAttempts,
    };
  }
}
