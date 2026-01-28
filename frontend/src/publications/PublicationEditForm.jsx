import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TextField, Button, Box, Typography, Paper, Divider, CircularProgress, Link } from '@mui/material';
import contentApi from '../api/contentApi';
import ContentSelector from '../content/ContentSelector';

const PublicationEditForm = () => {
  const navigate = useNavigate();
  const { publicationId } = useParams();
  const [formData, setFormData] = useState({
    text_content: '',
    status: 'PUBLISHED'
  });
  const [selectedContent, setSelectedContent] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isUploadingContent, setIsUploadingContent] = useState(false);

  useEffect(() => {
    const fetchPublicationDetails = async () => {
      try {
        setIsFetching(true);
        const publicationData = await contentApi.getPublicationDetails(publicationId);
        console.log('Publication data:', publicationData);
        
        // Set form data
        setFormData({
          text_content: publicationData.text_content || '',
          status: publicationData.status || 'PUBLISHED',
          content_profile_id: publicationData.content_profile_id || null
        });
        
        // Set content if it exists
        if (publicationData.content) {
          console.log('Setting content:', publicationData.content);
          setSelectedContent(publicationData.content);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching publication details:', err);
        setError('Error al cargar los detalles de la publicación');
      } finally {
        setIsFetching(false);
      }
    };

    fetchPublicationDetails();
  }, [publicationId]);

  const handleContentSelected = (contentProfile) => {
    console.log('Content selected for publication edit:', contentProfile);
    const contentProfileId = contentProfile.profile_id || contentProfile.id;
    
    setSelectedContent(contentProfile);
    setFormData(prev => ({
      ...prev,
      content_profile_id: contentProfileId
    }));
  };

  const handleContentRemoved = () => {
    setSelectedContent(null);
    setFormData(prev => ({
      ...prev,
      content_profile_id: null
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const publicationData = {
        ...formData
      };
      console.log('Sending publication update data:', publicationData);
      await contentApi.updatePublication(publicationId, publicationData);
      navigate('/profiles/my_profile');
    } catch (err) {
      setError('Error al actualizar la publicación');
      console.error('Error updating publication:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/profiles/my_profile');
  };

  const handleDelete = async () => {
    if (window.confirm('¿Está seguro de que desea eliminar esta publicación? Esta acción no se puede deshacer.')) {
      try {
        setIsLoading(true);
        await contentApi.deletePublication(publicationId);
        navigate('/profiles/my_profile');
      } catch (err) {
        setError('Error al eliminar la publicación');
        console.error('Error deleting publication:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (isFetching) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Link 
          component="button"
          variant="body2"
          onClick={() => navigate('/profiles/my_profile')}
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          ← Volver al Perfil
        </Link>
      </Box>

      <Typography variant="h4" gutterBottom>
        Editar Publicación
      </Typography>

      <ContentSelector
        selectedContent={selectedContent}
        onContentSelected={handleContentSelected}
        onContentRemoved={handleContentRemoved}
        previewVariant="preview"
        onUploadingChange={setIsUploadingContent}
      />

      <Paper elevation={2} sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Detalles de la Publicación
        </Typography>

        <TextField
          fullWidth
          multiline
          rows={4}
          label="Contenido de Texto"
          value={formData.text_content}
          onChange={(e) => setFormData({ ...formData, text_content: e.target.value })}
          required
          sx={{ mb: 3 }}
        />

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDelete}
            disabled={isLoading || isUploadingContent}
          >
            Eliminar
          </Button>
          <Button
            variant="outlined"
            onClick={handleCancel}
            disabled={isLoading || isUploadingContent}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isLoading || isUploadingContent}
          >
            {isLoading ? 'Actualizando...' : 'Actualizar Publicación'}
          </Button>
        </Box>
      </Paper>

      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

export default PublicationEditForm; 