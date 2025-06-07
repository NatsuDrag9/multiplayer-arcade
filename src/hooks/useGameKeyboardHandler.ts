import { useEffect } from 'react';

interface GameKeyboardHandlerProps {
  onMount?: () => void;
  onUnmount?: () => void;
}

export function useGameKeyboardHandler({
  onMount,
  onUnmount,
}: GameKeyboardHandlerProps = {}) {
  useEffect(() => {
    // Prevent arrow keys from scrolling the window
    const preventDefaultForArrowKeys = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)
      ) {
        e.preventDefault();
      }
    };

    // Set up window click handler to refocus canvas
    const handleWindowClick = (e: MouseEvent) => {
      const gameContainer = document.querySelector('.snake-game');
      if (gameContainer && gameContainer.contains(e.target as Node)) {
        const canvas = document.querySelector(
          '.game-canvas'
        ) as HTMLCanvasElement;
        if (canvas) {
          canvas.focus();
        }
      }
    };

    window.addEventListener('keydown', preventDefaultForArrowKeys);
    window.addEventListener('click', handleWindowClick);
    onMount?.();

    return () => {
      window.removeEventListener('keydown', preventDefaultForArrowKeys);
      window.removeEventListener('click', handleWindowClick);
      onUnmount?.();
    };
  }, [onMount, onUnmount]);
}
