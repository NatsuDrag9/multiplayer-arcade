import {
  GameMessage,
  ClientType,
  ChatMessage,
  CommandMessage,
  GameDataMessage,
  ConnectionMessage,
  StatusMessage,
  ClientListMessage,
  SessionStatsMessage,
  BaseMessage,
  isGameDataMessage,
  isCommandMessage,
  isChatMessage,
  TileSizeValidationMessage,
  validateTileSize,
  TileSizeValidation,
} from '../../definitions/connectionTypes';
import { decode } from '@msgpack/msgpack';
import WebSocket from 'ws';

// Type guards for message validation using your interfaces
function isValidBaseMessage(obj: unknown): obj is BaseMessage {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    typeof (obj as Record<string, unknown>).type === 'string'
  );
}

function isValidGameMessage(obj: unknown): obj is GameMessage {
  if (!isValidBaseMessage(obj)) return false;

  const message = obj;

  // Validate timestamp if present
  if (
    'timestamp' in message &&
    message.timestamp !== undefined &&
    typeof message.timestamp !== 'number'
  ) {
    return false;
  }

  // Type-specific validation based on your interfaces
  switch (message.type) {
    case 'connection':
      return (
        'id' in message &&
        'message' in message &&
        typeof message.id === 'string' &&
        typeof message.message === 'string'
      );

    case 'command':
      return (
        'command' in message &&
        typeof message.command === 'string' &&
        (!('parameters' in message) ||
          typeof message.parameters === 'object') &&
        (!('data' in message) || typeof message.data === 'string') &&
        (!('sessionId' in message) || typeof message.sessionId === 'string')
      );

    case 'game_data_message':
      return (
        'data_type' in message &&
        'data' in message &&
        typeof message.data_type === 'string' &&
        typeof message.data === 'string' &&
        (!('player_id' in message) || typeof message.player_id === 'string') &&
        (!('metadata' in message) || typeof message.metadata === 'string') &&
        (!('clientId' in message) || typeof message.clientId === 'string') &&
        (!('sessionId' in message) || typeof message.sessionId === 'string')
      );

    case 'chat_message':
      return 'message' in message && typeof message.message === 'string';

    case 'status':
      return (
        'status' in message &&
        'message' in message &&
        'data' in message &&
        typeof message.status === 'string' &&
        typeof message.message === 'string' &&
        typeof message.data === 'object' &&
        message.data !== null
      );

    case 'clientList':
      return (
        'clients' in message &&
        Array.isArray(message.clients) &&
        message.clients.every(
          (client: unknown) =>
            typeof client === 'object' &&
            client !== null &&
            'id' in client &&
            'type' in client &&
            typeof (client as Record<string, unknown>).id === 'string' &&
            typeof (client as Record<string, unknown>).type === 'string'
        )
      );

    case 'session_stats':
      return (
        'data' in message &&
        typeof message.data === 'object' &&
        message.data !== null &&
        'totalSessions' in (message.data as Record<string, unknown>) &&
        'activeSessions' in (message.data as Record<string, unknown>) &&
        'waitingSessions' in (message.data as Record<string, unknown>) &&
        'totalPlayers' in (message.data as Record<string, unknown>)
      );

    case 'game_state':
      return (
        'data_type' in message &&
        'data' in message &&
        typeof message.data_type === 'string' &&
        typeof message.data === 'string' &&
        (!('sessionId' in message) || typeof message.sessionId === 'string')
      );

    case 'echo':
      return 'message' in message;

    case 'broadcast':
      return (
        'message' in message &&
        (!('from' in message) || typeof message.from === 'string')
      );

    case 'error':
    case 'success':
      return 'message' in message && typeof message.message === 'string';

    case 'ping':
      return true; // No additional fields required

    default:
      // Allow unknown message types but require basic structure
      return true;
  }
}

