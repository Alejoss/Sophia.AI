import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { 
  getUserEventRegistrations, 
  getUserCreatedEvents,
  getUserCreatedEventsById
} from '../api/eventsApi';

const UserEvents = ({ isOwnProfile = false, userId = null }) => {
  const [registrations, setRegistrations] = useState([]);
  const [createdEvents, setCreatedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('registrations'); // 'registrations' or 'created'

  useEffect(() => {
    const loadUserEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let registrationsData, createdEventsData;
        
        if (isOwnProfile || !userId) {
          // Owner view - fetch own events
          [registrationsData, createdEventsData] = await Promise.all([
            getUserEventRegistrations(),
            getUserCreatedEvents()
          ]);
        } else {
          // Visitor view - fetch events for specific user
          try {
            // Try to fetch created events for the user
            createdEventsData = await getUserCreatedEventsById(userId);
          } catch (err) {
            console.warn('Could not fetch created events for user:', err);
            // For now, show empty array since backend endpoint doesn't exist
            createdEventsData = [];
          }
          
          // For visitors, we don't show registrations as they are private
          registrationsData = [];
        }
        
        setRegistrations(registrationsData);
        setCreatedEvents(createdEventsData);
      } catch (err) {
        console.error('Error loading user events:', err);
        setError('Error al cargar los eventos');
      } finally {
        setLoading(false);
      }
    };

    loadUserEvents();
  }, [isOwnProfile, userId]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Por determinar';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventTypeLabel = (eventType) => {
    const typeMap = {
      'LIVE_COURSE': 'Curso en Vivo',
      'LIVE_CERTIFICATION': 'Certificación en Vivo',
      'LIVE_MASTER_CLASS': 'Clase Magistral en Vivo'
    };
    return typeMap[eventType] || eventType;
  };

  const getPaymentStatusLabel = (paymentStatus) => {
    const paymentMap = {
      'PENDING': 'Pendiente',
      'PAID': 'Pagado',
      'REFUNDED': 'Reembolsado'
    };
    return paymentMap[paymentStatus] || paymentStatus;
  };

  const getRegistrationStatusLabel = (registrationStatus) => {
    const statusMap = {
      'REGISTERED': 'Registrado',
      'CANCELLED': 'Cancelado'
    };
    return statusMap[registrationStatus] || registrationStatus;
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
          <Button onClick={() => window.location.reload()} variant="contained">
            Intentar de nuevo
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: 2, mb: 4 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontSize: {
              xs: "1.5rem", // ~24px on mobile
              sm: "1.75rem", // ~28px on small screens
              md: "2.125rem", // ~34px on desktop (default h4)
            },
            fontWeight: 600,
          }}
        >
          {isOwnProfile ? 'Mis eventos' : 'Eventos'}
        </Typography>
        <Button component={Link} to="/events" variant="outlined" color="inherit">
          Explorar todos los eventos
        </Button>
      </Box>

      {/* Tab Navigation - Show registrations tab only for owners */}
      {isOwnProfile ? (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab value="registrations" label={`Eventos en los que estoy registrado (${registrations.length})`} />
            <Tab value="created" label={`Eventos que he creado (${createdEvents.length})`} />
          </Tabs>
        </Box>
      ) : (
        // For visitors, show created events directly without tabs
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h6"
            sx={{
              fontSize: "1.25rem",
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            Eventos creados ({createdEvents.length})
          </Typography>
        </Box>
      )}

      {/* Registrations Tab - Only for owners */}
      {isOwnProfile && activeTab === 'registrations' && (
        <Box>
          {registrations.length === 0 ? (
            <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
              <Typography color="text.secondary">Aún no estás registrado en ningún evento.</Typography>
              <Button component={Link} to="/events" variant="contained">
                Explorar eventos
              </Button>
            </Stack>
          ) : (
            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
              {registrations.map((registration) => (
                <Card key={registration.id} variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 1.5, mb: 1 }}>
                      <Typography variant="h6">{registration.event_title || 'Evento sin título'}</Typography>
                      <Stack direction="row" spacing={0.8}>
                        <Chip size="small" label={getRegistrationStatusLabel(registration.registration_status)} color="primary" variant="outlined" />
                        <Chip size="small" label={getPaymentStatusLabel(registration.payment_status)} color="success" variant="outlined" />
                      </Stack>
                    </Box>
                    <Typography variant="body2"><strong>Fecha del evento:</strong> {formatDate(registration.event_date)}</Typography>
                    <Typography variant="body2"><strong>Registrado:</strong> {formatDate(registration.registered_at)}</Typography>
                  </CardContent>
                  <CardActions>
                    <Button component={Link} to={`/events/${registration.event}`} variant="outlined" size="small">
                      Ver evento
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Created Events Tab - For both owners and visitors */}
      {(isOwnProfile && activeTab === 'created') || !isOwnProfile ? (
        <Box>
          {createdEvents.length === 0 ? (
            <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
              <Typography color="text.secondary">
                {isOwnProfile ? 'Aún no has creado ningún evento.' : 'No se encontraron eventos creados.'}
              </Typography>
              {isOwnProfile && (
                <Button component={Link} to="/events/create" variant="contained">
                  Crear tu primer evento
                </Button>
              )}
            </Stack>
          ) : (
            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' } }}>
              {createdEvents.map((event) => (
                <Card key={event.id} variant="outlined">
                  {event.image ? (
                    <CardMedia component="img" height="170" image={event.image} alt={event.title || 'Evento'} />
                  ) : (
                    <Box sx={{ height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                      <Typography variant="h5">📅</Typography>
                    </Box>
                  )}
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 1, mb: 1 }}>
                      <Typography variant="h6">{event.title || 'Evento sin título'}</Typography>
                      <Chip size="small" variant="outlined" color="primary" label={getEventTypeLabel(event.event_type)} />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {event.description 
                        ? (event.description.length > 150 
                            ? `${event.description.substring(0, 150)}...` 
                            : event.description)
                        : 'No hay descripción disponible'}
                    </Typography>

                    <Stack spacing={0.6}>
                      <Typography variant="body2">
                        <strong>Inicio:</strong> {formatDate(event.date_start)}
                      </Typography>
                      {event.date_end && (
                        <Typography variant="body2">
                          <strong>Fin:</strong> {formatDate(event.date_end)}
                        </Typography>
                      )}
                      {event.reference_price > 0 && (
                        <Typography variant="body2">
                          <strong>Precio:</strong> ${event.reference_price}
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>
                  <CardActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                    <Button component={Link} to={`/events/${event.id}`} variant="outlined" size="small">
                      Ver detalles
                    </Button>
                    {isOwnProfile && (
                      <>
                        <Button component={Link} to={`/events/${event.id}/edit`} variant="contained" size="small">
                          Editar
                        </Button>
                        <Button component={Link} to={`/events/${event.id}/manage`} variant="outlined" color="inherit" size="small">
                          Gestionar
                        </Button>
                      </>
                    )}
                  </CardActions>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      ) : null}
    </Container>
  );
};

export default UserEvents;