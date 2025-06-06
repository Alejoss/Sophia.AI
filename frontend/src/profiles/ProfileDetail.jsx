import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProfileById } from '../api/profilesApi';
import { AuthContext } from '../context/AuthContext';
import PublicationList from '../publications/PublicationList';
import { 
    Box, 
    Typography, 
    Paper, 
    Grid, 
    CircularProgress, 
    Tabs, 
    Tab, 
    Button, 
    Tooltip,
    IconButton
} from '@mui/material';
import MessageIcon from '@mui/icons-material/Message';

const ProfileDetail = () => {
    const { profileId } = useParams();
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('publications');
    const [isNavigating, setIsNavigating] = useState(false);
    const { authState } = useContext(AuthContext);
    const currentUser = authState.user;
    const navigate = useNavigate();
    
    const isOwnProfile = currentUser && currentUser.id === parseInt(profileId);
    const isAuthenticated = authState.isAuthenticated;

    useEffect(() => {
        const fetchProfile = async () => {
            setIsLoading(true);
            try {
                const profileData = await getProfileById(profileId);
                console.log('Profile data received:', profileData);
                console.log('Profile picture URL:', profileData?.profile_picture);
                setProfile(profileData);
                setError(null);
            } catch (err) {
                setError(err.message);
                setProfile(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [profileId]);

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

    console.log('Current profile state:', profile);
    console.log('Profile picture being used in render:', profile.profile_picture || '/default-avatar.png');

    return (
        <Box sx={{ p: 3 }}>
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={3}>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <img 
                                src={profile.profile_picture || '/default-avatar.png'} 
                                alt="Profile" 
                                style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={9}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            <Typography variant="h4">
                                {profile.user.username}
                            </Typography>
                            {!isOwnProfile && (
                                <Tooltip title={isAuthenticated ? "Send a message" : "Login to send a message"}>
                                    <IconButton 
                                        color="primary"
                                        onClick={handleSendMessage}
                                        disabled={isNavigating}
                                        sx={{ 
                                            ml: 1,
                                            '&:hover': {
                                                backgroundColor: 'primary.light',
                                                color: 'white'
                                            }
                                        }}
                                    >
                                        {isNavigating ? (
                                            <CircularProgress size={24} color="inherit" />
                                        ) : (
                                            <MessageIcon />
                                        )}
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Box>
                        <Typography variant="body1" paragraph>
                            {profile.profile_description || 'No description available.'}
                        </Typography>
                    </Grid>
                </Grid>
            </Paper>
            
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
