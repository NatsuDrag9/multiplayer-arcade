import {
  GamePhase,
  Position,
  RenderConfig,
} from '@/definitions/gameEngineTypes';
import {
  GameStats,
  MultiplayerPlayerState,
} from '@/definitions/snakeGameTypes';
import {
  ConnectionStatus,
  PlayerAssignmentColor,
} from '@/definitions/connectionTypes';
import { logInDev } from '@/utils/logUtils';

export class MultiplayerSnakeRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;
  private canvas: HTMLCanvasElement;
  private reconnectButtonArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;
  private boundHandleCanvasClick: (event: MouseEvent) => void; // Store the bound function reference
  private deviceTileSize: number;
  private playerOneColor = '';
  private playerTwoColor = '';

  constructor(
    canvas: HTMLCanvasElement,
    config: RenderConfig,
    deviceTileSize: number
  ) {
    this.canvas = canvas;
    // Set canvas dimensions
    this.canvas.width = config.boardWidth * deviceTileSize;
    this.canvas.height = config.boardHeight * deviceTileSize;

    this.ctx = canvas.getContext('2d')!;
    this.config = config;
    this.deviceTileSize = deviceTileSize;

    // Set up canvas for pixel-perfect rendering
    this.ctx.imageSmoothingEnabled = false;

    // Add click listener for reconnect button
    this.boundHandleCanvasClick = this.handleCanvasClick.bind(this);
    this.canvas.addEventListener('click', this.boundHandleCanvasClick);
  }

  public updateConfig(config: Partial<RenderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Clean up event listeners
  public destroy(): void {
    logInDev('Destroying MultiplayerSnakeRenderer');
    // Remove event listeners
    this.canvas.removeEventListener('click', this.boundHandleCanvasClick);

    // Clear canvas
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    logInDev('MultiplayerSnakeRenderer destroyed');

    // Clear references
    this.reconnectButtonArea = null;

    // Remove canvas focus (if it has it)
    if (document.activeElement === this.canvas) {
      this.canvas.blur();
    }

    // Reset canvas cursor (if you change it)
    this.canvas.style.cursor = 'default';
  }

  // Main render method
  public render(
    gamePhase: GamePhase,
    players: MultiplayerPlayerState[],
    food: Position,
    gameStats: GameStats,
    connectionStatus: ConnectionStatus,
    networkLatency: number,
    localPlayerId: number,
    predictedPlayer?: MultiplayerPlayerState | null,
    isSpectator: boolean = false
  ): void {
    // Clear canvas
    this.clearCanvas();

    switch (gamePhase) {
      case 'waiting':
        this.renderWaitingScreen(connectionStatus, localPlayerId, isSpectator);
        break;

      case 'playing':
        this.renderGameplay(
          players,
          food,
          gameStats,
          localPlayerId,
          predictedPlayer
        );
        break;

      case 'ended':
        this.renderGameplay(
          players,
          food,
          gameStats,
          localPlayerId,
          predictedPlayer
        );
        this.renderGameOver(gameStats);
        break;
    }

    // Always render connection status and debug info
    this.renderConnectionStatus(connectionStatus, networkLatency);

    if (this.config.showDebugInfo) {
      this.renderDebugInfo(players, networkLatency, localPlayerId);
    }
  }

  public setPlayerOneColor(color: PlayerAssignmentColor) {
    this.playerOneColor = color;
  }

  public setPlayerTwoColor(color: PlayerAssignmentColor) {
    this.playerTwoColor = color;
  }

  // Render player color
  private renderPlayerColor(
    isPlayerOne: boolean,
    x: number,
    y: number,
    radius: number = 8
  ) {
    // Determine player color based on whether it's playerId
    const playerColor = isPlayerOne ? this.playerOneColor : this.playerTwoColor;

    this.ctx.fillStyle = playerColor;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // Screen rendering methods
  private renderWaitingScreen(
    connectionStatus: ConnectionStatus,
    localPlayerId: number,
    isSpectator: boolean
  ): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    this.ctx.fillStyle = this.config.colors.text;
    this.ctx.font = '16px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    switch (connectionStatus) {
      case 'connecting':
        this.ctx.fillText('Connecting to server...', centerX, centerY);
        break;

      case 'connected':
        this.ctx.fillText('Waiting for opponent...', centerX, centerY);

        this.ctx.font = '12px monospace';
        const playerText = `You are Player ${localPlayerId}`;
        this.ctx.fillText(playerText, centerX, centerY + 20);

        const textWidth = this.ctx.measureText(playerText).width;

        this.renderPlayerColor(
          localPlayerId === 1,
          textWidth + 280,
          centerY + 17
        );

        if (isSpectator) {
          this.ctx.fillText('(Spectator Mode)', centerX, centerY + 35);
        }
        break;

      case 'disconnected':
        this.ctx.fillText('Connection failed', centerX, centerY);
        this.ctx.font = '12px monospace';
        this.ctx.fillText('Click to reconnect...', centerX, centerY + 20);
        this.renderReconnectButton(centerX, centerY + 50);
        break;
        break;
    }
  }

  private renderGameplay(
    players: MultiplayerPlayerState[],
    food: Position,
    gameStats: GameStats,
    localPlayerId: number,
    predictedPlayer?: MultiplayerPlayerState | null
  ): void {
    // Draw border
    this.renderBorder();

    // Draw game elements
    this.renderPlayerId(localPlayerId);
    this.renderStatus(gameStats);
    this.renderFood(food);
    this.renderPlayers(players, localPlayerId, predictedPlayer);
  }

  private renderGameOver(gameStats: GameStats): void {
    // Semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    this.ctx.fillStyle = this.config.colors.text;
    this.ctx.font = '18px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.ctx.fillText('GAME OVER', centerX, centerY);

    // Show final scores
    this.ctx.font = '12px monospace';
    this.ctx.fillText(
      `Final - P1: ${gameStats.p1Score} | P2: ${gameStats.p2Score}`,
      centerX,
      centerY + 20
    );

    // Determine and show winner
    const winnerText = this.getWinnerText(gameStats);
    this.ctx.fillText(winnerText, centerX, centerY + 35);
  }

  // Game element rendering
  private renderBorder(): void {
    this.ctx.strokeStyle = this.config.colors.border;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(5, 25, this.canvas.width - 10, this.canvas.height - 30);
  }

  private renderStatus(gameStats: GameStats): void {
    this.ctx.fillStyle = this.config.colors.text;
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    // const statusText = `P1: ${gameStats.p1Score} | P2: ${gameStats.p2Score} | Target: ${gameStats.targetScore}`;
    const statusText = `Target: ${gameStats.targetScore === 0 ? '-' : gameStats.targetScore}`;
    this.ctx.fillText(statusText, this.canvas.width - 90, 8);
  }

  private renderPlayerId(localPlayerId: number): void {
    this.ctx.fillStyle = this.config.colors.text;
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    const playerText = `You are Player ${localPlayerId}`;
    this.ctx.fillText(playerText, 8, 8);

    // Render small color indicator next to the text
    const textWidth = this.ctx.measureText(playerText).width;
    this.renderPlayerColor(localPlayerId === 1, 8 + textWidth + 15, 12, 6);
  }

  private renderPlayers(
    players: MultiplayerPlayerState[],
    localPlayerId: number,
    predictedPlayer?: MultiplayerPlayerState | null
  ): void {
    players.forEach((player) => {
      if (!player.alive) return;

      const isLocalPlayer = player.playerId === localPlayerId;

      // FIX: Use predicted state for local player if available, otherwise use server state
      const renderPlayer =
        isLocalPlayer && predictedPlayer ? predictedPlayer : player;

      // Show prediction indicator for debugging
      if (isLocalPlayer && predictedPlayer && this.config.showDebugInfo) {
        const serverPlayer = player;
        const driftX = Math.abs(predictedPlayer.x - serverPlayer.x);
        const driftY = Math.abs(predictedPlayer.y - serverPlayer.y);

        if (driftX > 0 || driftY > 0) {
          // Draw server position as ghost
          this.ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
          this.ctx.fillRect(
            serverPlayer.x,
            serverPlayer.y,
            this.deviceTileSize,
            this.deviceTileSize
          );
        }
      }

      // Player colors
      const isPlayerOne = player.playerId === 1;
      const headColor = isPlayerOne
        ? this.config.colors.snakeHead
        : 'rgba(0, 0, 255, 100%)'; // Blue for opponent

      const bodyColor = isPlayerOne
        ? this.config.colors.snakeBody
        : 'rgba(0, 100, 255, 100%)'; // Darker blue for opponent body

      // Render body segments (skip head)
      this.ctx.fillStyle = bodyColor;
      renderPlayer.body.forEach((segment, index) => {
        if (index === 0) return; // Skip head
        this.ctx.fillRect(
          segment.x,
          segment.y,
          this.deviceTileSize,
          this.deviceTileSize
        );
      });

      // Render head
      this.ctx.fillStyle = headColor;
      this.ctx.fillRect(
        renderPlayer.x,
        renderPlayer.y,
        this.deviceTileSize,
        this.deviceTileSize
      );

      // FIX: Draw prediction border for local player
      if (isLocalPlayer && predictedPlayer && this.config.showDebugInfo) {
        this.ctx.strokeStyle = '#00ff00'; // Green border for prediction
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(
          renderPlayer.x,
          renderPlayer.y,
          this.deviceTileSize,
          this.deviceTileSize
        );
      }

      // Draw eyes (white) - relative to head position
      this.ctx.fillStyle = 'white';
      const eyeSize = this.deviceTileSize / 6;
      const eyeOffset = this.deviceTileSize / 8;

      // Top eye
      this.ctx.fillRect(
        renderPlayer.x + eyeOffset,
        renderPlayer.y + eyeOffset,
        eyeSize,
        eyeSize
      );
      // Bottom eye
      this.ctx.fillRect(
        renderPlayer.x + eyeOffset,
        renderPlayer.y + this.deviceTileSize - eyeOffset - eyeSize,
        eyeSize,
        eyeSize
      );

      // Draw pupils (black) - relative to head position
      this.ctx.fillStyle = 'black';
      const pupilSize = eyeSize / 2;

      // Top pupil
      this.ctx.fillRect(
        renderPlayer.x + eyeOffset + pupilSize / 2,
        renderPlayer.y + eyeOffset + pupilSize / 2,
        pupilSize,
        pupilSize
      );
      // Bottom pupil
      this.ctx.fillRect(
        renderPlayer.x + eyeOffset + pupilSize / 2,
        renderPlayer.y +
          this.deviceTileSize -
          eyeOffset -
          eyeSize +
          pupilSize / 2,
        pupilSize,
        pupilSize
      );
    });
  }
  private renderFood(food: Position): void {
    // Draw food as an apple
    this.ctx.fillStyle = this.config.colors.food;
    this.ctx.beginPath();
    this.ctx.arc(
      food.x + this.deviceTileSize / 2,
      food.y + this.deviceTileSize / 2,
      this.deviceTileSize / 2,
      0,
      Math.PI * 2
    );
    this.ctx.fill();

    // Draw stem
    this.ctx.fillStyle = 'rgba(0, 100, 0, 100%)'; // Dark green
    this.ctx.fillRect(food.x + this.deviceTileSize / 2 - 1, food.y, 2, 3);
  }

  private renderConnectionStatus(
    connectionStatus: ConnectionStatus,
    networkLatency: number
  ): void {
    // Connection indicator (top right corner)
    const indicatorSize = 6;
    const x = this.canvas.width - indicatorSize - 5;
    const y = 5;

    let color: string;
    switch (connectionStatus) {
      case 'connected':
        color = '#00ff00'; // Green
        break;
      case 'connecting':
        color = '#ffff00'; // Yellow
        break;
      case 'disconnected':
        color = '#ff0000'; // Red
        break;
    }

    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, indicatorSize, indicatorSize);

    // Network latency (if connected)
    if (networkLatency > 0 && connectionStatus === 'connected') {
      this.ctx.fillStyle = this.config.colors.text;
      this.ctx.font = '8px monospace';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(`${networkLatency}ms`, x - 2, y + indicatorSize + 10);
    }
  }

  private renderDebugInfo(
    players: MultiplayerPlayerState[],
    networkLatency: number,
    localPlayerId: number
  ): void {
    const debugY = this.canvas.height - 60;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, debugY, this.canvas.width, 60);

    this.ctx.fillStyle = '#ffff00';
    this.ctx.font = '8px monospace';
    this.ctx.textAlign = 'left';

    let y = debugY + 10;
    this.ctx.fillText(`Players: ${players.length}`, 5, y);

    y += 10;
    this.ctx.fillText(`Local ID: ${localPlayerId}`, 5, y);

    y += 10;
    this.ctx.fillText(`Latency: ${networkLatency}ms`, 5, y);

    // Player positions
    y += 10;
    players.forEach((player, index) => {
      if (y < this.canvas.height - 5) {
        this.ctx.fillText(
          `P${player.playerId}: (${player.x},${player.y}) L:${player.length}`,
          5 + index * 80,
          y
        );
      }
    });
  }

  private renderReconnectButton(centerX: number, centerY: number): void {
    const buttonWidth = 120;
    const buttonHeight = 30;
    const buttonX = centerX - buttonWidth / 2;
    const buttonY = centerY - buttonHeight / 2;

    // Store button area for click detection
    this.reconnectButtonArea = {
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
    };

    // Draw button background
    this.ctx.fillStyle = '#4CAF50';
    this.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

    // Draw button border
    this.ctx.strokeStyle = '#45a049';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);

    // Draw button text
    this.ctx.fillStyle = 'white';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('Reconnect', centerX, centerY);
  }

  private handleCanvasClick(event: MouseEvent): void {
    if (!this.reconnectButtonArea || !this.config.onReconnectRequest) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Check if click is within button area
    if (
      clickX >= this.reconnectButtonArea.x &&
      clickX <= this.reconnectButtonArea.x + this.reconnectButtonArea.width &&
      clickY >= this.reconnectButtonArea.y &&
      clickY <= this.reconnectButtonArea.y + this.reconnectButtonArea.height
    ) {
      logInDev('Reconnect button clicked');
      this.config.onReconnectRequest();
    }
  }

  // Utility methods
  private clearCanvas(): void {
    this.ctx.fillStyle = this.config.colors.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private getWinnerText(gameStats: GameStats): string {
    if (gameStats.p1Score > gameStats.p2Score) {
      return 'Player 1 Wins!';
    } else if (gameStats.p2Score > gameStats.p1Score) {
      return 'Player 2 Wins!';
    } else {
      return 'Draw!';
    }
  }

  // Animation helpers
  public renderLoadingAnimation(
    centerX: number,
    centerY: number,
    frame: number
  ): void {
    const dots = '.'.repeat((frame % 4) + 1);
    this.ctx.fillStyle = this.config.colors.text;
    this.ctx.font = '14px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Loading${dots}`, centerX, centerY);
  }

  public renderCountdown(count: number): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = '#ffff00';
    this.ctx.font = '24px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    if (count > 0) {
      this.ctx.fillText(count.toString(), centerX, centerY);
    } else {
      this.ctx.fillText('GO!', centerX, centerY);
    }
  }

  // Resize handling
  public handleResize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.imageSmoothingEnabled = false;
  }
}
