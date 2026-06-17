import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Card, Typography, Box, Button, Alert } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import contentApi from '../api/contentApi';
import { AuthContext } from '../context/AuthContext';
import ContentReferences from './ContentReferences';
import ContentDisplay from './ContentDisplay';
import AddToLibraryModal from '../components/AddToLibraryModal';
import FileSuggestionUploadDialog from './FileSuggestionUploadDialog';
import ContentDetailSkeleton from '../components/ContentDetailSkeleton';

// ContentDisplay Mode: "detailed" - Full content detail view in library context
const ContentDetailsLibrary = () => {
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [references, setReferences] = useState(null);
    const [fileSuggestions, setFileSuggestions] = useState([]);
    const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
    const [suggestionError, setSuggestionError] = useState('');
    const [suggestionSuccess, setSuggestionSuccess] = useState('');
    const { contentId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { authState } = useContext(AuthContext);
    const currentUser = authState.user;

    useEffect(() => {
        let cancelled = false;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            setReferences(null);
            setFileSuggestions([]);

            try {
                const searchParams = new URLSearchParams(location.search);
                const context = searchParams.get('context') || 'library';
                const contextId = searchParams.get('id') || searchParams.get('userId') || currentUser?.id;

                const contentData = await contentApi.getContentDetails(contentId, context, contextId);
                if (cancelled) return;

                setContent(contentData);
                setLoading(false);

                contentApi.getContentReferences(contentId)
                    .then((referencesData) => {
                        if (!cancelled) setReferences(referencesData);
                    })
                    .catch((refErr) => {
                        console.warn('Error loading content references:', refErr);
                    });

                contentApi.listFileSuggestions(contentId)
                    .then((suggestions) => {
                        if (!cancelled) {
                            setFileSuggestions(Array.isArray(suggestions) ? suggestions : []);
                        }
                    })
                    .catch((listErr) => {
                        console.warn('Error loading file suggestions:', listErr);
                    });
            } catch (err) {
                if (cancelled) return;
                console.error('Error in ContentDetailsLibrary:', err);
                console.error('Error response:', err.response);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [contentId, location.search, currentUser]);

    if (loading) return <ContentDetailSkeleton />;
    if (error) return <div>Error: {error}</div>;
    if (!content) return <div>No se encontró contenido</div>;

    const profile = content.selected_profile;
    const isOwner = profile?.user && currentUser && parseInt(profile.user) === parseInt(currentUser.id);

    // Determine if we are viewing this content from the current user's own library context.
    const searchParams = new URLSearchParams(location.search);
    const contextParam = searchParams.get('context');
    const contextUserId = searchParams.get('id') || searchParams.get('userId');
    const isOwnLibraryView =
        contextParam === 'library' &&
        currentUser &&
        (
            !contextUserId || // when no user id is provided, the API call defaults to the current user
            parseInt(contextUserId) === parseInt(currentUser.id)
        );

    const isInUserLibrary = isOwner || isOwnLibraryView;
    const isOriginalUploader = !!content?.is_original_uploader;
    const hasFileAvailable = !!(content?.has_file_available || content?.file_details?.file);
    const canSuggestFile = !!(content?.can_suggest_file && !hasFileAvailable);
    const pendingSuggestions = fileSuggestions.filter(s => s.status === 'PENDING');

    const refreshFileSuggestions = async () => {
        try {
            const suggestions = await contentApi.listFileSuggestions(contentId);
            setFileSuggestions(Array.isArray(suggestions) ? suggestions : []);
        } catch (err) {
            console.warn('Error refreshing file suggestions:', err);
        }
    };

    const refreshContentData = async () => {
        const searchParams = new URLSearchParams(location.search);
        const context = searchParams.get('context') || 'library';
        const contextId = searchParams.get('id') || searchParams.get('userId') || currentUser?.id;
        const updatedContent = await contentApi.getContentDetails(contentId, context, contextId);
        setContent(updatedContent);
    };

    const handleAcceptSuggestion = async (suggestionId) => {
        try {
            await contentApi.acceptFileSuggestion(suggestionId);
            await Promise.all([refreshFileSuggestions(), refreshContentData()]);
        } catch (err) {
            setSuggestionError(err?.response?.data?.error || 'No se pudo aceptar la sugerencia.');
        }
    };

    const handleRejectSuggestion = async (suggestionId) => {
        try {
            await contentApi.rejectFileSuggestion(suggestionId, '');
            await refreshFileSuggestions();
        } catch (err) {
            setSuggestionError(err?.response?.data?.error || 'No se pudo rechazar la sugerencia.');
        }
    };

    return (
        <Box sx={{ maxWidth: 800, margin: '0 auto', padding: 2, pt: 12 }}>
            {/* Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                {isInUserLibrary ? (
                    // Owner actions
                    <>
                        <Button
                            variant="outlined"
                            startIcon={<ArrowBackIcon />}
                            onClick={() => navigate('/content/library_user')}
                        >
                            Ir a tu biblioteca
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() => navigate(`/content/${contentId}/edit`)}
                        >
                            Editar perfil de contenido
                        </Button>
                    </>
                ) : (
                    // Non-owner actions - only Add to Library button
                    <AddToLibraryModal
                        content={content}
                        onSuccess={() => {}}
                        buttonProps={{
                            variant: 'outlined',
                            size: 'medium'
                        }}
                    />
                )}
            </Box>

            {suggestionError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {suggestionError}
                </Alert>
            )}
            {suggestionSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    {suggestionSuccess}
                </Alert>
            )}

            <Card sx={{ padding: 3 }}>
                {/* Content Display */}
                <ContentDisplay 
                    content={content}
                    variant="detailed"
                    showAuthor={true}
                    showSuggestFileButton={canSuggestFile}
                    onSuggestFile={() => {
                        setSuggestionError('');
                        setSuggestDialogOpen(true);
                    }}
                />

                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1 }}
                >
                    Luego podrás editar la imagen miniatura
                </Typography>

                {/* Content References Section */}
                {references && (
                    <Box sx={{ mt: 4 }}>
                        <ContentReferences references={references} />
                    </Box>
                )}

                {isOriginalUploader && !hasFileAvailable && pendingSuggestions.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Sugerencias de archivo pendientes
                        </Typography>
                        {pendingSuggestions.map((suggestion) => (
                            <Box
                                key={suggestion.id}
                                sx={{
                                    p: 2,
                                    mb: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                }}
                            >
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    Sugerido por: {suggestion?.suggested_by?.username || 'Usuario'}
                                </Typography>
                                {suggestion?.message && (
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        {suggestion.message}
                                    </Typography>
                                )}
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {suggestion?.file && (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => window.open(suggestion.file, '_blank')}
                                        >
                                            Ver archivo sugerido
                                        </Button>
                                    )}
                                    <Button
                                        size="small"
                                        variant="contained"
                                        onClick={() => handleAcceptSuggestion(suggestion.id)}
                                    >
                                        Aceptar
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        onClick={() => handleRejectSuggestion(suggestion.id)}
                                    >
                                        Rechazar
                                    </Button>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                )}
            </Card>

            <FileSuggestionUploadDialog
                open={suggestDialogOpen}
                onClose={() => setSuggestDialogOpen(false)}
                contentId={contentId}
                onSuccess={async () => {
                    setSuggestionSuccess('Sugerencia enviada correctamente.');
                    setSuggestionError('');
                    await refreshFileSuggestions();
                }}
            />
        </Box>
    );
};

export default ContentDetailsLibrary; 