import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getUserProfile, getProfileById, getNotifications, markNotificationAsRead, markAllNotificationsAsRead, getUnreadNotificationsCount } from '../api/profilesApi';
import ProfileHeader from './ProfileHeader';
import ProfileVerticalNavigation from './ProfileVerticalNavigation';
import PublicationList from '../publications/PublicationList';
import Notifications from './Notifications';
import UserEvents from '../events/UserEvents';
import Certificates from './Certificates';
import Bookmarks from './Bookmarks';
import KnowledgePathsUser from '../knowledgePaths/KnowledgePathsUser';
import KnowledgePathsByUser from '../knowledgePaths/KnowledgePathsByUser';
import FavoriteCryptos from './FavoriteCryptos';
import { 
    Box, 
    Typography, 
    CircularProgress, 
    Tabs, 
    Tab,
    Button,
    Grid,
    Container,
    Paper
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SecurityIcon from '@mui/icons-material/Security';

// Placeholder components for different sections
const SecuritySection = () => (
  <Box>
    <Typography variant="h5" gutterBottom>Security Settings</Typography>
    <Typography variant="body1" color="text.secondary">
      Password change and security settings will be implemented here.
    </Typography>
  </Box>
);

const Profile = () => {
    const { profileId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { authState } = useContext(AuthContext);
    const currentUser = authState.user;
    
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeSection, setActiveSection] = useState('publications');
    const [notifications, setNotifications] = useState([]);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [notificationsError, setNotificationsError] = useState(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
    
    // Determine if this is the user's own profile
    const isOwnProfile = !profileId || (currentUser && profile && currentUser.id === profile.user?.id);
    const isAuthenticated = authState.isAuthenticated;

    useEffect(() => {
        const fetchProfile = async () => {
            setIsLoading(true);
            try {
                let profileData;
                if (profileId) {
                    // Fetching another user's profile
                    profileData = await getProfileById(profileId);
                } else {
                    // Fetching own profile
                    profileData = await getUserProfile();
                }
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
    }, [profileId]);

    useEffect(() => {
        if (isOwnProfile) {
            fetchUnreadNotificationsCount();
        }
    }, [isOwnProfile]);

    // Handle URL parameters for section navigation
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const sectionParam = urlParams.get('section');
        
        if (sectionParam && isOwnProfile) {
            // Map URL parameter to section name
            const sectionMap = {
                'knowledge-paths': 'knowledge-paths',
                'publications': 'publications',
                'events': 'events',
                'certificates': 'certificates',
                'saved-items': 'saved-items',
                'cryptos': 'cryptos',
                'notifications': 'notifications',
                'security': 'security'
            };
            
            if (sectionMap[sectionParam]) {
                setActiveSection(sectionMap[sectionParam]);
            }
        }
    }, [location.search, isOwnProfile]);

    useEffect(() => {
        if (isOwnProfile && activeSection === 'notifications') {
            fetchNotifications();
        }
    }, [isOwnProfile, activeSection]);

    const fetchUnreadNotificationsCount = async () => {
        if (!isOwnProfile) return;
        
        try {
            const count = await getUnreadNotificationsCount();
            setUnreadNotificationsCount(count);
        } catch (err) {
            console.error('Error fetching unread notifications count:', err);
            setUnreadNotificationsCount(0);
        }
    };

    const fetchNotifications = async () => {
        if (!isOwnProfile) return;
        
        try {
            setNotificationsLoading(true);
            const notifications = await getNotifications(true);
            setNotifications(Array.isArray(notifications) ? notifications : []);
            setNotificationsError(null);
        } catch (err) {
            setNotificationsError('Failed to fetch notifications');
            console.error('Error fetching notifications:', err);
            setNotifications([]);
        } finally {
            setNotificationsLoading(false);
        }
    };

    const handleMarkAsRead = async (notificationId) => {
        try {
            await markNotificationAsRead(notificationId);
            await fetchNotifications();
            await fetchUnreadNotificationsCount(); // Refresh count after marking as read
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    const handleSendMessage = () => {
        if (!isAuthenticated) {
            navigate('/profiles/login');
            return;
        }
        setIsNavigating(true);
        navigate(`/messages/thread/${profile.user.id}`);
    };

    const handleSecurityClick = () => {
        setActiveSection('security');
    };

    const handleSectionChange = (event, newSection) => {
        setActiveSection(newSection);
    };

    const renderSectionContent = () => {
        switch (activeSection) {
            case 'publications':
                return (
                    <Box>
                        {isOwnProfile && (
                            <Box sx={{ mb: 3, display: 'flex', flexwrap:'wrap', justifyContent: 'flex-end' }}>
                                <Button
                                    component={Link}
                                    to="/publications/create"
                                    variant="contained"
                                    color="primary"
                                    startIcon={<EditIcon />}
                                >
                                    Create Publication
                                </Button>
                            </Box>
                        )}
                        <PublicationList isOwnProfile={isOwnProfile} userId={profile?.user?.id} />
                    </Box>
                );
            case 'notifications':
                if (isOwnProfile) {
                    const unreadCount = notifications.filter(n => n.unread).length;
                    return (
                        <Notifications
                            notifications={notifications}
                            loading={notificationsLoading}
                            error={notificationsError}
                            unreadCount={unreadCount}
                            onMarkAsRead={handleMarkAsRead}
                            onMarkAllAsRead={async () => {
                                try {
                                    await markAllNotificationsAsRead();
                                    await fetchNotifications();
                                    await fetchUnreadNotificationsCount(); // Refresh count after marking all as read
                                } catch (err) {
                                    console.error('Error marking all notifications as read:', err);
                                }
                            }}
                            onRefresh={fetchNotifications}
                        />
                    );
                }
                return (
                    <Box>
                        <Typography variant="body1" color="text.secondary">
                            Recent activity will be shown here.
                        </Typography>
                    </Box>
                );
            case 'security':
                return isOwnProfile ? <SecuritySection /> : null;
            case 'certificates':
                return <Certificates isOwnProfile={isOwnProfile} userId={profile?.user?.id} />;
            case 'saved-items':
                return <Bookmarks />;
            case 'cryptos':
                return <FavoriteCryptos isOwnProfile={isOwnProfile} userId={profile?.user?.id} />;
            case 'knowledge-paths':
                return isOwnProfile ? <KnowledgePathsUser /> : (
                    <KnowledgePathsByUser 
                        userId={profile?.user?.id} 
                        authorName={profile?.user?.username || 'User'}
                    />
                );
            case 'events':
                return <UserEvents isOwnProfile={isOwnProfile} userId={profile?.user?.id} />;
            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }
    
    if (error) {
        return (
            <Container maxWidth="xl" sx={{ py: 3 }}>
                <Typography color="error">Error: {error}</Typography>
            </Container>
        );
    }
    
    if (!profile) {
        return (
            <Container maxWidth="xl" sx={{ py: 3 }}>
                <Typography>No profile found</Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 3 }}>
            <ProfileHeader 
                profile={profile}
                isOwnProfile={isOwnProfile}
                isAuthenticated={isAuthenticated}
                onSendMessage={handleSendMessage}
                isNavigating={isNavigating}
                onSecurityClick={handleSecurityClick}
            />
            
            {/* Use flexbox instead of Grid for better control with fixed-width navigation */}
            <Box sx={{ 
                display: 'flex', 
                gap: 3, 
                mt: 0,
                flexDirection: { xs: 'column', md: 'row' }
            }}>
                {/* Left Sidebar - Profile Vertical Navigation */}
                <Box sx={{ 
                    flexShrink: 0,
                    width: { xs: '100%', md: '280px' }
                }}>
                    <Box sx={{ position: 'sticky', top: 20 }}>
                        <ProfileVerticalNavigation 
                            isOwnProfile={isOwnProfile} 
                            userId={profile?.user?.id}
                            activeSection={activeSection}
                            onSectionChange={handleSectionChange}
                            unreadNotificationsCount={unreadNotificationsCount}
                        />
                    </Box>
                </Box>

                {/* Main Content Area */}
                <Box sx={{ 
                    flex: 1,
                    minWidth: 0 // Prevents flex item from overflowing
                }}>
                    {/* Section Content */}
                    <Paper elevation={1} sx={{ p: 3, minHeight: '400px', width: '100%' }}>
                        {renderSectionContent()}
                    </Paper>
                </Box>
            </Box>
        </Container>
    );
};

export default Profile; 