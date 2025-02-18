import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Chip, IconButton, Button } from '@mui/material';
import NoteIcon from '@mui/icons-material/Note';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import contentApi from '../api/contentApi';

const Collection = () => {
    const { collectionId } = useParams();
    const navigate = useNavigate();
    const [content, setContent] = useState([]);
    const [collectionName, setCollectionName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCollectionContent = async () => {
            try {
                console.log('Fetching collection content for ID:', collectionId);
                const data = await contentApi.getCollectionContent(collectionId);
                console.log('Received collection data:', data);
                
                setContent(data);
                
                if (data.length > 0) {
                    setCollectionName(data[0].collection_name || 'Untitled Collection');
                }
                setLoading(false);
            } catch (err) {
                console.error('Error fetching collection content:', err);
                setError(err.response?.data?.error || 'Failed to fetch collection content');
                setLoading(false);
            }
        };

        fetchCollectionContent();
    }, [collectionId]);

    if (loading) return <Typography>Loading collection content...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;

    return (
        <Box sx={{ pt: 12, px: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <IconButton onClick={() => navigate('/content/collections')} sx={{ mr: 2 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h1" sx={{ flexGrow: 1, fontSize: '2.5rem' }}>
                    {collectionName}
                </Typography>
                <Button 
                    variant="contained" 
                    color="primary"
                    onClick={() => navigate(`/content/collections/${collectionId}/edit`)}
                >
                    Edit Content
                </Button>
            </Box>

            <Box display="grid" gridTemplateColumns="repeat(12, 1fr)" gap={3}>
                {content.map((contentProfile) => (
                    <Box gridColumn={{ xs: "span 12", sm: "span 6", md: "span 4" }} key={contentProfile.id}>
                        <Card 
                            sx={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/content/${contentProfile.content.id}/library`)}
                        >
                            {contentProfile.content.media_type === 'IMAGE' && contentProfile.content.file_details?.file && (
                                <Box sx={{ 
                                    width: '100%', 
                                    height: 200, 
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <img 
                                        src={`http://localhost:8000${contentProfile.content.file_details.file}`}
                                        alt={contentProfile.title || 'Content image'}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                </Box>
                            )}
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Typography variant="h6">
                                        {contentProfile.title || 'Untitled'}
                                    </Typography>
                                    {contentProfile.personal_note && (
                                        <IconButton size="small" title={contentProfile.personal_note}>
                                            <NoteIcon color="primary" />
                                        </IconButton>
                                    )}
                                </Box>
                                
                                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                    <Chip 
                                        label={contentProfile.content.media_type} 
                                        size="small"
                                        color="primary"
                                    />
                                    {contentProfile.author && (
                                        <Chip 
                                            label={`Author: ${contentProfile.author}`}
                                            size="small"
                                            variant="outlined"
                                        />
                                    )}
                                </Box>
                                
                                <Typography variant="caption" color="text.secondary">
                                    Added: {contentProfile.content.file_details?.uploaded_at 
                                        ? new Date(contentProfile.content.file_details.uploaded_at).toLocaleDateString()
                                        : 'Date not available'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                ))}

                {content.length === 0 && (
                    <Box gridColumn="span 12">
                        <Typography variant="body1" color="text.secondary" align="center">
                            No content in this collection yet.
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default Collection; 