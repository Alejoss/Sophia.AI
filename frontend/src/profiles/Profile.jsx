import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { AuthContext } from '../context/AuthContext';
import { getUserProfile, getProfileById, getNotifications, markNotificationAsRead, markAllNotificationsAsRead, changePassword } from '../api/profilesApi';
import { useNotifications } from '../context/NotificationsContext.jsx';
import ProfileHeader from './ProfileHeader';
import ProfileHeaderSkeleton from '../components/ProfileHeaderSkeleton';
import ProfileVerticalNavigation from './ProfileVerticalNavigation';
import PublicationList from '../publications/PublicationList';
import Notifications from './Notifications';
import UserEvents from '../events/UserEvents';
import Certificates from './Certificates';
import Bookmarks from './Bookmarks';
import KnowledgePathsUser from '../knowledgePaths/KnowledgePathsUser';
import KnowledgePathsByUser from '../knowledgePaths/KnowledgePathsByUser';
import TopicsUser from '../topics/TopicsUser';
import TopicsByUser from '../topics/TopicsByUser';
import FavoriteCryptos from './FavoriteCryptos';
import FeaturedBadgeSelector from '../gamification/FeaturedBadgeSelector';
import BadgeList from '../gamification/BadgeList';
import SuggestionModal from './SuggestionModal';
import ProfileSharedCollections from './ProfileSharedCollections';
import contentApi from '../api/contentApi';
import { useBadges } from '../gamification/useBadges';
import { 
    Box, 
    Typography, 
    CircularProgress, 
    Tabs, 
    Tab,
    Button,
    Grid,
    Container,
    Paper,
    TextField,
    Alert
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SecurityIcon from '@mui/icons-material/Security';
import { passwordField } from '../utils/formSchemas.js';
import { applyApiErrorsToForm } from '../utils/apiFormErrors.js';

const changePasswordSchema = yup.object({
  old_password: yup
    .string()
    .required('La contraseña actual es requerida.'),
  new_password: passwordField().test(
    'different-from-old',
    'La nueva contraseña debe ser diferente a la actual.',
    function differentFromOld(value) {
      return value !== this.parent.old_password;
    },
  ),
  confirm_password: yup
    .string()
    .required('Confirma la nueva contraseña.')
    .oneOf([yup.ref('new_password')], 'Las contraseñas no coinciden.'),
});

// Security Section Component
export const SecuritySection = () => {
  const [generalError, setGeneralError] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(changePasswordSchema),
    defaultValues: {
      old_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  const onSubmit = async ({ old_password, new_password, confirm_password }) => {
    setGeneralError('');
    setSuccess(false);

    try {
      await changePassword(old_password, new_password, confirm_password);
      setSuccess(true);
      reset({
        old_password: '',
        new_password: '',
        confirm_password: '',
      });
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    } catch (err) {
      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setError,
        'Error al cambiar la contraseña. Por favor, intenta nuevamente.',
      );
      if (parsed) {
        setGeneralError(parsed);
      }
    }
  };

  return (
    <Box>
      <Typography
        variant="h4"
        gutterBottom
        sx={{
          fontSize: {
            xs: "1.5rem",
            sm: "1.75rem",
            md: "2.125rem",
          },
          fontWeight: 600,
        }}
      >
        Configuración de seguridad
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Cambia tu contraseña para mantener tu cuenta segura.
      </Typography>

      <Paper elevation={1} sx={{ p: 3, maxWidth: 600 }}>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              ¡Contraseña cambiada exitosamente!
            </Alert>
          )}

          {generalError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {generalError}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Contraseña actual"
            type="password"
            margin="normal"
            disabled={isSubmitting || success}
            autoComplete="current-password"
            error={!!errors.old_password}
            helperText={errors.old_password?.message}
            {...register('old_password')}
          />

          <TextField
            fullWidth
            label="Nueva contraseña"
            type="password"
            margin="normal"
            disabled={isSubmitting || success}
            autoComplete="new-password"
            error={!!errors.new_password}
            helperText={errors.new_password?.message || 'Mínimo 8 caracteres, mayúsculas, minúsculas, números y símbolos'}
            {...register('new_password')}
          />

          <TextField
            fullWidth
            label="Confirmar nueva contraseña"
            type="password"
            margin="normal"
            disabled={isSubmitting || success}
            autoComplete="new-password"
            error={!!errors.confirm_password}
            helperText={errors.confirm_password?.message}
            {...register('confirm_password')}
          />

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSubmitting || success}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
            >
              {isSubmitting ? 'Cambiando...' : success ? 'Cambiada' : 'Cambiar contraseña'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

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
    const { unreadCount: unreadNotificationsCount, refreshUnreadCount } = useNotifications();
    const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
    /** Total public collections for another user's profile (sidebar button label). */
    const [sharedCollectionsCount, setSharedCollectionsCount] = useState(null);
    
    // Determine if this is the user's own profile
    const isOwnProfile = !profileId || (currentUser && profile && currentUser.id === profile.user?.id);
    const isAuthenticated = authState.isAuthenticated;
    
    // Use badges hook - fetch own badges if own profile, otherwise fetch by userId
    const badgesUserId = isOwnProfile ? null : (profileId || profile?.user?.id);
    const { badges: userBadges, loading: badgesLoading, error: badgesError } = useBadges(badgesUserId);

    const updateProfileSectionUrl = (newSection, { tab = null } = {}) => {
        const searchParams = new URLSearchParams(location.search);
        searchParams.set('section', newSection);
        if (tab) {
            searchParams.set('tab', tab);
        } else if (newSection !== 'certificates') {
            searchParams.delete('tab');
        }
        navigate({ pathname: location.pathname, search: searchParams.toString() });
    };

    // Function to handle section changes from external navigation (like header menu)
    const handleExternalSectionChange = (newSection) => {
        setActiveSection(newSection);
        updateProfileSectionUrl(newSection);
    };

    // Expose the function globally for header navigation
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.handleProfileSectionChange = handleExternalSectionChange;
        }
        
        return () => {
            if (typeof window !== 'undefined') {
                delete window.handleProfileSectionChange;
            }
        };
    }, []);

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
        if (isOwnProfile || !profile?.user?.id) {
            setSharedCollectionsCount(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const data = await contentApi.getPublicCollections({
                    owner: profile.user.id,
                    page: 1,
                    page_size: 1,
                });
                if (cancelled) return;
                const n =
                    typeof data?.count === 'number'
                        ? data.count
                        : Array.isArray(data?.results)
                          ? data.results.length
                          : 0;
                setSharedCollectionsCount(n);
            } catch (err) {
                console.error('Error fetching shared collections count:', err);
                if (!cancelled) setSharedCollectionsCount(0);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOwnProfile, profile?.user?.id]);

    // Handle URL parameters for section navigation
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const sectionParam = urlParams.get('section');

        if (!sectionParam) return;

        if (isOwnProfile) {
            const sectionMap = {
                'knowledge-paths': 'knowledge-paths',
                'topics': 'topics',
                'publications': 'publications',
                'events': 'events',
                'certificates': 'certificates',
                'saved-items': 'saved-items',
                'cryptos': 'cryptos',
                'badges': 'badges',
                'notifications': 'notifications',
                'security': 'security',
            };
            if (sectionMap[sectionParam]) {
                setActiveSection(sectionMap[sectionParam]);
            }
        } else if (sectionParam === 'shared-collections') {
            setActiveSection('shared-collections');
        }
    }, [location.search, isOwnProfile]);

    useEffect(() => {
        if (isOwnProfile && activeSection === 'notifications') {
            fetchNotifications();
            refreshUnreadCount(true);
        }
    }, [isOwnProfile, activeSection]);

    const fetchNotifications = async () => {
        if (!isOwnProfile) return;
        
        try {
            setNotificationsLoading(true);
            const notifications = await getNotifications(true);
            setNotifications(Array.isArray(notifications) ? notifications : []);
            setNotificationsError(null);
        } catch (err) {
            setNotificationsError('Error al obtener las notificaciones');
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
            await refreshUnreadCount(true);
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


    const handleSectionChange = (event, newSection) => {
        setActiveSection(newSection);
        if (isOwnProfile) {
            updateProfileSectionUrl(newSection);
        }
    };

    const handleSuggestionClick = () => {
        setSuggestionModalOpen(true);
    };

    const renderSectionContent = () => {
        switch (activeSection) {
            case 'publications':
                return (
                    <Box>
                        <PublicationList isOwnProfile={isOwnProfile} userId={profile?.user?.id} />
                    </Box>
                );
            case 'shared-collections':
                if (isOwnProfile) {
                    return (
                        <Typography variant="body1" color="text.secondary">
                            Las colecciones compartidas de otros usuarios se muestran al visitar su perfil.
                        </Typography>
                    );
                }
                return (
                    <ProfileSharedCollections
                        userId={profile?.user?.id}
                        ownerUsername={profile?.user?.username}
                    />
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
                                    await refreshUnreadCount(true);
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
                            La actividad reciente se mostrará aquí.
                        </Typography>
                    </Box>
                );
            case 'security':
                return isOwnProfile ? <SecuritySection /> : null;
            case 'certificates':
                return <Certificates isOwnProfile={isOwnProfile} userId={profile?.user?.id} />;
            case 'saved-items':
                return isOwnProfile ? <Bookmarks /> : null;
            case 'cryptos':
                return <FavoriteCryptos isOwnProfile={isOwnProfile} userId={profile?.user?.id} />;
            case 'knowledge-paths':
                return isOwnProfile ? <KnowledgePathsUser /> : (
                    <KnowledgePathsByUser 
                        userId={profile?.user?.id} 
                        authorName={profile?.user?.username || 'User'}
                    />
                );
            case 'topics':
                return isOwnProfile ? <TopicsUser /> : (
                    <TopicsByUser 
                        userId={profile?.user?.id} 
                        userName={profile?.user?.username || 'User'}
                    />
                );
            case 'events':
                return <UserEvents isOwnProfile={isOwnProfile} userId={profile?.user?.id} />;
            case 'badges':
                // Use hook data for own profile, fallback to profile data for others
                const badgesToShow = isOwnProfile ? userBadges : (profile?.badges || []);
                
                return (
                    <Box>
                        <Typography 
                            variant="body1" 
                            color="text.secondary" 
                            sx={{ mb: 3, lineHeight: 1.6, fontStyle: 'italic' }}
                        >
                            Las insignias reflejan tu recorrido dentro de la red de conocimiento compartido de Academia Blockchain. Se obtienen al aprender, aportar y generar valor real para la comunidad.
                        </Typography>
                        {isOwnProfile && (
                            <Box sx={{ mb: 4 }}>
                                <FeaturedBadgeSelector
                                    badges={badgesToShow}
                                    currentFeaturedBadgeId={profile?.featured_badge?.id}
                                    onUpdate={async () => {
                                        // Refetch profile to get updated featured_badge
                                        try {
                                            const profileData = await getUserProfile();
                                            setProfile(profileData);
                                            // Also refresh badges
                                            // The hook will automatically refetch when component re-renders
                                        } catch (err) {
                                            console.error('Error refreshing profile:', err);
                                        }
                                    }}
                                />
                            </Box>
                        )}
                        <BadgeList 
                            badges={badgesToShow}
                            title={isOwnProfile ? "Mis Insignias" : "Insignias"}
                            emptyMessage={isOwnProfile ? "Aún no has obtenido insignias. ¡Sigue aprendiendo y contribuyendo!" : "Este usuario aún no tiene insignias."}
                            loading={badgesLoading}
                            error={badgesError}
                            showEarningTooltip={isOwnProfile}
                        />
                    </Box>
                );
            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <Container maxWidth="xl" sx={{ pb: 3 }}>
                <ProfileHeaderSkeleton />
            </Container>
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
                <Typography>No se encontró el perfil</Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ pb: 3 }}>
            <ProfileHeader 
                profile={profile}
                isOwnProfile={isOwnProfile}
                isAuthenticated={isAuthenticated}
                onSendMessage={handleSendMessage}
                isNavigating={isNavigating}
            />
            
            {/* Use flexbox instead of Grid for better control with fixed-width navigation */}
            <Box sx={{ 
                display: 'flex', 
                gap: 3, 
                mt: 0,
                flexDirection: { xs: 'column', md: 'row' }
            }}>
                {/* Left Sidebar - Profile Vertical Navigation - Hidden on mobile */}
                <Box sx={{ 
                    flexShrink: 0,
                    width: { xs: '100%', md: '280px' },
                    display: { xs: 'none', md: 'block' }
                }}>
                    <Box sx={{ position: 'sticky', top: 20 }}>
                        <ProfileVerticalNavigation 
                            isOwnProfile={isOwnProfile} 
                            userId={profile?.user?.id}
                            activeSection={activeSection}
                            onSectionChange={handleSectionChange}
                            onSuggestionClick={handleSuggestionClick}
                            unreadNotificationsCount={unreadNotificationsCount}
                            sharedCollectionsCount={sharedCollectionsCount}
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
            
            {/* Suggestion Modal */}
            {isOwnProfile && (
                <SuggestionModal 
                    open={suggestionModalOpen} 
                    onClose={() => setSuggestionModalOpen(false)} 
                />
            )}
        </Container>
    );
};

export default Profile; 