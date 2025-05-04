import { SnakeGameState } from '@/defitions/storeTypes';
import { createSlice } from '@reduxjs/toolkit';

const initialState: SnakeGameState = {
  lives: 3,
  score: 0,
};

export const snakeGame = createSlice({
  name: 'snakeGame',
  initialState,
  reducers: {
    updateLives: (state, action) => {
      state.lives = action.payload;
    },
    updateScore: (state, action) => {
      state.score = action.payload;
    },
  },
});

export const { updateLives, updateScore } = snakeGame.actions;

export default snakeGame.reducer;
