// src/api/profileAPI.js
import clienteAxios from './axios';

const fetchProfileData = async (storedUsername) => {
  try {
    console.log('Fetching profile data');
    const responseProfiles = await clienteAxios.get('/profiles');
    const responseUsers = await clienteAxios.get('/users');

    const profiles = responseProfiles.data;
    const users = responseUsers.data;

    const user = profiles.find(profile => profile.user.username === storedUsername);
    const updatedUser = users.find(user => user.username === storedUsername);

    return { user, updatedUser };
  } catch (error) {
    console.error('Error fetching profile data:', error);
    throw error; // Re-lanzar el error para que pueda ser manejado por el componente
  }
};

export default fetchProfileData;