import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Card, Typography, Box, Chip, Divider, Button, Stack } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PersonIcon from '@mui/icons-material/Person';
import { formatDate } from '../utils/dateUtils';
import contentApi from '../api/contentApi';
import { AuthContext } from '../context/AuthContext';
import ContentReferences from './ContentReferences';
import ContentDisplay from './ContentDisplay';

const ContentDetailsLibrary = () => {
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [references, setReferences] = useState(null);
    const { contentId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { authState } = useContext(AuthContext);
    const currentUser = authState.user;

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Get context parameters from location state or query params
                const searchParams = new URLSearchParams(location.search);
                const context = searchParams.get('context') || 'library';
                const contextId = searchParams.get('userId') || currentUser?.id;

                const [contentData, referencesData] = await Promise.all([
                    contentApi.getContentDetails(contentId, context, contextId),
                    contentApi.getContentReferences(contentId)
                ]);
                
                setContent(contentData);
                setReferences(referencesData);
            } catch (err) {
                console.error('Error in ContentDetailsLibrary:', err);
                console.error('Error response:', err.response);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [contentId, location.search, currentUser]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!content) return <div>No content found</div>;

    const profile = content.selected_profile;
    
    // Determine if the current user is the owner of the profile
    const isOwner = profile?.user && currentUser && parseInt(profile.user) === parseInt(currentUser.id);
    
    // Get the username for the button text
    const ownerUsername = profile?.user_username || 'User';

    return (
        <Box sx={{ maxWidth: 800, margin: '0 auto', padding: 2, pt: 12 }}>
            {/* Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate(`/content/library_user${isOwner ? '' : `/${profile?.user}`}`)}
                >
                    {isOwner ? "Go to your library" : `Go to ${ownerUsername}'s library`}
                </Button>
                {isOwner && (
                    <Button
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => navigate(`/content/${contentId}/edit`)}
                    >
                        Edit Content
                    </Button>
                )}
            </Box>

            <Card sx={{ padding: 3 }}>
                {/* Content Display */}
                <ContentDisplay 
                    content={content}
                    variant="detailed"
                    showAuthor={true}
                />

                <Divider sx={{ my: 3 }} />

                {/* Content Details Section */}
                <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom color="text.secondary">
                        Content Details
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 2 }}>
                        <Typography variant="body2">
                            <strong>Added to Library:</strong> {formatDate(content?.created_at)}
                        </Typography>
                        {profile?.collection_name && (
                            <Typography variant="body2">
                                <strong>Collection:</strong> {profile.collection_name}
                            </Typography>
                        )}
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2">
                                <strong>Visibility:</strong>
                            </Typography>
                            {profile?.is_visible ? (
                                <VisibilityIcon color="success" />
                            ) : (
                                <VisibilityOffIcon color="error" />
                            )}
                        </Stack>
                        {profile?.is_producer && (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <PersonIcon color="primary" />
                                <Typography variant="body2">
                                    You are the producer of this content
                                </Typography>
                            </Stack>
                        )}
                    </Box>
                </Box>

                {/* Personal Notes Section */}
                {profile?.personal_note && (
                    <Box sx={{ mt: 3 }}>
                        <Typography variant="h6" gutterBottom color="text.secondary">
                            Personal Notes
                        </Typography>
                        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                {profile.personal_note}
                            </Typography>
                        </Box>
                    </Box>
                )}

                {/* Content References Section */}
                {references && (
                    <Box sx={{ mt: 4 }}>
                        <ContentReferences references={references} />
                    </Box>
                )}
            </Card>
        </Box>
    );
};

const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return 'Unknown size';
    
    const size = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    
    if (size < 1024) {
        return `${size} bytes`;
    } else if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(2)} KB`;
    } else if (size < 1024 * 1024 * 1024) {
        return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    } else {
        return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
};

export default ContentDetailsLibrary; 