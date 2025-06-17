import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getUserProfile } from '../api/profilesApi';
import { Outlet } from 'react-router-dom';
import HeaderComp from '../generalComponents/HeaderComp.jsx';
import './ProfileLayout.css';
import MessageIcon from '@mui/icons-material/Message';

const ProfileLayout = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const { authState } = useContext(AuthContext);
    const user = authState.user;

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const profileData = await getUserProfile();
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

    return (
        <div className="profile-container">
            <HeaderComp />
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
                    <Link to="/profiles/my_profile" className="nav-item">
                        <span>Publications</span>
                        <span className="arrow">›</span>
                    </Link>
                    <Link to="/profiles/profile_certificates" className="nav-item">
                        <span>Certificates</span>
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
                    <Link to="/messages" className="nav-item">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MessageIcon fontSize="small" />
                            Messages
                        </span>
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
                <Outlet />
            </div>
        </div>
    );
};

export default ProfileLayout;
