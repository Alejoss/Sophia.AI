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
                setError('Error al obtener tus colecciones');
                setLoading(false);
            }
        };

        if (isAuthenticated()) {
            fetchCollections();
        }
    }, []);

    if (loading) return <Typography>Cargando tus colecciones...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;
    if (!isAuthenticated()) return <Typography>Por favor inicia sesión para ver tus colecciones</Typography>;

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
                        Mis colecciones
                    </Typography>
                </Box>
                <Button 
                    variant="contained" 
                    color="primary"
                    onClick={() => navigate('/content/collections/create')}
                >
                    Crear colección
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
                                    {collection.content_count} {collection.content_count === 1 ? 'elemento' : 'elementos'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                ))}

                {collections.length === 0 && (
                    <Box gridColumn="span 12">
                        <Typography variant="body1" color="text.secondary" align="center">
                            Aún no has creado ninguna colección.
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default CollectionsUser; 