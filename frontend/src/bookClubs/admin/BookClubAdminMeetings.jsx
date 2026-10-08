import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import bookClubsApi from '../../api/bookClubsApi';
import { getUserCreatedEvents } from '../../api/eventsApi';
import { extractApiError, formatClubDate } from '../clubTheme';

const BookClubAdminMeetings = () => {
  const { t } = useTranslation('bookClubs');
  const { slug } = useParams();
  const { reload } = useOutletContext();
  const [linked, setLinked] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clubEvents, mine] = await Promise.all([
        bookClubsApi.listEvents(slug),
        getUserCreatedEvents().catch(() => []),
      ]);
      setLinked(Array.isArray(clubEvents) ? clubEvents : []);
      const list = Array.isArray(mine) ? mine : mine?.results || [];
      setMyEvents(list);
      setError(null);
    } catch (err) {
      setError(extractApiError(err, t('errors.loadMeetings')));
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLink = async () => {
    if (!eventId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await bookClubsApi.linkEvent(slug, Number(eventId));
      setEventId('');
      setSuccess(t('meetingAdmin.linked'));
      await load();
      await reload?.();
    } catch (err) {
      setError(extractApiError(err, t('errors.linkEvent')));
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async (linkId) => {
    if (!window.confirm(t('meetingAdmin.confirmUnlink'))) return;
    setUnlinkingId(linkId);
    setError(null);
    setSuccess(null);
    try {
      await bookClubsApi.unlinkEvent(slug, linkId);
      setSuccess(t('meetingAdmin.unlinked'));
      await load();
      await reload?.();
    } catch (err) {
      setError(extractApiError(err, t('errors.unlinkEvent')));
    } finally {
      setUnlinkingId(null);
    }
  };

  const linkedIds = new Set(linked.map((e) => e.event_id));
  const available = myEvents.filter((e) => !linkedIds.has(e.id));

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('meetingAdmin.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('meetingAdmin.intro')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Stack spacing={2} maxWidth={640} sx={{ mb: 4 }}>
        <FormControl fullWidth>
          <InputLabel id="event-label">{t('meetingAdmin.eventLabel')}</InputLabel>
          <Select
            labelId="event-label"
            label={t('meetingAdmin.eventLabel')}
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            disabled={loading}
          >
            <MenuItem value="">{t('meetingAdmin.selectEvent')}</MenuItem>
            {available.map((ev) => (
              <MenuItem key={ev.id} value={String(ev.id)}>
                {ev.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={handleLink} disabled={saving || !eventId}>
            {t('meetingAdmin.link')}
          </Button>
          <Button component={RouterLink} to="/events/create" variant="outlined">
            {t('meetingAdmin.createEvent')}
          </Button>
        </Stack>
      </Stack>

      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
        {t('meetingAdmin.alreadyLinked')}
      </Typography>
      {!linked.length ? (
        <Typography color="text.secondary">{t('meetingAdmin.none')}</Typography>
      ) : (
        <Stack spacing={1.5}>
          {linked.map((ev) => (
            <Box
              key={ev.id}
              sx={{
                py: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                gap: 2,
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography fontWeight={600}>{ev.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatClubDate(ev.date_start) || t('dates.none')}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button size="small" component={RouterLink} to={`/events/${ev.event_id}`}>
                  {t('meetingAdmin.openEvent')}
                </Button>
                <Button
                  size="small"
                  color="error"
                  disabled={unlinkingId === ev.id}
                  onClick={() => handleUnlink(ev.id)}
                >
                  {unlinkingId === ev.id ? t('meetingAdmin.unlinking') : t('meetingAdmin.unlink')}
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default BookClubAdminMeetings;
