import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import bookClubsApi from '../api/bookClubsApi';
import { useBookClub } from './BookClubLayout';
import { CLUB_ACCENT, formatClubDate } from './clubTheme';

const BookClubMeetings = () => {
  const { slug } = useParams();
  const { authState } = useContext(AuthContext);
  const { guestToken } = useBookClub();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bookClubsApi.listEvents(slug, { guestToken: guestToken || undefined });
      setEvents(data);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudieron cargar las reuniones.');
    } finally {
      setLoading(false);
    }
  }, [slug, guestToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: CLUB_ACCENT }} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Reuniones
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.65)', mb: 3 }}>
        Encuentros en vivo vinculados a este ciclo del club.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {!events.length ? (
        <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
          Todavía no hay reuniones vinculadas a este club.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {events.map((ev) => (
            <Box
              key={ev.id}
              sx={{
                p: 2.5,
                borderRadius: 1,
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Typography sx={{ fontWeight: 600 }}>{ev.title}</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mt: 0.5 }}>
                {formatClubDate(ev.date_start, { dateStyle: 'full', timeStyle: 'short' }) ||
                  'Fecha por confirmar'}
              </Typography>
              {ev.schedule_description && (
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', mt: 1 }}>
                  {ev.schedule_description}
                </Typography>
              )}
              <Button
                size="small"
                component={RouterLink}
                to={`/events/${ev.event_id}`}
                sx={{ mt: 1.5, color: CLUB_ACCENT }}
              >
                Ver evento
              </Button>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default BookClubMeetings;
