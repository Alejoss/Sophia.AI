import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import knowledgePathsApi from '../api/knowledgePathsApi';
import ContentSelector from '../content/ContentSelector';

const NodeCreate = () => {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const [knowledgePath, setKnowledgePath] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content_profile_id: null
  });
  const [selectedContent, setSelectedContent] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isUploadingContent, setIsUploadingContent] = useState(false);

  useEffect(() => {
    const fetchKnowledgePath = async () => {
      try {
        const data = await knowledgePathsApi.getKnowledgePathBasic(pathId);
        setKnowledgePath(data);
      } catch (err) {
        setError('Error al cargar el camino de conocimiento');
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgePath();
  }, [pathId]);

  const handleContentSelected = useCallback((content_profile) => {
    console.log('Selected content profile:', content_profile);
    console.log('Content profile title:', content_profile.title);
    console.log('Content profile original title:', content_profile.content?.original_title);
    
    setSelectedContent(content_profile);
    setFormData(prev => {
      const newFormData = {
        ...prev,
        content_profile_id: content_profile.id,
        title: prev.title || content_profile.title || content_profile.content?.original_title || 'Untitled'
      };
      console.log('New form data being set:', newFormData);
      return newFormData;
    });
  }, []);

  const handleContentRemoved = useCallback(() => {
    setSelectedContent(null);
    setFormData(prev => ({
      ...prev,
      content_profile_id: null
    }));
  }, []);

  const handleUploadingChange = useCallback((uploading) => {
    setIsUploadingContent(uploading);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await knowledgePathsApi.addNode(pathId, formData);
      // Redirect to knowledge path edit page
      navigate(`/knowledge_path/${pathId}/edit`);
    } catch (err) {
      setError(err.message || 'Error al agregar el nodo');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 } }}>
      <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
        <Typography variant="h5" component="h1" sx={{ mb: 1 }}>
          Agregar Nodo de Contenido
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          al Camino de Conocimiento: {knowledgePath?.title}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <ContentSelector
            selectedContent={selectedContent}
            onContentSelected={handleContentSelected}
            onContentRemoved={handleContentRemoved}
            previewVariant="detailed"
            onUploadingChange={handleUploadingChange}
          />

          <Box 
            component="form" 
            onSubmit={handleSubmit} 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 3,
              opacity: isUploadingContent ? 0.7 : 1,
              transition: 'opacity 0.3s ease'
            }}
          >
            <TextField
              fullWidth
              id="title"
              label="Título del Nodo"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
              disabled={isUploadingContent}
            />

            <TextField
              fullWidth
              id="description"
              label="Descripción"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={4}
              disabled={isUploadingContent}
            />

            {isUploadingContent && (
              <Alert severity="info" sx={{ mb: 1 }}>
                Subiendo contenido... Puedes completar el formulario mientras tanto.
              </Alert>
            )}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={!formData.content_profile_id || submitting || isUploadingContent}
                sx={{ minWidth: { xs: '100%', md: 'auto' } }}
              >
                {submitting ? 'Agregando...' : 'Agregar Nodo'}
              </Button>
              <Button
                type="button"
                onClick={() => navigate(`/knowledge_path/${pathId}/edit`)}
                variant="outlined"
                color="inherit"
                disabled={isUploadingContent}
                sx={{ minWidth: { xs: '100%', md: 'auto' } }}
              >
                Cancelar
              </Button>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default NodeCreate;
