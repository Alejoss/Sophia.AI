import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Box,
    Card,
    Button,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Divider,
    Grid,
    Alert,
    Paper,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import AddIcon from '@mui/icons-material/Add';
import { formatDate } from '../utils/dateUtils';
import contentApi from '../api/contentApi';
import { AuthContext } from '../context/AuthContext';
import ContentDisplay from './ContentDisplay';
import UploadContentForm from './UploadContentForm';

const ContentSourceEdit = () => {
    const { contentId } = useParams();
    const navigate = useNavigate();
    const [content, setContent] = useState(null);
    const [modificationCheck, setModificationCheck] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { authState } = useContext(AuthContext);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [contentData, modificationData] = await Promise.all([
                    contentApi.getContentDetails(contentId, 'library', authState?.user?.id),
                    contentApi.checkContentModification(contentId)
                ]);
                setContent(contentData);
                setModificationCheck(modificationData);
            } catch (err) {
                setError('Error al cargar el contenido');
                console.error(err);
            }
        };
        fetchData();
    }, [contentId, authState?.user?.id]);

    const handleContentUploaded = async (contentProfile) => {
        try {
            // Content was updated successfully
            setSuccess('¡Fuente de contenido actualizada exitosamente!');
            
            // Refresh the current content data
            const updatedData = await contentApi.getContentDetails(contentId, 'library', authState?.user?.id);
            setContent(updatedData);
        } catch (err) {
            setError('Error al actualizar los datos del contenido');
            console.error(err);
        }
    };

    if (!content || !modificationCheck) return <div>Cargando...</div>;

    // Check if content can be modified
    const canModify = modificationCheck.can_modify;

    return (
        <Box sx={{ maxWidth: 1400, margin: '0 auto', padding: 2, pt: 12 }}>
            <Typography 
              variant="h4" 
              gutterBottom 
              sx={{ 
                mb: 3,
                fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
                fontWeight: 400,
                fontSize: "24px"
              }} 
              color="text.primary"
            >
                Editar fuente del contenido
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    {success}
                </Alert>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                    variant="outlined"
                    onClick={() => navigate(`/content/${contentId}/library?context=library&id=${authState?.user?.id}`)}
                >
                    Cancelar
                </Button>
            </Box>

            {!canModify ? (
                // Show message when content cannot be modified
                <Card sx={{ padding: 3, mb: 3 }}>
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        <Typography 
                          variant="h6" 
                          gutterBottom 
                          color="text.primary"
                          sx={{
                            fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
                            fontWeight: 400,
                            fontSize: "18px"
                          }}
                        >
                            No se puede modificar la fuente del contenido
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            {modificationCheck.message}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Como otros usuarios han agregado este contenido a sus bibliotecas, cambiar la fuente afectaría su contenido también.
                        </Typography>
                        <Button
                            component={Link}
                            to="/content/library_upload_content"
                            variant="contained"
                            startIcon={<AddIcon />}
                            sx={{ mt: 1 }}
                        >
                            Subir nuevo contenido
                        </Button>
                    </Alert>
                    
                    {/* Show content preview */}
                    <Typography 
                      variant="h6" 
                      gutterBottom 
                      sx={{ 
                        mt: 3,
                        fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
                        fontWeight: 400,
                        fontSize: "18px"
                      }} 
                      color="text.primary"
                    >
                        Vista previa del contenido
                    </Typography>
                    <ContentDisplay 
                        content={content}
                        variant="detailed"
                        maxImageHeight={400}
                        showAuthor={true}
                    />
                </Card>
            ) : (
                // Show edit form when content can be modified
                <Grid container spacing={3}>
                    {/* Left Side - Edit Form */}
                    <Grid item xs={12} md={6}>
                        <Card sx={{ padding: 3, height: 'fit-content' }}>
                            {/* Upload Content Form */}
                            <Paper elevation={2} sx={{ p: 3 }}>
                                <Typography 
                                  variant="h6" 
                                  gutterBottom 
                                  color="text.primary"
                                  sx={{
                                    fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
                                    fontWeight: 400,
                                    fontSize: "18px"
                                  }}
                                >
                                    Cambiar fuente del contenido
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Sube un nuevo archivo o cambia la URL para reemplazar la fuente de contenido actual.
                                </Typography>
                                <UploadContentForm 
                                    onContentUploaded={handleContentUploaded}
                                    initialData={{
                                        url: content.url || '',
                                        media_type: content.media_type || '',
                                        title: content.original_title || '',
                                        author: content.original_author || '',
                                    }}
                                    isEditMode={true}
                                    contentId={contentId}
                                    contentProfileId={content.selected_profile?.id}
                                />
                            </Paper>
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
            )}
        </Box>
    );
};

export default ContentSourceEdit; 