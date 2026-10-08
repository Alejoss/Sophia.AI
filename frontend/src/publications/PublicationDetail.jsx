import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Button, 
    Divider,
    CircularProgress,
    Paper,
    Fab,
    Snackbar,
    Alert,
    Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import { formatDate } from '../utils/dateUtils';
import contentApi from '../api/contentApi';
import ContentDisplay from '../content/ContentDisplay';
import BookmarkButton from '../bookmarks/BookmarkButton';
import VoteComponent from '../votes/VoteComponent';
import ProfileHeader from '../profiles/ProfileHeader';
import AddToLibraryModal from '../components/AddToLibraryModal';
import { getProfileById } from '../api/profilesApi';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

// ContentDisplay Mode: "card" - Rich card display for publication content
const PublicationDetail = () => {
    const { t } = useTranslation('publications');
    const [publication, setPublication] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success',
    });
    const { publicationId } = useParams();
    const navigate = useNavigate();
    const { authState } = useAuth();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await contentApi.getPublicationDetails(publicationId);
                setPublication(data);

                if (data.content_profile?.user?.id) {
                    const profileData = await getProfileById(data.content_profile.user.id);
                    setProfile(profileData);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [publicationId]);

    const handleSendMessage = () => {
        if (!authState.isAuthenticated) {
            navigate('/profiles/login');
            return;
        }
        setIsNavigating(true);
        navigate(`/messages/thread/${profile.user.id}`);
    };

    const showSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCloseSnackbar = (_, reason) => {
        if (reason === 'clickaway') return;
        setSnackbar((prev) => ({ ...prev, open: false }));
    };

    const handleSharePublication = async () => {
        const shareUrl = `${window.location.origin}/publications/${publicationId}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            showSnackbar(t('detail.copySuccess'), 'success');
        } catch (err) {
            console.error('Failed to copy publication URL:', err);
            showSnackbar(t('detail.copyError'), 'error');
        }
    };

    const handleAddToLibrarySuccess = () => {
        // Refresh publication data after adding to library
        contentApi.getPublicationDetails(publicationId)
            .then(updatedPublication => {
                setPublication(updatedPublication);
            })
            .catch(err => {
                console.error('Error refreshing publication:', err);
            });
    };

    if (loading) return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
            <CircularProgress />
        </Box>
    );

    if (error) return (
        <Box sx={{ p: 3 }}>
            <Typography color="error">{t('detail.error', { message: error })}</Typography>
        </Box>
    );

    if (!publication) return (
        <Box sx={{ p: 3 }}>
            <Typography>{t('detail.notFound')}</Typography>
        </Box>
    );

    const isOwnProfile = authState.user && profile && authState.user.id === profile.user.id;

    return (
        <Box sx={{ p: 3 }}>
            {profile && (
                <ProfileHeader 
                    profile={profile}
                    isOwnProfile={isOwnProfile}
                    isAuthenticated={authState.isAuthenticated}
                    onSendMessage={handleSendMessage}
                    isNavigating={isNavigating}
                />
            )}

            <Paper elevation={2} sx={{ p: 3 }}>
                {/* Action Buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <VoteComponent
                        type="publication"
                        ids={{ publicationId: publicationId }}
                        initialVoteCount={publication.vote_count || 0}
                        initialUserVote={publication.user_vote || 0}
                    />
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {/* Add to Library - Only show when viewing another user's publication */}
                        {!isOwnProfile && publication.content && (
                            <AddToLibraryModal
                                content={publication.content}
                                onSuccess={handleAddToLibrarySuccess}
                            />
                        )}
                        <BookmarkButton 
                            contentId={publicationId}
                            contentType="publication"
                        />
                        <Button
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() => navigate(`/publications/${publicationId}/edit`)}
                        >
                            {t('detail.edit')}
                        </Button>
                    </Box>
                </Box>

                {/* Publication Header */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        {t('detail.published', { date: formatDate(publication.published_at) })}
                    </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Content Reference Section */}
                {publication.content && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            {t('detail.referenced')}
                        </Typography>
                        
                        <Box sx={{ mb: 2 }}>
                            <ContentDisplay 
                                content={publication.content}
                                variant="preview"
                                showAuthor={true}
                            />
                        </Box>
                    </Box>
                )}

                <Divider sx={{ my: 2 }} />

                {/* Publication Content */}
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {publication.text_content}
                </Typography>
            </Paper>

            <Tooltip title={t('detail.shareTooltip')} placement="left">
                <Fab
                    color="primary"
                    aria-label={t('detail.shareAria')}
                    onClick={handleSharePublication}
                    sx={{
                        position: 'fixed',
                        right: 24,
                        bottom: 24,
                        zIndex: (theme) => theme.zIndex.speedDial,
                    }}
                >
                    <ShareIcon />
                </Fab>
            </Tooltip>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={2500}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleCloseSnackbar}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default PublicationDetail; 