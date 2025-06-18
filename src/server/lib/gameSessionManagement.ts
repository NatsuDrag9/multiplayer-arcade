/* eslint-disable no-param-reassign */
import { sendMessage } from './helperFunctions';
import { Client, GameSession } from '@/definitions/gameSessionTypes';
import {
  GameDataMessage,
  CommandMessage,
  StatusMessage,
} from '../../definitions/connectionTypes';
import { createSnakeGameSession } from './gameSessionFactories';

// Store game sessions - now generic for all game types
export const gameSessions: Map<string, GameSession> = new Map();

// Find or create a game session for a new player
export function findOrCreateGameSession(): GameSession {
  // Try to find a session that needs players
  const availableSession = Array.from(gameSessions.values()).find(
    (session) =>
      session.players.size < 2 && session.game.getGamePhase() === 'waiting'
  );

  if (availableSession) {
    return availableSession;
  }

  // Create new session - using factory function
  const newSession = createSnakeGameSession();
  gameSessions.set(newSession.id, newSession);
  console.log(`Created new game session: ${newSession.id}`);
  return newSession;
}

// Assign player to a game session
export function assignPlayerToSession(client: Client): void {
  const session = findOrCreateGameSession();

  // Assign player ID (1 or 2)
  let playerId: number;
  if (!session.players.has(1)) {
    playerId = 1;
  } else if (!session.players.has(2)) {
    playerId = 2;
  } else {
    // Session is full, create new one
    const newSession = findOrCreateGameSession();
    playerId = 1;
    // Update session reference
    session.id = newSession.id;
    session.players = newSession.players;
    session.game = newSession.game;
    session.lastUpdate = newSession.lastUpdate;
  }

  console.log('Session: ', session);

  // Update client info
  client.playerId = playerId;
  client.gameSessionId = session.id;

  // Add to session
  session.players.set(playerId, client);

  // Add player to AuthoritativeGame
  const result = session.game.addPlayer(client.id, playerId);
  if (!result.success) {
    console.error(`Failed to add player ${client.id} to game`);
    return;
  }
  console.log(`Player ${client.id} added to game with ID ${result.playerId}`);

  console.log(
    `Player ${playerId} joined session ${session.id} (${session.players.size}/2 players)`
  );

  // Send player assignment message
  const assignmentMessage: StatusMessage = {
    type: 'status',
    status: 'player_assignment',
    message: `You are Player ${playerId}`,
    data: {
      playerId: playerId,
      sessionId: session.id,
      playerCount: session.players.size,
    },
    timestamp: Date.now(),
  };

  sendMessage(client.ws, assignmentMessage, client.type);

  // Notify existing players about new player
  session.players.forEach((player, pid) => {
    if (pid !== playerId) {
      const newPlayerMessage: StatusMessage = {
        type: 'status',
        status: 'opponent_connected',
        message: `Player ${playerId} joined the game`,
        data: {
          playerId: playerId,
          sessionId: session.id,
          playerCount: session.players.size,
        },
        timestamp: Date.now(),
      };
      sendMessage(player.ws, newPlayerMessage, player.type);
    }
  });

  // Send current game state to the new player
  sendGameStateToPlayer(client, session);

  // Check if game can start
  if (session.players.size === 2) {
    startGameSession(session);
  }
}

// Start a game session when 2 players are ready
export function startGameSession(session: GameSession): void {
  // Use game's startGame method instead of manually setting phase
  session.game.startGame();
  session.lastUpdate = Date.now();

  // Send game_start command message
  const gameStartMessage: CommandMessage = {
    type: 'command',
    command: 'game_start',
    sessionId: session.id,
    timestamp: Date.now(),
  };

  session.players.forEach((player) => {
    sendMessage(player.ws, gameStartMessage, player.type);
  });

  console.log(`Game started in session ${session.id}`);

  // Start game update loop
  startGameLoop(session);
}

// Start the game update loop for a session
function startGameLoop(session: GameSession): void {
  if (session.gameLoop) {
    clearInterval(session.gameLoop);
  }

  session.gameLoop = setInterval(() => {
    updateGameSession(session);
  }, 100); // Update every 100ms
}

// Update game state and broadcast to players
function updateGameSession(session: GameSession): void {
  if (session.game.getGamePhase() !== 'playing') {
    console.log(
      'Game phase in updateGameSession(): ',
      session.game.getGamePhase()
    );
    return;
  }

  // Let the authoritative game handle the update
  session.game.tick();

  // Broadcast the updated state
  broadcastGameStateToSession(session);
  session.lastUpdate = Date.now();

  // Check if game ended
  if (session.game.getGamePhase() === 'ended') {
    endGameSession(session);
  }
}

