import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, Outlet, Link } from 'react-router-dom';
import { Box, Paper, useTheme, useMediaQuery, Typography, Avatar } from '@mui/material';
import ThreadList from './ThreadList';
import { AuthContext } from '../context/AuthContext';

const MessagesLayout = () => {
    const { t } = useTranslation('messages');
    const { userId } = useParams();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { authState } = useContext(AuthContext);
    const currentUser = authState.user;

    const handleThreadSelect = (nextUserId) => {
        navigate(`/messages/thread/${nextUserId}`);
    };

    const showList = !isMobile || !userId;
    const showThread = !isMobile || Boolean(userId);

    return (
        <Box sx={{
            flex: 1,
            minHeight: 0,
            height: '100%',
            display: 'flex',
            overflow: 'hidden',
            bgcolor: 'background.default',
        }}>
            <Paper
                data-testid="inbox-list"
                elevation={0}
                sx={{
                    width: { xs: '100%', md: 320 },
                    flex: { xs: '1 1 auto', md: '0 0 320px' },
                    minWidth: 0,
                    minHeight: 0,
                    display: showList ? 'flex' : 'none',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    borderRight: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Box sx={{
                    flexShrink: 0,
                    px: 2,
                    py: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                }}>
                    <Link
                        to="/profiles/my_profile"
                        style={{
                            textDecoration: 'none',
                            color: 'inherit',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            minWidth: 0,
                        }}
                    >
                        <Avatar
                            src={currentUser?.profile_picture}
                            sx={{ width: 32, height: 32 }}
                        >
                            {currentUser?.username?.[0]?.toUpperCase()}
                        </Avatar>
                        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 500 }}>
                            {currentUser?.username}
                        </Typography>
                    </Link>
                </Box>
                <ThreadList onThreadSelect={handleThreadSelect} />
            </Paper>

            <Box
                data-testid="inbox-thread"
                sx={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                    display: showThread ? 'flex' : 'none',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {userId ? (
                    <Outlet />
                ) : (
                    <Box sx={{
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        px: 3,
                    }}>
                        <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                            <h2>{t('layout.selectTitle')}</h2>
                            <p>{t('layout.selectHint')}</p>
                        </Box>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default MessagesLayout;
