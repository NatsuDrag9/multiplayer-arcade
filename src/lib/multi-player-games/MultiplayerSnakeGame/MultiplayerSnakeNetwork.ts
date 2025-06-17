import {
  GameDataMessage,
  CommandMessage,
  GameMessage,
  ConnectionStatus,
  ConnectionMessage,
  StatusMessage,
  PlayerAssignmentData,
  ChatMessage,
} from '@/definitions/connectionTypes';
import { logErrorInDev, logInDev } from '@/utils/logUtils';

export interface NetworkConfig {
  websocketUrl: string;
  maxReconnectAttempts: number;
  reconnectDelay: number;
}

export interface NetworkEventCallbacks {
  onConnected?: (message?: ConnectionMessage) => void;
  onStatusMessage?: (message: StatusMessage) => void;
  onDisconnected?: () => void;
  onGameData?: (message: GameDataMessage) => void;
  onCommand?: (message: CommandMessage) => void;
  onError?: (error: string) => void;
}

export class MultiplayerSnakeNetwork {
  private ws: WebSocket | null = null;
  private config: NetworkConfig;
  private callbacks: NetworkEventCallbacks;

  // Connection state
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectAttempts: number = 0;
  private lastServerUpdate: number = 0;
  private networkLatency: number = 0;
  private pingInterval?: NodeJS.Timeout;

  // Connection guards to prevent multiple connections
  private isConnecting: boolean = false;
  private isDestroyed: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  // Client info - assigned via websocket messages from backend
  private clientId!: string;
  private playerId!: number;

  constructor(config: NetworkConfig, callbacks: NetworkEventCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;

    logInDev(`NetworkManager initialized with URL: ${config.websocketUrl}`);
  }

