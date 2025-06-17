import { BaseGameState } from '@/definitions/gameSessionTypes';

export interface AuthoritativeGame<
  TGameState extends BaseGameState = BaseGameState,
> {
  addPlayer(
    clientId: string,
    playerId: number
  ): { success: boolean; playerId?: number };
  removePlayer(clientId: string): void;
  processPlayerInput(clientId: string, input: unknown): boolean;

  startGame(): void;
  tick(): void;
  forceEndGame(): void;

  // Type-safe state access
  getGameState(): TGameState;
  getGamePhase(): TGameState['gamePhase'];
  getPlayerCount(): number;
  isGameActive(): boolean;
  formatGameStateData(): string;
}
