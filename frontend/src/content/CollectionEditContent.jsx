import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    IconButton, 
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    Alert,
    Chip,
    Link as MuiLink,
    Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import contentApi from '../api/contentApi';
import LibrarySelectMultiple from './LibrarySelectMultiple';

const CollectionEditContent = () => {
    const { collectionId } = useParams();
    const navigate = useNavigate();
    const [collectionData, setCollectionData] = useState(null);
    const [collectionName, setCollectionName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showAddContent, setShowAddContent] = useState(false);

    useEffect(() => {
        const fetchCollectionData = async () => {
            console.log('Fetching collection data for ID:', collectionId);
            try {
                console.log('Fetching collection content...');
                const contentData = await contentApi.getCollectionContent(collectionId);
                console.log('Collection content fetched:', contentData);

                // Get the collection name from the first content item's collection_name
                if (contentData.length > 0 && contentData[0].collection_name) {
                    setCollectionName(contentData[0].collection_name);
                } else {
                    // If no content, try to get it from user collections
                    const collections = await contentApi.getUserCollections();
                    const collection = collections.find(c => c.id === parseInt(collectionId));
                    if (collection) {
                        setCollectionName(collection.name);
                    }
                }

                setCollectionData(contentData);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching collection data:', err);
                console.error('Error details:', {
                    message: err.message,
                    response: err.response,
                    stack: err.stack
                });
                setError('Error al obtener los datos de la colección');
                setLoading(false);
            }
        };

        fetchCollectionData();
    }, [collectionId]);

    const handleContentRemove = async (contentProfileId) => {
        console.log('Removing content profile:', contentProfileId);
        try {
            setSaving(true);
            await contentApi.removeContentFromCollection(contentProfileId);
            console.log('Content removed successfully');
            setCollectionData(prev => prev.filter(content => content.id !== contentProfileId));
            setSaving(false);
        } catch (err) {
            console.error('Error removing content:', err);
            setError('Error al eliminar contenido de la colección');
            setSaving(false);
        }
    };

    const handleCancelAdd = () => {
        console.log('Canceling add content');
        setShowAddContent(false);
    };

    const handleSaveAdd = async (selectedContentProfileIds) => {
        console.log('Saving selected content profiles:', selectedContentProfileIds);
        try {
            setSaving(true);
            // Make a single API call with all selected content profile IDs
            await contentApi.addContentToCollection(collectionId, selectedContentProfileIds);
            console.log('All content added successfully');
            // Refresh collection content
            const data = await contentApi.getCollectionContent(collectionId);
            console.log('Refreshed collection content:', data);
            setCollectionData(data);
            setShowAddContent(false);
            setSaving(false);
        } catch (error) {
            console.error('Error adding content:', error);
            setError('Error al agregar contenido a la colección');
            setSaving(false);
        }
    };

    const filterContent = (content) => {
        // Filter out content that's already in this collection
        const isInCollection = content.collection === parseInt(collectionId);
        console.log('CollectionEditContent filtering content:', {
            contentId: content.id,
            contentTitle: content.title,
            collectionId: collectionId,
            contentCollection: content.collection,
            isInCollection,
            contentStructure: JSON.stringify(content, null, 2)
        });
        return !isInCollection;
    };

    if (loading) {
        console.log('Component is loading...');
        return <Typography>Cargando contenido de la colección...</Typography>;
    }
    if (error) {
        console.log('Component has error:', error);
        return <Alert severity="error">{error}</Alert>;
    }
    if (!collectionData) {
        console.log('No collection data available');
        return <Alert severity="error">Colección no encontrada</Alert>;
    }

    if (showAddContent) {
        console.log('Showing add content view');
        return (
            <LibrarySelectMultiple
                title="Agregar contenido a la colección"
                description="Selecciona contenido de tu biblioteca para agregar a esta colección"
                onCancel={handleCancelAdd}
                onSave={handleSaveAdd}
                filterFunction={filterContent}
                contextName={collectionName}
            />
        );
    }

    console.log('Rendering collection content view:', {
        collectionId,
        collectionName,
        contentCount: collectionData.length
    });

    return (
        <Box sx={{ pt: 12, px: 3, maxWidth: 1200, mx: 'auto' }}>
            <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <IconButton 
                        onClick={() => navigate(`/content/collections/${collectionId}`)}
                        sx={{ mr: 2 }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h4" sx={{ flexGrow: 1 }}>
                        {collectionName}
                    </Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={() => setShowAddContent(true)}
                    >
                        Agregar contenido de tu biblioteca
                    </Button>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" sx={{ mb: 2 }}>
                    Contenido en la colección ({collectionData.length})
                </Typography>

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Título</TableCell>
                                <TableCell>Tipo</TableCell>
                                <TableCell>Autor</TableCell>
                                <TableCell>Ver</TableCell>
                                <TableCell>Acciones</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {collectionData.map((content) => (
                                <TableRow 
                                    key={content.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                >
                                    <TableCell>{content.title || 'Sin título'}</TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={content.content.media_type} 
                                            size="small"
                                            color="primary"
                                        />
                                    </TableCell>
                                    <TableCell>{content.author || 'Desconocido'}</TableCell>
                                    <TableCell>
                                        <MuiLink
                                            href={`/content/${content.content.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            sx={{ 
                                                display: 'flex', 
                                                alignItems: 'center',
                                                gap: 0.5,
                                                color: 'primary.main',
                                                textDecoration: 'none',
                                                '&:hover': {
                                                    textDecoration: 'underline'
                                                }
                                            }}
                                        >
                                            Ver
                                            <OpenInNewIcon fontSize="small" />
                                        </MuiLink>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            size="small"
                                            onClick={() => handleContentRemove(content.id)}
                                            disabled={saving}
                                        >
                                            Eliminar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {collectionData.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center">
                                        No hay contenido en esta colección
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default CollectionEditContent; 