// import { useMemo } from 'react';
// import { GamePhase } from '@/definitions/gameEngineTypes';

// export function useMultiplayerGamePhase(gamePhase: GamePhase) {
//   const gamePhaseInfo = useMemo(() => {
//     switch (gamePhase) {
//       case 'waiting':
//         return {
//           text: 'Waiting for players...',
//           color: '#ffff00',
//           canPlay: false,
//         };
//       case 'playing':
//         return {
//           text: 'Game in progress',
//           color: '#00ff00',
//           canPlay: true,
//         };
//       case 'ended':
//         return {
//           text: 'Game ended',
//           color: '#ff0000',
//           canPlay: false,
//         };
//       default:
//         return {
//           text: 'Unknown',
//           color: '#888888',
//           canPlay: false,
//         };
//     }
//   }, [gamePhase]);

//   return gamePhaseInfo;
// }

import { useMemo } from 'react';
import { GamePhase } from '@/definitions/gameEngineTypes';

interface GamePhaseInfo {
  text: string;
  color: string;
  canPlay: boolean;
}

export function useMultiplayerGamePhase(gamePhase: GamePhase): GamePhaseInfo {
  return useMemo(() => {
    switch (gamePhase) {
      case 'waiting':
        return {
          text: 'Waiting for players...',
          color: '#ffff00',
          canPlay: false,
        };
      case 'playing':
        return { text: 'Game in progress', color: '#00ff00', canPlay: true };
      case 'ended':
        return { text: 'Game ended', color: '#ff0000', canPlay: false };
      default:
        return { text: 'Unknown', color: '#888888', canPlay: false };
    }
  }, [gamePhase]);
}
