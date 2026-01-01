import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Card,
    TextField,
    Button,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Divider,
    FormControlLabel,
    Switch,
    Checkbox,
    Grid,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { formatDate } from '../utils/dateUtils';
import contentApi from '../api/contentApi';
import { AuthContext } from '../context/AuthContext';
import ContentDisplay from './ContentDisplay';

const ContentProfileEdit = () => {
    const { contentId } = useParams();
    const navigate = useNavigate();
    const [content, setContent] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        author: '',
        personal_note: '',
        is_visible: true,
        is_producer: false,
    });
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [error, setError] = useState('');
    const { authState } = useContext(AuthContext);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const data = await contentApi.getContentDetails(contentId, 'library', authState?.user?.id);
                console.log('Content details:', data);
                console.log('Media type:', data.media_type);
                console.log('Content structure:', {
                    id: data.id,
                    media_type: data.media_type,
                    original_title: data.original_title,
                    selected_profile: data.selected_profile,
                    content: data.content
                });
                setContent(data);
                const profile = data.selected_profile;
                setFormData({
                    title: profile?.title || data.original_title || '',
                    author: profile?.author || data.original_author || '',
                    personal_note: profile?.personal_note || '',
                    is_visible: profile?.is_visible ?? true,
                    is_producer: profile?.is_producer ?? false,
                });
            } catch (err) {
                setError('Error al cargar el contenido');
                console.error(err);
            }
        };
        fetchContent();
    }, [contentId, authState?.user?.id]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!content.selected_profile?.id) {
                setError('No se encontró el perfil de contenido');
                return;
            }
            await contentApi.updateContentProfile(content.selected_profile.id, formData);
            navigate(`/content/${contentId}/library?context=library&id=${authState?.user?.id}`);
        } catch (err) {
            if (err.response?.data?.error?.includes('producer')) {
                setError('Debes reclamar ser el productor para cambiar la visibilidad');
            } else {
                setError('Error al actualizar el contenido');
            }
            console.error(err);
        }
    };

    const handleDelete = async () => {
        try {
            await contentApi.deleteContent(contentId);
            navigate('/content/library_user');
        } catch (err) {
            setError('Error al eliminar el contenido');
            console.error(err);
        }
    };

    if (!content) return <div>Cargando...</div>;

    return (
        <Box sx={{ maxWidth: 1400, margin: '0 auto', padding: 2, pt: 12 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Editar perfil de contenido
                </Typography>
                <Button
                    variant="outlined"
                    size="small"
                    onClick={() => navigate(`/content/${contentId}/source-edit`)}
                >
                    Editar fuente del contenido
                </Button>
            </Box>

            {error && (
                <Typography color="error" sx={{ mb: 2 }}>
                    {error}
                </Typography>
            )}

            <Grid container spacing={3}>
                {/* Left Side - Edit Form */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ padding: 3, height: 'fit-content' }}>
                        <Typography variant="h6" gutterBottom>
                            Información del perfil de contenido
                        </Typography>
                        
                        <Box sx={{ mb: 2 }}>
                            <Chip 
                                label={content.media_type || content.content?.media_type || 'DESCONOCIDO'} 
                                color="primary" 
                                sx={{ mr: 1 }}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Subido: {formatDate(content.created_at)}
                            </Typography>
                        </Box>

                        {/* Download Button */}
                        {content.file_details && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Detalles del archivo:
                                </Typography>
                                <Typography variant="body2">
                                    Tamaño: {(content.file_details.file_size / 1024 / 1024).toFixed(2)} MB
                                </Typography>
                                {content.file_details.file && (
                                    <Button
                                        variant="outlined"
                                        startIcon={<DownloadIcon />}
                                        href={content.url || content.file_details.url || content.file_details.file}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download
                                        sx={{ mt: 1 }}
                                    >
                                        Descargar archivo
                                    </Button>
                                )}
                            </Box>
                        )}

                        <Divider sx={{ my: 3 }} />

                        {/* Edit Form */}
                        <form onSubmit={handleSubmit}>
                            <TextField
                                fullWidth
                                label="Título"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                margin="normal"
                                helperText={content.original_title && `Título original: ${content.original_title}`}
                            />
                            <TextField
                                fullWidth
                                label="Autor"
                                name="author"
                                value={formData.author}
                                onChange={handleChange}
                                margin="normal"
                                helperText={content.original_author && `Autor original: ${content.original_author}`}
                            />
                            <TextField
                                fullWidth
                                label="Nota personal"
                                name="personal_note"
                                value={formData.personal_note}
                                onChange={handleChange}
                                margin="normal"
                                multiline
                                rows={4}
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={formData.is_producer}
                                        onChange={(e) => setFormData({ ...formData, is_producer: e.target.checked })}
                                        name="is_producer"
                                    />
                                }
                                label="He producido este contenido"
                                sx={{ mt: 2 }}
                            />
                            {formData.is_producer && (
                                <>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={formData.is_visible}
                                                onChange={(e) => setFormData({ ...formData, is_visible: e.target.checked })}
                                                name="is_visible"
                                            />
                                        }
                                        label="Visible en los resultados de búsqueda"
                                        sx={{ mt: 1, ml: 4 }}
                                    />
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, ml: 5 }}>
                                        Nota: Solo el productor del contenido puede hacerlo invisible en los resultados de búsqueda.
                                    </Typography>
                                </>
                            )}

                            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={() => setDeleteDialogOpen(true)}
                                >
                                    Eliminar contenido
                                </Button>
                                <Box>
                                    <Button
                                        variant="outlined"
                                        onClick={() => navigate(`/content/${contentId}/library?context=library&id=${authState?.user?.id}`)}
                                        sx={{ mr: 1 }}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        type="submit"
                                    >
                                        Guardar cambios
                                    </Button>
                                </Box>
                            </Box>
                        </form>
                    </Card>
                </Grid>

                {/* Right Side - Content Display */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ padding: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Vista previa del contenido
                        </Typography>
                        <ContentDisplay 
                            content={content}
                            variant="detailed"
                            maxImageHeight={400}
                            showAuthor={true}
                        />
                    </Card>
                </Grid>
            </Grid>

            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
            >
                <DialogTitle>Confirmar eliminación</DialogTitle>
                <DialogContent>
                    ¿Estás seguro de que deseas eliminar este contenido? Esta acción no se puede deshacer.
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleDelete} color="error">
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ContentProfileEdit; 