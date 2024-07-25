// src/app/store.ts
import { configureStore } from '@reduxjs/toolkit';
import eventsReducer from '/src/events/eventsSlice.ts';

export const store = configureStore({
  reducer: {
    events: eventsReducer,
  },
});

// Inferred type: {events: EventsState}
export type RootState = ReturnType<typeof store.getState>;

// Inferred type: AppDispatch = ThunkDispatch<RootState, any, AnyAction>
export type AppDispatch = typeof store.dispatch;
