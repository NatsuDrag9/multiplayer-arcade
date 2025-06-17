import {
  ChatMessage,
  ClientListMessage,
  ClientType,
  CommandMessage,
  GameDataMessage,
  GameMessage,
  SessionStatsMessage,
} from '@/definitions/connectionTypes';
import { encode } from '@msgpack/msgpack';
import WebSocket from 'ws';
import { clients } from '../websocket';
import { gameSessions, getSessionStats } from './gameSessionManagement';

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
  message: GameMessage,
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

    // console.log(
    //   `Sending ${message.type} message to ${clientType} client:`,
    //   message
    // );

    if (clientType === 'esp32') {
      // Send MessagePack binary data to ESP32
      const buffer = encode(message);
      // console.log(`  -> Sending ${buffer.length} bytes as MessagePack binary`);
      ws.send(buffer);
    } else {
      // Send JSON to web/mobile clients
      const jsonString = JSON.stringify(message);
      // console.log(`  -> Sending ${jsonString.length} chars as JSON text`);
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
        playerId: c.playerId,
        gameSessionId: c.gameSessionId,
      }));

      const response: ClientListMessage = {
        type: 'clientList',
        clients: clientList,
        timestamp: Date.now(),
      };

      sendMessage(client.ws, response, client.type);
      break;

    case 'getSessionStats':
      // Send session statistics back to requester
      const stats = getSessionStats();
      const statsMessage: SessionStatsMessage = {
        type: 'session_stats',
        data: stats,
        timestamp: Date.now(),
      };

      sendMessage(client.ws, statsMessage, client.type);
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

    case 'requestGameState':
      // Handle game state requests
      // if (client.gameSessionId) {
      //   const session = gameSessions.get(client.gameSessionId);
      //   if (session) {
      //     const gameStateMessage: GameStateResponseMessage = {
      //       type: 'game_state',
      //       data_type: 'state_response',
      //       data: `session:${session.id},phase:${session.gameState.gamePhase},players:${session.players.size}`,
      //       timestamp: Date.now(),
      //     };
      //     sendMessage(client.ws, gameStateMessage, client.type);
      //   }
      // }
      break;

    default:
      console.log(`Unhandled command: ${commandMessage.command}`);
  }
}