// Parse and validate incoming message based on client type
export function receiveMessage(
  data: WebSocket.Data,
  clientType: ClientType
): GameMessage | null {
  try {
    let parsedMessage: unknown;

    if (clientType === 'esp32') {
      // Handle MessagePack binary data from ESP32
      if (Buffer.isBuffer(data)) {
        parsedMessage = decode(data);
        console.log(`Received ${data.length} bytes as MessagePack from ESP32`);
      } else if (data instanceof ArrayBuffer) {
        parsedMessage = decode(new Uint8Array(data));
        console.log(
          `Received ${data.byteLength} bytes as ArrayBuffer from ESP32`
        );
      } else {
        console.error(
          'Expected binary data from ESP32 client but received:',
          typeof data
        );
        return null;
      }
    } else {
      // Handle JSON string data from web/mobile clients
      if (typeof data === 'string') {
        parsedMessage = JSON.parse(data) as unknown;
        console.log(`Received ${data.length} chars as JSON from ${clientType}`);
      } else if (Buffer.isBuffer(data)) {
        // Sometimes string data comes as Buffer
        const jsonString = data.toString('utf8');
        parsedMessage = JSON.parse(jsonString) as unknown;
        console.log(
          `Received ${jsonString.length} chars as JSON (from Buffer) from ${clientType}`
        );
      } else {
        console.error(
          `Expected JSON string from ${clientType} client but received:`,
          typeof data
        );
        return null;
      }
    }

    // Validate the parsed message structure
    if (!isValidGameMessage(parsedMessage)) {
      console.error('Invalid message structure:', parsedMessage);
      return null;
    }

    // Add timestamp if missing
    if (!parsedMessage.timestamp) {
      (parsedMessage as GameMessage).timestamp = Date.now();
    }

    console.log(
      `Successfully parsed ${parsedMessage.type} message from ${clientType} client`
    );
    return parsedMessage as GameMessage;
  } catch (error) {
    console.error(`Failed to parse message from ${clientType} client:`, error);
    console.error('Raw data:', data);
    return null;
  }
}

// Type-specific message parsers using your type guards and interfaces
export function parseCommandMessage(
  message: GameMessage
): CommandMessage | null {
  return isCommandMessage(message) ? message : null;
}

export function parseGameDataMessage(
  message: GameMessage
): GameDataMessage | null {
  return isGameDataMessage(message) ? message : null;
}

export function parseChatMessage(message: GameMessage): ChatMessage | null {
  return isChatMessage(message) ? message : null;
}

export function parseConnectionMessage(
  message: GameMessage
): ConnectionMessage | null {
  if (message.type !== 'connection') return null;

  const msg = message;
  if (
    !('id' in msg) ||
    !('message' in msg) ||
    typeof msg.id !== 'string' ||
    typeof msg.message !== 'string'
  ) {
    return null;
  }

  return message as ConnectionMessage;
}

export function parseTileSizeValidationMessage(
  message: TileSizeValidationMessage
): {
  validation: TileSizeValidation;
  message: TileSizeValidationMessage | null;
} {
  // Validate tile size
  const validation = validateTileSize(message.tileSize);

  return {
    validation,
    message: validation.valid ? message : null,
  };
}

export function parseStatusMessage(message: GameMessage): StatusMessage | null {
  if (message.type !== 'status') return null;

  const msg = message;
  if (
    !('status' in msg) ||
    !('message' in msg) ||
    !('data' in msg) ||
    typeof msg.status !== 'string' ||
    typeof msg.message !== 'string' ||
    typeof msg.data !== 'object' ||
    msg.data === null
  ) {
    return null;
  }

  return message as StatusMessage;
}

export function parseClientListMessage(
  message: GameMessage
): ClientListMessage | null {
  if (message.type !== 'clientList') return null;

  const msg = message;
  if (!('clients' in msg) || !Array.isArray(msg.clients)) return null;

  return message as ClientListMessage;
}

export function parseSessionStatsMessage(
  message: GameMessage
): SessionStatsMessage | null {
  if (message.type !== 'session_stats') return null;

  const msg = message;
  if (!('data' in msg) || typeof msg.data !== 'object' || msg.data === null)
    return null;

  const data = msg.data;
  if (
    !('totalSessions' in data) ||
    !('activeSessions' in data) ||
    !('waitingSessions' in data) ||
    !('totalPlayers' in data)
  ) {
    return null;
  }

  return message as SessionStatsMessage;
}

// export function parseGameStateResponseMessage(
//   message: GameMessage
// ): GameStateResponseMessage | null {
//   if (message.type !== 'game_state') return null;

//   const msg = message;
//   if (
//     !('data_type' in msg) ||
//     !('data' in msg) ||
//     typeof msg.data_type !== 'string' ||
//     typeof msg.data !== 'string'
//   ) {
//     return null;
//   }

//   return message as GameStateResponseMessage;
// }

// Utility function to safely handle different WebSocket data types
export function normalizeWebSocketData(data: WebSocket.Data): string | Buffer {
  if (typeof data === 'string') {
    return data;
  } else if (Buffer.isBuffer(data)) {
    return data;
  } else if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  } else if (Array.isArray(data)) {
    // Handle array of Buffer (fragmented messages)
    return Buffer.concat(data);
  } else {
    console.error('Unexpected WebSocket data type:', typeof data);
    return Buffer.alloc(0);
  }
}

// Type assertion helper for safe casting with validation
export function assertGameMessageType<T extends GameMessage>(
  message: GameMessage,
  validator: (msg: GameMessage) => msg is T
): T | null {
  return validator(message) ? message : null;
}
