import React, { useState, useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import i18n from '../i18n';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
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
  FormHelperText,
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
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
import useAuthErrorHandler, { AUTH_ERROR_STRATEGY } from '../hooks/useAuthErrorHandler';

const PLATFORM_CHOICES = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'jitsi', label: 'Jitsi' },
  { value: 'microsoft_teams', label: 'Microsoft Teams' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'tox', label: 'Tox' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'other' },
];

const EVENT_TYPES = [
  { value: 'LIVE_COURSE' },
  { value: 'LIVE_CERTIFICATION' },
  { value: 'LIVE_MASTER_CLASS' },
];

const schema = yup.object({
  title: yup
    .string()
    .trim()
    .required(() => i18n.t('events:validation.titleRequired')),
  description: yup
    .string()
    .trim()
    .required(() => i18n.t('events:validation.descriptionRequired')),
  event_type: yup
    .string()
    .required(() => i18n.t('events:validation.typeRequired')),
  platform: yup.string().default(''),
  other_platform: yup
    .string()
    .default('')
    .when('platform', {
      is: 'other',
      then: (field) => field.trim().required(() => i18n.t('events:validation.otherPlatformRequired')),
      otherwise: (field) => field,
    }),
  reference_price: yup.string().default(''),
  date_start: yup.string().default(''),
  date_end: yup
    .string()
    .default('')
    .test(
      'after-start',
      () => i18n.t('events:validation.endAfterStart'),
      function afterStart(value) {
        const { date_start: dateStart } = this.parent;
        if (!value || !dateStart) return true;
        return new Date(value) > new Date(dateStart);
      },
    ),
  schedule_description: yup.string().default(''),
});

