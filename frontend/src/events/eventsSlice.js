import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchEvents } from '../api/eventsApi.js';

export const fetchEventsThunk = createAsyncThunk(
  'events/fetchEvents',
  async () => {
    return await fetchEvents();
  }
);

const initialState = {
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
      .addCase(fetchEventsThunk.fulfilled, (state, action) => {
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
