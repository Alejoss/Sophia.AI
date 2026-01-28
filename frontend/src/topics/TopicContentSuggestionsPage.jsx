import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Box,
    Typography,
    Alert,
    CircularProgress,
    Chip,
    Card,
    CardContent,
    Button
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/Pending';
import contentApi from '../api/contentApi';
import VoteComponent from '../votes/VoteComponent';
import { useAuth } from '../context/AuthContext';

const TopicContentSuggestionsPage = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [suggestions, setSuggestions] = useState([]);
    const [topic, setTopic] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchTopic();
        fetchSuggestions();
    }, [topicId]);

    const fetchTopic = async () => {
        try {
            const data = await contentApi.getTopicDetails(topicId);
            setTopic(data);
        } catch (err) {
            console.error('Error fetching topic:', err);
        }
    };

    const fetchSuggestions = async () => {
        try {
            setLoading(true);
            const data = await contentApi.getTopicContentSuggestions(topicId, {});
            setSuggestions(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError('Error al cargar las sugerencias');
            console.error('Error fetching suggestions:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusChip = (status) => {
        const statusConfig = {
            PENDING: { 
                label: 'Pendiente', 
                color: 'warning',
                icon: <PendingIcon fontSize="small" />
            },
            ACCEPTED: { 
                label: 'Aceptada', 
                color: 'success',
                icon: <CheckCircleIcon fontSize="small" />
            },
            REJECTED: { 
                label: 'Rechazada', 
                color: 'error',
                icon: <CancelIcon fontSize="small" />
            }
        };
        const config = statusConfig[status] || { label: status, color: 'default', icon: null };
        return (
            <Chip 
                label={config.label} 
                color={config.color} 
                icon={config.icon}
                size="small" 
            />
        );
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/content/topics/${topicId}`)}>
                    Volver al Tema
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate(`/content/topics/${topicId}`)}
                    sx={{ mb: 2 }}
                >
                    Volver al Tema
                </Button>
                <Typography variant="h4" gutterBottom>
                    Sugerencias de Contenido
                </Typography>
                {topic && (
                    <Typography variant="body1" color="text.secondary">
                        Tema: {topic.title}
                    </Typography>
                )}
            </Box>

            {/* Suggestions List */}
            {suggestions.length === 0 ? (
                <Alert severity="info">
                    No hay sugerencias de contenido para este tema.
                </Alert>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {suggestions.map((suggestion) => (
                        <Card key={suggestion.id} variant="outlined">
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Typography 
                                            variant="h6" 
                                            gutterBottom
                                            component={Link}
                                            to={suggestion.content_profile?.id 
                                                ? `/content/search/${suggestion.content?.id}?profile=${suggestion.content_profile.id}`
                                                : `/content/search/${suggestion.content?.id}`
                                            }
                                            sx={{ 
                                                textDecoration: 'none',
                                                color: 'primary.main',
                                                '&:hover': {
                                                    textDecoration: 'underline'
                                                },
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {suggestion.content?.original_title || 'Sin título'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Sugerido por <strong>{suggestion.suggested_by?.username || 'Usuario desconocido'}</strong>
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        {getStatusChip(suggestion.status)}
                                        {isAuthenticated && (
                                            <VoteComponent
                                                type="content_suggestion"
                                                ids={{ suggestionId: suggestion.id }}
                                                initialVoteCount={suggestion.vote_count || 0}
                                                initialUserVote={suggestion.user_vote || 0}
                                            />
                                        )}
                                    </Box>
                                </Box>

                                {suggestion.message && suggestion.message.trim() && (
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>Mensaje:</strong> {suggestion.message}
                                        </Typography>
                                    </Box>
                                )}

                                {suggestion.status === 'REJECTED' && suggestion.rejection_reason && (
                                    <Alert severity="error" sx={{ mb: 2 }}>
                                        <Typography variant="body2">
                                            <strong>Razón de rechazo:</strong> {suggestion.rejection_reason}
                                        </Typography>
                                    </Alert>
                                )}

                                {suggestion.is_duplicate && (
                                    <Chip 
                                        label="Este contenido ya estaba en el tema" 
                                        size="small" 
                                        color="warning" 
                                        sx={{ mb: 1 }}
                                    />
                                )}

                                <Typography variant="caption" color="text.secondary">
                                    Sugerido el {suggestion.created_at ? new Date(suggestion.created_at).toLocaleString() : '-'}
                                </Typography>

                                {suggestion.reviewed_at && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        Revisado el {new Date(suggestion.reviewed_at).toLocaleString()}
                                        {suggestion.reviewed_by && ` por ${suggestion.reviewed_by.username}`}
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default TopicContentSuggestionsPage;
