// src/api/profileAPI.ts
import axiosInstance from './axios';
import { Profile, User } from '../profiles/profileTypes';

const fetchProfileData = async (profileId: number | null): Promise<{ profile?: Profile, user?: User }> => {
  if (!profileId) {
    throw new Error("No profile ID provided");
  }

  try {
    // Fetch the specific profile by ID
    const responseProfile = await axiosInstance.get<Profile>(`/profiles/${profileId}/`);

    // Assuming the profile contains user data or a user ID that can be used to fetch the user detail
    const profile = responseProfile.data;
    let user;

    if (profile && profile.user) {
      // Fetch the specific user by user ID
      const responseUser = await axiosInstance.get<User>(`/users/${profile.user.id}/`);
      user = responseUser.data;
    }

    return { profile, user };
  } catch (error) {
    console.error('Error fetching profile data:', error);
    throw error; // Re-throw the error to be handled by the component
  }
};

export default fetchProfileData;
