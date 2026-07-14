import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
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
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EventDateTimeField from './EventDateTimeField';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';

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

const schema = yup.object({
  title: yup
    .string()
    .trim()
    .required('El título es obligatorio'),
  description: yup
    .string()
    .trim()
    .required('La descripción es obligatoria'),
  event_type: yup
    .string()
    .required('El tipo de evento es obligatorio'),
  platform: yup.string().default(''),
  other_platform: yup
    .string()
    .default('')
    .when('platform', {
      is: 'other',
      then: (field) => field.trim().required('El nombre de la otra plataforma es obligatorio'),
      otherwise: (field) => field,
    }),
  reference_price: yup.string().default(''),
  date_start: yup
    .string()
    .default('')
    .test(
      'min-hour',
      'La fecha de inicio debe ser al menos 1 hora a partir de ahora',
      (value) => {
        if (!value) return true;
        const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
        return new Date(value) >= oneHourFromNow;
      },
    ),
  date_end: yup
    .string()
    .default('')
    .test(
      'after-start',
      'La fecha de fin debe ser posterior a la fecha de inicio',
      function afterStart(value) {
        const { date_start: dateStart } = this.parent;
        if (!value || !dateStart) return true;
        return new Date(value) > new Date(dateStart);
      },
    ),
  schedule_description: yup.string().default(''),
});

const defaultValues = {
  title: '',
  description: '',
  event_type: '',
  platform: '',
  other_platform: '',
  reference_price: '',
  date_start: '',
  date_end: '',
  schedule_description: '',
};

const EventCreate = () => {
  const navigate = useNavigate();
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageError, setImageError] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [success, setSuccess] = useState(null);
  const [generalError, setGeneralError] = useState(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues,
  });

  const platform = watch('platform');
  const dateStart = watch('date_start');

  const startMinDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);

  const endMinDate = useMemo(() => {
    if (!dateStart) return undefined;
    const [datePart] = dateStart.split('T');
    const parsed = parse(datePart, 'yyyy-MM-dd', new Date());
    return isValid(parsed) ? parsed : undefined;
  }, [dateStart]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Por favor, seleccione un archivo de imagen válido');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError('El tamaño de la imagen debe ser menor a 5MB');
      return;
    }

    setImageFile(file);
    setImageError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageError('');
  };

  const onSubmit = async (form) => {
    setSuccess(null);
    setGeneralError(null);
    setImageError('');

    try {
      const formData = new FormData();

      Object.keys(form).forEach((key) => {
        if (key === 'reference_price') {
          formData.append(key, form[key] ? parseFloat(form[key]) : 0);
        } else {
          formData.append(key, form[key]);
        }
      });
      formData.append('is_visible', String(isVisible));

      if (imageFile) {
        formData.append('image', imageFile);
      }

      const createdEvent = await createEvent(formData);
      setSuccess('¡Evento creado exitosamente!');

      setTimeout(() => {
        navigate(`/events/${createdEvent.id}`);
      }, 1500);
    } catch (err) {
      console.error('Error creating event:', err);

      const imageErrors = err?.response?.data?.image;
      if (imageErrors) {
        const imageMsg = Array.isArray(imageErrors) ? imageErrors.join(' ') : String(imageErrors);
        setImageError(imageMsg);
      }

      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setError,
        'Error al crear el evento. Por favor, inténtelo de nuevo.',
      );

      if (!imageErrors && parsed) {
        setGeneralError(parsed);
      }
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 2.5 }}>
        Crear Nuevo Evento
      </Typography>

      <Card variant="outlined">
        <CardContent>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              <TextField
                label="Título *"
                {...register('title')}
                error={Boolean(errors.title)}
                helperText={errors.title?.message || ''}
                placeholder="Ingrese el título del evento"
                fullWidth
              />

              <TextField
                label="Descripción *"
                {...register('description')}
                error={Boolean(errors.description)}
                helperText={errors.description?.message || ''}
                placeholder="Describa su evento..."
                multiline
                minRows={3}
                fullWidth
              />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Imagen del Evento
                </Typography>
                <Button component="label" variant="outlined" disabled={isSubmitting}>
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
                {imageError && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                    {imageError}
                  </Typography>
                )}
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="event_type"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth error={Boolean(errors.event_type)}>
                        <InputLabel>Tipo de Evento *</InputLabel>
                        <Select {...field} label="Tipo de Evento *">
                          <MenuItem value="">Seleccionar tipo</MenuItem>
                          {EVENT_TYPES.map((et) => (
                            <MenuItem key={et.value} value={et.value}>{et.label}</MenuItem>
                          ))}
                        </Select>
                        {errors.event_type && (
                          <FormHelperText>{errors.event_type.message}</FormHelperText>
                        )}
                      </FormControl>
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="platform"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth error={Boolean(errors.platform)}>
                        <InputLabel>Plataforma</InputLabel>
                        <Select {...field} label="Plataforma">
                          <MenuItem value="">Ninguna</MenuItem>
                          {PLATFORM_CHOICES.map((p) => (
                            <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                          ))}
                        </Select>
                        {errors.platform && (
                          <FormHelperText>{errors.platform.message}</FormHelperText>
                        )}
                      </FormControl>
                    )}
                  />
                </Grid>
              </Grid>

              {platform === 'other' && (
                <TextField
                  label="Otra Plataforma *"
                  {...register('other_platform')}
                  error={Boolean(errors.other_platform)}
                  helperText={errors.other_platform?.message || ''}
                  placeholder="Ingrese el nombre de la plataforma"
                  fullWidth
                />
              )}

              <TextField
                label="Precio de Referencia en USD"
                type="number"
                {...register('reference_price')}
                error={Boolean(errors.reference_price)}
                helperText={errors.reference_price?.message || ''}
                placeholder="0.00"
                fullWidth
              />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="date_start"
                    control={control}
                    render={({ field }) => (
                      <EventDateTimeField
                        label="Fecha/Hora de Inicio"
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.date_start?.message}
                        dateHelperText="Seleccione la fecha de inicio"
                        minDate={startMinDate}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="date_end"
                    control={control}
                    render={({ field }) => (
                      <EventDateTimeField
                        label="Fecha/Hora de Fin"
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.date_end?.message}
                        dateHelperText="Seleccione la fecha de fin"
                        minDate={endMinDate}
                      />
                    )}
                  />
                </Grid>
              </Grid>

              <TextField
                label="Descripción del Horario"
                {...register('schedule_description')}
                error={Boolean(errors.schedule_description)}
                helperText={errors.schedule_description?.message || ''}
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
                    disabled={isSubmitting}
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
                Los eventos privados no aparecen en el listado público ni en búsquedas, pero pueden compartirse con un enlace directo.
              </Typography>

              <Button type="submit" variant="contained" disabled={isSubmitting}>
                {isSubmitting ? 'Creando...' : 'Crear Evento'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
      {generalError && <Alert severity="error" sx={{ mt: 2 }}>{generalError}</Alert>}
    </Container>
  );
};

export default EventCreate;
