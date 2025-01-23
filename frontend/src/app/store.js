// src/app/store.js
import { configureStore } from '@reduxjs/toolkit';
import eventsReducer from '../events/eventsSlice.js';

export const store = configureStore({
  reducer: {
    events: eventsReducer,
    auth: authReducer
  },
});
