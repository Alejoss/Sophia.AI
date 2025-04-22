import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, Typography, Box, Chip, Divider, Button, Breadcrumbs } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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
    const { authState } = useContext(AuthContext);
    const currentUser = authState.user;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [contentData, referencesData] = await Promise.all([
                    contentApi.getContentDetails(contentId),
                    contentApi.getContentReferences(contentId)
                ]);
                
                setContent(contentData);
                setReferences(referencesData);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [contentId]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!content) return <div>No content found</div>;

    const profile = content.selected_profile;
    
    // Determine if the current user is the owner of the profile
    const isOwner = profile?.user && currentUser && profile.user === currentUser.id;
    
    // Get the username for the button text
    const ownerUsername = profile?.user_username || 'User';

    return (
        <Box sx={{ maxWidth: 800, margin: '0 auto', padding: 2, pt: 12 }}>
            {/* Navigation Breadcrumbs */}
            <Box sx={{ mb: 2 }}>
                <Breadcrumbs 
                    separator={<NavigateNextIcon fontSize="small" />}
                    aria-label="content navigation"
                >
                    <Link 
                        to="/content/library_user"
                        style={{ 
                            color: 'inherit', 
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' }
                        }}
                    >
                        My Library
                    </Link>
                    
                    {profile?.collection_name && (
                        <Link
                            to={`/content/collections/${profile.collection}`}
                            style={{ 
                                color: 'inherit', 
                                textDecoration: 'none',
                                '&:hover': { textDecoration: 'underline' }
                            }}
                        >
                            {profile.collection_name}
                        </Link>
                    )}
                    
                    <Typography color="text.primary">
                        {profile?.title}
                    </Typography>
                </Breadcrumbs>
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => {
                        if (profile?.user) {
                            navigate(`/content/library/${profile.user}`);
                        }
                    }}
                >
                    {isOwner ? "Go to your library" : `Go to ${ownerUsername}'s library`}
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => navigate(`/content/${contentId}/edit`)}
                >
                    Edit Content
                </Button>
            </Box>

            <Card sx={{ padding: 3 }}>
                {/* Content Display */}
                <ContentDisplay 
                    content_profile={{
                        title: profile?.title || content?.original_title,
                        author: profile?.author || content?.original_author,
                        content: {
                            media_type: content?.media_type,
                            file_details: content?.file_details,
                            original_title: content?.original_title,
                            original_author: content?.original_author
                        }
                    }}
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