import {
  ClientType,
  isErrorMessage,
  MessageHandlers,
} from '../../definitions/connectionTypes';
import {
  parseCommandMessage,
  parseGameDataMessage,
  parseChatMessage,
  parseConnectionMessage,
  parseStatusMessage,
  parseClientListMessage,
  parseSessionStatsMessage,
  receiveMessage,
  parseTileSizeValidationMessage,
} from './messageParser';
import WebSocket from 'ws';

// Message routing result
export interface RoutingResult {
  success: boolean;
  messageType: string;
  handlerCalled: string | null;
  error?: string;
}

// Comprehensive message receiver that routes to appropriate handlers
export function receiveAndRouteMessage(
  data: WebSocket.Data,
  clientType: ClientType,
  clientId: string,
  handlers: MessageHandlers
): RoutingResult {
  const message = receiveMessage(data, clientType);

  if (!message) {
    const error = `Failed to parse message from client ${clientId}`;
    console.error(error);
    return {
      success: false,
      messageType: 'unknown',
      handlerCalled: null,
      error,
    };
  }

  console.log(`Routing ${message.type} message from ${clientId}`);

  // Route to appropriate handler based on message type
  switch (message.type) {
    case 'tile_size_validation':
      const tileSizeValidation = parseTileSizeValidationMessage(message);
      if (handlers.onTileSizeValidation)
        handlers.onTileSizeValidation(
          tileSizeValidation.message,
          tileSizeValidation.validation,
          clientId
        );
      return {
        success: true,
        handlerCalled: 'onTileSizeValidation',
        messageType: message.type,
      };
    case 'command': {
      const commandMsg = parseCommandMessage(message);
      if (commandMsg && handlers.onCommand) {
        handlers.onCommand(commandMsg, clientId);
        return {
          success: true,
          messageType: message.type,
          handlerCalled: 'onCommand',
        };
      }
      break;
    }

    case 'game_data_message': {
      const gameDataMsg = parseGameDataMessage(message);
      if (gameDataMsg && handlers.onGameData) {
        handlers.onGameData(gameDataMsg, clientId, clientType);
        return {
          success: true,
          messageType: message.type,
          handlerCalled: 'onGameData',
        };
      }
      break;
    }

    case 'chat_message': {
      const chatMsg = parseChatMessage(message);
      if (chatMsg && handlers.onChat) {
        handlers.onChat(chatMsg, clientId);
        return {
          success: true,
          messageType: message.type,
          handlerCalled: 'onChat',
        };
      }
      break;
    }

    case 'connection': {
      const connectionMsg = parseConnectionMessage(message);

      if (connectionMsg && handlers.onConnection) {
        handlers.onConnection(connectionMsg, clientId);
        return {
          success: true,
          messageType: message.type,
          handlerCalled: 'onConnection',
        };
      }
      break;
    }

    case 'status': {
      const statusMsg = parseStatusMessage(message);
      if (statusMsg && handlers.onStatus) {
        handlers.onStatus(statusMsg, clientId);
        return {
          success: true,
          messageType: message.type,
          handlerCalled: 'onStatus',
        };
      }
      break;
    }

    case 'clientList': {
      const clientListMsg = parseClientListMessage(message);
      if (clientListMsg && handlers.onClientList) {
        handlers.onClientList(clientListMsg, clientId);
        return {
          success: true,
          messageType: message.type,
          handlerCalled: 'onClientList',
        };
      }
      break;
    }

    case 'session_stats': {
      const sessionStatsMsg = parseSessionStatsMessage(message);
      if (sessionStatsMsg && handlers.onSessionStats) {
        handlers.onSessionStats(sessionStatsMsg, clientId);
        return {
          success: true,
          messageType: message.type,
          handlerCalled: 'onSessionStats',
        };
      }
      break;
    }

    // case 'game_state': {
    //   const gameStateMsg = parseGameStateResponseMessage(message);
    //   if (gameStateMsg && handlers.onGameState) {
    //     handlers.onGameState(gameStateMsg, clientId);
    //     return {
    //       success: true,
    //       messageType: message.type,
    //       handlerCalled: 'onGameState',
    //     };
    //   }
    //   break;
    // }

    case 'error': {
      if (isErrorMessage(message) && handlers.onError) {
        handlers.onError(message, clientId);
        return {
          success: true,
          messageType: message.type,
          handlerCalled: 'onError',
        };
      }
      break;
    }

    case 'success': {
      if (handlers.onSuccess) {
        handlers.onSuccess(message, clientId);
        return {
          success: true,
          messageType: message.type,
          handlerCalled: 'onSuccess',
        };
      }
      break;
    }

    case 'ping': {
      if (handlers.onPing) {
        handlers.onPing(message, clientId);
        return {
          success: true,
          messageType: message.type,
          handlerCalled: 'onPing',
        };
      }
      break;
    }

    case 'echo': {
      if (handlers.onEcho) {
        handlers.onEcho(message, clientId);
        return {
          success: true,
          messageType: message.type,
          handlerCalled: 'onEcho',
        };
      }
      break;
    }

    case 'broadcast': {
      if (handlers.onBroadcast) {
        handlers.onBroadcast(message, clientId);
        return {
          success: true,
          messageType: message.type,
          handlerCalled: 'onBroadcast',
        };
      }
      break;
    }

    default: {
      console.log(`Unknown message type: ${message}`);
      if (handlers.onUnknown) {
        handlers.onUnknown(message, clientId);
        return {
          success: true,
          messageType: message,
          handlerCalled: 'onUnknown',
        };
      }
      return {
        success: false,
        messageType: message,
        handlerCalled: null,
        error: `Unknown message type: ${message}`,
      };
    }
  }

  const error = `No handler found for ${message.type} message from ${clientId}`;
  console.error(error);
  return {
    success: false,
    messageType: message.type,
    handlerCalled: null,
    error,
  };
}

// Simplified routing function for common use cases
export function routeMessage(
  data: WebSocket.Data,
  clientType: ClientType,
  clientId: string,
  handlers: MessageHandlers
): boolean {
  const result = receiveAndRouteMessage(data, clientType, clientId, {
    ...handlers,
    onUnknown: (msg, id) =>
      console.log(`Unhandled message type: ${msg.type} from ${id}`),
  });

  return result.success;
}

// Utility to create a default set of handlers
export function createDefaultHandlers(): MessageHandlers {
  return {
    onCommand: (msg, id) => console.log(`Command from ${id}:`, msg.command),
    onGameData: (msg, id) =>
      console.log(`Game data from ${id}:`, msg.data_type),
    onChat: (msg, id) => console.log(`Chat from ${id}:`, msg.message),
    onConnection: (msg, id) =>
      console.log(`Connection from ${id}:`, msg.message),
    onStatus: (msg, id) => console.log(`Status from ${id}:`, msg.status),
    onError: (msg, id) => console.error(`Error from ${id}:`, msg),
    onPing: (msg, id) => console.log(`Ping from ${id}`),
    onUnknown: (msg, id) =>
      console.log(`Unknown message from ${id}:`, msg.type),
  };
}
