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
    Alert,
    CircularProgress,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { formatDate } from '../utils/dateUtils';
import { resolveMediaUrl } from '../utils/fileUtils';
import contentApi from '../api/contentApi';
import { AuthContext } from '../context/AuthContext';
import ContentDisplay from './ContentDisplay';
import OwnerContentFileUploadDialog from './OwnerContentFileUploadDialog';

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
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [error, setError] = useState('');
    const [attachFileDialogOpen, setAttachFileDialogOpen] = useState(false);
    const [attachFileSuccess, setAttachFileSuccess] = useState('');
    const [editUrlDialogOpen, setEditUrlDialogOpen] = useState(false);
    const [urlDraft, setUrlDraft] = useState('');
    const [urlDialogCheckLoading, setUrlDialogCheckLoading] = useState(false);
    const [urlDialogSaveLoading, setUrlDialogSaveLoading] = useState(false);
    const [urlDialogError, setUrlDialogError] = useState('');
    const [urlSaveBlocked, setUrlSaveBlocked] = useState(false);
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

                // Thumbnail preview: first use the user's existing thumbnail, then fallback to og_image.
                setThumbnailFile(null);
                setThumbnailPreviewUrl(
                    profile?.thumbnail || data.file_details?.og_image || null
                );
            } catch (err) {
                setError('Error al cargar el contenido');
                console.error(err);
            }
        };
        fetchContent();
    }, [contentId, authState?.user?.id]);

    const reloadContent = async () => {
        const data = await contentApi.getContentDetails(contentId, 'library', authState?.user?.id);
        setContent(data);
        const profile = data.selected_profile;
        setThumbnailPreviewUrl(
            profile?.thumbnail || data.file_details?.og_image || null
        );
        return data;
    };

    const openEditUrlDialog = async () => {
        if (!content?.url) return;
        setUrlDraft(content.url);
        setUrlDialogError('');
        setUrlSaveBlocked(false);
        setEditUrlDialogOpen(true);
        setUrlDialogCheckLoading(true);
        try {
            const check = await contentApi.checkContentModification(contentId);
            if (!check?.can_modify) {
                setUrlSaveBlocked(true);
                setUrlDialogError(
                    check?.message ||
                        'No se puede cambiar la URL porque otros usuarios tienen este contenido en su biblioteca.'
                );
            }
        } catch (err) {
            setUrlSaveBlocked(true);
            setUrlDialogError(
                err.response?.data?.error ||
                    err.message ||
                    'No se pudo comprobar si se permite cambiar la URL.'
            );
        } finally {
            setUrlDialogCheckLoading(false);
        }
    };

    const handleSaveContentUrl = async () => {
        const trimmed = (urlDraft || '').trim();
        if (!trimmed) {
            setUrlDialogError('La URL no puede estar vacía.');
            return;
        }
        setUrlDialogSaveLoading(true);
        setUrlDialogError('');
        try {
            await contentApi.updateContent(contentId, { url: trimmed });
            await reloadContent();
            setEditUrlDialogOpen(false);
            setAttachFileSuccess('URL del contenido actualizada correctamente.');
        } catch (err) {
            const msg =
                err.response?.data?.error ||
                (typeof err.response?.data === 'string' ? err.response.data : null) ||
                err.message ||
                'No se pudo guardar la URL.';
            setUrlDialogError(typeof msg === 'string' ? msg : 'No se pudo guardar la URL.');
        } finally {
            setUrlDialogSaveLoading(false);
        }
    };

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

            // If the user selected a new thumbnail, send multipart/form-data.
            if (thumbnailFile) {
                const fd = new FormData();
                fd.append('title', formData.title ?? '');
                fd.append('author', formData.author ?? '');
                fd.append('personal_note', formData.personal_note ?? '');
                fd.append('is_visible', String(!!formData.is_visible));
                fd.append('is_producer', String(!!formData.is_producer));
                fd.append('thumbnail', thumbnailFile);
                await contentApi.updateContentProfile(content.selected_profile.id, fd);
            } else {
                await contentApi.updateContentProfile(content.selected_profile.id, formData);
            }

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

    const hasAttachedFile = !!(content.has_file_available || content.file_details?.file);
    const canAttachFileAsOwner = !!(content.is_original_uploader && content.url && !hasAttachedFile);

    return (
        <Box sx={{ maxWidth: 1400, margin: '0 auto', padding: 2, pt: 12 }}>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Editar perfil de contenido
                </Typography>
            </Box>

            {attachFileSuccess && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAttachFileSuccess('')}>
                    {attachFileSuccess}
                </Alert>
            )}

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

                        {/* Thumbnail editor */}
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                                Miniatura (thumbnail)
                            </Typography>

                            {thumbnailPreviewUrl ? (
                                <Box
                                    sx={{
                                        width: "100%",
                                        maxWidth: 320,
                                        height: 160,
                                        borderRadius: 1,
                                        overflow: "hidden",
                                        border: "1px solid",
                                        borderColor: "divider",
                                        bgcolor: "grey.50",
                                        mb: 1,
                                    }}
                                >
                                    <img
                                        src={thumbnailPreviewUrl}
                                        alt="Miniatura actual"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            display: "block",
                                        }}
                                    />
                                </Box>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    No hay miniatura disponible.
                                </Typography>
                            )}

                            <Button
                                variant="outlined"
                                component="label"
                                size="small"
                                sx={{ textTransform: "none" }}
                            >
                                Cambiar miniatura
                                <input
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        // Revoke previous blob preview (if any) to avoid memory leaks.
                                        setThumbnailFile(file);
                                        if (
                                            typeof thumbnailPreviewUrl === "string" &&
                                            thumbnailPreviewUrl.startsWith("blob:")
                                        ) {
                                            URL.revokeObjectURL(thumbnailPreviewUrl);
                                        }
                                        setThumbnailPreviewUrl(URL.createObjectURL(file));
                                    }}
                                />
                            </Button>

                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                                Se reemplazará la miniatura actual de este contenido.
                            </Typography>
                        </Box>

                        {/* Archivo relacionado: título según exista archivo; acciones en la misma fila */}
                        {(content.file_details || content?.can_suggest_file || canAttachFileAsOwner) && (
                            <Box sx={{ mb: 3 }}>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 1,
                                        flexWrap: 'wrap',
                                        mb: hasAttachedFile && content.file_details ? 1 : 0,
                                    }}
                                >
                                    <Typography variant="subtitle2" component="div" sx={{ m: 0 }}>
                                        {hasAttachedFile
                                            ? 'Detalles del archivo:'
                                            : 'No hay archivo relacionado'}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        {canAttachFileAsOwner && (
                                            <Button
                                                variant="contained"
                                                size="small"
                                                onClick={() => {
                                                    setAttachFileSuccess('');
                                                    setAttachFileDialogOpen(true);
                                                }}
                                            >
                                                Subir archivo
                                            </Button>
                                        )}
                                        {content?.can_suggest_file && (
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={() =>
                                                    navigate(
                                                        `/content/${contentId}/library?context=library&id=${authState?.user?.id}`
                                                    )
                                                }
                                            >
                                                Sugerir archivo
                                            </Button>
                                        )}
                                    </Box>
                                </Box>
                                {content.file_details && hasAttachedFile && (
                                    <>
                                        <Typography variant="body2">
                                            Tamaño:{' '}
                                            {content.file_details.file_size != null
                                                ? `${(content.file_details.file_size / 1024 / 1024).toFixed(2)} MB`
                                                : '—'}
                                        </Typography>
                                        {(() => {
                                            const downloadUrl = resolveMediaUrl(
                                                content.url ?? content.file_details?.url ?? content.file_details?.file
                                            );
                                            return downloadUrl && content.file_details.file ? (
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<DownloadIcon />}
                                                    href={downloadUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    download
                                                    sx={{ mt: 1 }}
                                                >
                                                    Descargar archivo
                                                </Button>
                                            ) : null;
                                        })()}
                                    </>
                                )}
                            </Box>
                        )}

                        {content.url && content.is_original_uploader && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    URL del contenido (fuente compartida)
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ wordBreak: 'break-all', mb: 1 }}
                                >
                                    {content.url}
                                </Typography>
                                <Button variant="outlined" size="small" onClick={openEditUrlDialog}>
                                    Cambiar URL
                                </Button>
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

            <Dialog
                open={editUrlDialogOpen}
                onClose={() =>
                    !urlDialogSaveLoading && !urlDialogCheckLoading && setEditUrlDialogOpen(false)
                }
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Cambiar URL del contenido</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        La URL vive en el registro del contenido (no en tu perfil de biblioteca). Si otras
                        personas usan el mismo ítem, el cambio las afecta. Por favor, asegúrate que la url no esté rota.
                    </Typography>
                    {urlDialogCheckLoading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                            <CircularProgress size={32} />
                        </Box>
                    )}
                    {!urlDialogCheckLoading && (
                        <>
                            {urlDialogError && (
                                <Alert severity="error" sx={{ mb: 2 }}>
                                    {urlDialogError}
                                </Alert>
                            )}
                            <TextField
                                fullWidth
                                label="URL"
                                value={urlDraft}
                                onChange={(e) => setUrlDraft(e.target.value)}
                                margin="normal"
                                multiline
                                minRows={2}
                                disabled={urlSaveBlocked || urlDialogSaveLoading}
                            />
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setEditUrlDialogOpen(false)}
                        disabled={urlDialogSaveLoading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSaveContentUrl}
                        disabled={
                            urlDialogSaveLoading ||
                            urlDialogCheckLoading ||
                            urlSaveBlocked
                        }
                    >
                        {urlDialogSaveLoading ? 'Guardando…' : 'Guardar'}
                    </Button>
                </DialogActions>
            </Dialog>

            <OwnerContentFileUploadDialog
                open={attachFileDialogOpen}
                onClose={() => setAttachFileDialogOpen(false)}
                contentId={contentId}
                dialogTitle="Subir archivo correspondiente"
                submitLabel="Adjuntar archivo"
                introText="Este contenido tiene URL pero aún no tiene archivo descargable. Al adjuntar un archivo, quedará vinculado a este ítem."
                onSuccess={async () => {
                    setAttachFileSuccess('Archivo adjuntado correctamente.');
                    setAttachFileDialogOpen(false);
                    try {
                        await reloadContent();
                    } catch (e) {
                        console.error(e);
                    }
                }}
            />
        </Box>
    );
};

export default ContentProfileEdit; 