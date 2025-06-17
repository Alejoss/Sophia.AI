import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Button, 
    Paper, 
    Grid, 
    Tooltip,
    CircularProgress
} from '@mui/material';
import MessageIcon from '@mui/icons-material/Message';

const ProfileHeader = ({ 
    profile, 
    isOwnProfile, 
    isAuthenticated, 
    onSendMessage, 
    isNavigating 
}) => {
    const navigate = useNavigate();

    const handleProfileClick = () => {
        navigate(`/profiles/user_profile/${profile.user.id}`);
    };

    return (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <img 
                            src={profile.profile_picture || '/default-avatar.png'} 
                            alt="Profile" 
                            style={{ 
                                width: '150px', 
                                height: '150px', 
                                borderRadius: '50%', 
                                objectFit: 'cover',
                                cursor: 'pointer'
                            }}
                            onClick={handleProfileClick}
                        />
                    </Box>
                </Grid>
                <Grid item xs={12} md={9}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Typography 
                            variant="h4" 
                            onClick={handleProfileClick}
                            sx={{ 
                                cursor: 'pointer',
                                '&:hover': {
                                    color: 'primary.main'
                                }
                            }}
                        >
                            {profile.user.username}
                        </Typography>
                        {!isOwnProfile && (
                            <Tooltip title={isAuthenticated ? "Send a message" : "Login to send a message"}>
                                <Button 
                                    variant="contained"
                                    color="primary"
                                    onClick={onSendMessage}
                                    disabled={isNavigating}
                                    startIcon={isNavigating ? <CircularProgress size={20} color="inherit" /> : <MessageIcon />}
                                    sx={{ 
                                        ml: 1,
                                        '&:hover': {
                                            backgroundColor: 'primary.dark'
                                        }
                                    }}
                                >
                                    Send Message
                                </Button>
                            </Tooltip>
                        )}
                    </Box>
                    <Typography variant="body1" paragraph>
                        {profile.profile_description || 'No description available.'}
                    </Typography>
                </Grid>
            </Grid>
        </Paper>
    );
};

export default ProfileHeader; 