import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
import EditIcon from '@mui/icons-material/Edit';
import PostAddIcon from '@mui/icons-material/PostAdd';
import BadgeDisplay from '../gamification/BadgeDisplay';

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
        <Paper elevation={2} sx={{ p: 3, mb: 3, position: 'relative' }}>
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box>
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
                            </Box>
                            {profile.featured_badge && (
                                <BadgeDisplay 
                                    badge={profile.featured_badge} 
                                    showName={false} 
                                    context="profile"
                                />
                            )}
                        </Box>
                        
                        {/* Action Buttons */}
                        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
                            {isOwnProfile && (
                                <>
                                    <Button
                                        component={Link}
                                        to="/publications/create"
                                        variant="contained"
                                        color="primary"
                                        startIcon={<PostAddIcon />}
                                        size="small"
                                    >
                                        Crear publicación
                                    </Button>
                                    <Button
                                        component={Link}
                                        to="/profiles/my_profile/edit"
                                        variant="outlined"
                                        color="primary"
                                        startIcon={<EditIcon />}
                                        size="small"
                                    >
                                        Editar perfil
                                    </Button>
                                </>
                            )}
                            {!isOwnProfile && (
                                <Tooltip title={isAuthenticated ? "Enviar un mensaje" : "Inicia sesión para enviar un mensaje"}>
                                    <Button 
                                        variant="contained"
                                        color="primary"
                                        onClick={onSendMessage}
                                        disabled={isNavigating}
                                        startIcon={isNavigating ? <CircularProgress size={20} color="inherit" /> : <MessageIcon />}
                                        sx={{ 
                                            '&:hover': {
                                                backgroundColor: 'primary.dark'
                                            }
                                        }}
                                    >
                                        Enviar mensaje
                                    </Button>
                                </Tooltip>
                            )}
                        </Box>
                    </Box>
                    {profile.profile_description && (
                        <Typography variant="body1" paragraph>
                            {profile.profile_description}
                        </Typography>
                    )}
                </Grid>
            </Grid>
        </Paper>
    );
};

export default ProfileHeader; 