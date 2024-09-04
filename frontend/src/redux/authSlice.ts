// authSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Profile } from '../types/profileTypes';
import { getUserProfile } from "../api/profilesApi";

export const fetchUserData = createAsyncThunk<Profile, void, { rejectValue: string }>(
  'auth/fetchUserData',
  async (_, thunkAPI) => {
    try {
      const response = await getUserProfile();
      return response.data;
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
    logout(state) {
      state.isAuthenticated = false;
      state.user = null;
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

export const { logout, clearError } = authSlice.actions;

// Selector example
export const selectIsAuthenticated = (state: any) => state.auth.isAuthenticated;

export default authSlice.reducer;
