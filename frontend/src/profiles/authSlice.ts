// authSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../api/axios.ts';

// Define the return type of your API call
interface User {
  id: string;
  username: string;
  email: string;
  // add other fields from UserSerializer if necessary
}

interface UserData {
  id: string;
  user: User;  // This should match the structure of your UserSerializer
  interests: string[];
  profile_description: string;
  timezone: string;
  is_teacher: boolean;
  profile_picture: string | null;
  email_confirmed: boolean;
  // add other fields as necessary
}

// Thunk for fetching user profile data
export const fetchUserData = createAsyncThunk<UserData, void, { rejectValue: string }>(
  'auth/fetchUserData',
  async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.get<UserData>('/user_profile/');
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue('Failed to fetch profile data');
    }
  }
);

interface AuthState {
  isAuthenticated: boolean;
  user: UserData | null; // Allow user to be either UserData or null
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  status: 'idle',
};


const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.isAuthenticated = false;
      state.user = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserData.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchUserData.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.user = action.payload; // This is now valid
        state.status = 'succeeded';
      })
      .addCase(fetchUserData.rejected, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.status = 'failed';
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
