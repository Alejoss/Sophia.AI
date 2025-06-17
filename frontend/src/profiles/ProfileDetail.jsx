import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getProfileById } from '../api/profilesApi';
import { AuthContext } from '../context/AuthContext';
import PublicationList from '../publications/PublicationList';
import ProfileHeader from './ProfileHeader';
import { 
    Box, 
    Typography, 
    Paper, 
    CircularProgress, 
    Tabs, 
    Tab
} from '@mui/material';

const ProfileDetail = () => {
    const { profileId: paramProfileId } = useParams();
    const location = useLocation();
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('publications');
    const [isNavigating, setIsNavigating] = useState(false);
    const { authState } = useContext(AuthContext);
    const currentUser = authState.user;
    const navigate = useNavigate();
    
    const isOwnProfile = currentUser && profile && currentUser.id === profile.user.id;
    const isAuthenticated = authState.isAuthenticated;

    useEffect(() => {
        const fetchProfile = async () => {
            setIsLoading(true);
            try {
                const profileData = await getProfileById(paramProfileId);
                console.log('Profile data received:', profileData);
                setProfile(profileData);
                setError(null);
            } catch (err) {
                console.error('Error fetching profile:', err);
                setError(err.message);
                setProfile(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [paramProfileId]);

    const handleSendMessage = () => {
        if (!isAuthenticated) {
            navigate('/profiles/login');
            return;
        }
        setIsNavigating(true);
        navigate(`/messages/thread/${profile.user.id}`);
    };

    if (isLoading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
        </Box>
    );
    
    if (error) return (
        <Box sx={{ p: 3 }}>
            <Typography color="error">Error: {error}</Typography>
        </Box>
    );
    
    if (!profile) return (
        <Box sx={{ p: 3 }}>
            <Typography>No profile found</Typography>
        </Box>
    );

    return (
        <Box sx={{ p: 3 }}>
            <ProfileHeader 
                profile={profile}
                isOwnProfile={isOwnProfile}
                isAuthenticated={isAuthenticated}
                onSendMessage={handleSendMessage}
                isNavigating={isNavigating}
            />
            
            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs 
                    value={activeTab} 
                    onChange={(e, newValue) => setActiveTab(newValue)}
                >
                    <Tab label="Publications" value="publications" />
                    <Tab label="Activity" value="activity" />
                </Tabs>
            </Box>

            {/* Tab Content */}
            <Box>
                {activeTab === 'publications' && (
                    <Box>
                        <PublicationList isOwnProfile={isOwnProfile} userId={profile.user.id} />
                    </Box>
                )}
                {activeTab === 'activity' && (
                    <Box>
                        <Typography variant="body1" color="text.secondary">
                            Recent activity will be shown here.
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default ProfileDetail;
