import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchEvents } from '../api/eventsApi';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';

const EventsList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchEvents();
      setEvents(data);
    } catch (err) {
      console.error('Error loading events:', err);
      if (err.detail) {
        setError(err.detail);
      } else if (typeof err === 'string') {
        setError(err);
      } else {
        setError('Error al cargar eventos. Por favor, inténtelo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  const getEventTypeLabel = (eventType) => {
    const typeMap = {
      'LIVE_COURSE': 'Curso en Vivo',
      'LIVE_CERTIFICATION': 'Certificación en Vivo',
      'LIVE_MASTER_CLASS': 'Clase Magistral en Vivo'
    };
    return typeMap[eventType] || eventType;
  };

  const getPlatformLabel = (platform) => {
    const platformMap = {
      'google_meet': 'Google Meet',
      'jitsi': 'Jitsi',
      'microsoft_teams': 'Microsoft Teams',
      'other': 'Otra',
      'telegram': 'Telegram',
      'tox': 'Tox',
      'twitch': 'Twitch',
      'zoom': 'Zoom'
    };
    return platformMap[platform] || platform;
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={1.5} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>Eventos</Typography>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary">Cargando eventos...</Typography>
        </Stack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>Eventos</Typography>
          <Alert severity="error">{error}</Alert>
          <Button onClick={loadEvents} variant="contained">
            Intentar de nuevo
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Eventos
        </Typography>
        <Button component={Link} to="/events/create" variant="contained">
            Crear Evento
        </Button>
      </Box>

      {events.length === 0 ? (
        <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
          <Typography color="text.secondary">No se encontraron eventos.</Typography>
          <Button component={Link} to="/events/create" variant="contained">
            Crear tu Primer Evento
          </Button>
        </Stack>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {events.map((event) => (
            <Card key={event.id} variant="outlined">
              {event.image ? (
                <CardMedia component="img" height="180" image={event.image} alt={event.title || 'Evento'} />
              ) : (
                <Box sx={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                  <Typography variant="h5">📅</Typography>
                </Box>
              )}
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 1, mb: 1.5 }}>
                  <Typography variant="h6">{event.title || 'Evento sin título'}</Typography>
                  <Chip
                    size="small"
                    label={getEventTypeLabel(event.event_type)}
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {event.description 
                    ? (event.description.length > 150 
                        ? `${event.description.substring(0, 150)}...` 
                        : event.description)
                    : 'No hay descripción disponible'}
                </Typography>
                
                <Stack spacing={0.6}>
                  <Typography variant="body2">
                    <strong>Anfitrión:</strong> {event.owner?.username || 'Desconocido'}
                  </Typography>
                  
                  {event.platform && (
                    <Typography variant="body2">
                      <strong>Plataforma:</strong> {getPlatformLabel(event.platform)}
                      {event.platform === 'other' && event.other_platform && (
                        <span> ({event.other_platform})</span>
                      )}
                    </Typography>
                  )}
                  
                  {event.reference_price > 0 && (
                    <Typography variant="body2">
                      <strong>Precio:</strong> ${event.reference_price}
                    </Typography>
                  )}
                  
                  <Typography variant="body2">
                    <strong>Inicio:</strong> {formatDate(event.date_start)}
                  </Typography>
                  
                  {event.date_end && (
                    <Typography variant="body2">
                      <strong>Fin:</strong> {formatDate(event.date_end)}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
              <CardActions>
                <Button component={Link} to={`/events/${event.id}`} variant="outlined" size="small">
                  Ver Detalles
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}
    </Container>
  );
};

export default EventsList;
