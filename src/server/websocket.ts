import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  ConnectionMessage,
  ErrorMessage,
  StatusMessage,
} from '@/definitions/connectionTypes';
import {
  determineClientType,
  handleChatMessage,
  handleCommand,
  handleGameData,
  handleTileSizeValidation,
  sendMessage,
} from './lib/helperFunctions';
import { Client } from '@/definitions/gameSessionTypes';
import { gameSessions, getSessionStats } from './lib/gameSessionManagement';
import { routeMessage } from './lib/messageRouter';

// Store connected clients
export const clients: Map<string, Client> = new Map();

// Setup WebSocket server and handlers
export function setupWebSocketServer(wss: WebSocketServer) {
  console.log('WebSocket server initialized');

  wss.on('connection', (ws: WebSocket, request) => {
    // Generate a unique client ID using UUID
    const clientId = uuidv4();

    // Determine client type from User-Agent or query params
    const userAgent = request.headers['user-agent'] || '';
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const clientType = determineClientType(userAgent, url);

    // Create and store the new client
    const client: Client = {
      id: clientId,
      ws,
      type: clientType,
      validated: false,
    };
    clients.set(clientId, client);

    console.log(`\nNew ${clientType} client connected: ${clientId}`);

    // Send welcome message using appropriate serialization
    const connectionMessage: ConnectionMessage = {
      type: 'connection',
      id: clientId,
      message: 'Connected to game server',
      timestamp: Date.now(),
    };

    sendMessage(ws, connectionMessage, clientType);

    // Receive message from client
    ws.on('message', (data) => {
      const routingStatus = routeMessage(data, client.type, clientId, {
        onCommand: handleCommand,
        onGameData: handleGameData,
        onChat: handleChatMessage,
        onConnection: (message: ConnectionMessage, clientId: string) => {
          // Check if this is the acknowledgment message
          if (message.message === 'Acknowledge game server connection') {
            console.log(
              `Client ${clientId} acknowledged connection. Proceeding to tile size validation...`
            );
            // assignPlayerToSession(client);
          } else {
            console.log(
              `Connection message from ${clientId}: ${message.message}`
            );
          }
        },
        onTileSizeValidation: handleTileSizeValidation, // player assignment happens here
      });

      console.log('Routing status: ', routingStatus);
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log(`Client disconnected: ${clientId} (${clientType})`);

      // Handle game session disconnection
      handlePlayerDisconnection(client);
      clients.delete(clientId);

      // Log session stats
      const stats = getSessionStats();
      console.log(
        `Session stats: ${stats.totalSessions} sessions, ${stats.totalPlayers} players`
      );
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      const errorMessage: ErrorMessage = {
        type: 'error',
        message: error.message,
        timestamp: Date.now(),
      };
      sendMessage(ws, errorMessage, clientType);
    });
  });

  // Handle player disconnection from session
  function handlePlayerDisconnection(client: Client): void {
    if (!client.gameSessionId || !client.playerId) return;

    const session = gameSessions.get(client.gameSessionId);
    if (!session) return;

    console.log(
      `Player ${client.playerId} disconnecting from session ${client.gameSessionId}`
    );

    // Remove player from session and authoritative game
    session.players.delete(client.playerId);
    session.game.removePlayer(client.id);

    // Notify remaining players
    if (session.players.size > 0) {
      const disconnectMessage: StatusMessage = {
        type: 'status',
        status: 'opponent_disconnected',
        message: `Player ${client.playerId} disconnected`,
        data: {
          playerId: client.playerId,
          sessionId: session.id,
          playerCount: session.players.size,
        },
        timestamp: Date.now(),
      };

      session.players.forEach((player) => {
        sendMessage(player.ws, disconnectMessage, player.type);
      });

      // Game will automatically handle player removal and potentially end
      if (session.game.getGamePhase() === 'playing') {
        console.log(
          `Game may end in session ${session.id} due to player disconnection`
        );
      }
    }

    // Clean up empty sessions
    if (session.players.size === 0) {
      if (session.gameLoop) {
        clearInterval(session.gameLoop);
      }
      gameSessions.delete(client.gameSessionId);
      console.log(`Removed empty session ${client.gameSessionId}`);
    }
  }

  // Keep connections alive with periodic pings
  // setInterval(() => {
  //   wss.clients.forEach((client) => {
  //     if (client.readyState === WebSocket.OPEN) {
  //       // Find the client info to determine serialization method
  //       const clientInfo = Array.from(clients.values()).find(
  //         (c) => c.ws === client
  //       );
  //       const clientType = clientInfo?.type || 'web';

  //       const pingMessage: PingMessage = {
  //         type: 'ping',
  //         timestamp: Date.now(),
  //       };

  //       const chatMessage: ChatMessage = {
  //         type: 'chat_message',
  //         message: 'STM32 chat test',
  //         timestamp: Date.now(),
  //       };

  //       sendMessage(client, pingMessage, clientType);
  //       sendMessage(client, chatMessage, clientType);
  //     }
  //   });
  // }, 30000); // Send ping every 30 seconds
}
