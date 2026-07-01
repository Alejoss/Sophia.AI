import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import contentApi from '../api/contentApi';
import LibrarySelectMultiple from '../content/LibrarySelectMultiple';
import UploadContentForm from '../content/UploadContentForm';

const TopicContentManager = ({ topicId, topicTitle: topicTitleProp = '' }) => {
  const [topicData, setTopicData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showAddContent, setShowAddContent] = useState(false);
  const [addSourceMode, setAddSourceMode] = useState(null);
  const [uploadMode, setUploadMode] = useState('file');

  const topicTitle = topicTitleProp || topicData?.topic?.title || '';

  const refreshContent = useCallback(async () => {
    const data = await contentApi.getTopicDetailsSimple(topicId);
    setTopicData(data);
    return data;
  }, [topicId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await refreshContent();
        if (!cancelled) {
          setTopicData(data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError('Error al cargar el contenido del tema');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [refreshContent]);

  const handleContentRemove = async (contentId) => {
    try {
      setSaving(true);
      await contentApi.removeContentFromTopic(topicId, [contentId]);
      await refreshContent();
    } catch {
      setError('Error al eliminar contenido del tema');
    } finally {
      setSaving(false);
    }
  };

  const handleContentUploaded = async (contentProfile) => {
    const profileId = contentProfile?.id ?? contentProfile;
    if (!profileId) return;
    try {
      setSaving(true);
      await contentApi.addContentToTopic(topicId, [profileId]);
      await refreshContent();
      setSuccessMessage('Contenido agregado al tema correctamente.');
      setAddSourceMode(null);
      setShowAddContent(false);
    } catch {
      setError('Error al agregar el contenido al tema');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdd = async (selectedContentProfileIds) => {
    try {
      setSaving(true);
      await contentApi.addContentToTopic(topicId, selectedContentProfileIds);
      await refreshContent();
      setSuccessMessage('Contenido agregado al tema correctamente.');
      setAddSourceMode(null);
      setShowAddContent(false);
    } catch {
      setError('Error al agregar contenido al tema');
    } finally {
      setSaving(false);
    }
  };

  const filterContent = (content) => {
    const isInTopic = content?.content?.topics?.some(
      (id) => id === parseInt(topicId, 10),
    );
    return !isInTopic;
  };

  if (loading) {
    return <Typography color="text.secondary">Cargando contenido...</Typography>;
  }
  if (error && !topicData) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (!topicData) {
    return <Alert severity="error">Tema no encontrado</Alert>;
  }

  if (showAddContent) {
    if (addSourceMode === 'library') {
      return (
        <Box>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => setAddSourceMode(null)}
            sx={{ mb: 2, textTransform: 'none' }}
            disabled={saving}
          >
            Volver
          </Button>
          <LibrarySelectMultiple
            title={topicTitle ? `Agregar contenido — ${topicTitle}` : 'Agregar contenido'}
            description="Selecciona contenido de tu biblioteca para agregar a este tema"
            onCancel={() => setAddSourceMode(null)}
            onSave={handleSaveAdd}
            filterFunction={filterContent}
            contextName={topicTitle}
          />
        </Box>
      );
    }

    if (addSourceMode === 'upload') {
      return (
        <Box>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => setAddSourceMode(null)}
            sx={{ mb: 2, textTransform: 'none' }}
            disabled={saving}
          >
            Volver
          </Button>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {uploadMode === 'url' ? 'Agregar contenido desde URL' : 'Subir archivo'}
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
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Agregar contenido al tema
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Elige de la biblioteca, desde una URL o sube un archivo.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button variant="contained" onClick={() => setAddSourceMode('library')} sx={{ textTransform: 'none', py: 1.5 }}>
            Elegir de la biblioteca
          </Button>
          <Button variant="outlined" onClick={() => { setUploadMode('url'); setAddSourceMode('upload'); }} sx={{ textTransform: 'none', py: 1.5 }}>
            Desde URL
          </Button>
          <Button variant="outlined" onClick={() => { setUploadMode('file'); setAddSourceMode('upload'); }} sx={{ textTransform: 'none', py: 1.5 }}>
            Subir archivo
          </Button>
        </Box>
        <Button variant="text" onClick={() => setShowAddContent(false)} sx={{ mt: 2, textTransform: 'none' }}>
          Cancelar
        </Button>
      </Paper>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Contenido en el tema ({topicData.contents?.length || 0})
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowAddContent(true)}
          sx={{ textTransform: 'none' }}
        >
          Agregar contenido
        </Button>
      </Box>

      {topicData.description && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {topicData.description}
          </Typography>
          <Divider sx={{ mb: 2 }} />
        </>
      )}

      {(topicData.contents?.length || 0) === 0 ? (
        <Alert severity="info">Aun no se ha agregado contenido a este tema.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Titulo</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Autor</TableCell>
                <TableCell>Ver</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {topicData.contents.map((contentProfile) => (
                <TableRow key={contentProfile.id} hover>
                  <TableCell>{contentProfile.title || 'Sin titulo'}</TableCell>
                  <TableCell>
                    <Chip label={contentProfile.content?.media_type} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell>{contentProfile.author || 'Desconocido'}</TableCell>
                  <TableCell>
                    <Button
                      component="a"
                      href={`/content/${contentProfile.content.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      endIcon={<OpenInNewIcon />}
                      sx={{ textTransform: 'none' }}
                    >
                      Ver
                    </Button>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => handleContentRemove(contentProfile.content.id)}
                      disabled={saving}
                      sx={{ textTransform: 'none' }}
                    >
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccessMessage(null)} severity="success" variant="filled">
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TopicContentManager;
