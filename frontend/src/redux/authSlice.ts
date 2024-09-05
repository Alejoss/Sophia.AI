// Import RootState from your store configuration if it's defined there
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from '../app/store'
import { Profile } from '../types/profileTypes';
import { getUserProfile } from "../api/profilesApi";

export const fetchUserData = createAsyncThunk<Profile, void, { rejectValue: string }>(
  'auth/fetchUserData',
  async (_, thunkAPI) => {
    try {
      const response = await getUserProfile();
      if (!response) {
        return thunkAPI.rejectWithValue('No profile data available');
      }
      return response;
    } catch (error) {
      return thunkAPI.rejectWithValue('Error fetching profile data: ' + error.message);
    }
  }
);

interface AuthState {
  isAuthenticated: boolean;
  user: Profile | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  status: 'idle',
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetAuthState(state) {
      // Resets the entire state to its initial state
      Object.assign(state, initialState);
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserData.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchUserData.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.user = action.payload;
        state.status = 'succeeded';
      })
      .addCase(fetchUserData.rejected, (state, action) => {
        state.isAuthenticated = false;
        state.user = null;
        state.status = 'failed';
        state.error = action.payload as string;
      });
  },
});

export const { resetAuthState, clearError } = authSlice.actions;

// Selectors
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectUser = (state: RootState) => state.auth.user;
export const selectAuthStatus = (state: RootState) => state.auth.status;

export default authSlice.reducer;
