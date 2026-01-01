import React, { useState, useEffect } from 'react';
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

const NodeEdit = () => {
  const { pathId, nodeId } = useParams();
  const navigate = useNavigate();
  const [knowledgePath, setKnowledgePath] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content_profile_id: null
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching data for node edit');
        // Fetch both the knowledge path and node data
        const [pathData, nodeData] = await Promise.all([
          knowledgePathsApi.getKnowledgePathBasic(pathId),
          knowledgePathsApi.getNode(pathId, nodeId)
        ]);

        console.log('Node data:', nodeData);
        setKnowledgePath(pathData);
        
        // Check if there's a content_profile_id
        const hasContentProfile = nodeData.content_profile_id !== null && nodeData.content_profile_id !== undefined;
        console.log('Has content profile?', hasContentProfile, 'content_profile_id:', nodeData.content_profile_id);
        
        // Set initial form data with the node information
        setFormData({
          title: nodeData.title,
          description: nodeData.description || '',
          content_profile_id: hasContentProfile ? nodeData.content_profile_id : null
        });
        
        // If we have a content profile ID, fetch the content details
        if (hasContentProfile) {
          try {
            console.log('Fetching content profile:', nodeData.content_profile_id);
            const contentProfileData = await knowledgePathsApi.getNodeContent(nodeData.content_profile_id);
            console.log('Content profile data:', contentProfileData);
            setSelectedContent(contentProfileData);
          } catch (contentErr) {
            console.error('Error fetching content profile:', contentErr);
            setSelectedContent(null);
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pathId, nodeId]);

  const handleContentSelected = (content_profile) => {
    console.log('Selected content profile:', content_profile);
    console.log('Content profile title:', content_profile.title);
    console.log('Content profile original title:', content_profile.content?.original_title);
    console.log('Current form data:', formData);
    
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      console.log('Submitting form data:', formData);
      await knowledgePathsApi.updateNode(pathId, nodeId, formData);
      navigate(`/knowledge_path/${pathId}/edit`);
    } catch (err) {
      console.error('Error updating node:', err);
      setError(err.message || 'Error al actualizar el nodo');
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
          Editar Nodo de Contenido
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          en la Ruta de Conocimiento: {knowledgePath?.title}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <ContentSelector
            selectedContent={selectedContent}
            onContentSelected={handleContentSelected}
            onContentRemoved={() => {
              setSelectedContent(null);
              setFormData(prev => ({
                ...prev,
                content_profile_id: null
              }));
            }}
            previewVariant="detailed"
          />

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              id="title"
              label="Título del Nodo"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />

            <TextField
              fullWidth
              id="description"
              label="Descripción"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={4}
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Button
                type="submit"
                variant="contained"
                color="success"
                sx={{ minWidth: { xs: '100%', md: 'auto' } }}
              >
                Guardar Cambios
              </Button>
              <Button
                type="button"
                onClick={() => navigate(`/knowledge_path/${pathId}/edit`)}
                variant="outlined"
                color="inherit"
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

export default NodeEdit;
