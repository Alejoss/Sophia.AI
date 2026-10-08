import React, { useState, useEffect, useContext } from 'react';
import { Box, Typography, Card, CardContent, Button, IconButton, Chip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import { AuthContext } from '../context/AuthContext';

const CollectionsUser = () => {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { t } = useTranslation('content');
    const navigate = useNavigate();
    const { authState } = useContext(AuthContext);
    const isAuthenticated = authState.isAuthenticated;

    useEffect(() => {
        const fetchCollections = async () => {
            try {
                const data = await contentApi.getUserCollections();
                setCollections(data || []);
                setLoading(false);
            } catch (err) {
                setError(t('collections.loadError'));
                setLoading(false);
            }
        };

        if (isAuthenticated) {
            fetchCollections();
        } else {
            setLoading(false);
        }
    }, [isAuthenticated, t]);

    if (loading) return <Typography>{t('collections.loading')}</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;
    if (!isAuthenticated) return <Typography>{t('collections.signIn')}</Typography>;

    return (
        <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, color: "text.primary" }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton 
                        onClick={() => navigate('/content/library_user')} 
                        sx={{ mr: 2 }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography 
                        variant="h4" 
                        color="text.primary"
                        sx={{
                            fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
                            fontWeight: 400,
                            fontSize: "24px"
                        }}
                    >
                        {t('collections.mine')}
                    </Typography>
                </Box>
                <Button 
                    variant="contained" 
                    color="primary"
                    onClick={() => navigate('/content/collections/create')}
                >
                    {t('collections.create')}
                </Button>
            </Box>

            <Box display="grid" gridTemplateColumns="repeat(12, 1fr)" gap={3}>
                {collections.map((collection) => (
                    <Box gridColumn={{ xs: "span 12", sm: "span 6", md: "span 4" }} key={collection.id}>
                        <Card 
                            sx={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/content/collections/${collection.id}`, { state: { from: '/content/library_user' } })}
                        >
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                                    <Typography variant="h6">
                                        {collection.name}
                                    </Typography>
                                    {collection.is_public && (
                                        <Chip label={t('collections.public')} size="small" color="secondary" variant="outlined" />
                                    )}
                                </Box>
                                {collection.description && (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            mb: 1,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {collection.description}
                                    </Typography>
                                )}
                                <Typography color="text.secondary">
                                    {t('itemCount', { count: collection.content_count })}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                ))}

                {collections.length === 0 && (
                    <Box gridColumn="span 12">
                        <Typography variant="body1" color="text.secondary" align="center">
                            {t('collections.empty')}
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default CollectionsUser; 