import React, { useState, useEffect } from 'react';
import clienteAxios from '../config/axios';

const ProfileData = () => {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [interests, setInterests] = useState('');
  const [whatDoYouDo, setWhatDoYouDo] = useState('');
  const [userName, setUserName] = useState('');
  const [preferredCryptos, setPreferredCryptos] = useState([]);
  const [contactMethods, setContactMethods] = useState('');
  const [profileId, setProfileId] = useState(null);
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        console.log('Fetching profile data');
        const { data } = await clienteAxios.get('/profiles');
        console.log(data[0].id);

        setProfileId(data[0].id);
        setUserName(data[0].user.username || '');
        setEmail(data[0].email || '');
        setFirstName(data[0].firstName || '');
        setLastName(data[0].lastName || '');
        setTimezone(data[0].timezone || '');
        setInterests(data[0].interests || '');
        setWhatDoYouDo(data[0].whatDoYouDo || '');
        setPreferredCryptos(data[0].cryptos_list || []);
        setContactMethods(data[0].contactMethods || '');
      } catch (error) {
        console.error('Error al buscar perfiles:', error);
      }
    };

    fetchProfileData();
  }, []);

  const handleSaveChanges = async () => {
    const updatedData = {
      timezone,
      interests,
      profile_description: whatDoYouDo,
    };

    try {
      const response = await clienteAxios.put(`/profiles/${profileId}/`, updatedData);
      console.log('Profile updated successfully:', response.data);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  return (
    <div className="user-profile">
      <div className="profile-header">
        <h1>User Profile</h1>
        <div className="profile-info">
          <p><strong>Name:</strong> {userName}</p>
          <p><strong>Interests:</strong> {interests}</p>
          <p><strong>Preferred Cryptos:</strong> {preferredCryptos.map(crypto => crypto.name).join(', ')}</p>
          <p><strong>Contact Methods:</strong> {contactMethods}</p>
          <p><strong>Timezone:</strong> {timezone}</p>
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
            value={email}
            placeholder={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="firstName">First Name:</label>
          <input
            type="text"
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="lastName">Last Name:</label>
          <input
            type="text"
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="timezone">Timezone:</label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
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
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            rows={4}
          />
        </div>
        <div className="form-group">
          <label htmlFor="whatDoYouDo">What do you do?</label>
          <textarea
            id="whatDoYouDo"
            value={whatDoYouDo}
            onChange={(e) => setWhatDoYouDo(e.target.value)}
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
