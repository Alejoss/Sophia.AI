import { useState, useEffect} from 'react';
import fetchProfileData from "../api/profilesApi.ts";

const ProfileData = () => {
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    timezone: '',
    interests: '',
    whatDoYouDo: '',
    userName: '',
    preferredCryptos: [],
    contactMethods: '',
    profileId: null as number | null,
    email: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!profile.profileId) return;
      try {
        const { user } = await fetchProfileData(profile.profileId);
        if (user) {
          setProfile(prev => ({
            ...prev,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            timezone: user.timezone || '',
            interests: user.interests || '',
            whatDoYouDo: user.whatDoYouDo || '',
            userName: user.userName || '',
            preferredCryptos: user.preferredCryptos || [],
            contactMethods: user.contactMethods || '',
            email: user.email || '',
            profileId: user.id
          }));
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      }
    };

    fetchData();
  }, [profile.profileId]);

  const handleInputChange = (name: keyof typeof profile, value: string) => {
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="user-profile">
      <div className="profile-header">
        <h1>User Profile</h1>
        <div className="profile-info">
          <p><strong>Name:</strong> {profile.userName}</p>
          <p><strong>Interests:</strong> {profile.interests}</p>
          <p><strong>Preferred Cryptos:</strong> {profile.preferredCryptos.map(crypto => crypto.name).join(', ')}</p>
          <p><strong>Contact Methods:</strong> {profile.contactMethods}</p>
          <p><strong>Timezone:</strong> {profile.timezone}</p>
        </div>
        <div className="buttons">
          <button>Edit Profile</button>
          <button>Cryptos</button>
          <button>Contact Methods</button>
        </div>
      </div>

      <hr className="separator" />

      <form className="profile-form">
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={profile.email}
            placeholder="Enter your email"
            onChange={(e) => handleInputChange('email', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="firstName">First Name:</label>
          <input
            type="text"
            id="firstName"
            value={profile.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="lastName">Last Name:</label>
          <input
            type="text"
            id="lastName"
            value={profile.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="timezone">Timezone:</label>
          <select
            id="timezone"
            value={profile.timezone}
            onChange={(e) => handleInputChange('timezone', e.target.value)}
          >
            <option value="">Select your timezone</option>
            <option value="UTC">UTC</option>
            <option value="GMT">GMT</option>
            <option value="EST">EST</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="interests">Interests:</label>
          <textarea
            id="interests"
            value={profile.interests}
            onChange={(e) => handleInputChange('interests', e.target.value)}
            rows={4}
          />
        </div>
        <div className="form-group">
          <label htmlFor="whatDoYouDo">What do you do?</label>
          <textarea
            id="whatDoYouDo"
            value={profile.whatDoYouDo}
            onChange={(e) => handleInputChange('whatDoYouDo', e.target.value)}
            rows={6}
          />
        </div>
        <div className="form-actions">
          <button type="button" onClick={handleSaveChanges}>Save Changes</button>
        </div>
      </form>
    </div>
  );
};

export default ProfileData;
