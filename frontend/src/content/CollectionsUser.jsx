import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Button, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import contentApi from '../api/contentApi';
import { isAuthenticated } from '../context/localStorageUtils';

const CollectionsUser = () => {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchCollections = async () => {
            try {
                const data = await contentApi.getUserCollections();
                setCollections(data);
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch your collections');
                setLoading(false);
            }
        };

        if (isAuthenticated()) {
            fetchCollections();
        }
    }, []);

    if (loading) return <Typography>Loading your collections...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;
    if (!isAuthenticated()) return <Typography>Please login to view your collections</Typography>;

    return (
        <Box sx={{ pt: 12, px: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton 
                        onClick={() => navigate('/content/library_user')} 
                        sx={{ mr: 2 }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h4">
                        My Collections
                    </Typography>
                </Box>
                <Button 
                    variant="contained" 
                    color="primary"
                    onClick={() => navigate('/content/collections/create')}
                >
                    Create Collection
                </Button>
            </Box>

            <Box display="grid" gridTemplateColumns="repeat(12, 1fr)" gap={3}>
                {collections.map((collection) => (
                    <Box gridColumn={{ xs: "span 12", sm: "span 6", md: "span 4" }} key={collection.id}>
                        <Card 
                            sx={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/content/collections/${collection.id}`)}
                        >
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    {collection.name}
                                </Typography>
                                <Typography color="text.secondary">
                                    {collection.content_count} {collection.content_count === 1 ? 'item' : 'items'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                ))}

                {collections.length === 0 && (
                    <Box gridColumn="span 12">
                        <Typography variant="body1" color="text.secondary" align="center">
                            You haven't created any collections yet.
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default CollectionsUser; 