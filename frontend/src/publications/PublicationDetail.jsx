import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Button, 
    Divider,
    CircularProgress,
    Paper
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import { formatDate } from '../utils/dateUtils';
import contentApi from '../api/contentApi';
import ContentDisplay from '../content/ContentDisplay';

const PublicationDetail = () => {
    const [publication, setPublication] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { publicationId } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPublication = async () => {
            try {
                const data = await contentApi.getPublicationDetails(publicationId);
                console.log('Fetched publication:', data);
                setPublication(data);
            } catch (err) {
                console.error('Error fetching publication:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPublication();
    }, [publicationId]);

    if (loading) return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
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

    const hasContent = publication.content_profile && 
                      publication.content_profile.content;

    // Log the content profile data for debugging
    console.log('Publication content profile:', publication.content_profile);
    if (hasContent) {
        console.log('Content details:', {
            media_type: publication.content_profile.content.media_type,
            file_details: publication.content_profile.content.file_details,
            url: publication.content_profile.content.url
        });
    }

    return (
        <Box sx={{ maxWidth: 800, margin: '0 auto', padding: 2, pt: 12 }}>
            {/* Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate(-1)}
                >
                    Back
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => navigate(`/publications/${publicationId}/edit`)}
                >
                    Edit Publication
                </Button>
            </Box>

            <Paper elevation={2} sx={{ p: 3 }}>
                {/* Publication Header */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        Published by {publication.username} on {formatDate(publication.published_at)}
                    </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Content Reference Section */}
                {hasContent && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            Referenced Content:
                        </Typography>
                        
                        <Box sx={{ mb: 2 }}>
                            <ContentDisplay 
                                content={publication.content_profile.content}
                                variant="detailed"
                                showAuthor={true}
                                onClick={() => navigate(`/content/${publication.content_profile.content.id}/library?context=publication&id=${publicationId}`)}
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