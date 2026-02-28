import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Grid,
    Chip,
    Button,
    Link
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import contentApi from '../api/contentApi';
import { resolveMediaUrl } from '../utils/fileUtils';
import CommentSection from '../comments/CommentSection';
import VoteComponent from '../votes/VoteComponent';
import TopicHeader from './TopicHeader';
import ContentDisplay from '../content/ContentDisplay';

const TopicContentMediaType = () => {
    const { topicId, mediaType } = useParams();
    const navigate = useNavigate();
    const [topic, setTopic] = useState(null);
    const [contents, setContents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTopicAndContents = async () => {
            try {
                console.log(`Fetching topic ${topicId} and ${mediaType} contents...`);
                const [topicData, contentsData] = await Promise.all([
                    contentApi.getTopicDetails(topicId),
                    contentApi.getTopicContentByType(topicId, mediaType)
                ]);
                
                console.log('Received topic data:', topicData);
                console.log('Received contents data:', contentsData);
                
                setTopic(topicData);
                setContents(contentsData.contents || []);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching data:', err);
                console.error('Error details:', {
                    message: err.message,
                    status: err.response?.status,
                    data: err.response?.data
                });
                setError('Error al cargar los detalles del tema o del contenido');
                setLoading(false);
            }
        };

        fetchTopicAndContents();
    }, [topicId, mediaType]);

    const renderContentPreview = (content) => {
        if (!content.file_details) return null;

        switch (mediaType) {
            case 'image':
                return (
                    <CardMedia
                        component="img"
                        sx={{ 
                            height: 200,
                            width: '100%',
                            objectFit: 'cover'
                        }}
                        image={resolveMediaUrl(content.file_details?.url) || `https://picsum.photos/800/600?random=${content.id}`}
                        alt={content.selected_profile?.title || 'Content image'}
                    />
                );
            case 'text':
                return (
                    <CardContent>
                        <Typography variant="body2" color="text.secondary" noWrap>
                            {content.file_details?.text || 'Vista previa no disponible'}
                        </Typography>
                    </CardContent>
                );
            case 'video':
                return (
                    <Box sx={{ position: 'relative', height: 200 }}>
                        <CardMedia
                            component="video"
                            sx={{ 
                                height: '100%',
                                width: '100%',
                                objectFit: 'cover'
                            }}
                            image={resolveMediaUrl(content.file_details?.url)}
                        />
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'rgba(0, 0, 0, 0.3)',
                            }}
                        >
                            <Typography variant="body1" color="white">
                                Haz clic para reproducir el video
                            </Typography>
                        </Box>
                    </Box>
                );
            case 'audio':
                return (
                    <Box sx={{ p: 2 }}>
                        <audio
                            controls
                            style={{ width: '100%' }}
                        >
                            <source src={resolveMediaUrl(content.file_details?.url)} type="audio/mpeg" />
                            Tu navegador no soporta el elemento de audio.
                        </audio>
                    </Box>
                );
            default:
                return null;
        }
    };

    if (loading) return <Typography>Cargando contenido...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;
    if (!topic) return <Typography>Tema no encontrado</Typography>;

    return (
        <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
            <TopicHeader 
                topic={topic}
                onEdit={() => navigate(`/content/topics/${topicId}/edit`)}
                size="small"
            />

            <Box sx={{ mb: 4 }}>
                <Button
                    onClick={() => navigate(`/content/topics/${topicId}`)}
                    startIcon={<ArrowBackIcon />}
                    sx={{ mb: 2, textTransform: 'none' }}
                >
                    Regresar a la vista principal del tema
                </Button>
                <Typography 
                    variant="h5" 
                    sx={{ 
                        mb: 2,
                        fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
                        fontWeight: 400,
                        fontSize: "20px"
                    }} 
                    color="text.primary"
                >
                    {mediaType === 'image' ? 'Todas las imágenes' : mediaType === 'text' ? 'Todos los textos' : `Todos los ${mediaType}s`}
                </Typography>

                <Grid container spacing={3}>
                    {contents.map((content) => (
                        <Grid item xs={12} sm={6} md={4} key={content.id}>
                            <ContentDisplay
                                content={content}
                                variant="card"
                                showAuthor={true}
                                topicId={topicId}
                                onClick={() => navigate(`/content/${content.id}/topic/${topicId}`)}
                            />
                        </Grid>
                    ))}
                </Grid>
            </Box>

            <CommentSection topicId={topicId} />
        </Box>
    );
};

export default TopicContentMediaType; 