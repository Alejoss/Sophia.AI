import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  deleteFeaturedEvent,
  fetchAdminFeaturedEvents,
  fetchFeaturedEventChoices,
  saveFeaturedEvent,
} from '../api/eventsApi';
import { formatEventWhen } from '../utils/dateUtils';
import { useDateLocales } from '../hooks/useDateLocales';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DESKTOP_RATIO = '1600 / 280';
const MOBILE_RATIO = '12 / 5';

const responseData = (error) => error?.data ?? error?.response?.data;

const firstMessage = (value) => (Array.isArray(value) ? value[0] : value);

const messageFrom = (error, fallback) => {
  const data = responseData(error);
  const detail = firstMessage(data?.detail);
  return typeof detail === 'string' ? detail : fallback;
};

const fieldErrorsFrom = (error) => {
  const data = responseData(error) || {};
  return {
    desktop: firstMessage(data.desktop_image) || '',
    mobile: firstMessage(data.mobile_image) || '',
  };
};

const useEventWhen = () => {
  const { t } = useTranslation('events');
  const { intl } = useDateLocales();
  return (item) => {
    const start = item.date_start
      ? formatEventWhen(item.date_start, item.date_start_has_time !== false, intl)
      : '';
    const end = item.date_end
      ? formatEventWhen(item.date_end, item.date_end_has_time !== false, intl)
      : '';
    return [start, end].filter(Boolean).join(' – ') || t('featuredAdmin.noDate');
  };
};

