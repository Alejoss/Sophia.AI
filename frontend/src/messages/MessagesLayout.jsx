import React, { useState, useContext } from 'react';
import { useNavigate, useParams, Outlet, Link } from 'react-router-dom';
import { Box, Paper, useTheme, useMediaQuery, Typography, Avatar, IconButton } from '@mui/material';
import ThreadList from './ThreadList';
import MessageThread from './MessageThread';
import { AuthContext } from '../context/AuthContext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const MessagesLayout = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [selectedThread, setSelectedThread] = useState(null);
    const { authState } = useContext(AuthContext);
    const currentUser = authState.user;

    const handleThreadSelect = (userId) => {
        setSelectedThread(userId);
        navigate(`/messages/thread/${userId}`);
    };

    return (
        <Box sx={{ 
            height: 'calc(100vh - 64px)', // Subtract header height
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Top Header with Profile Link */}
            <Paper 
                elevation={0} 
                sx={{ 
                    p: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2
                }}
            >
                <Link 
                    to="/profiles/my_profile"
                    style={{ 
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <Avatar 
                        src={currentUser?.profile_picture}
                        sx={{ width: 32, height: 32 }}
                    >
                        {currentUser?.username?.[0]?.toUpperCase()}
                    </Avatar>
                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                        {currentUser?.username}
                    </Typography>
                </Link>
            </Paper>

            {/* Main Content Area */}
            <Box sx={{ 
                flex: 1,
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                overflow: 'hidden'
            }}>
                {/* Left Panel - Thread List */}
                <Paper 
                    elevation={0} 
                    sx={{ 
                        width: { xs: '100%', md: 320 },
                        height: { xs: userId ? 0 : '100%', md: '100%' },
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        display: { xs: userId ? 'none' : 'block', md: 'block' }
                    }}
                >
                    <ThreadList onThreadSelect={handleThreadSelect} />
                </Paper>

                {/* Middle Panel - Message Thread */}
                <Box 
                    sx={{ 
                        flex: 1,
                        height: '100%',
                        display: { xs: userId ? 'block' : 'none', md: 'flex' },
                        flexDirection: 'column'
                    }}
                >
                    {userId ? (
                        <>
                            {/* Thread Header */}
                            <Paper 
                                elevation={0} 
                                sx={{ 
                                    p: 2,
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2
                                }}
                            >
                                <IconButton 
                                    onClick={() => navigate('/messages')}
                                    sx={{ display: { md: 'none' } }}
                                >
                                    <ArrowBackIcon />
                                </IconButton>
                                <MessageThread />
                            </Paper>
                        </>
                    ) : (
                        <Box 
                            sx={{ 
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'background.default'
                            }}
                        >
                            <Box 
                                sx={{ 
                                    textAlign: 'center',
                                    color: 'text.secondary',
                                    p: 3
                                }}
                            >
                                <h2>Seleccione una conversación</h2>
                                <p>Elija una conversación de la lista o inicie una nueva</p>
                            </Box>
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default MessagesLayout; 