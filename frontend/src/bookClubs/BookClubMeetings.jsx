import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import bookClubsApi from '../api/bookClubsApi';

const accent = '#FF6B35';

const formatDate = (value) => {
  if (!value) return 'Fecha por confirmar';
  try {
    return new Date(value).toLocaleString('es-ES', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
};

const BookClubMeetings = () => {
  const { slug } = useParams();
  const { authState } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bookClubsApi.listEvents(slug);
      setEvents(data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudieron cargar las reuniones.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (authState.isAuthenticated) load();
    else setLoading(false);
  }, [authState.isAuthenticated, load]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: accent }} />
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#0d0d0d', minHeight: '100%', color: '#fff', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="md">
        <Button component={RouterLink} to={`/club-de-lectura/${slug}`} sx={{ color: accent, mb: 2 }}>
          ← Volver al hub
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
          Reuniones del club
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
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
                  p: 2,
                  borderRadius: 1,
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <Typography sx={{ fontWeight: 600 }}>{ev.title}</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mt: 0.5 }}>
                  {formatDate(ev.date_start)}
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
                  sx={{ mt: 1, color: accent }}
                >
                  Ver evento
                </Button>
              </Box>
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
};

export default BookClubMeetings;
