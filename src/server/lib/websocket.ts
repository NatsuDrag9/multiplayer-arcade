import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { decode } from '@msgpack/msgpack';
import {
  BroadcastMessage,
  ClientType,
  CommandMessage,
  ConnectionMessage,
  EchoMessage,
  ErrorMessage,
  GameMessage,
  PingMessage,
  GameDataMessage,
  ChatMessage,
} from '@/definitions/connectionTypes';
import {
  broadcastToAll,
  determineClientType,
  handleChatMessage,
  handleCommand,
  handleGameData,
  sendMessage,
} from './helperFunctions';

interface Client {
  id: string;
  ws: WebSocket;
  type: ClientType;
}

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

    // Store the new client
    clients.set(clientId, { id: clientId, ws, type: clientType });

    console.log(`\nNew ${clientType} client connected: ${clientId}`);

    // Send welcome message using appropriate serialization
    const connectionMessage: ConnectionMessage = {
      type: 'connection',
      id: clientId,
      message: 'Connected to game server',
      timestamp: Date.now(),
    };

    sendMessage(ws, connectionMessage, clientType);

    // Handle messages from clients
    ws.on('message', (message: Buffer | string) => {
      try {
        console.log(`Received message from ${clientId} (${clientType})`);

        let parsedMessage: GameMessage;

        try {
          if (clientType === 'esp32') {
            // ESP32 sends MessagePack binary data
            if (message instanceof Buffer) {
              parsedMessage = decode(message) as GameMessage;
            } else {
              // Convert string to buffer for MessagePack decoding
              parsedMessage = decode(
                Buffer.from(message.toString(), 'binary')
              ) as GameMessage;
            }
          } else {
            // Web/mobile clients send JSON
            if (message instanceof Buffer) {
              parsedMessage = JSON.parse(message.toString()) as GameMessage;
            } else {
              parsedMessage = JSON.parse(message.toString()) as GameMessage;
            }
          }
        } catch (e) {
          console.error(
            `Failed to decode message from ${clientType} client:`,
            e
          );

          const errorMessage: ErrorMessage = {
            type: 'error',
            message: 'Failed to decode message',
            timestamp: Date.now(),
          };
          sendMessage(ws, errorMessage, clientType);
          return;
        }

        // Echo the message back using appropriate serialization
        const echoMessage: EchoMessage = {
          type: 'echo',
          message: parsedMessage,
          timestamp: Date.now(),
        };
        sendMessage(ws, echoMessage, clientType);

        // Handle different message types
        switch (parsedMessage.type) {
          case 'broadcast':
            const broadcastData = parsedMessage as BroadcastMessage;
            const broadcastMessage: BroadcastMessage = {
              type: 'broadcast',
              from: clientId,
              message: broadcastData.message,
              timestamp: Date.now(),
            };
            broadcastToAll(broadcastMessage, clientId);
            break;

          case 'command':
            handleCommand(parsedMessage as CommandMessage, clientId);
            break;

          case 'game_data':
          case 'player_action':
          case 'game_state':
            handleGameData(parsedMessage as GameDataMessage, clientId);
            break;
          case 'chat_message':
            handleChatMessage(parsedMessage as ChatMessage, clientId);
            break;
          default:
            console.log(`Unhandled message type: ${parsedMessage.type}`);
        }
      } catch (error) {
        console.error(`Error handling message: ${error}`);
        const errorMessage: ErrorMessage = {
          type: 'error',
          message: 'Error processing message',
          timestamp: Date.now(),
        };
        sendMessage(ws, errorMessage, clientType);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log(`Client disconnected: ${clientId} (${clientType})`);
      clients.delete(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
    });
  });

  // Keep connections alive with periodic pings
  setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        // Find the client info to determine serialization method
        const clientInfo = Array.from(clients.values()).find(
          (c) => c.ws === client
        );
        const clientType = clientInfo?.type || 'web';

        const pingMessage: PingMessage = {
          type: 'ping',
          timestamp: Date.now(),
        };

        const chatMessage: ChatMessage = {
          type: 'chat_message',
          message: 'STM32 chat test',
          timestamp: Date.now(),
        };

        sendMessage(client, pingMessage, clientType);
        sendMessage(client, chatMessage, clientType);
      }
    });
  }, 30000); // Send ping every 30 seconds
}
