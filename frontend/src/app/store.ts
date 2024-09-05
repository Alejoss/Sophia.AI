// src/app/store.ts
import { configureStore } from '@reduxjs/toolkit';
import eventsReducer from '../events/eventsSlice';
import authReducer from '../redux/authSlice';

export const store = configureStore({
  reducer: {
    events: eventsReducer,
    auth: authReducer
  },
});

export type RootState = ReturnType<typeof store.getState>;

// Inferred type: AppDispatch = ThunkDispatch<RootState, any, AnyAction>
export type AppDispatch = typeof store.dispatch;
