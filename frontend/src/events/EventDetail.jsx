import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchEventById, registerForEvent, cancelEventRegistration, getUserEventRegistrations } from '../api/eventsApi';
import { getPaymentGatewayStatus } from '../api/paymentsApi';
import { AuthContext } from '../context/AuthContext';
import CryptoPaymentModal from './CryptoPaymentModal';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link as MuiLink,
  Stack,
  Typography,
} from '@mui/material';

const EventDetail = () => {
  const { eventId } = useParams();
  const { authState } = useContext(AuthContext);
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [shareButtonText, setShareButtonText] = useState('Compartir Evento');
  const [userRegistration, setUserRegistration] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cryptoPaymentsEnabled, setCryptoPaymentsEnabled] = useState(false);
  const [gatewayCurrencies, setGatewayCurrencies] = useState(['bch', 'xmr']);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    getPaymentGatewayStatus()
      .then((data) => {
        setCryptoPaymentsEnabled(!!data.enabled);
        if (Array.isArray(data.currencies) && data.currencies.length > 0) {
          setGatewayCurrencies(data.currencies);
        }
      })
      .catch(() => setCryptoPaymentsEnabled(false));
  }, []);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        setLoading(true);
        const data = await fetchEventById(eventId);
        console.log('Event data loaded:', data); // Debug log
        setEvent(data);
        
        // Check if user is registered for this event
        if (authState.isAuthenticated && data.owner.id !== authState.user?.id) {
          try {
            // Try to get user's registrations to check if they're registered for this event
            const userRegistrations = await getUserEventRegistrations();
            const userRegistration = userRegistrations.find(
              reg => reg.event === parseInt(eventId)
            );
            setIsRegistered(!!userRegistration);
            setUserRegistration(userRegistration || null);
          } catch (err) {
            // If there's an error, assume not registered
            setIsRegistered(false);
            setUserRegistration(null);
          }
        }

      } catch (err) {
        setError('Error al cargar el evento. Por favor, inténtelo de nuevo.');
        console.error('Error loading event:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId, authState.isAuthenticated, authState.user]);

  useEffect(() => {
    setImageError(false);
  }, [event?.image]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Por determinar';
      return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
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

  const isEventCreator = () => {
    return authState.isAuthenticated && event?.owner?.id === authState.user?.id;
  };

  const isEventStarted = () => {
    if (!event?.date_start) return false;
    return new Date(event.date_start) < new Date();
  };

  const handleRegister = async () => {
    if (!authState.isAuthenticated) {
      setError('Por favor, inicie sesión para registrarse en eventos');
      return;
    }

    if (isEventStarted()) {
      setError('No se puede registrar en eventos que ya han comenzado');
      return;
    }

    // Show confirmation modal first
    setShowRegistrationModal(true);
  };

  const confirmRegistration = async () => {
    try {
      setRegistrationLoading(true);
      setError(null);
      const registration = await registerForEvent(eventId);
      setIsRegistered(true);
      setUserRegistration(registration);
      setShowRegistrationModal(false);
      if (
        event?.reference_price > 0 &&
        cryptoPaymentsEnabled &&
        registration?.payment_status !== 'PAID'
      ) {
        setShowPaymentModal(true);
      }
    } catch (err) {
      const errorMessage = err.error || err.detail || 'Error al registrarse en el evento';
      setError(errorMessage);
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handlePaymentComplete = () => {
    setUserRegistration((prev) => (prev ? { ...prev, payment_status: 'PAID' } : prev));
    setShowPaymentModal(false);
  };

  const cancelRegistrationModal = () => {
    setShowRegistrationModal(false);
  };

  const handleCancelRegistration = async () => {
    // Check if payment has been accepted
    if (userRegistration && userRegistration.payment_status === 'PAID') {
      setError('No se puede cancelar el registro después de que el pago haya sido aceptado');
      return;
    }

    try {
      setRegistrationLoading(true);
      setError(null);
      await cancelEventRegistration(eventId);
      setIsRegistered(false);
      setUserRegistration(null);
    } catch (err) {
      const errorMessage = err.error || err.detail || 'Error al cancelar el registro';
      setError(errorMessage);
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleShareEvent = async () => {
    try {
      const eventUrl = `${window.location.origin}/events/${eventId}`;
      await navigator.clipboard.writeText(eventUrl);
      
      // Update button text to show success
      setShareButtonText('¡URL Copiada!');
      
      // Reset button text after 2 seconds
      setTimeout(() => {
        setShareButtonText('Compartir Evento');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
      // Fallback for older browsers
      const eventUrl = `${window.location.origin}/events/${eventId}`;
      const textArea = document.createElement('textarea');
      textArea.value = eventUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setShareButtonText('¡URL Copiada!');
      setTimeout(() => {
        setShareButtonText('Compartir Evento');
      }, 2000);
    }
  };

  const handleContactCreator = () => {
    if (!authState.isAuthenticated) {
      navigate('/profiles/login');
      return;
    }
    navigate(`/messages/thread/${event.owner.id}`);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={1.5} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Detalles del Evento
          </Typography>
          <Typography color="text.secondary">Cargando evento...</Typography>
        </Stack>
      </Container>
    );
  }

  if (error && !event) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Detalles del Evento
          </Typography>
          <Alert severity="error">{error}</Alert>
          <Button component={Link} to="/events" variant="contained">
            Volver a Eventos
          </Button>
        </Stack>
      </Container>
    );
  }

  if (!event) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Detalles del Evento
          </Typography>
          <Alert severity="warning">Evento no encontrado.</Alert>
          <Button component={Link} to="/events" variant="contained">
            Volver a Eventos
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <Button component={Link} to="/events" variant="outlined" color="inherit">
          ← Volver a Eventos
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          {event.title}
        </Typography>
        <Chip
          color="primary"
          variant="outlined"
          label={getEventTypeLabel(event.event_type)}
        />
      </Stack>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' } }}>
        <Card variant="outlined">
          <CardContent>
            {event.image && !imageError ? (
              <Box
                component="img"
                src={event.image}
                alt={event.title}
                onError={() => setImageError(true)}
                sx={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 1, mb: 2 }}
              />
            ) : (
              <Box sx={{ height: 220, borderRadius: 1, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                <Typography variant="h5">📅 {event.title}</Typography>
              </Box>
            )}

            <Typography variant="h6" sx={{ mb: 1 }}>
              Descripción
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {event.description}
            </Typography>

            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Anfitrión:</strong>{' '}
                <MuiLink component={Link} to={`/profiles/user_profile/${event.owner.id}`} underline="hover">
                  {event.owner.username}
                </MuiLink>
              </Typography>

              {event.platform && (
                <Typography variant="body2">
                  <strong>Plataforma:</strong> {getPlatformLabel(event.platform)}
                  {event.platform === 'other' && event.other_platform && ` (${event.other_platform})`}
                </Typography>
              )}

              <Typography variant="body2">
                <strong>Creado:</strong> {formatDate(event.date_created)}
              </Typography>

              {event.reference_price > 0 && (
                <Box>
                  <Typography variant="body2">
                    <strong>Precio:</strong> ${event.reference_price}
                  </Typography>
                  {event.owner_accepted_cryptos && event.owner_accepted_cryptos.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                      {event.owner_accepted_cryptos.map((acceptedCrypto) => (
                        <Chip
                          key={acceptedCrypto.id}
                          label={acceptedCrypto.crypto.code}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              <Typography variant="body2">
                <strong>Fecha de Inicio:</strong> {formatDate(event.date_start)}
              </Typography>

              {event.date_end && (
                <Typography variant="body2">
                  <strong>Fecha de Fin:</strong> {formatDate(event.date_end)}
                </Typography>
              )}

              {event.date_recorded && (
                <Typography variant="body2">
                  <strong>Fecha Grabada:</strong> {formatDate(event.date_recorded)}
                </Typography>
              )}

              {event.schedule_description && (
                <Typography variant="body2">
                  <strong>Horario:</strong> {event.schedule_description}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            {error && (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {error}
              </Alert>
            )}
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              Acciones
            </Typography>
            <Stack spacing={1.2}>
          {isEventCreator() && (
            <>
              <Button component={Link} to={`/events/${eventId}/edit`} variant="contained">
                Editar Evento
              </Button>
              <Button component={Link} to={`/events/${eventId}/manage`} variant="outlined">
                Gestionar Evento
              </Button>
            </>
          )}
          
          {!isEventCreator() && authState.isAuthenticated && (
            <>
              {!isRegistered ? (
                <Button
                  onClick={handleRegister}
                  disabled={registrationLoading || isEventStarted()}
                  title={isEventStarted() ? 'El evento ya ha comenzado' : ''}
                  variant="contained"
                >
                  {registrationLoading ? 'Registrando...' : isEventStarted() ? 'Evento Iniciado' : 'Unirse al Evento'}
                </Button>
              ) : (
                <Button
                  onClick={handleCancelRegistration}
                  disabled={registrationLoading || (userRegistration && userRegistration.payment_status === 'PAID')}
                  title={userRegistration && userRegistration.payment_status === 'PAID' ? 'No se puede cancelar después de que el pago sea aceptado' : ''}
                  variant="contained"
                  color={userRegistration && userRegistration.payment_status === 'PAID' ? 'inherit' : 'error'}
                >
                  {registrationLoading ? 'Cancelando...' : 
                   userRegistration && userRegistration.payment_status === 'PAID' ? 'Pago Aceptado' : 'Cancelar Registro'}
                </Button>
              )}
            </>
          )}
          
          {!authState.isAuthenticated && (
            <Button component={Link} to="/profiles/login" variant="contained">
              Iniciar Sesión para Unirse al Evento
            </Button>
          )}
          
          <Button variant="outlined" color="inherit" onClick={handleShareEvent}>
            {shareButtonText}
          </Button>
          
          {!isEventCreator() && authState.isAuthenticated && isRegistered && (
            <Button variant="outlined" onClick={handleContactCreator}>
              Contactar al Creador
            </Button>
          )}

          {!isEventCreator() &&
            authState.isAuthenticated &&
            isRegistered &&
            event.reference_price > 0 &&
            cryptoPaymentsEnabled &&
            userRegistration?.payment_status !== 'PAID' && (
              <Button
                type="button"
                variant="contained"
                onClick={() => setShowPaymentModal(true)}
              >
                Pagar con BCH / XMR
              </Button>
            )}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Registration Confirmation Modal */}
      <Dialog open={showRegistrationModal} onClose={cancelRegistrationModal} maxWidth="sm" fullWidth>
        <DialogTitle>Confirmar Registro en el Evento</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography>Estás a punto de registrarte en <strong>{event.title}</strong>.</Typography>
            <Typography variant="body2">
              <strong>Importante:</strong> El creador del evento se pondrá en contacto contigo para proporcionarte más detalles sobre cómo unirte al evento.
            </Typography>
            <Typography variant="body2">
              <strong>Revisa tu bandeja de entrada de Academia Blockchain y tu correo electrónico</strong> para recibir comunicación del creador del evento.
            </Typography>
            <Divider />
            <Typography variant="body2"><strong>Evento:</strong> {event.title}</Typography>
            <Typography variant="body2"><strong>Anfitrión:</strong> {event.owner.username}</Typography>
            <Typography variant="body2"><strong>Fecha:</strong> {formatDate(event.date_start)}</Typography>
            {event.reference_price > 0 && (
              <Typography variant="body2"><strong>Precio:</strong> ${event.reference_price}</Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelRegistrationModal} disabled={registrationLoading}>
            Cancelar
          </Button>
          <Button onClick={confirmRegistration} disabled={registrationLoading} variant="contained">
            {registrationLoading ? 'Registrando...' : 'Confirmar Registro'}
          </Button>
        </DialogActions>
      </Dialog>

      <CryptoPaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        registrationId={userRegistration?.id}
        eventTitle={event?.title}
        priceUsd={event?.reference_price}
        supportedCurrencies={gatewayCurrencies}
        onPaymentComplete={handlePaymentComplete}
      />
    </Container>
  );
};

export default EventDetail;
