import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Paper,
    Button,
    Alert,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Link as MuiLink,
    Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import contentApi from '../api/contentApi';
import LibrarySelectMultiple from '../content/LibrarySelectMultiple';

// ContentDisplay Mode: Uses SimpleContentProfileSerializer for minimal information in content management
const TopicEditContent = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [topicData, setTopicData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showAddContent, setShowAddContent] = useState(false);

    useEffect(() => {
        const fetchTopicContent = async () => {
            try {
                const data = await contentApi.getTopicDetailsSimple(topicId);
                setTopicData(data);
                setLoading(false);
            } catch (err) {
                setError('Error al cargar el contenido del tema');
                setLoading(false);
            }
        };

        fetchTopicContent();
    }, [topicId]);

    const handleContentRemove = async (contentId) => {
        try {
            setSaving(true);
            await contentApi.removeContentFromTopic(topicId, [contentId]);
            // Refresh the topic data to ensure UI is updated
            const data = await contentApi.getTopicDetailsSimple(topicId);
            setTopicData(data);
            setSaving(false);
        } catch (err) {
            setError('Error al eliminar contenido del tema');
            setSaving(false);
        }
    };

    const handleCancelAdd = () => {
        setShowAddContent(false);
    };

    const handleSaveAdd = async (selectedContentProfileIds) => {
        try {
            setSaving(true);
            // Make a single API call with all selected content profile IDs
            await contentApi.addContentToTopic(topicId, selectedContentProfileIds);
            // Refresh topic content
            const data = await contentApi.getTopicDetailsSimple(topicId);
            setTopicData(data);
            setShowAddContent(false);
            setSaving(false);
        } catch (error) {
            console.error('Failed to add content to topic:', error);
            setError('Error al agregar contenido al tema');
            setSaving(false);
        }
    };

    const filterContent = (content) => {
        // Filter out content that's already in this topic
        // Now topics are serialized as IDs, so we can directly compare them
        const isInTopic = content.content.topics?.some(topicIdInArray => topicIdInArray === parseInt(topicId));
        
        console.log('TopicEditContent filtering content:', {
            contentId: content.id,
            contentTitle: content.title,
            topicId: topicId,
            isInTopic,
            topics: content.content.topics,
            contentStructure: JSON.stringify(content, null, 2)
        });
        return !isInTopic;
    };

    if (loading) return <Typography>Cargando contenido del tema...</Typography>;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!topicData) return <Alert severity="error">Tema no encontrado</Alert>;

    if (showAddContent) {
        return (
            <LibrarySelectMultiple
                title="Agregar Contenido al Tema"
                description="Selecciona contenido de tu biblioteca para agregar a este tema"
                onCancel={handleCancelAdd}
                onSave={handleSaveAdd}
                filterFunction={filterContent}
                contextName={topicData?.topic?.title}
            />
        );
    }

    return (
        <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
            <Paper sx={{ p: 3 }}>
          <Box
  sx={{
    display: {
      xs: "block", // mobile → stacked
      md: "flex",  // md and up → flex row
    },
    alignItems: "center",
    mb: 3,
    "& > *:not(:last-child)": {
      mb: {
        xs: 2, // vertical spacing between children on mobile
        md: 0, // no spacing when flex row
      },
    },
  }}
>
                    <Box sx={{ display: "flex", alignItems: "center", flexGrow: 1 }}>
                        <IconButton 
                            onClick={() => navigate(`/content/topics/${topicId}/edit`)}
                            sx={{ mr: 2 }}
                        >
                            <ArrowBackIcon />
                        </IconButton>
                        <Typography 
                          variant="h4" 
                          sx={{ 
                            fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
                            fontWeight: 400,
                            fontSize: "24px"
                          }} 
                          color="text.primary"
                        >
                            {topicData?.topic?.title}
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={() => setShowAddContent(true)}
                    >
                        Agregar contenido de tu biblioteca
                    </Button>
                </Box>

                {topicData.description && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="body1" color="text.secondary">
                            {topicData.description}
                        </Typography>
                    </Box>
                )}

                <Divider sx={{ my: 3 }} />

                <Typography 
                  variant="h6" 
                  sx={{ 
                    mb: 2,
                    fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
                    fontWeight: 400,
                    fontSize: "18px"
                  }} 
                  color="text.primary"
                >
                    Contenido en el Tema ({topicData.contents.length})
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
                            {topicData.contents.map((contentProfile) => (
                                <TableRow 
                                    key={contentProfile.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                >
                                    <TableCell>{contentProfile.title || 'Sin título'}</TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={contentProfile.content.media_type} 
                                            size="small"
                                            color="primary"
                                        />
                                    </TableCell>
                                    <TableCell>{contentProfile.author || 'Desconocido'}</TableCell>
                                    <TableCell>
                                        <MuiLink
                                            href={`/content/${contentProfile.content.id}`}
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
                                            onClick={() => handleContentRemove(contentProfile.content.id)}
                                            disabled={saving}
                                        >
                                            Eliminar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default TopicEditContent; 