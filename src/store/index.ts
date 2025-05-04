import { configureStore } from '@reduxjs/toolkit';
import snakeGameReducer from './slices/snakeGameSlice';

export const store = configureStore({
  reducer: {
    snakeGame: snakeGameReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