// Handle game data from any client
// SECURE: Only accept player actions from clients
export function handleGameData(
  gameMessage: GameDataMessage,
  clientId: string
): void {
  const client = clients.get(clientId);
  if (!client?.gameSessionId) {
    console.warn(`Client ${clientId} rejected - not in session`);
    return;
  }

  // ONLY accept player_action from clients
  if (gameMessage.data_type !== 'player_action') {
    console.warn(
      `Client ${clientId} sent unauthorized ${gameMessage.data_type} - rejected`
    );
    return;
  }

  const session = gameSessions.get(client.gameSessionId);
  if (!session) {
    console.error(
      `Session ${client.gameSessionId} not found for client ${clientId}`
    );
    return;
  }

  // Only process actions during active gameplay
  if (session.game.getGamePhase() !== 'playing') {
    console.log(
      `Ignoring action - game phase is ${session.game.getGamePhase()}`
    );
    return;
  }

  // Parse and validate the player action
  const actionData = gameMessage.data as string;
  const directionMatch = actionData.match(/direction:(\d+)/);

  if (directionMatch) {
    const newDirection = parseInt(directionMatch[1]);

    // Process input through authoritative game (updates session.game state internally)
    const success = session.game.processPlayerInput(client.id, newDirection);

    if (success) {
      // Update session activity timestamp
      session.lastUpdate = Date.now();
      console.log(
        `Player ${client.playerId} changed direction to ${newDirection}`
      );
    } else {
      console.warn(
        `Invalid direction ${newDirection} from player ${client.playerId}`
      );
    }
  } else {
    console.warn(
      `Invalid action format from client ${clientId}: ${actionData}`
    );
  }

  // No broadcasting here - updateGameSession() handles it every 100ms
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
  const senderPlayerId = senderClient?.playerId;
  const senderSessionId = senderClient?.gameSessionId;

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

  // 2. Broadcast chat to session members first (if in a session)
  let sessionBroadcastCount = 0;
  if (senderSessionId) {
    const session = gameSessions.get(senderSessionId);
    if (session) {
      const sessionChatMessage: ChatMessage = {
        type: 'chat_message',
        message: `[P${senderPlayerId}] ${chatMessage.message}`,
        timestamp: Date.now(),
      };

      session.players.forEach((player, playerId) => {
        if (
          playerId !== senderPlayerId &&
          player.ws.readyState === WebSocket.OPEN
        ) {
          console.log(`Broadcasting chat to session member P${playerId}`);
          sendMessage(player.ws, sessionChatMessage, player.type);
          sessionBroadcastCount++;
        }
      });
    }
  }

  // 3. Broadcast to all other connected clients (global chat)
  const globalChatMessage: ChatMessage = {
    type: 'chat_message',
    message: `[${senderType.toUpperCase()}${senderPlayerId ? `-P${senderPlayerId}` : ''}] ${chatMessage.message}`,
    timestamp: Date.now(),
  };

  let globalBroadcastCount = 0;
  clients.forEach((client, id) => {
    if (id !== clientId && client.ws.readyState === WebSocket.OPEN) {
      // Skip session members if already sent to them
      if (senderSessionId && client.gameSessionId === senderSessionId) {
        return;
      }

      console.log(`Broadcasting chat to ${id} (${client.type})`);
      sendMessage(client.ws, globalChatMessage, client.type);
      globalBroadcastCount++;
    }
  });

  console.log(
    `Chat broadcasted to ${sessionBroadcastCount} session members and ${globalBroadcastCount} other clients`
  );

  // 4. For testing with single client, send auto-reply
  if (sessionBroadcastCount + globalBroadcastCount <= 1) {
    console.log(`Auto-reply mode for single client`);

    setTimeout(() => {
      if (senderClient && senderClient.ws.readyState === WebSocket.OPEN) {
        const autoReply: ChatMessage = {
          type: 'chat_message',
          message: `Server auto-reply: Thanks for your message "${chatMessage.message}"! You are Player ${senderPlayerId || 'Unknown'} in session ${senderSessionId || 'None'}`,
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
  let broadcastCount = 0;

  clients.forEach((client, clientId) => {
    if (excludeClientId && clientId === excludeClientId) return;

    if (client.ws.readyState === WebSocket.OPEN) {
      sendMessage(client.ws, message, client.type);
      broadcastCount++;
    }
  });

  console.log(
    `Broadcasted ${message.type} message to ${broadcastCount} clients`
  );
}

// Broadcast message to specific session
export function broadcastToSession(
  sessionId: string,
  message: GameMessage,
  excludeClientId?: string
) {
  const session = gameSessions.get(sessionId);
  if (!session) return;

  let broadcastCount = 0;

  session.players.forEach((client) => {
    if (excludeClientId && client.id === excludeClientId) return;

    if (client.ws.readyState === WebSocket.OPEN) {
      sendMessage(client.ws, message, client.type);
      broadcastCount++;
    }
  });

  console.log(
    `Broadcasted ${message.type} message to ${broadcastCount} players in session ${sessionId}`
  );
}

// Get detailed server status
export function getDetailedServerStatus(): {
  totalClients: number;
  clientsByType: Record<ClientType, number>;
  sessionStats: ReturnType<typeof getSessionStats>;
  clientsInSessions: number;
  clientsWithoutSessions: number;
} {
  const clientsByType: Record<ClientType, number> = {
    web: 0,
    mobile: 0,
    esp32: 0,
  };

  let clientsInSessions = 0;
  let clientsWithoutSessions = 0;

  clients.forEach((client) => {
    clientsByType[client.type]++;

    if (client.gameSessionId) {
      clientsInSessions++;
    } else {
      clientsWithoutSessions++;
    }
  });

  return {
    totalClients: clients.size,
    clientsByType,
    sessionStats: getSessionStats(),
    clientsInSessions,
    clientsWithoutSessions,
  };
}
