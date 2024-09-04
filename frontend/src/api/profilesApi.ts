// src/api/profileAPI.ts
import axiosInstance from './axios';
import { Profile } from '../types/profileTypes.ts';

const getUserProfile = async (): Promise<Profile | null> => {
  try {
    const response = await axiosInstance.get<Profile>('/user_profile/');
    return response.data; // Assuming the API returns the profile directly
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    return null; // Return null or handle the error as appropriate for your application context
  }
}

export { getUserProfile };
