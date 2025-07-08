import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Button, 
    Divider,
    CircularProgress,
    Paper
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { formatDate } from '../utils/dateUtils';
import contentApi from '../api/contentApi';
import ContentDisplay from '../content/ContentDisplay';
import BookmarkButton from '../bookmarks/BookmarkButton';
import VoteComponent from '../votes/VoteComponent';
import ProfileHeader from '../profiles/ProfileHeader';
import AddToLibraryModal from '../components/AddToLibraryModal';
import { getProfileById } from '../api/profilesApi';
import { useAuth } from '../context/AuthContext';

// ContentDisplay Mode: "card" - Rich card display for publication content
const PublicationDetail = () => {
    const [publication, setPublication] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isNavigating, setIsNavigating] = useState(false);
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
            <Typography color="error">Error: {error}</Typography>
        </Box>
    );

    if (!publication) return (
        <Box sx={{ p: 3 }}>
            <Typography>Publication not found</Typography>
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
                        {/* Add to Library Button - Only show if there's referenced content */}
                        {publication.content && (
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
                            Edit Publication
                        </Button>
                    </Box>
                </Box>

                {/* Publication Header */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        Published on {formatDate(publication.published_at)}
                    </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Content Reference Section */}
                {publication.content && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            Referenced Content:
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
        </Box>
    );
};

export default PublicationDetail; 