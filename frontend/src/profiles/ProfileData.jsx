import { useState, useEffect } from 'react';
import { getUserProfile } from "../api/profilesApi.js";

const ProfileData = () => {
  const [profile, setProfile] = useState({});
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (storedUser) {
      setUser(storedUser);
    }

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

  const handleAlertUserData = () => {
    alert(JSON.stringify(user, null, 2));
  };

  return (
    <div className="user-profile">
      <div className="profile-header">
        <h1>User Profile</h1>
        <div className="profile-info">
          <p><strong>Name:</strong> {profile.user?.username || 'N/A'}</p>
          <p><strong>Interests:</strong> {profile.interests || 'N/A'}</p>
          <p><strong>Timezone:</strong> {profile.timezone || 'N/A'}</p>
        </div>
        <div className="buttons">
          <button>Edit Profile</button>
          <button>Cryptos</button>
          <button>Contact Methods</button>
          <button onClick={handleAlertUserData}>Alert User Data</button>
        </div>
      </div>

      <hr className="separator" />
    </div>
  );
};

export default ProfileData;