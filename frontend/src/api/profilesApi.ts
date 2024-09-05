// src/api/profilesAPI.ts
import axiosInstance from './axios';
import { Profile } from '../types/profileTypes';

const getUserProfile = async (): Promise<Profile | null> => {
  try {
    const response = await axiosInstance.get<Profile>('/user_profile/');
    return response.data; // Assuming the API returns the profile directly
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    return null; // Simply return null on error
  }
}

const logout = async (): Promise<void> => {
  try {
    await axiosInstance.post('/api/logout');
  } catch (error) {
    console.error('Failed to logout:', error);
    throw new Error('Logout failed'); // Throw an error for logout failure
  }
}

export { getUserProfile, logout };