const BannerPreview = ({ src, ratio, emptyLabel, maxWidth }) => (
  <Box
    sx={{
      width: '100%',
      maxWidth,
      aspectRatio: ratio,
      borderRadius: 1,
      overflow: 'hidden',
      backgroundColor: '#12141c',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {src ? (
      <Box
        component="img"
        src={src}
        alt=""
        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    ) : (
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
        {emptyLabel}
      </Typography>
    )}
  </Box>
);

const ImageSlot = ({ label, hint, ratio, maxWidth, preview, error, onFile }) => {
  const { t } = useTranslation('events');
  return (
    <Box>
      <Typography variant="subtitle2">{label}</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        {hint}
      </Typography>
      <BannerPreview src={preview} ratio={ratio} maxWidth={maxWidth} emptyLabel={t('featuredAdmin.noImage')} />
      <Button component="label" variant="outlined" size="small" sx={{ mt: 1 }}>
        {preview ? t('featuredAdmin.changeImage') : t('featuredAdmin.chooseImage')}
        <input
          hidden
          type="file"
          accept="image/*"
          aria-label={label}
          onChange={(event) => {
            onFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </Button>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Box>
  );
};

const eventTags = (event, t) => [
  !event.is_visible && t('featuredAdmin.tagPrivate'),
  event.has_ended && t('featuredAdmin.tagEnded'),
  event.has_banner && t('featuredAdmin.tagHasBanner'),
].filter(Boolean);

const emptyImageState = { file: null, preview: '', error: '' };

/** One form for new and existing banners: two images, the event, and the on/off switch. */
const BannerForm = ({ events, placements, initialEventId, scrollOnMount, onSaved, onCancel }) => {
  const { t } = useTranslation('events');
  const when = useEventWhen();
  const [eventId, setEventId] = useState(initialEventId ?? null);
  const initialPlacement = placements.find((p) => p.event_id === initialEventId);
  const [isActive, setIsActive] = useState(initialPlacement ? initialPlacement.is_active : true);
  const [desktop, setDesktop] = useState(emptyImageState);
  const [mobile, setMobile] = useState(emptyImageState);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef(null);

  const selectedEvent = events.find((event) => event.id === eventId) || null;
  const existing = placements.find((p) => p.event_id === eventId) || null;
  const desktopPreview = desktop.preview || existing?.desktop_image || '';
  const mobilePreview = mobile.preview || existing?.mobile_image || '';

  useEffect(() => {
    if (scrollOnMount) {
      panelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  }, [scrollOnMount]);

  const pick = (setSlot) => (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSlot((slot) => ({ ...slot, error: t('image.invalid') }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setSlot((slot) => ({ ...slot, error: t('image.tooLarge') }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const preview = typeof reader.result === 'string' ? reader.result : '';
      setSlot({ file, preview, error: '' });
    };
    reader.readAsDataURL(file);
  };

  const chooseEvent = (_, option) => {
    setEventId(option?.id ?? null);
    const placement = option ? placements.find((p) => p.event_id === option.id) : null;
    setIsActive(placement ? placement.is_active : true);
    setError('');
  };

  const onSave = async () => {
    if ((isActive || !existing) && (!desktopPreview || !mobilePreview)) {
      setError(t('featuredAdmin.needBoth'));
      return;
    }
    if (!eventId) {
      setError(t('featuredAdmin.eventRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveFeaturedEvent(eventId, {
        desktopFile: desktop.file,
        mobileFile: mobile.file,
        isActive,
      });
      onSaved();
    } catch (err) {
      const fields = fieldErrorsFrom(err);
      setDesktop((slot) => ({ ...slot, error: fields.desktop }));
      setMobile((slot) => ({ ...slot, error: fields.mobile }));
      if (!fields.desktop && !fields.mobile) {
        setError(messageFrom(err, t('featuredAdmin.saveError')));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper ref={panelRef} variant="outlined" sx={{ p: 2.5, mb: 4, scrollMarginTop: 80 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {existing
          ? t('featuredAdmin.editorTitle', { title: existing.title })
          : t('featuredAdmin.newTitle')}
      </Typography>
      <Stack spacing={3}>
        <ImageSlot
          label={t('featuredAdmin.desktopLabel')}
          hint={t('featuredAdmin.desktopHint')}
          ratio={DESKTOP_RATIO}
          preview={desktopPreview}
          error={desktop.error}
          onFile={pick(setDesktop)}
        />
        <ImageSlot
          label={t('featuredAdmin.mobileLabel')}
          hint={t('featuredAdmin.mobileHint')}
          ratio={MOBILE_RATIO}
          maxWidth={420}
          preview={mobilePreview}
          error={mobile.error}
          onFile={pick(setMobile)}
        />
        <Box>
          {events.length === 0 ? (
            <Alert severity="info">{t('featuredAdmin.noEvents')}</Alert>
          ) : (
            <Autocomplete
              options={events}
              value={selectedEvent}
              onChange={chooseEvent}
              getOptionLabel={(option) => option.title || ''}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderOption={({ key, ...props }, option) => {
                const tags = eventTags(option, t);
                return (
                  <Box component="li" key={key} {...props}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{option.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[when(option), ...tags].join(' · ')}
                      </Typography>
                    </Box>
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('featuredAdmin.eventLabel')}
                  helperText={t('featuredAdmin.eventHelper')}
                />
              )}
            />
          )}
          {selectedEvent && !selectedEvent.is_visible && (
            <Alert severity="warning" sx={{ mt: 1 }}>{t('featuredAdmin.warnPrivate')}</Alert>
          )}
          {selectedEvent && selectedEvent.has_ended && (
            <Alert severity="warning" sx={{ mt: 1 }}>{t('featuredAdmin.warnEnded')}</Alert>
          )}
        </Box>
        <Box>
          <FormControlLabel
            control={<Switch checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />}
            label={t('featuredAdmin.active')}
          />
          <Typography variant="caption" color="text.secondary" display="block">
            {t('featuredAdmin.activeNote')}
          </Typography>
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction="row" spacing={1.5}>
          <Button type="button" variant="contained" onClick={onSave} disabled={saving}>
            {saving ? t('featuredAdmin.saving') : t('featuredAdmin.save')}
          </Button>
          {(eventId || desktop.file || mobile.file) && (
            <Button type="button" variant="outlined" color="inherit" onClick={onCancel} disabled={saving}>
              {t('featuredAdmin.cancel')}
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
};

const statusChips = (placement, t) => {
  const chips = [];
  if (placement.is_live) {
    chips.push({ key: 'live', label: t('featuredAdmin.status.live'), color: 'success' });
  } else if (!placement.is_active) {
    chips.push({ key: 'off', label: t('featuredAdmin.status.off') });
  }
  if (!placement.event_is_visible) {
    chips.push({ key: 'private', label: t('featuredAdmin.status.eventPrivate'), color: 'warning' });
  }
  if (placement.event_has_ended) {
    chips.push({ key: 'ended', label: t('featuredAdmin.status.eventEnded'), color: 'warning' });
  }
  if (!placement.mobile_image) {
    chips.push({ key: 'mobile', label: t('featuredAdmin.status.missingMobile'), color: 'error' });
  }
  return chips;
};

const FeaturedEventsDashboard = () => {
  const { t } = useTranslation('events');
  const when = useEventWhen();
  const [placements, setPlacements] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingEventId, setEditingEventId] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadPlacements = useCallback(async () => {
    try {
      setPlacements(await fetchAdminFeaturedEvents());
    } catch (err) {
      setError(messageFrom(err, t('featuredAdmin.loadError')));
    }
  }, [t]);

  const loadEvents = useCallback(async () => {
    try {
      setEvents(await fetchFeaturedEventChoices());
    } catch (err) {
      setError(messageFrom(err, t('featuredAdmin.eventsError')));
    }
  }, [t]);

  const reload = useCallback(
    () => Promise.all([loadPlacements(), loadEvents()]),
    [loadPlacements, loadEvents],
  );

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const resetForm = () => {
    setEditingEventId(null);
    setFormKey((key) => key + 1);
  };

  const editPlacement = (placement) => {
    setError('');
    setSuccess('');
    setEditingEventId(placement.event_id);
    setFormKey((key) => key + 1);
  };

  const onSaved = async () => {
    setSuccess(t('featuredAdmin.saved'));
    setError('');
    await reload();
    resetForm();
  };

  const toggle = async (placement) => {
    setBusyId(placement.event_id);
    setError('');
    setSuccess('');
    try {
      await saveFeaturedEvent(placement.event_id, { isActive: !placement.is_active });
      await loadPlacements();
    } catch (err) {
      const fields = fieldErrorsFrom(err);
      setError(fields.mobile || fields.desktop || messageFrom(err, t('featuredAdmin.saveError')));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const placement = pendingDelete;
    setPendingDelete(null);
    setBusyId(placement.event_id);
    setError('');
    setSuccess('');
    try {
      await deleteFeaturedEvent(placement.event_id);
      await reload();
      resetForm();
    } catch (err) {
      setError(messageFrom(err, t('featuredAdmin.deleteError')));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('featuredAdmin.intro')}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <BannerForm
        key={formKey}
        events={events}
        placements={placements}
        initialEventId={editingEventId}
        scrollOnMount={editingEventId !== null}
        onSaved={onSaved}
        onCancel={resetForm}
      />

      <Typography variant="h6" sx={{ mb: 1 }}>
        {t('featuredAdmin.listTitle')}
      </Typography>
      {placements.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('featuredAdmin.listEmpty')}
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {placements.map((placement) => (
            <Paper
              key={placement.id}
              variant="outlined"
              sx={{
                p: 1.5,
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 2,
                alignItems: { md: 'center' },
                borderColor: placement.is_live ? 'success.main' : 'divider',
              }}
            >
              <Box sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}>
                <BannerPreview
                  src={placement.desktop_image}
                  ratio={DESKTOP_RATIO}
                  emptyLabel={t('featuredAdmin.noImage')}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" noWrap>{placement.title}</Typography>
                <Typography variant="body2" color="text.secondary">{when(placement)}</Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                  {statusChips(placement, t).map(({ key, ...chip }) => (
                    <Chip key={key} size="small" variant="outlined" {...chip} />
                  ))}
                </Stack>
              </Box>
              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                <Button size="small" variant="outlined" onClick={() => editPlacement(placement)}>
                  {t('featuredAdmin.edit')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={busyId === placement.event_id}
                  onClick={() => toggle(placement)}
                >
                  {placement.is_active ? t('featuredAdmin.turnOff') : t('featuredAdmin.turnOn')}
                </Button>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  disabled={busyId === placement.event_id}
                  onClick={() => setPendingDelete(placement)}
                >
                  {t('featuredAdmin.delete')}
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
        <DialogTitle>{t('featuredAdmin.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('featuredAdmin.deleteBody', { title: pendingDelete?.title || '' })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>{t('featuredAdmin.cancel')}</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            {t('featuredAdmin.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FeaturedEventsDashboard;
