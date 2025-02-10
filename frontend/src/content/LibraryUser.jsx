import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Chip } from '@mui/material';
import { isAuthenticated } from '../context/localStorageUtils';
import contentApi from '../api/contentApi';

const LibraryUser = () => {
    const [userContent, setUserContent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUserContent = async () => {
            try {
                const data = await contentApi.getUserContent();
                setUserContent(data);
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch your content');
                setLoading(false);
            }
        };

        if (isAuthenticated()) {
            fetchUserContent();
        }
    }, []);

    if (loading) return <Typography>Loading your content...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;
    if (!isAuthenticated()) return <Typography>Please login to view your content</Typography>;

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                My Content Library
            </Typography>
            
            <Grid container spacing={3}>
                {userContent.map((content) => (
                    <Grid item xs={12} sm={6} md={4} key={content.id}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    {content.title || 'Untitled'}
                                </Typography>
                                
                                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                    <Chip 
                                        label={content.content_type} 
                                        size="small"
                                        color="primary"
                                    />
                                    {content.author && (
                                        <Chip 
                                            label={`Author: ${content.author}`}
                                            size="small"
                                            variant="outlined"
                                        />
                                    )}
                                </Box>

                                {content.personal_note && (
                                    <Typography 
                                        variant="body2" 
                                        color="text.secondary"
                                        sx={{ 
                                            mt: 1,
                                            fontStyle: 'italic',
                                            borderLeft: '3px solid #ccc',
                                            pl: 1
                                        }}
                                    >
                                        {content.personal_note}
                                    </Typography>
                                )}

                                <Typography 
                                    variant="caption" 
                                    display="block" 
                                    sx={{ mt: 2 }}
                                >
                                    Visibility: {content.is_visible ? 'Public' : 'Private'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}

                {userContent.length === 0 && (
                    <Grid item xs={12}>
                        <Typography variant="body1" color="text.secondary" align="center">
                            You haven't added any content yet.
                        </Typography>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
};

export default LibraryUser; 
