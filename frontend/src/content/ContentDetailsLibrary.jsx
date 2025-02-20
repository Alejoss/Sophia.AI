import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Typography, Box, Chip, Divider, Button, Breadcrumbs } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { formatDate } from '../utils/dateUtils';
import contentApi from '../api/contentApi';


const ContentDetailsLibrary = () => {
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { contentId } = useParams();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const contentData = await contentApi.getContentDetails(contentId);
                console.log('Fetched content data:', contentData);
                setContent(contentData);
            } catch (err) {
                console.error('Error fetching content:', err);
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
    console.log('Current profile:', profile);

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

            <Card sx={{ padding: 3 }}>
                {/* Title Section */}
                <Typography variant="h2" gutterBottom sx={{ fontSize: '2rem', mb: 3 }}>
                    {profile?.title || content?.original_title || 'Untitled'}
                </Typography>

                {/* Content Information */}
                <Box sx={{ mb: 3 }}>
                    <Chip 
                        label={content?.media_type} 
                        color="primary" 
                        sx={{ mr: 1 }}
                    />
                    {(profile?.author || content?.original_author) && (
                        <Chip 
                            label={`Author: ${profile?.author || content?.original_author}`} 
                            variant="outlined" 
                            sx={{ mr: 1 }}
                        />
                    )}
                </Box>

                {/* File Details with Download */}
                <Box sx={{ mb: 3 }}>
                    <Box sx={{ color: 'text.secondary', mb: 2 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            Created: {formatDate(content.created_at)}
                        </Typography>
                        {content.file_details && (
                            <Typography variant="body2">
                                File size: {(content.file_details.file_size / 1024 / 1024).toFixed(2)} MB
                            </Typography>
                        )}
                    </Box>
                    
                    {content.file_details?.file && (
                        <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            href={`http://localhost:8000${content.file_details.file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                        >
                            Download File
                        </Button>
                    )}
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* Image Display */}
                {content.media_type === 'IMAGE' && content.file_details?.file && (
                    <Box sx={{ my: 3 }}>
                        <img 
                            src={`http://localhost:8000${content.file_details.file}`}
                            alt={profile?.title}
                            style={{ maxWidth: '100%', height: 'auto' }}
                        />
                    </Box>
                )}

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

                {/* Content Details Section */}
                <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom color="text.secondary">
                        Content Details
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 2 }}>
                        <Typography variant="body2">
                            <strong>Added to Library:</strong> {formatDate(content?.created_at)}
                        </Typography>
                        {content?.file_details?.file_size && (
                            <Typography variant="body2">
                                <strong>File Size:</strong> {(content.file_details.file_size / 1024 / 1024).toFixed(2)} MB
                            </Typography>
                        )}
                        {profile?.collection_name && (
                            <Typography variant="body2">
                                <strong>Collection:</strong> {profile.collection_name}
                            </Typography>
                        )}
                    </Box>
                </Box>

                {/* Topics */}
                {content.topics?.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                        <Typography variant="subtitle2" gutterBottom color="text.secondary">
                            Topics
                        </Typography>
                        <Box>
                            {content.topics.map((topic, index) => (
                                <Chip 
                                    key={index} 
                                    label={topic} 
                                    sx={{ mr: 1, mb: 1 }}
                                    size="small"
                                />
                            ))}
                        </Box>
                    </Box>
                )}
            </Card>
        </Box>
    );
};

export default ContentDetailsLibrary; 