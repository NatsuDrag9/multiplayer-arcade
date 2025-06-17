import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import { setupWebSocketServer } from './websocket';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Security and middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Basic API route
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

// Game state API routes
app.get('/api/games', (req, res) => {
  res.json({ games: ['snake', 'pacman', 'mario'] });
});

// Create HTTP server from Express app
const server = http.createServer(app);

// Create WebSocket server attached to the HTTP server
const wss = new WebSocketServer({ server });

// Set up WebSocket handlers
setupWebSocketServer(wss);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nSIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed\n');
    process.exit(0);
  });
});
