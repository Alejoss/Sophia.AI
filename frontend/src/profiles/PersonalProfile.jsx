import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getUserProfile } from '../api/profilesApi';
import PublicationList from '../publications/PublicationList';
import './PersonalProfile.css';
import { Typography } from '@mui/material';

const PersonalProfile = () => {
  const [activeTab, setActiveTab] = useState('publications');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { authState } = useContext(AuthContext);
  const user = authState.user;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileData = await getUserProfile();
        console.log('Profile data received:', profileData);
        console.log('Profile picture URL:', profileData?.profile_picture);
        setProfile(profileData);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  console.log('Current profile state:', profile);
  console.log('Profile picture being used in render:', profile?.profile_picture || '/default-avatar.png');

  return (
    <div className="profile-container">
      {/* Left Sidebar */}
      <div className="profile-sidebar">
        <div className="profile-header">
          <div className="profile-picture">
            <img src={profile?.profile_picture || '/default-avatar.png'} alt="Profile" />
          </div>
          <h2 className="profile-name">{user?.username}</h2>
          <Link 
            to="/profiles/my_profile/edit"
            style={{
              backgroundColor: '#1976d2',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '4px',
              textDecoration: 'none',
              marginBottom: '20px'
            }}
          >
            Edit Profile
          </Link>
          {/* TODO: Add country flag component */}
          <div className="favorite-cryptos">
            <h3>Favorite Cryptos:</h3>
            <div className="crypto-icons">
              {/* TODO: Replace with actual crypto icons from profile data */}
              <span className="crypto-icon bitcoin">₿</span>
              <span className="crypto-icon ethereum">Ξ</span>
              <Link to="/profile/cryptos" className="view-all">View all &gt;</Link>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="profile-nav">
          <Link to="/profiles/profile_certificates" className="nav-item">
            <span>Certificates</span>
            <span className="arrow">›</span>
          </Link>
          <Link to="/profiles/certificate-requests" className="nav-item">
            <span>Certificate Requests</span>
            <span className="arrow">›</span>
          </Link>
          <Link to="/content/library_user" className="nav-item">
            <span>Library</span>
            <span className="arrow">›</span>
          </Link>
          <Link to="/profiles/profile_bookmarks" className="nav-item">
            <span>Saved Items</span>
            <span className="arrow">›</span>
          </Link>
          <Link to="/profiles/security" className="nav-item">
            <span>Security</span>
            <span className="arrow">›</span>
          </Link>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="profile-content">
        {/* Tabs */}
        <div className="profile-tabs">
          <button 
            className={`tab ${activeTab === 'publications' ? 'active' : ''}`}
            onClick={() => setActiveTab('publications')}
          >
            Publications
          </button>
          <button 
            className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'publications' && (
            <div className="publications">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Your Publications</h3>
                <Link 
                  to="/publications/create"
                  style={{
                    backgroundColor: '#1976d2',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    textDecoration: 'none',
                  }}
                >
                  Create Publication
                </Link>
              </div>
              <PublicationList isOwnProfile={true} />
            </div>
          )}
          {activeTab === 'activity' && (
            <div className="activity">
              {/* Activity content will go here */}
              <Typography variant="body1" color="text.secondary">
                Recent activity will be shown here.
              </Typography>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalProfile;