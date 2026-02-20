import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    Paper,
    Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LibrarySelectMultiple from '../content/LibrarySelectMultiple';
import UploadContentForm from '../content/UploadContentForm';
import contentApi from '../api/contentApi';

const TopicAddContent = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [topicData, setTopicData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [selectedContentProfileIds, setSelectedContentProfileIds] = useState([]);
    const [addSourceMode, setAddSourceMode] = useState(null); // null | 'library' | 'upload'
    const [uploadMode, setUploadMode] = useState('file'); // 'url' | 'file'

    useEffect(() => {
        const fetchTopic = async () => {
            try {
                const data = await contentApi.getTopicDetailsSimple(topicId);
                setTopicData(data);
            } catch (err) {
                setError('Error al cargar el tema');
            } finally {
                setLoading(false);
            }
        };
        fetchTopic();
    }, [topicId]);

    const handleCancel = () => {
        navigate(`/content/topics/${topicId}`);
    };

    const handleBackToSourceChoice = () => {
        setAddSourceMode(null);
    };

    const handleSave = async (selectedIds) => {
        try {
            await contentApi.addContentToTopic(topicId, selectedIds);
            navigate(`/content/topics/${topicId}`);
        } catch (err) {
            console.error('TopicAddContent - Failed to add content to topic:', err);
            setError('Error al agregar contenido al tema');
            throw err;
        }
    };

    const handleContentUploaded = async (contentProfile) => {
        const profileId = contentProfile?.id ?? contentProfile;
        if (!profileId) return;
        try {
            setSaving(true);
            await contentApi.addContentToTopic(topicId, [profileId]);
            setAddSourceMode(null);
        } catch (err) {
            console.error('Failed to add uploaded content to topic:', err);
            setError('Error al agregar el contenido al tema');
        } finally {
            setSaving(false);
        }
    };

    const handleSelectionChange = (selectedContentProfiles) => {
        setSelectedContentProfileIds(selectedContentProfiles.map((p) => p.id));
    };

    const filterContent = (content) => {
        const isInTopic = content.content.topics?.some(
            (tid) => tid === parseInt(topicId, 10)
        );
        return !isInTopic;
    };

    if (loading) {
        return <Typography>Cargando...</Typography>;
    }
    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography color="error">{error}</Typography>
                <Button onClick={() => navigate(`/content/topics/${topicId}`)}>
                    Volver al tema
                </Button>
            </Box>
        );
    }

    if (addSourceMode === 'library') {
        return (
            <LibrarySelectMultiple
                title="Agregar Contenido al Tema"
                description="Selecciona contenido de tu biblioteca para agregar a este tema"
                onCancel={handleBackToSourceChoice}
                onSave={handleSave}
                onSelectionChange={handleSelectionChange}
                filterFunction={filterContent}
                contextName={topicData?.topic?.title ?? topicId}
                selectedIds={selectedContentProfileIds}
            />
        );
    }

    if (addSourceMode === 'upload') {
        return (
            <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: 800, mx: 'auto' }}>
                <Button
                    variant="text"
                    startIcon={<ArrowBackIcon />}
                    onClick={handleBackToSourceChoice}
                    sx={{ mb: 2, textTransform: 'none' }}
                    disabled={saving}
                >
                    Volver
                </Button>
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                        {uploadMode === 'url'
                            ? 'Agregar contenido desde URL'
                            : 'Subir archivo'}
                    </Typography>
                    <UploadContentForm
                        onContentUploaded={handleContentUploaded}
                        onUploadingChange={setSaving}
                        initialUrlMode={uploadMode === 'url'}
                        showModeToggle={false}
                    />
                </Paper>
            </Box>
        );
    }

    return (
        <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: 600, mx: 'auto' }}>
            <Paper elevation={2} sx={{ p: 4 }}>
                <Typography variant="h6" gutterBottom align="center" sx={{ mb: 1 }}>
                    Agregar contenido al tema
                </Typography>
                {topicData?.topic?.title && (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                        {topicData.topic.title}
                    </Typography>
                )}
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                    Elige de la biblioteca, desde una URL o sube un archivo.
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        onClick={() => setAddSourceMode('library')}
                        sx={{ textTransform: 'none', py: 2 }}
                    >
                        Elegir de la biblioteca
                    </Button>
                    <Button
                        variant="outlined"
                        size="large"
                        onClick={() => { setUploadMode('url'); setAddSourceMode('upload'); }}
                        sx={{ textTransform: 'none', py: 2 }}
                    >
                        Desde URL
                    </Button>
                    <Button
                        variant="outlined"
                        size="large"
                        onClick={() => { setUploadMode('file'); setAddSourceMode('upload'); }}
                        sx={{ textTransform: 'none', py: 2 }}
                    >
                        Subir archivo
                    </Button>
                </Box>
                <Button
                    variant="outlined"
                    onClick={handleCancel}
                    sx={{ mt: 3, width: '100%', textTransform: 'none' }}
                >
                    Cancelar
                </Button>
            </Paper>
        </Box>
    );
};

export default TopicAddContent;