const EventEdit = () => {
  const { t } = useTranslation('events');
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { handleAuthError, getErrorMessage } = useAuthErrorHandler({
    strategy: AUTH_ERROR_STRATEGY.REDIRECT,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageError, setImageError] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      event_type: '',
      platform: '',
      other_platform: '',
      reference_price: '',
      date_start: '',
      date_end: '',
      schedule_description: '',
    },
  });

  const platform = watch('platform');
  const title = watch('title');

  useEffect(() => {
    const loadEvent = async () => {
      try {
        setFetchLoading(true);
        setLoadError(null);
        const eventData = await fetchEventById(eventId, { bypassCache: true });

        reset({
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
        setLoadError(getErrorMessage(err, t('errors.loadEvent')));
      } finally {
        setFetchLoading(false);
      }
    };

    loadEvent();
  }, [eventId, reset, handleAuthError, getErrorMessage]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError(t('image.invalid'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError(t('image.tooLarge'));
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
    setSubmitError(null);
    setSuccess(null);
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

      const updatedEvent = await updateEvent(eventId, formData);
      setSuccess(t('success.updated'));

      setTimeout(() => {
        navigate(`/events/${updatedEvent.id}`);
      }, 1500);
    } catch (err) {
      console.error('Error updating event:', err);

      const imageErrors = err?.response?.data?.image;
      if (imageErrors) {
        const imageMsg = Array.isArray(imageErrors) ? imageErrors.join(' ') : String(imageErrors);
        setImageError(imageMsg);
      }

      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setError,
        t('errors.update'),
      );

      if (!imageErrors && parsed) {
        setSubmitError(parsed);
      }
    }
  };

  const handleDeleteEvent = async () => {
    setIsDeletingEvent(true);
    setSubmitError(null);
    try {
      await deleteEvent(eventId);
      setDeleteDialogOpen(false);
      navigate('/events', { replace: true });
    } catch (err) {
      setSubmitError(err?.detail || err?.error || t('errors.delete'));
    } finally {
      setIsDeletingEvent(false);
    }
  };

  if (fetchLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={1.5} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>{t('editEvent')}</Typography>
          <Typography color="text.secondary">{t('loadingEvent')}</Typography>
        </Stack>
      </Container>
    );
  }

  if (loadError && !title) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>{t('editEvent')}</Typography>
          <Alert severity="error">{loadError}</Alert>
          <Button onClick={() => navigate('/events')} variant="contained">
            {t('backToEvents')}
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 2.5 }}>
        {t('editEvent')}
      </Typography>

      <Card variant="outlined">
        <CardContent>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              <TextField
                label={t('fields.title')}
                {...register('title')}
                error={Boolean(errors.title)}
                helperText={errors.title?.message || ''}
                placeholder={t('fields.titlePlaceholder')}
                fullWidth
              />

              <TextField
                label={t('fields.description')}
                {...register('description')}
                error={Boolean(errors.description)}
                helperText={errors.description?.message || ''}
                placeholder={t('fields.descriptionPlaceholder')}
                multiline
                minRows={3}
                fullWidth
              />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('fields.image')}
                </Typography>
                <Button component="label" variant="outlined" disabled={isSubmitting}>
                  {imagePreview ? t('fields.changeImage') : t('fields.chooseImage')}
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
                        {t('delete')}
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
                        <InputLabel>{t('fields.eventType')}</InputLabel>
                        <Select {...field} label={t('fields.eventType')}>
                          <MenuItem value="">{t('platforms.selectType')}</MenuItem>
                          {EVENT_TYPES.map((et) => (
                            <MenuItem key={et.value} value={et.value}>{t(`eventTypes.${et.value}`)}</MenuItem>
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
                        <InputLabel>{t('fields.platform')}</InputLabel>
                        <Select {...field} label={t('fields.platform')}>
                          <MenuItem value="">{t('platforms.none')}</MenuItem>
                          {PLATFORM_CHOICES.map((p) => (
                            <MenuItem key={p.value} value={p.value}>
                              {p.value === 'other' ? t('platforms.other') : p.label}
                            </MenuItem>
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
                  label={t('fields.otherPlatform')}
                  {...register('other_platform')}
                  error={Boolean(errors.other_platform)}
                  helperText={errors.other_platform?.message || ''}
                  placeholder={t('fields.otherPlatformPlaceholder')}
                  fullWidth
                />
              )}

              <TextField
                label={t('fields.referencePrice')}
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
                        label={t('fields.start')}
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.date_start?.message}
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
                        label={t('fields.end')}
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.date_end?.message}
                      />
                    )}
                  />
                </Grid>
              </Grid>

              <TextField
                label={t('fields.schedule')}
                {...register('schedule_description')}
                error={Boolean(errors.schedule_description)}
                helperText={errors.schedule_description?.message || ''}
                placeholder={t('fields.schedulePlaceholder')}
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
                      {t('public')}
                    </Typography>
                  </Stack>
                }
              />
              <Typography variant="caption" color="text.secondary">
                {t('visibilityHint')}
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button type="button" onClick={() => navigate(`/events/${eventId}`)} variant="outlined" color="inherit">
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting} variant="contained">
                  {isSubmitting ? t('updating') : t('updateEvent')}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Paper variant="outlined" sx={{ mt: 2.5, p: 2.5, borderColor: 'error.light' }}>
        <Typography variant="h6" color="error" sx={{ mb: 1 }}>
          {t('danger.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('danger.body')}
        </Typography>
        <Button type="button" color="error" variant="outlined" onClick={() => setDeleteDialogOpen(true)}>
          {t('danger.deleteEvent')}
        </Button>
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={() => !isDeletingEvent && setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('danger.dialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            <Trans
              t={t}
              i18nKey="danger.confirm"
              values={{ title: title || t('danger.thisEvent') }}
              components={{ strong: <strong /> }}
            />
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeletingEvent}>
            {t('cancel')}
          </Button>
          <Button onClick={handleDeleteEvent} disabled={isDeletingEvent} color="error" variant="contained">
            {isDeletingEvent ? t('deleting') : t('delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
      {submitError && <Alert severity="error" sx={{ mt: 2 }}>{submitError}</Alert>}
    </Container>
  );
};

export default EventEdit;
