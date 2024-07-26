// src/api/profileAPI.ts
import axiosInstance from './axios';
import { Profile, User } from '../profiles/profileTypes';

const fetchProfileData = async (storedUsername: string): Promise<{ user: Profile | undefined, updatedUser: User | undefined }> => {
  try {
    console.log('Fetching profile data');
    const responseProfiles = await axiosInstance.get<Profile[]>('/profiles');
    const responseUsers = await axiosInstance.get<User[]>('/users');

    const profiles = responseProfiles.data;
    const users = responseUsers.data;

    const user = profiles.find(profile => profile.user.username === storedUsername);
    const updatedUser = users.find(user => user.username === storedUsername);

    return { user, updatedUser };
  } catch (error) {
    console.error('Error fetching profile data:', error);
    throw error; // Re-throw the error to be handled by the component
  }
};

export default fetchProfileData;
