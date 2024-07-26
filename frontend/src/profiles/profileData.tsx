import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '/src/context/AuthContext.tsx';
import fetchProfileData from "/src/api/profilesAPi.ts"; // Importa la función desde el archivo
import clienteAxios from '/src/api/axios';

const ProfileData = () => {
  const { username } = useContext(AuthContext);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [interests, setInterests] = useState('');
  const [whatDoYouDo, setWhatDoYouDo] = useState('');
  const [userName, setUserName] = useState('');
  const [preferredCryptos, setPreferredCryptos] = useState([]);
  const [contactMethods, setContactMethods] = useState('');
  const [profileId, setProfileId] = useState(null);
  const [email, setEmail] = useState('');

  const storedUsername = localStorage.getItem('userName');

  useEffect(() => {
    const Data = async () => {
      try {
        const { user, updatedUser } = await fetchProfileData(storedUsername);

        if (user) {
          console.log(updatedUser.email);

          setProfileId(user.id);
          setUserName(user.user.username || '');
          setFirstName(user.firstName || '');
          setLastName(user.lastName || '');
          setTimezone(user.timezone || '');
          setInterests(user.interests || '');
          setWhatDoYouDo(user.whatDoYouDo || '');
          setPreferredCryptos(user.cryptos_list || []);
          setContactMethods(user.contactMethods || '');
          setEmail(updatedUser.email || '');
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      }
    };

    Data();
  }, [username, storedUsername]);

  const handleSaveChanges = async () => {
    const updatedData = {
      firstName,
      lastName,
      timezone,
      interests,
      profile_description: whatDoYouDo,
    };

    const updatedEmailData = {
      email: email,
    };

    try {
      const response = await clienteAxios.put(`/profiles/${profileId}/`, updatedData);
      console.log('Profile updated successfully:', response.data);
      const responseMail = await clienteAxios.put(`/users/${profileId}/`, updatedEmailData);
      console.log('Email updated successfully:', responseMail.data);
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
            placeholder="Enter your email"
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


