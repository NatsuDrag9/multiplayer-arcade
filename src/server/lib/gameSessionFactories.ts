import { v4 as uuidv4 } from 'uuid';
import { GameSession, SnakeGameSession } from '@/definitions/gameSessionTypes';
import { GameDataMessage } from '@/definitions/connectionTypes';
import {
  AuthoritativeSnakeGame,
  initialSnakeGameConfig,
} from './games/SnakeGame/AuthoritativeSnakeGame';
import { sendMessage } from './helperFunctions';

// Helper function to create GameDataMessage from raw event
function createGameEventMessage(
  event: string,
  data: Record<string, unknown>,
  sessionId: string
): GameDataMessage {
  return {
    type: 'game_data_message',
    data_type: 'game_event',
    data: JSON.stringify({ event, ...data }),
    sessionId,
    timestamp: Date.now(),
  };
}

// Factory function for creating Snake game sessions
export function createSnakeGameSession(): SnakeGameSession {
  const session: Partial<SnakeGameSession> = {
    id: uuidv4(),
    players: new Map(),
    lastUpdate: Date.now(),
  };

  const handleGameEvent = (event: string, data: Record<string, unknown>) => {
    if (!session.id || !session.players) {
      console.log('ERROR - Missing session properties');
      return;
    }

    console.log('Snake game event:', event, data);

    // Handle all game events as GameDataMessage (game lifecycle is handled by gameSessionManagement)
    const gameEventMessage = createGameEventMessage(event, data, session.id);
    session.players.forEach((player) => {
      sendMessage(player.ws, gameEventMessage, player.type);
    });
  };

  const snakeGame = new AuthoritativeSnakeGame(
    initialSnakeGameConfig,
    handleGameEvent
  );

  // Complete the session object
  const completeSession: SnakeGameSession = {
    ...session,
    game: snakeGame,
  } as SnakeGameSession;

  return completeSession;
}

// Future factories for other games
// export function createPacmanGameSession(): PacmanGameSession { ... }
// export function createMarioGameSession(): MarioGameSession { ... }
// export function createTetrisGameSession(): TetrisGameSession { ... }

// Factory selector function for dynamic game creation
export type GameType = 'snake' | 'pacman' | 'mario' | 'tetris';

export function createGameSession(gameType: GameType): GameSession {
  switch (gameType) {
    case 'snake':
      return createSnakeGameSession();
    // case 'pacman':
    //   return createPacmanGameSession();
    // case 'mario':
    //   return createMarioGameSession();
    // case 'tetris':
    //   return createTetrisGameSession();
    default:
      throw new Error(`Unsupported game type: ${gameType}`);
  }
}
