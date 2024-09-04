import { useState, useEffect} from 'react';
import { getUserProfile } from "../api/profilesApi";
import { Profile } from '../types/profileTypes';


// Helper function to initialize a profile with default values
const initializeProfile = (): Profile => {
  return {
    id: 0,
    user: {
      id: 0,
      username: '',
      email: ''
    },
    interests: '',
    profile_description: '',
    timezone: '',
    is_teacher: false,
    profile_picture: null,
    email_confirmed: false,
    green_diamonds: 0,
    yellow_diamonds: 0,
    purple_diamonds: 0,
    blue_diamonds: 0,
  };
};

const ProfileData = () => {
  const [profile, setProfile] = useState<Profile>(initializeProfile());

   useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getUserProfile(); // Calls the API to get the logged-in user's profile
        if (data) {
          setProfile(data); // Sets the profile data directly from the API response
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      }
    };

    fetchData();
  }, []);

  return (
  <div className="user-profile">
    <div className="profile-header">
      <h1>User Profile</h1>
      <div className="profile-info">
        <p><strong>Name:</strong> {profile.user.username}</p>
        <p><strong>Interests:</strong> {profile.interests}</p>
        <p><strong>Timezone:</strong> {profile.timezone}</p>
      </div>
      <div className="buttons">
        <button>Edit Profile</button>
        <button>Cryptos</button>
        <button>Contact Methods</button>
      </div>
    </div>

    <hr className="separator" />
  </div>
);

};

export default ProfileData;
