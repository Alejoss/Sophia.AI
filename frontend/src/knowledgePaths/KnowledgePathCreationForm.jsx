import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  Stack,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { isAuthenticated } from '../context/localStorageUtils';
import knowledgePathsApi from '../api/knowledgePathsApi';

const KnowledgePathCreationForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      // Prepare form data with image if selected
      const submitData = { ...formData };
      if (selectedImage) {
        submitData.image = selectedImage;
      }
      
      const data = await knowledgePathsApi.createKnowledgePath(submitData);
      navigate(`/knowledge_path/${data.id}/edit`);
    } catch (err) {
      setError(err.message || 'Error al crear el camino de conocimiento');
    }
  };

  return (
    <Container sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 } }}>
      <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          Crear Camino de Conocimiento
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Paper sx={{ p: 3 }}>
          <form onSubmit={handleSubmit}>
            {/* Image Upload Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
                Imagen de Portada (Opcional)
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
                <Box
                  sx={{
                    width: { xs: '100%', sm: 240 },
                    height: 135,
                    borderRadius: 2,
                    bgcolor: 'grey.300',
                    overflow: 'hidden',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  {imagePreview ? (
                    <Box
                      component="img"
                      src={imagePreview}
                      alt="Knowledge Path Cover"
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '3rem',
                        color: 'text.secondary',
                        fontWeight: 700,
                      }}
                    >
                      {formData.title ? formData.title.charAt(0).toUpperCase() : 'K'}
                    </Box>
                  )}
                </Box>
                <Box>
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="image-upload"
                    type="file"
                    onChange={handleImageUpload}
                  />
                  <label htmlFor="image-upload">
                    <Button
                      component="span"
                      variant="outlined"
                      startIcon={<PhotoCameraIcon />}
                      sx={{
                        textTransform: 'none',
                        borderRadius: 2,
                      }}
                    >
                      Subir portada
                    </Button>
                  </label>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Recomendado: imagen 16:9 para mejor visualización.
                  </Typography>
                </Box>
              </Box>
            </Box>

            <TextField
              fullWidth
              id="title"
              name="title"
              label="Título"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="Ingresa el título del camino de conocimiento"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              id="description"
              name="description"
              label="Descripción"
              value={formData.description}
              onChange={handleChange}
              required
              multiline
              minRows={8}
              maxRows={24}
              placeholder="Describe tu camino de conocimiento"
              sx={{ mb: 3 }}
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                sx={{ minWidth: { xs: '100%', md: 'auto' } }}
              >
                Crear Camino de Conocimiento
              </Button>
              <Button
                type="button"
                onClick={() => navigate('/knowledge_path')}
                variant="contained"
                color="inherit"
                sx={{ minWidth: { xs: '100%', md: 'auto' } }}
              >
                Cancelar
              </Button>
            </Stack>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default KnowledgePathCreationForm;