  // Connection management
  public async connect(): Promise<void> {
    // Prevent multiple simultaneous connections
    if (this.isDestroyed) {
      logInDev('Cannot connect: NetworkManager is destroyed');
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      logInDev('Already connected, skipping duplicate connection');
      return;
    }

    if (this.isConnecting) {
      logInDev('Connection already in progress, waiting...');
      return this.connectionPromise || Promise.resolve();
    }

    // Lock connection process
    this.isConnecting = true;
    this.connectionStatus = 'connecting';

    logInDev(`Starting WebSocket connection to ${this.config.websocketUrl}`);

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        // Clean up any existing connection first
        this.cleanupWebSocket();

        this.ws = new WebSocket(this.config.websocketUrl);
        this.setupEventHandlers(resolve, reject);
      } catch (error) {
        logErrorInDev('Failed to create WebSocket:', error);
        this.connectionStatus = 'disconnected';
        this.isConnecting = false;
        this.callbacks.onError?.('Failed to create WebSocket connection');
        reject(error);
      }
    });

    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  public disconnect(): void {
    logInDev('Manually disconnecting from server');
    this.cleanup();
  }

  public isConnected(): boolean {
    return (
      this.connectionStatus === 'connected' &&
      this.ws?.readyState === WebSocket.OPEN &&
      !this.isDestroyed
    );
  }

  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  public getNetworkLatency(): number {
    return this.networkLatency;
  }

  // Message sending methods
  public sendPlayerReady(targetScore: number): void {
    if (this.playerId) {
      const message: GameDataMessage = {
        type: 'game_data_message',
        data_type: 'game_event',
        data: `target_score:${targetScore}`,
        player_id: this.playerId.toString(),
        clientId: this.clientId,
        timestamp: Date.now(),
      };

      this.sendMessage(message);
      logInDev(`Player ${this.playerId} ready message sent`);
    } else {
      logErrorInDev('Failed to send player ready as playerId is undefined');
    }
  }

  public sendPlayerInput(direction: number): void {
    if (!this.isConnected()) return;

    const message: GameDataMessage = {
      type: 'game_data_message',
      data_type: 'player_action',
      data: `direction:${direction}`,
      player_id: this.playerId.toString(),
      clientId: this.clientId,
      timestamp: Date.now(),
    };

    this.sendMessage(message);
    logInDev(`Input sent: direction ${direction}`);
  }

  public sendChatMessage(chatText: string): void {
    const message: ChatMessage = {
      type: 'chat_message',
      message: chatText,
      timestamp: Date.now(),
    };

    this.sendMessage(message);
    logInDev(`Chat message sent: ${chatText}`);
  }

  public requestGameState(): void {
    const message: GameDataMessage = {
      type: 'game_data_message',
      data_type: 'game_state',
      data: 'full_state',
      player_id: this.playerId.toString(),
      clientId: this.clientId,
      timestamp: Date.now(),
    };

    this.sendMessage(message);
    logInDev('Game state requested');
  }

  private sendMessage(message: GameMessage): void {
    if (!this.isConnected()) {
      logErrorInDev('Cannot send message: not connected');
      this.callbacks.onError?.('Cannot send message: not connected to server');
      return;
    }

    try {
      this.ws!.send(JSON.stringify(message));
    } catch (error) {
      logErrorInDev('Failed to send message:', error);
      this.callbacks.onError?.(
        error instanceof Error
          ? `Send failed: ${error.message}`
          : 'Failed to send message'
      );
    }
  }

  // Event handlers with proper promise resolution
  private setupEventHandlers(
    resolve: () => void,
    reject: (error: Event) => void
  ): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      if (this.isDestroyed) {
        logInDev('Connection opened but NetworkManager is destroyed, closing');
        this.ws?.close();
        return;
      }

      logInDev('Connected to multiplayer server');
      this.connectionStatus = 'connected';
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.lastServerUpdate = Date.now();

      resolve(); // Resolve the connection promise
    };

    this.ws.onmessage = (event) => {
      if (!this.isDestroyed) {
        this.handleMessage(event.data);
      }
    };

    this.ws.onclose = (event) => {
      logInDev(`WebSocket closed: ${event.code} - ${event.reason}`);
      this.connectionStatus = 'disconnected';
      this.isConnecting = false;
      this.stopPingMonitoring();

      if (this.isDestroyed) {
        logInDev('Connection closed after destruction, not reconnecting');
        return;
      }

      if (event.code !== 1000) {
        this.callbacks.onError?.(
          `Connection closed unexpectedly: ${event.reason || 'Unknown reason'}`
        );
      }

      this.callbacks.onDisconnected?.();

      // Attempt reconnection if not manually disconnected
      if (
        event.code !== 1000 &&
        this.reconnectAttempts < this.config.maxReconnectAttempts
      ) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      logErrorInDev('WebSocket error:', error);
      this.connectionStatus = 'disconnected';
      this.isConnecting = false;
      this.callbacks.onError?.('WebSocket connection error');
      reject(error); // Reject the connection promise
    };
  }

  private handleMessage(data: string): void {
    this.lastServerUpdate = Date.now();

    try {
      const message: GameMessage = JSON.parse(data);
      this.routeMessage(message);
    } catch (error) {
      logErrorInDev('Failed to parse server message:', error);
      logInDev('data:', data);
      this.callbacks.onError?.('Invalid message format');
    }
  }

  private routeMessage(message: GameMessage): void {
    switch (message.type) {
      case 'game_data_message':
        this.callbacks.onGameData?.(message as GameDataMessage);
        break;

      case 'command':
        this.callbacks.onCommand?.(message as CommandMessage);
        break;

      case 'connection':
        this.clientId = message.id;
        const connectionMessage: ConnectionMessage = {
          type: 'connection',
          id: this.clientId,
          message: 'Acknowledge game server connection',
          timestamp: Date.now(),
        };
        this.sendMessage(connectionMessage);
        logInDev('Connection handshake completed');
        this.callbacks.onConnected?.(message as ConnectionMessage);
        break;

      case 'status':
        if (message.status === 'player_assignment') {
          this.playerId = (message.data as PlayerAssignmentData).playerId;
          logInDev(`Assigned as Player ${this.playerId}`);
        }
        // this.playerId needs to be assigned first as the callback calls sendPlayerReady which uses it.
        this.callbacks.onStatusMessage?.(message as StatusMessage);
        break;

      case 'error':
        logErrorInDev('Server error:', message.message);
        this.callbacks.onError?.(message.message);
        break;

      case 'ping':
        this.handlePing();
        break;

      default:
        logInDev('Unknown message type:', message.type);
    }
  }

  private handlePing(): void {
    const now = Date.now();
    if (this.lastServerUpdate > 0) {
      this.networkLatency = now - this.lastServerUpdate;
    }

    const pongMessage = {
      type: 'ping',
      timestamp: now,
    };

    this.sendMessage(pongMessage as GameMessage);
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed) return;

    const delay =
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts);

    logInDev(
      `Scheduling reconnection attempt ${this.reconnectAttempts + 1}/${this.config.maxReconnectAttempts} in ${delay}ms`
    );

    setTimeout(() => {
      if (this.isDestroyed) return;

      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
        this.callbacks.onError?.(
          `Failed to reconnect after ${this.config.maxReconnectAttempts} attempts`
        );
        return;
      }
      this.connect();
    }, delay);
  }

  private startPingMonitoring(): void {
    this.pingInterval = setInterval(() => {
      this.checkConnectionHealth();
    }, 5000);
  }

  private stopPingMonitoring(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  private checkConnectionHealth(): void {
    if (this.isDestroyed) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastServerUpdate;

    if (timeSinceLastUpdate > 10000 && this.connectionStatus === 'connected') {
      logInDev('Connection appears to be lost (no server updates)');
      this.connectionStatus = 'disconnected';
      this.callbacks.onDisconnected?.();

      if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    }
  }

  // Improved cleanup with proper WebSocket cleanup
  private cleanupWebSocket(): void {
    if (this.ws) {
      // Remove all event listeners to prevent ghost events
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;

      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close(1000, 'Client cleanup');
      }

      this.ws = null;
    }
  }

  private cleanup(): void {
    logInDev('Cleaning up NetworkManager');

    this.stopPingMonitoring();
    this.cleanupWebSocket();

    this.connectionStatus = 'disconnected';
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.lastServerUpdate = 0;
    this.networkLatency = 0;
    this.connectionPromise = null;
  }

  public destroy(): void {
    logInDev('Destroying NetworkManager');

    this.isDestroyed = true; // Mark as destroyed to prevent any new operations
    this.cleanup();
  }

  // Network status
  public getNetworkStats(): {
    status: ConnectionStatus;
    latency: number;
    reconnectAttempts: number;
    lastUpdate: number;
  } {
    return {
      status: this.connectionStatus,
      latency: this.networkLatency,
      reconnectAttempts: this.reconnectAttempts,
      lastUpdate: this.lastServerUpdate,
    };
  }
}
