export type ClientType = 'esp32' | 'web' | 'mobile'; // Client type to determine serialization method

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export type StatusMessageType = 'error' | 'warning' | 'info' | 'success';

// export type MessageType =
//   | 'connection'
//   | 'echo'
//   | 'broadcast'
//   | 'error'
//   | 'ping'
//   | 'command';

export type GameMessageType = 'game_data' | 'player_action' | 'game_state';

export interface BaseMessage {
  type: string;
  timestamp?: number;
}

export interface ConnectionMessage extends BaseMessage {
  type: 'connection';
  id: string;
  message: string;
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

export interface PingMessage extends BaseMessage {
  type: 'ping';
}

export interface CommandMessage extends BaseMessage {
  type: 'command';
  command: 'restart' | 'sleep' | 'update' | string;
  parameters?: Record<string, string | number | boolean>;
}

export interface ChatMessage extends BaseMessage {
  type: 'chat_message';
  message: string;
}

// Game data message (replaces SensorDataMessage)
export interface GameDataMessage extends BaseMessage {
  type: GameMessageType;
  data_type: string; // "player_move", "game_state", etc.
  data: string; // Game payload (JSON string or simple string)
  player_id?: string; // Player/client identifier
  metadata?: string; // Additional metadata
  clientId?: string; // Source client ID
}

// Client list message
export interface ClientListMessage extends BaseMessage {
  type: 'clientList';
  clients: Array<{
    id: string;
    type: ClientType;
  }>;
}

export type GameMessage =
  | ConnectionMessage
  | EchoMessage
  | BroadcastMessage
  | ErrorMessage
  | PingMessage
  | CommandMessage
  | GameDataMessage
  | ClientListMessage
  | ChatMessage;