// Send game state to a specific player
export function sendGameStateToPlayer(
  client: Client,
  session: GameSession
): void {
  // Send initial game state and target score to be acheived

  const gameStateData = session.game.formatGameStateData();
  const targetScore = session.game.getTargetScore();

  const gameStateMessage: GameDataMessage = {
    type: 'game_data_message',
    data_type: 'game_state',
    data: `${gameStateData};target_score: ${targetScore}`,
    player_id: client.playerId?.toString(),
    clientId: client.id,
    sessionId: session.id,
    timestamp: Date.now(),
  };

  console.log('Sending game state to player: ', client.playerId);

  sendMessage(client.ws, gameStateMessage, client.type);
}

// Broadcast game state to all players in a session
export function broadcastGameStateToSession(session: GameSession): void {
  const gameStateData = session.game.formatGameStateData();

  const gameStateMessage: GameDataMessage = {
    type: 'game_data_message',
    data_type: 'game_state',
    data: gameStateData,
    sessionId: session.id,
    timestamp: Date.now(),
  };

  for (const [, client] of session.players) {
    sendMessage(client.ws, gameStateMessage, client.type);
  }
}

// Broadcast game event to all players in session
export function broadcastEventToSession(
  session: GameSession,
  event: string,
  data: Record<string, unknown>
): void {
  const eventMessage: GameDataMessage = {
    type: 'game_data_message',
    data_type: 'game_event',
    data: JSON.stringify({ event, ...data }),
    sessionId: session.id,
    timestamp: Date.now(),
  };

  session.players.forEach((player) => {
    sendMessage(player.ws, eventMessage, player.type);
  });
}

// End a game session
export function endGameSession(session: GameSession, winner?: number): void {
  // Force end the game if not already ended
  if (session.game.getGamePhase() !== 'ended') {
    session.game.forceEndGame();
  }

  if (session.gameLoop) {
    clearInterval(session.gameLoop);
    session.gameLoop = undefined;
  }

  // Send game_end command message
  const gameEndMessage: CommandMessage = {
    type: 'command',
    command: 'game_end',
    data: winner ? `Player ${winner} wins!` : 'Game ended',
    sessionId: session.id,
    timestamp: Date.now(),
  };

  session.players.forEach((player) => {
    sendMessage(player.ws, gameEndMessage, player.type);
  });

  console.log(
    `Game ended in session ${session.id}${winner ? ` - Player ${winner} wins` : ''}`
  );

  // Clean up session after delay
  setTimeout(() => {
    if (session.gameLoop) {
      clearInterval(session.gameLoop);
    }
    gameSessions.delete(session.id);
    console.log(`Session ${session.id} cleaned up`);
  }, 5000);
}

// Get session statistics
export function getSessionStats(): {
  totalSessions: number;
  activeSessions: number;
  waitingSessions: number;
  totalPlayers: number;
} {
  const sessions = Array.from(gameSessions.values());

  const activeSessions = sessions.filter(
    (session) => session.game.getGamePhase() === 'playing'
  ).length;
  const waitingSessions = sessions.filter(
    (session) => session.game.getGamePhase() === 'waiting'
  ).length;
  const totalPlayers = sessions.reduce(
    (sum, session) => sum + session.players.size,
    0
  );

  return {
    totalSessions: gameSessions.size,
    activeSessions,
    waitingSessions,
    totalPlayers,
  };
}

// Cleanup inactive sessions
export function cleanupInactiveSessions(): void {
  const now = Date.now();
  const INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  const inactiveSessions = Array.from(gameSessions.entries()).filter(
    ([_sessionId, session]) => now - session.lastUpdate > INACTIVE_TIMEOUT
  );

  inactiveSessions.forEach(([sessionId, session]) => {
    console.log(`Cleaning up inactive session: ${sessionId}`);

    // Notify remaining players
    session.players.forEach((player) => {
      // Send status message first
      const timeoutMessage: StatusMessage = {
        type: 'status',
        status: 'session_timeout',
        message: 'Session timed out due to inactivity',
        data: { sessionId: session.id },
        timestamp: Date.now(),
      };
      sendMessage(player.ws, timeoutMessage, player.type);

      // Send game_end command message
      const commandMessage: CommandMessage = {
        type: 'command',
        command: 'game_end',
        data: 'Game end due to session inactivity',
        sessionId: session.id,
        timestamp: Date.now(),
      };
      sendMessage(player.ws, commandMessage, player.type);
    });

    // Clean up
    if (session.gameLoop) {
      clearInterval(session.gameLoop);
    }
    gameSessions.delete(sessionId);
  });
}

// Start periodic cleanup
export function startSessionCleanup(): void {
  setInterval(cleanupInactiveSessions, 60000); // Check every minute
}
