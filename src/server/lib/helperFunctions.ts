import {
  ChatMessage,
  ClientListMessage,
  ClientType,
  CommandMessage,
  GameDataMessage,
  GameMessage,
} from '@/definitions/connectionTypes';
import { encode } from '@msgpack/msgpack';
import WebSocket from 'ws';
import { clients } from './websocket';

// Determine client type based on User-Agent or URL parameters
export function determineClientType(userAgent: string, url: URL): ClientType {
  // Check URL query parameter first
  const clientType = url.searchParams.get('client');
  if (clientType === 'esp32') return 'esp32';
  if (clientType === 'mobile') return 'mobile';

  // Check User-Agent for ESP32 identification
  if (
    userAgent.includes('ESP32') ||
    userAgent.includes('esp-websocket-client')
  ) {
    return 'esp32';
  }

  // Check for mobile browsers
  if (
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
  ) {
    return 'mobile';
  }

  // Default to web
  return 'web';
}

// Helper function to get readable WebSocket state
function getWebSocketState(state: number): string {
  switch (state) {
    case WebSocket.CONNECTING:
      return 'CONNECTING';
    case WebSocket.OPEN:
      return 'OPEN';
    case WebSocket.CLOSING:
      return 'CLOSING';
    case WebSocket.CLOSED:
      return 'CLOSED';
    default:
      return 'UNKNOWN';
  }
}

// Send message using appropriate serialization method
export function sendMessage(
  ws: WebSocket,
  message: GameMessage | ChatMessage,
  clientType: ClientType
) {
  try {
    // Check WebSocket state before sending
    if (ws.readyState !== WebSocket.OPEN) {
      console.log(
        `Cannot send message - WebSocket state: ${ws.readyState} (${getWebSocketState(ws.readyState)})`
      );
      return;
    }

    console.log(
      `Sending ${message.type} message to ${clientType} client:`,
      message
    );

    if (clientType === 'esp32') {
      // Send MessagePack binary data to ESP32
      const buffer = encode(message);
      console.log(`  -> Sending ${buffer.length} bytes as MessagePack binary`);
      ws.send(buffer);
    } else {
      // Send JSON to web/mobile clients
      const jsonString = JSON.stringify(message);
      console.log(`  -> Sending ${jsonString.length} chars as JSON text`);
      ws.send(jsonString);
    }
  } catch (error) {
    console.error(`Failed to send message to ${clientType} client:`, error);
  }
}

// Process command messages
export function handleCommand(
  commandMessage: CommandMessage,
  clientId: string
): void {
  console.log(`Received command "${commandMessage.command}" from ${clientId}`);

  const client = clients.get(clientId);
  if (!client) return;

  // Handle server-side commands
  switch (commandMessage.command) {
    case 'getClients':
      // Send list of connected clients back to requester
      const clientList = Array.from(clients.values()).map((c) => ({
        id: c.id,
        type: c.type,
      }));

      const response: ClientListMessage = {
        type: 'clientList',
        clients: clientList,
        timestamp: Date.now(),
      };

      sendMessage(client.ws, response, client.type);
      break;

    case 'restart':
    case 'sleep':
    case 'update':
      // Forward these commands to ESP32 clients
      clients.forEach((targetClient) => {
        if (
          targetClient.type === 'esp32' &&
          targetClient.ws.readyState === WebSocket.OPEN
        ) {
          sendMessage(targetClient.ws, commandMessage, targetClient.type);
        }
      });
      break;

    default:
      console.log(`Unhandled command: ${commandMessage.command}`);
  }
}

// Handle game data from any client
export function handleGameData(
  gameMessage: GameDataMessage,
  clientId: string
): void {
  console.log(
    `Received game data from ${clientId}: type=${gameMessage.data_type}, data=${gameMessage.data}`
  );

  // Add client ID and timestamp to the message
  const gameDataBroadcast: GameDataMessage = {
    ...gameMessage,
    clientId: clientId,
    player_id: gameMessage.player_id || clientId,
    timestamp: Date.now(),
  };

  // Broadcast game data to all other clients based on game logic
  clients.forEach((client, id) => {
    if (id !== clientId && client.ws.readyState === WebSocket.OPEN) {
      // Forward to all clients for now - you can add game-specific filtering here
      // For example: only forward player_action to game participants, etc.

      switch (gameMessage.type) {
        case 'player_action':
          // Send player actions to all other players
          sendMessage(client.ws, gameDataBroadcast, client.type);
          break;

        case 'game_state':
          // Send game state updates to all clients
          sendMessage(client.ws, gameDataBroadcast, client.type);
          break;

        case 'game_data':
        default:
          // Send generic game data to all clients
          sendMessage(client.ws, gameDataBroadcast, client.type);
          break;
      }
    }
  });
}

// Handle chat messages - PURE CHAT COMMUNICATION ONLY
export function handleChatMessage(
  chatMessage: ChatMessage,
  clientId: string
): void {
  console.log(`CHAT MESSAGE from ${clientId}: ${chatMessage.message}`);

  // Get sender info
  const senderClient = clients.get(clientId);
  const senderType = senderClient?.type || 'unknown';

  // 1. Send chat acknowledgment back to sender
  if (senderClient && senderClient.ws.readyState === WebSocket.OPEN) {
    const chatAck: ChatMessage = {
      type: 'chat_message',
      message: `Server received your message: "${chatMessage.message}"`,
      timestamp: Date.now(),
    };

    console.log(`Sending chat acknowledgment to ${clientId}`);
    sendMessage(senderClient.ws, chatAck, senderClient.type);
  }

  // 2. Broadcast chat to all other connected clients
  const chatBroadcast: ChatMessage = {
    type: 'chat_message',
    message: `[${senderType.toUpperCase()}] ${chatMessage.message}`,
    timestamp: Date.now(),
  };

  let chatBroadcastCount = 0;
  clients.forEach((client, id) => {
    if (id !== clientId && client.ws.readyState === WebSocket.OPEN) {
      console.log(`Broadcasting chat to ${id} (${client.type})`);
      sendMessage(client.ws, chatBroadcast, client.type);
      chatBroadcastCount++;
    }
  });

  console.log(`Chat broadcasted to ${chatBroadcastCount} other clients`);

  // 3. For testing with single client, send auto-reply
  if (chatBroadcastCount <= 1) {
    console.log(`Auto-reply mode for single client`);

    setTimeout(() => {
      if (senderClient && senderClient.ws.readyState === WebSocket.OPEN) {
        const autoReply: ChatMessage = {
          type: 'chat_message',
          message: `Server auto-reply: Thanks for your message "${chatMessage.message}"!`,
          timestamp: Date.now(),
        };

        sendMessage(senderClient.ws, autoReply, senderClient.type);
        console.log(`Sent auto-reply to ${clientId}`);
      }
    }, 2000);
  }
}

// Broadcast message to all clients except sender
export function broadcastToAll(message: GameMessage, excludeClientId?: string) {
  clients.forEach((client, clientId) => {
    if (excludeClientId && clientId === excludeClientId) return;

    if (client.ws.readyState === WebSocket.OPEN) {
      sendMessage(client.ws, message, client.type);
    }
  });
}
