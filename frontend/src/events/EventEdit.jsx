import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchEventById, updateEvent, deleteEvent } from '../api/eventsApi';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EventDateTimeField from './EventDateTimeField';
import { formatDateTimeForInput } from '../utils/dateUtils';
import useAuthErrorHandler, { AUTH_ERROR_STRATEGY } from '../hooks/useAuthErrorHandler';

const PLATFORM_CHOICES = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'jitsi', label: 'Jitsi' },
  { value: 'microsoft_teams', label: 'Microsoft Teams' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'tox', label: 'Tox' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'other', label: 'Otra' },
];

const EVENT_TYPES = [
  { value: 'LIVE_COURSE', label: 'Curso en Vivo' },
  { value: 'LIVE_CERTIFICATION', label: 'Certificación en Vivo' },
  { value: 'LIVE_MASTER_CLASS', label: 'Clase Magistral en Vivo' },
];

const EventEdit = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { handleAuthError, getErrorMessage } = useAuthErrorHandler({
    strategy: AUTH_ERROR_STRATEGY.REDIRECT,
  });
  const [form, setForm] = useState({
    title: '',
    description: '',
    event_type: '',
    platform: '',
    other_platform: '',
    reference_price: '',
    date_start: '',
    date_end: '',
    schedule_description: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        setFetchLoading(true);
        const eventData = await fetchEventById(eventId);
        
        setForm({
          title: eventData.title || '',
          description: eventData.description || '',
          event_type: eventData.event_type || '',
          platform: eventData.platform || '',
          other_platform: eventData.other_platform || '',
          reference_price: eventData.reference_price ? eventData.reference_price.toString() : '',
          date_start: formatDateTimeForInput(eventData.date_start),
          date_end: formatDateTimeForInput(eventData.date_end),
          schedule_description: eventData.schedule_description || '',
        });
        setIsVisible(Boolean(eventData.is_visible));

        if (eventData.image) {
          setImagePreview(eventData.image);
        }
      } catch (err) {
        if (handleAuthError(err).handled) {
          return;
        }
        console.error('Error loading event:', err);
        setError(getErrorMessage(err, 'Error al cargar el evento. Por favor, inténtelo de nuevo.'));
      } finally {
        setFetchLoading(false);
      }
    };

    loadEvent();
  }, [eventId, getErrorMessage, handleAuthError]);

  const validateForm = () => {
    const newErrors = {};

    if (!form.title.trim()) {
      newErrors.title = 'El título es obligatorio';
    }

    if (!form.description.trim()) {
      newErrors.description = 'La descripción es obligatoria';
    }

    if (!form.event_type) {
      newErrors.event_type = 'El tipo de evento es obligatorio';
    }

    if (form.platform === 'other' && !form.other_platform.trim()) {
      newErrors.other_platform = 'El nombre de la otra plataforma es obligatorio';
    }

    if (form.date_start && form.date_end) {
      const startDate = new Date(form.date_start);
      const endDate = new Date(form.date_end);
      if (endDate <= startDate) {
        newErrors.date_end = 'La fecha de fin debe ser posterior a la fecha de inicio';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDateTimeChange = (name) => (value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, image: 'Por favor, seleccione un archivo de imagen válido' }));
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, image: 'El tamaño de la imagen debe ser menor a 5MB' }));
        return;
      }

      setImageFile(file);
      setErrors(prev => ({ ...prev, image: '' }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setErrors(prev => ({ ...prev, image: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      
      // Add form fields
      Object.keys(form).forEach(key => {
        if (key === 'reference_price') {
          formData.append(key, form[key] ? parseFloat(form[key]) : 0);
        } else {
          formData.append(key, form[key]);
        }
      });
      formData.append('is_visible', String(isVisible));
      
      // Add image if a new one was selected
      if (imageFile) {
        formData.append('image', imageFile);
      }
      
      const updatedEvent = await updateEvent(eventId, formData);
      setSuccess('¡Evento actualizado exitosamente!');
      
      // Navigate to the updated event after a short delay
      setTimeout(() => {
        navigate(`/events/${updatedEvent.id}`);
      }, 1500);
      
    } catch (err) {
      console.error('Error updating event:', err);
      
      if (err.other_platform) {
        setErrors({ other_platform: err.other_platform });
      } else if (err.date_end) {
        setErrors({ date_end: err.date_end });
      } else if (err.detail) {
        setError(err.detail);
      } else if (typeof err === 'string') {
        setError(err);
      } else {
        setError('Error al actualizar el evento. Por favor, inténtelo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    setIsDeletingEvent(true);
    setError(null);
    try {
      await deleteEvent(eventId);
      setDeleteDialogOpen(false);
      navigate('/events', { replace: true });
    } catch (err) {
      setError(err?.detail || err?.error || 'Error al eliminar el evento. Por favor, inténtelo de nuevo.');
    } finally {
      setIsDeletingEvent(false);
    }
  };

  if (fetchLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={1.5} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>Editar Evento</Typography>
          <Typography color="text.secondary">Cargando evento...</Typography>
        </Stack>
      </Container>
    );
  }

  if (error && !form.title) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>Editar Evento</Typography>
          <Alert severity="error">{error}</Alert>
          <Button onClick={() => navigate('/events')} variant="contained">
            Volver a Eventos
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 2.5 }}>
        Editar Evento
      </Typography>

      <Card variant="outlined">
        <CardContent>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField
                name="title"
                label="Título *"
                value={form.title}
                onChange={handleChange}
                error={Boolean(errors.title)}
                helperText={errors.title || ''}
                placeholder="Ingrese el título del evento"
                fullWidth
              />

              <TextField
                name="description"
                label="Descripción *"
                value={form.description}
                onChange={handleChange}
                error={Boolean(errors.description)}
                helperText={errors.description || ''}
                placeholder="Describa su evento..."
                multiline
                minRows={3}
                fullWidth
              />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Imagen del Evento
                </Typography>
                <Button component="label" variant="outlined">
                  {imagePreview ? 'Cambiar Imagen' : 'Elegir Imagen'}
                  <input type="file" accept="image/*" hidden onChange={handleImageChange} />
                </Button>
                {imagePreview && (
                  <Box sx={{ mt: 1.5 }}>
                    <Box
                      component="img"
                      src={imagePreview}
                      alt="Preview"
                      sx={{ maxWidth: '100%', width: 280, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                    />
                    <Box sx={{ mt: 1 }}>
                      <Button type="button" onClick={removeImage} color="error" size="small">
                        Eliminar
                      </Button>
                    </Box>
                  </Box>
                )}
                {errors.image && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                    {errors.image}
                  </Typography>
                )}
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth error={Boolean(errors.event_type)}>
                    <InputLabel>Tipo de Evento *</InputLabel>
                    <Select
                      name="event_type"
                      value={form.event_type}
                      label="Tipo de Evento *"
                      onChange={handleChange}
                    >
                      <MenuItem value="">Seleccionar tipo</MenuItem>
                      {EVENT_TYPES.map((et) => (
                        <MenuItem key={et.value} value={et.value}>{et.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {errors.event_type && (
                    <Typography variant="caption" color="error">{errors.event_type}</Typography>
                  )}
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth error={Boolean(errors.platform)}>
                    <InputLabel>Plataforma</InputLabel>
                    <Select
                      name="platform"
                      value={form.platform}
                      label="Plataforma"
                      onChange={handleChange}
                    >
                      <MenuItem value="">Ninguna</MenuItem>
                      {PLATFORM_CHOICES.map((p) => (
                        <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {errors.platform && (
                    <Typography variant="caption" color="error">{errors.platform}</Typography>
                  )}
                </Grid>
              </Grid>

              {form.platform === 'other' && (
                <TextField
                  name="other_platform"
                  label="Otra Plataforma *"
                  value={form.other_platform}
                  onChange={handleChange}
                  error={Boolean(errors.other_platform)}
                  helperText={errors.other_platform || ''}
                  placeholder="Ingrese el nombre de la plataforma"
                  fullWidth
                />
              )}

              <TextField
                name="reference_price"
                label="Precio de Referencia en USD"
                type="number"
                value={form.reference_price}
                onChange={handleChange}
                placeholder="0.00"
                fullWidth
              />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <EventDateTimeField
                    label="Fecha/Hora de Inicio"
                    value={form.date_start}
                    onChange={handleDateTimeChange('date_start')}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EventDateTimeField
                    label="Fecha/Hora de Fin"
                    value={form.date_end}
                    onChange={handleDateTimeChange('date_end')}
                    error={errors.date_end}
                  />
                </Grid>
              </Grid>

              <TextField
                name="schedule_description"
                label="Descripción del Horario"
                value={form.schedule_description}
                onChange={handleChange}
                placeholder="ej., Todos los martes durante 5 semanas"
                multiline
                minRows={3}
                fullWidth
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={isVisible}
                    onChange={(e) => setIsVisible(e.target.checked)}
                  />
                }
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    {isVisible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Público
                    </Typography>
                  </Stack>
                }
              />
              <Typography variant="caption" color="text.secondary">
                Los eventos privados no aparecen en el listado público ni en tu perfil para otros usuarios.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button type="button" onClick={() => navigate(`/events/${eventId}`)} variant="outlined" color="inherit">
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} variant="contained">
                  {loading ? 'Actualizando...' : 'Actualizar Evento'}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Paper variant="outlined" sx={{ mt: 2.5, p: 2.5, borderColor: 'error.light' }}>
        <Typography variant="h6" color="error" sx={{ mb: 1 }}>
          Zona de peligro
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Si eliminas este evento se borrarán también todas las inscripciones y no podrás recuperarlos.
        </Typography>
        <Button type="button" color="error" variant="outlined" onClick={() => setDeleteDialogOpen(true)}>
          Eliminar evento
        </Button>
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={() => !isDeletingEvent && setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar evento</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Seguro que deseas eliminar <strong>{form.title || 'este evento'}</strong>? Se eliminarán todas las inscripciones y esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeletingEvent}>
            Cancelar
          </Button>
          <Button onClick={handleDeleteEvent} disabled={isDeletingEvent} color="error" variant="contained">
            {isDeletingEvent ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </Container>
  );
};

export default EventEdit; 