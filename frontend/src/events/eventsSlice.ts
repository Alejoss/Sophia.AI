// src/features/events/eventsSlice.ts
import {createAsyncThunk, createSlice, PayloadAction} from '@reduxjs/toolkit';
import {Event, EventsState} from './eventTypes';
import {fetchEvents} from '../api/eventsApi';

export const fetchEventsThunk = createAsyncThunk<Event[], void>(
  'events/fetchEvents',
  async () => {
    return await fetchEvents();
  }
);

const initialState: EventsState = {
  events: [],
  status: 'idle',
  error: null
};

const eventsSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchEventsThunk.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchEventsThunk.fulfilled, (state, action: PayloadAction<Event[]>) => {
        state.status = 'succeeded';
        state.events = action.payload;
      })
      .addCase(fetchEventsThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch events';
      });
  }
});

export default eventsSlice.reducer;
