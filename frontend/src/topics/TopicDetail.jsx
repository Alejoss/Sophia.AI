import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Paper, 
    Button,
    Divider,
    Grid,
    Chip,
    IconButton,
    List,
    ListItem,
    ListItemText
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import NoteIcon from '@mui/icons-material/Note';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/Add';
import ListIcon from '@mui/icons-material/List';
import contentApi from '../api/contentApi';
import { useAuth } from '../context/AuthContext';
import { MEDIA_BASE_URL } from '../api/config';
import CommentSection from '../comments/CommentSection';
import VoteComponent from '../votes/VoteComponent';
import TopicHeader from './TopicHeader';
import ContentDisplay from '../content/ContentDisplay';
import ContentSuggestionModal from './ContentSuggestionModal';
import { Badge } from '@mui/material';

const TopicDetail = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const [topic, setTopic] = useState(null);
    const [contentByType, setContentByType] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
    const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0);
    const [isModerator, setIsModerator] = useState(false);

    useEffect(() => {
        const fetchTopic = async () => {
            try {
                const data = await contentApi.getTopicDetails(topicId);
                setTopic(data);
                
                if (!data.contents) {
                    setContentByType({});
                    setLoading(false);
                    return;
                }
                
                const grouped = data.contents.reduce((acc, content) => {
                    const type = content.media_type.toLowerCase();
                    if (!acc[type]) acc[type] = [];
                    acc[type].push(content);
                    return acc;
                }, {});

                Object.keys(grouped).forEach(type => {
                    grouped[type].sort((a, b) => 
                        new Date(b.created_at) - new Date(a.created_at)
                    );
                });

                setContentByType(grouped);
                
                const creatorId = typeof data.creator === 'object' ? data.creator.id : data.creator;
                const userId = user?.id;
                const isCreator = isAuthenticated && creatorId != null && userId != null && String(creatorId) === String(userId);
                const userIsModerator = isCreator || (
                    isAuthenticated &&
                    (data.moderators || []).some(mod => String(mod.id) === String(userId))
                );
                setIsModerator(userIsModerator);
                
                // Fetch pending suggestions count if moderator
                if (userIsModerator) {
                    fetchPendingSuggestionsCount();
                }
                
                setLoading(false);
            } catch (err) {
                setError('Error al cargar los detalles del tema');
                setLoading(false);
            }
        };

        fetchTopic();
    }, [topicId, isAuthenticated, user?.id]);

    const fetchPendingSuggestionsCount = async () => {
        try {
            const suggestions = await contentApi.getTopicContentSuggestions(topicId, { status: 'PENDING' });
            setPendingSuggestionsCount(Array.isArray(suggestions) ? suggestions.length : 0);
        } catch (err) {
            // ignore
        }
    };

    const handleSuggestionSuccess = () => {
        fetchPendingSuggestionsCount();
        // Refresh topic to show newly accepted content if any
        const fetchTopic = async () => {
            try {
                const data = await contentApi.getTopicDetails(topicId);
                setTopic(data);
                
                if (data.contents) {
                    const grouped = data.contents.reduce((acc, content) => {
                        const type = content.media_type.toLowerCase();
                        if (!acc[type]) {
                            acc[type] = [];
                        }
                        acc[type].push(content);
                        return acc;
                    }, {});
                    
                    Object.keys(grouped).forEach(type => {
                        grouped[type].sort((a, b) => 
                            new Date(b.created_at) - new Date(a.created_at)
                        );
                    });
                    
                    setContentByType(grouped);
                }
            } catch (err) {
                // ignore
            }
        };
        fetchTopic();
    };

    const renderContentPreview = (content, type) => {
        if (!content.file_details && type !== 'image') return null;

        switch (type) {
            case 'image':
                return (
                    <ContentDisplay
                        content={content}
                        variant="image"
                        showAuthor={true}
                        onClick={() => navigate(`/content/${content.id}/topic/${topicId}`)}
                    />
                );
            case 'text':
                return (
                    <ContentDisplay
                        content={content}
                        variant="text"
                        showAuthor={true}
                        onClick={() => navigate(`/content/${content.id}/topic/${topicId}`)}
                    />
                );
            case 'video':
                return (
                    <ContentDisplay
                        content={content}
                        variant="video"
                        showAuthor={true}
                        onClick={() => navigate(`/content/${content.id}/topic/${topicId}`)}
                    />
                );
            case 'audio':
                return (
                    <ContentDisplay
                        content={content}
                        variant="audio"
                        showAuthor={true}
                        onClick={() => navigate(`/content/${content.id}/topic/${topicId}`)}
                    />
                );
            default:
                return null;
        }
    };

    const renderContentSection = (type, contents) => {
        if (!contents || contents.length === 0) return null;

        const displayContents = contents.slice(0, 3);
        const hasMore = contents.length > 3;

        return (
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        textTransform: 'capitalize',
                        fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
                        fontWeight: 400,
                        fontSize: "18px"
                      }} 
                      color="text.primary"
                    >
                        {type}s
                    </Typography>
                    {hasMore && (
                        <Button
                            endIcon={<ArrowForwardIcon />}
                            onClick={() => navigate(`/content/topics/${topicId}/${type}`)}
                            sx={{ textTransform: 'none' }}
                        >
                            Ver todos los {contents.length} {type}s
                        </Button>
                    )}
                </Box>

                <Grid container spacing={3}>
                    {displayContents.map((content) => (
                        <Grid item xs={12} sm={6} md={4} key={content.id}>
                            <ContentDisplay
                                content={content}
                                variant="card"
                                showAuthor={true}
                                onClick={() => navigate(`/content/${content.id}/topic/${topicId}`)}
                            />
                        </Grid>
                    ))}
                </Grid>
            </Box>
        );
    };

    const renderTextSection = (contents) => {
        if (!contents || contents.length === 0) return null;

        const displayContents = contents.slice(0, 3);
        const hasMore = contents.length > 3;

        return (
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            textTransform: 'capitalize',
                            fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
                            fontWeight: 400,
                            fontSize: "18px"
                        }} 
                        color="text.primary"
                    >
                        Textos
                    </Typography>
                    {hasMore && (
                        <Button
                            endIcon={<ArrowForwardIcon />}
                            onClick={() => navigate(`/content/topics/${topicId}/text`)}
                            sx={{ textTransform: 'none' }}
                        >
                            Ver todos los {contents.length} textos
                        </Button>
                    )}
                </Box>
                <List disablePadding sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    {displayContents.map((content) => {
                        const title = content.selected_profile?.title || content.original_title || 'Sin título';
                        const author = content.selected_profile?.author || content.original_author;
                        return (
                            <ListItem
                                key={content.id}
                                component={RouterLink}
                                to={`/content/${content.id}/topic/${topicId}`}
                                sx={{
                                    display: 'block',
                                    textAlign: 'left',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    py: 1.5,
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                            >
                                <ListItemText
                                    primary={title}
                                    secondary={author || null}
                                    primaryTypographyProps={{
                                        sx: {
                                            color: 'primary.main',
                                            textDecoration: 'underline',
                                            fontWeight: 500,
                                        },
                                    }}
                                />
                            </ListItem>
                        );
                    })}
                </List>
            </Box>
        );
    };

    if (loading) return <Typography>Cargando detalles del tema...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;
    if (!topic) return <Typography>Tema no encontrado</Typography>;

    const creatorId = typeof topic.creator === 'object' ? topic.creator.id : topic.creator;
    const userId = user?.id;
    const isCreator = isAuthenticated && creatorId != null && userId != null && String(creatorId) === String(userId);

    return (
        <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
            <TopicHeader 
                topic={topic}
                onEdit={() => navigate(`/content/topics/${topicId}/edit`)}
            />

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Dueño y moderadores: Editar Contenido. Resto de usuarios autenticados: Sugerir Contenido */}
                {(isCreator || isModerator) ? (
                    <Button
                        variant="contained"
                        startIcon={<EditIcon />}
                        onClick={() => navigate(`/content/topics/${topicId}/edit-content`)}
                    >
                        Editar Contenido
                    </Button>
                ) : isAuthenticated && (
                    <>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setSuggestionModalOpen(true)}
                        >
                            Sugerir Contenido
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<ListIcon />}
                            onClick={() => navigate(`/content/topics/${topicId}/suggestions`)}
                        >
                            Ver Todas las Sugerencias de Contenido
                        </Button>
                    </>
                )}
                {isModerator && pendingSuggestionsCount > 0 && (
                    <Badge badgeContent={pendingSuggestionsCount} color="error">
                        <Button
                            variant="outlined"
                            onClick={() => navigate(`/content/topics/${topicId}/edit?tab=suggestions`)}
                        >
                            Gestionar Sugerencias
                        </Button>
                    </Badge>
                )}
            </Box>

            {/* Content sections by type: images, videos, audios first; texts at the end as list */}
            {renderContentSection('image', contentByType.image)}
            {renderContentSection('video', contentByType.video)}
            {renderContentSection('audio', contentByType.audio)}
            {renderTextSection(contentByType.text)}

            {Object.keys(contentByType).length === 0 && (
                <Typography variant="body1" color="text.secondary" align="center">
                    Aún no se ha agregado contenido a este tema.
                </Typography>
            )}

            {/* Add CommentSection */}
            <CommentSection topicId={topicId} />

            {/* Content Suggestion Modal */}
            <ContentSuggestionModal
                open={suggestionModalOpen}
                onClose={() => setSuggestionModalOpen(false)}
                topicId={topicId}
                onSuccess={handleSuggestionSuccess}
            />
        </Box>
    );
};

export default TopicDetail; 