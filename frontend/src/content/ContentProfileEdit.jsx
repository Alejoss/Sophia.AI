import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
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
import { applyApiErrorsToForm } from '../utils/apiFormErrors';

const schema = yup.object({
  title: yup
    .string()
    .trim()
    .required('El título es requerido.'),
  author: yup.string().trim().default(''),
  personal_note: yup.string().default(''),
  is_visible: yup.boolean().default(true),
  is_producer: yup.boolean().default(false),
});

const ContentProfileEdit = () => {
  const { contentId } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [attachFileDialogOpen, setAttachFileDialogOpen] = useState(false);
  const [attachFileSuccess, setAttachFileSuccess] = useState('');
  const [editUrlDialogOpen, setEditUrlDialogOpen] = useState(false);
  const [clearUrlDialogOpen, setClearUrlDialogOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlDialogCheckLoading, setUrlDialogCheckLoading] = useState(false);
  const [urlDialogSaveLoading, setUrlDialogSaveLoading] = useState(false);
  const [urlDialogError, setUrlDialogError] = useState('');
  const [urlSaveBlocked, setUrlSaveBlocked] = useState(false);
  const { authState } = useContext(AuthContext);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      title: '',
      author: '',
      personal_note: '',
      is_visible: true,
      is_producer: false,
    },
  });

  const isProducer = watch('is_producer');

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const data = await contentApi.getContentDetails(contentId, 'library', authState?.user?.id);

        setContent(data);
        const profile = data.selected_profile;
        reset({
          title: profile?.title || data.original_title || '',
          author: profile?.author || data.original_author || '',
          personal_note: profile?.personal_note || '',
          is_visible: profile?.is_visible ?? true,
          is_producer: profile?.is_producer ?? false,
        });

        setThumbnailFile(null);
        setThumbnailPreviewUrl(
          profile?.thumbnail || data.file_details?.og_image || null,
        );
        setLoadError('');
      } catch (err) {
        setLoadError('Error al cargar el contenido');
        console.error(err);
      }
    };
    fetchContent();
  }, [contentId, authState?.user?.id, reset]);

  const reloadContent = async () => {
    const data = await contentApi.getContentDetails(contentId, 'library', authState?.user?.id);
    setContent(data);
    const profile = data.selected_profile;
    setThumbnailPreviewUrl(
      profile?.thumbnail || data.file_details?.og_image || null,
    );
    return data;
  };

  const runSourceModificationCheck = async () => {
    setUrlDialogError('');
    setUrlSaveBlocked(false);
    setUrlDialogCheckLoading(true);
    try {
      const check = await contentApi.checkContentModification(contentId);
      if (!check?.can_modify) {
        setUrlSaveBlocked(true);
        setUrlDialogError(
          check?.message ||
          'No se puede modificar la fuente porque otros usuarios tienen este contenido en su biblioteca.',
        );
        return false;
      }
      return true;
    } catch (err) {
      setUrlSaveBlocked(true);
      setUrlDialogError(
        err.response?.data?.error ||
        err.message ||
        'No se pudo comprobar si se permite modificar la fuente.',
      );
      return false;
    } finally {
      setUrlDialogCheckLoading(false);
    }
  };

  const openEditUrlDialog = async () => {
    if (!content?.url) return;
    setUrlDraft(content.url);
    setEditUrlDialogOpen(true);
    await runSourceModificationCheck();
  };

  const openClearUrlDialog = async () => {
    if (!content?.url) return;
    setClearUrlDialogOpen(true);
    await runSourceModificationCheck();
  };

  const handleClearContentUrl = async () => {
    setUrlDialogSaveLoading(true);
    setUrlDialogError('');
    try {
      await contentApi.updateContent(contentId, { url: null });
      await reloadContent();
      setClearUrlDialogOpen(false);
      setAttachFileSuccess('URL del contenido eliminada. El archivo adjunto se mantiene.');
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        (typeof err.response?.data === 'string' ? err.response.data : null) ||
        err.message ||
        'No se pudo eliminar la URL.';
      setUrlDialogError(typeof msg === 'string' ? msg : 'No se pudo eliminar la URL.');
    } finally {
      setUrlDialogSaveLoading(false);
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

  const onSubmit = async (formData) => {
    setSubmitError('');

    try {
      if (!content.selected_profile?.id) {
        setSubmitError('No se encontró el perfil de contenido');
        return;
      }

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
      const producerMsg = err.response?.data?.error?.includes?.('producer')
        ? 'Debes reclamar ser el productor para cambiar la visibilidad'
        : null;

      const { generalError } = applyApiErrorsToForm(
        err,
        setError,
        producerMsg || 'Error al actualizar el contenido',
      );
      setSubmitError(generalError);
      console.error(err);
    }
  };

  const handleDelete = async () => {
    setDeleteError('');
    try {
      await contentApi.deleteContent(contentId);
      navigate('/content/library_user');
    } catch (err) {
      setDeleteError('Error al eliminar el contenido');
      console.error(err);
    }
  };

  if (!content) {
    return (
      <Box sx={{ maxWidth: 1400, margin: '0 auto', padding: 2, pt: 12 }}>
        {loadError ? (
          <Alert severity="error">{loadError}</Alert>
        ) : (
          <Typography>Cargando...</Typography>
        )}
      </Box>
    );
  }

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

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {submitError}
        </Alert>
      )}

      {deleteError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {deleteError}
        </Alert>
      )}

      <Grid container spacing={3}>
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

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Miniatura (thumbnail)
              </Typography>

              {thumbnailPreviewUrl ? (
                <Box
                  sx={{
                    width: '100%',
                    maxWidth: 320,
                    height: 160,
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'grey.50',
                    mb: 1,
                  }}
                >
                  <img
                    src={thumbnailPreviewUrl}
                    alt="Miniatura actual"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
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
                sx={{ textTransform: 'none' }}
              >
                Cambiar miniatura
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const maxBytes = 3 * 1024 * 1024;
                    if (file.size > maxBytes) {
                      setSubmitError('La miniatura no debe superar 3 MB.');
                      e.target.value = '';
                      return;
                    }

                    setSubmitError('');
                    setThumbnailFile(file);
                    if (
                      typeof thumbnailPreviewUrl === 'string' &&
                      thumbnailPreviewUrl.startsWith('blob:')
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
                    {hasAttachedFile ? 'Detalles del archivo:' : 'No hay archivo relacionado'}
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
                            `/content/${contentId}/library?context=library&id=${authState?.user?.id}`,
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
                        content.url ?? content.file_details?.url ?? content.file_details?.file,
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
                  URL del contenido
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ wordBreak: 'break-all', mb: 1 }}
                >
                  {content.url}
                </Typography>
                {hasAttachedFile ? (
                  <Button
                    variant="outlined"
                    size="small"
                    color="warning"
                    onClick={openClearUrlDialog}
                  >
                    Borrar URL
                  </Button>
                ) : (
                  <Button variant="outlined" size="small" onClick={openEditUrlDialog}>
                    Cambiar URL
                  </Button>
                )}
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <TextField
                fullWidth
                label="Título"
                margin="normal"
                error={!!errors.title}
                helperText={errors.title?.message}
                {...register('title')}
              />

              <TextField
                fullWidth
                label="Autor"
                margin="normal"
                error={!!errors.author}
                helperText={
                  errors.author?.message ||
                  (content.original_author && `Autor original: ${content.original_author}`)
                }
                {...register('author')}
              />

              <TextField
                fullWidth
                label="Nota personal"
                margin="normal"
                multiline
                rows={4}
                error={!!errors.personal_note}
                helperText={errors.personal_note?.message}
                {...register('personal_note')}
              />

              <Controller
                name="is_producer"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        name="is_producer"
                      />
                    }
                    label="He producido este contenido"
                    sx={{ mt: 2 }}
                  />
                )}
              />

              {isProducer && (
                <>
                  <Controller
                    name="is_visible"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            name="is_visible"
                          />
                        }
                        label="Visible en los resultados de búsqueda"
                        sx={{ mt: 1, ml: 4 }}
                      />
                    )}
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
                    onClick={() =>
                      navigate(`/content/${contentId}/library?context=library&id=${authState?.user?.id}`)
                    }
                    sx={{ mr: 1 }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        Guardando...
                      </>
                    ) : (
                      'Guardar cambios'
                    )}
                  </Button>
                </Box>
              </Box>
            </form>
          </Card>
        </Grid>

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

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
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
        open={clearUrlDialogOpen}
        onClose={() =>
          !urlDialogSaveLoading && !urlDialogCheckLoading && setClearUrlDialogOpen(false)
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Borrar URL del contenido</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Se quitará el enlace externo del registro compartido. El archivo adjunto
            seguirá disponible para descarga. Si otras personas usan este ítem, el
            cambio las afecta.
          </Typography>
          {urlDialogCheckLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={32} />
            </Box>
          )}
          {!urlDialogCheckLoading && urlDialogError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {urlDialogError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setClearUrlDialogOpen(false)}
            disabled={urlDialogSaveLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleClearContentUrl}
            disabled={
              urlDialogSaveLoading ||
              urlDialogCheckLoading ||
              urlSaveBlocked
            }
          >
            {urlDialogSaveLoading ? 'Eliminando…' : 'Borrar URL'}
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
