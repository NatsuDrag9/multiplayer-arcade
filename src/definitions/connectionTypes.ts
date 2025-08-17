export type ClientType = 'esp32' | 'web' | 'mobile'; // Client type to determine serialization method

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export type StatusMessageCardType = 'error' | 'warning' | 'info' | 'success';

export type PlayerAssignmentColor = 'blue' | 'green';

export type StatusMessageType =
  | 'tile_size_response'
  | 'player_assignment'
  | 'opponent_connected'
  | 'opponent_disconnected'
  | 'session_timeout';

// Server response to tile size validation
export type TileSizeResponseType = 'tile_size_accepted' | 'tile_size_rejected';

export type GameDataMessageType =
  | 'game_event'
  | 'game_data'
  | 'player_action'
  | 'game_state';

export type CommandMessageType =
  | 'game_restart'
  | 'sleep'
  | 'update'
  | 'game_start'
  | 'game_end'
  | 'getClients'
  | 'getSessionStats'
  | 'requestGameState';

export interface BaseMessage {
  type: string;
  timestamp?: number;
}

export interface ConnectionMessage extends BaseMessage {
  type: 'connection';
  id: string;
  message: string;
}

export interface TileSizeValidationMessage extends BaseMessage {
  type: 'tile_size_validation';
  tileSize: number; // Must be multiple of 8
}

export interface EchoMessage extends BaseMessage {
  type: 'echo';
  message: unknown;
}

export interface BroadcastMessage extends BaseMessage {
  type: 'broadcast';
  from?: string;
  message: unknown;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  message: string;
}

export interface SuccessMessage extends BaseMessage {
  type: 'success';
  message: string;
}

export interface PingMessage extends BaseMessage {
  type: 'ping';
}

export interface CommandMessage extends BaseMessage {
  type: 'command';
  command: CommandMessageType | string;
  parameters?: Record<string, string | number | boolean>;
  data?: string;
  sessionId?: string;
}

export interface ChatMessage extends BaseMessage {
  type: 'chat_message';
  message: string;
}

// Game data message (replaces SensorDataMessage)
export interface GameDataMessage extends BaseMessage {
  type: 'game_data_message';
  data_type: GameDataMessageType; // "player_move", "game_state", etc.
  data: string; // Game payload (JSON string or simple string)
  player_id?: string; // Player/client identifier
  metadata?: string; // Additional metadata
  clientId?: string; // Source client ID
  sessionId?: string; // Game session ID
}

// Client list message
export interface ClientListMessage extends BaseMessage {
  type: 'clientList';
  clients: Array<{
    id: string;
    type: ClientType;
    playerId?: number;
    gameSessionId?: string;
  }>;
}

// Status Message
export interface StatusMessage {
  type: 'status';
  status: StatusMessageType;
  message: string;
  data:
    | SessionTimeoutData
    | PlayerAssignmentData
    | TileSizeResponseType
    | string;
  timestamp?: number;
}

// Session stats message
export interface SessionStatsMessage extends BaseMessage {
  type: 'session_stats';
  data: {
    totalSessions: number;
    activeSessions: number;
    waitingSessions: number;
    totalPlayers: number;
  };
}

// Union type for all possible messages
export type GameMessage =
  | ConnectionMessage
  | TileSizeValidationMessage
  | EchoMessage
  | BroadcastMessage
  | ErrorMessage
  | SuccessMessage
  | PingMessage
  | CommandMessage
  | GameDataMessage
  | ClientListMessage
  | ChatMessage
  | SessionStatsMessage
  | StatusMessage;

export interface PlayerAssignmentData {
  playerId: number;
  sessionId: string;
  playerCount: number;
  color: PlayerAssignmentColor;
}

export interface OpponentConnectionData {
  playerId: number;
  sessionId: string;
  playerCount: number;
  color: PlayerAssignmentColor;
}

export interface SessionTimeoutData {
  sessionId: string;
}

export interface TileSizeValidation {
  valid: boolean;
  reason?: string;
}

// Type guards for message types
export function isGameDataMessage(
  message: GameMessage
): message is GameDataMessage {
  return message.type === 'game_data_message';
}

export function isCommandMessage(
  message: GameMessage
): message is CommandMessage {
  return message.type === 'command';
}

export function isChatMessage(message: GameMessage): message is ChatMessage {
  return message.type === 'chat_message';
}

export function isErrorMessage(message: GameMessage): message is ErrorMessage {
  return message.type === 'error';
}

// Simple tile size validation
export function validateTileSize(tileSize: number): TileSizeValidation {
  if (!Number.isInteger(tileSize) || tileSize <= 0) {
    return { valid: false, reason: 'TILE_SIZE must be a positive integer' };
  }

  if (tileSize % 8 !== 0) {
    return {
      valid: false,
      reason: `TILE_SIZE must be multiple of 8, got ${tileSize}`,
    };
  }

  return { valid: true };
}

// Message handler interface for type safety
export interface MessageHandlers {
  onCommand?: (message: CommandMessage, clientId: string) => void;
  onGameData?: (
    message: GameDataMessage,
    clientId: string,
    clientType: ClientType
  ) => void;
  onChat?: (message: ChatMessage, clientId: string) => void;
  onConnection?: (message: ConnectionMessage, clientId: string) => void;
  onTileSizeValidation?: (
    message: TileSizeValidationMessage | null,
    validation: TileSizeValidation,
    clientId: string
  ) => void;
  onStatus?: (message: StatusMessage, clientId: string) => void;
  onClientList?: (message: ClientListMessage, clientId: string) => void;
  onSessionStats?: (message: SessionStatsMessage, clientId: string) => void;
  onError?: (message: GameMessage, clientId: string) => void;
  onSuccess?: (message: GameMessage, clientId: string) => void;
  onPing?: (message: GameMessage, clientId: string) => void;
  onEcho?: (message: GameMessage, clientId: string) => void;
  onBroadcast?: (message: GameMessage, clientId: string) => void;
  onUnknown?: (message: GameMessage, clientId: string) => void;
}
