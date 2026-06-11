import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEvent } from '../api/eventsApi';
import { parse, isValid } from 'date-fns';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import EventDateTimeField from './EventDateTimeField';

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

const EventCreate = () => {
  const navigate = useNavigate();
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
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const startMinDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);

  const endMinDate = useMemo(() => {
    if (!form.date_start) return undefined;
    const [datePart] = form.date_start.split('T');
    const parsed = parse(datePart, 'yyyy-MM-dd', new Date());
    return isValid(parsed) ? parsed : undefined;
  }, [form.date_start]);

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

    // Validate datetime fields
    if (form.date_start && form.date_end) {
      const startDate = new Date(form.date_start);
      const endDate = new Date(form.date_end);
      if (endDate <= startDate) {
        newErrors.date_end = 'La fecha de fin debe ser posterior a la fecha de inicio';
      }
    }

    // Only validate start date if it's provided
    if (form.date_start) {
      const startDate = new Date(form.date_start);
      const now = new Date();
      // Allow events to start within the next hour (for immediate events)
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      if (startDate < oneHourFromNow) {
        newErrors.date_start = 'La fecha de inicio debe ser al menos 1 hora a partir de ahora';
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
      
      // Add image if selected
      if (imageFile) {
        formData.append('image', imageFile);
      }
      
      const createdEvent = await createEvent(formData);
      setSuccess('¡Evento creado exitosamente!');
      
      // Navigate to the created event after a short delay
      setTimeout(() => {
        navigate(`/events/${createdEvent.id}`);
      }, 1500);
      
    } catch (err) {
      console.error('Error creating event:', err);
      
      if (err.other_platform) {
        setErrors({ other_platform: err.other_platform });
      } else if (err.date_end) {
        setErrors({ date_end: err.date_end });
      } else if (err.detail) {
        setError(err.detail);
      } else if (typeof err === 'string') {
        setError(err);
      } else {
        setError('Error al crear el evento. Por favor, inténtelo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 2.5 }}>
        Crear Nuevo Evento
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
                    error={errors.date_start}
                    dateHelperText="Seleccione la fecha de inicio"
                    minDate={startMinDate}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <EventDateTimeField
                    label="Fecha/Hora de Fin"
                    value={form.date_end}
                    onChange={handleDateTimeChange('date_end')}
                    error={errors.date_end}
                    dateHelperText="Seleccione la fecha de fin"
                    minDate={endMinDate}
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

              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? 'Creando...' : 'Crear Evento'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </Container>
  );
};

export default EventCreate; 