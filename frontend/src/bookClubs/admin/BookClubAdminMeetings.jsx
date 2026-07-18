import React, { useCallback, useEffect, useState } from 'react';
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
      setError(extractApiError(err, 'No se pudieron cargar las reuniones.'));
    } finally {
      setLoading(false);
    }
  }, [slug]);

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
      setSuccess('Reunión vinculada.');
      await load();
      await reload?.();
    } catch (err) {
      setError(extractApiError(err, 'No se pudo vincular el evento.'));
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async (linkId) => {
    if (!window.confirm('¿Desvincular esta reunión del club?')) return;
    setUnlinkingId(linkId);
    setError(null);
    setSuccess(null);
    try {
      await bookClubsApi.unlinkEvent(slug, linkId);
      setSuccess('Reunión desvinculada.');
      await load();
      await reload?.();
    } catch (err) {
      setError(extractApiError(err, 'No se pudo desvincular el evento.'));
    } finally {
      setUnlinkingId(null);
    }
  };

  const linkedIds = new Set(linked.map((e) => e.event_id));
  const available = myEvents.filter((e) => !linkedIds.has(e.id));

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Reuniones del club
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Vincula eventos existentes (lives / encuentros) a este club. Puedes crear nuevos en la sección
        de eventos.
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
          <InputLabel id="event-label">Evento a vincular</InputLabel>
          <Select
            labelId="event-label"
            label="Evento a vincular"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            disabled={loading}
          >
            <MenuItem value="">Selecciona un evento</MenuItem>
            {available.map((ev) => (
              <MenuItem key={ev.id} value={String(ev.id)}>
                {ev.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={handleLink} disabled={saving || !eventId}>
            Vincular
          </Button>
          <Button component={RouterLink} to="/events/create" variant="outlined">
            Crear evento
          </Button>
        </Stack>
      </Stack>

      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
        Ya vinculadas
      </Typography>
      {!linked.length ? (
        <Typography color="text.secondary">Ninguna aún.</Typography>
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
                  {formatClubDate(ev.date_start) || 'Sin fecha'}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button size="small" component={RouterLink} to={`/events/${ev.event_id}`}>
                  Abrir evento
                </Button>
                <Button
                  size="small"
                  color="error"
                  disabled={unlinkingId === ev.id}
                  onClick={() => handleUnlink(ev.id)}
                >
                  {unlinkingId === ev.id ? 'Quitando…' : 'Desvincular'}
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
