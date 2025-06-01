import {
  BroadcastMessage,
  CommandMessage,
  ConnectionMessage,
  GameMessage,
} from '@/definitions/connectionTypes';
import { encode, decode } from '@msgpack/msgpack';

class GameWebSocket {
  private ws: WebSocket | null = null;
  private clientId: string | null = null;
  private messageHandlers = new Map<string, (data: GameMessage) => void>();

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.binaryType = 'arraybuffer'; // Important for receiving binary data

      this.ws.onopen = () => {
        console.log('WebSocket connection established');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          // Decode the MessagePack data
          const data = decode(
            new Uint8Array(event.data as ArrayBuffer)
          ) as GameMessage;
          console.log('Received:', data);

          // Handle connection message to store clientId
          if (data.type === 'connection') {
            this.clientId = (data as ConnectionMessage).id;
          }

          // Call registered handler for this message type
          const handler = this.messageHandlers.get(data.type);
          if (handler) {
            handler(data);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.ws = null;
      };
    });
  }

  registerHandler<T extends GameMessage>(
    type: T['type'],
    handler: (data: T) => void
  ): void {
    this.messageHandlers.set(type, handler as (data: GameMessage) => void);
  }

  sendMessage<T extends GameMessage>(message: T): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }

    // Encode the message with MessagePack
    const encodedMessage = encode(message);
    this.ws.send(encodedMessage);
  }

  broadcast(message: unknown): void {
    const broadcastMessage: BroadcastMessage = {
      type: 'broadcast',
      message,
      timestamp: Date.now(),
    };
    this.sendMessage(broadcastMessage);
  }

  sendCommand(
    command: string,
    parameters?: Record<string, string | number | boolean>
  ): void {
    const commandMessage: CommandMessage = {
      type: 'command',
      command,
      parameters,
      timestamp: Date.now(),
    };
    this.sendMessage(commandMessage);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }

  getClientId(): string | null {
    return this.clientId;
  }
}

export default GameWebSocket;
