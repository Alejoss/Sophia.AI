import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { fetchEventFeature, saveEventFeature } from '../api/eventsApi';

const messageFrom = (error, fallback) => {
  const data = error?.data ?? error?.response?.data;
  const imageError = data?.image;
  if (Array.isArray(imageError)) return imageError[0];
  if (typeof imageError === 'string') return imageError;
  if (typeof data?.detail === 'string') return data.detail;
  return fallback;
};

const FeaturedEventEditor = ({ eventId }) => {
  const { t } = useTranslation('events');
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [savedImage, setSavedImage] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchEventFeature(eventId)
      .then((data) => {
        if (cancelled || !data) return;
        setIsActive(Boolean(data.is_active));
        setSavedImage(data.image || '');
        setPreview(data.image || '');
      })
      .catch((err) => {
        const status = err?.status ?? err?.response?.status;
        if (!cancelled && status === 403) setHidden(true);
        else if (!cancelled) setError(messageFrom(err, t('feature.loadError')));
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, t]);

  if (hidden || !ready) return null;

  const onFile = (event) => {
    const next = event.target.files?.[0];
    if (!next) return;
    if (!next.type.startsWith('image/')) {
      setError(t('image.invalid'));
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      setError(t('image.tooLarge'));
      return;
    }
    setFile(next);
    setError('');
    setSuccess('');
    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(next);
  };

  const onSave = async () => {
    if (isActive && !file && !savedImage) {
      setError(t('feature.needImage'));
      setSuccess('');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const saved = await saveEventFeature(eventId, { imageFile: file, isActive });
      setSavedImage(saved?.image || '');
      setPreview(saved?.image || '');
      setFile(null);
      setIsActive(Boolean(saved?.is_active));
      setSuccess(t('feature.saved'));
    } catch (err) {
      setError(messageFrom(err, t('feature.saveError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ mt: 2.5, p: 2.5 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        {t('feature.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t('feature.helper')}
      </Typography>
      <FormControlLabel
        control={(
          <Switch
            checked={isActive}
            onChange={(event) => {
              setIsActive(event.target.checked);
              setSuccess('');
            }}
          />
        )}
        label={t('feature.active')}
      />
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
        {t('feature.visibilityNote')}
      </Typography>
      {preview && (
        <Box
          component="img"
          src={preview}
          alt=""
          sx={{
            width: '100%',
            aspectRatio: '1600 / 280',
            objectFit: 'cover',
            borderRadius: 1,
            display: 'block',
            mb: 1.5,
            backgroundColor: '#12141c',
          }}
        />
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Button component="label" variant="outlined">
          {preview ? t('feature.changeImage') : t('feature.chooseImage')}
          <input hidden type="file" accept="image/*" onChange={onFile} />
        </Button>
        <Button type="button" variant="contained" onClick={onSave} disabled={saving}>
          {saving ? t('feature.saving') : t('feature.save')}
        </Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mt: 1.5 }}>{success}</Alert>}
    </Paper>
  );
};

export default FeaturedEventEditor;
