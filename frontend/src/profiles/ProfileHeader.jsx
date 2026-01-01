import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Button, 
    Paper, 
    Grid, 
    Tooltip,
    CircularProgress,
    IconButton
} from '@mui/material';
import MessageIcon from '@mui/icons-material/Message';
import SettingsIcon from '@mui/icons-material/Settings';
import EditIcon from '@mui/icons-material/Edit';

const ProfileHeader = ({ 
    profile, 
    isOwnProfile, 
    isAuthenticated, 
    onSendMessage, 
    isNavigating,
    onSecurityClick
}) => {
    const navigate = useNavigate();

    const handleProfileClick = () => {
        navigate(`/profiles/user_profile/${profile.user.id}`);
    };

    return (
        <Paper elevation={2} sx={{ p: 3, mb: 3, position: 'relative' }}>
            {/* Configuration Icon - Top Right Corner */}
            {isOwnProfile && (
                <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
                    <Tooltip title="Configuración">
                        <IconButton
                            onClick={onSecurityClick}
                            size="small"
                            sx={{
                                color: 'text.secondary',
                                '&:hover': {
                                    color: 'primary.main',
                                    backgroundColor: 'action.hover'
                                }
                            }}
                        >
                            <SettingsIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            )}

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
                        
                        {/* Action Buttons */}
                        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
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
                    <Typography variant="body1" paragraph>
                        {profile.profile_description || 'No hay descripción disponible.'}
                    </Typography>
                    
                    {/* Edit Profile Button - Below Description */}
                    {isOwnProfile && (
                        <Box sx={{ mt: 2 }}>
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
                        </Box>
                    )}
                </Grid>
            </Grid>
        </Paper>
    );
};

export default ProfileHeader; 