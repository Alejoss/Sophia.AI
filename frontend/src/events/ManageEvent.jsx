import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchEventById, getEventParticipants, updateParticipantStatus } from '../api/eventsApi';
import certificatesApi from '../api/certificatesApi';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Snackbar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';

const ManageEvent = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('participants');
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [certificateDialogOpen, setCertificateDialogOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [certificateNote, setCertificateNote] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [paymentConfirmationDialog, setPaymentConfirmationDialog] = useState(false);
  const [selectedPaymentRegistration, setSelectedPaymentRegistration] = useState(null);

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  const loadEventData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [eventData, participantsData] = await Promise.all([
        fetchEventById(eventId),
        getEventParticipants(eventId)
      ]);
      
      setEvent(eventData);
      setParticipants(participantsData);
    } catch (err) {
      console.error('Error loading event data:', err);
      setError(err.error || 'Error al cargar los datos del evento');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No especificado';
      return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentStatusLabel = (paymentStatus) => {
    const statusMap = {
      'PENDING': 'Pago Pendiente',
      'PAID': 'Pago Aceptado',
      'REFUNDED': 'Pago Reembolsado'
    };
    return statusMap[paymentStatus] || paymentStatus;
  };

  const getRegistrationStatusLabel = (registrationStatus) => {
    const statusMap = {
      'REGISTERED': 'Registrado',
      'CANCELLED': 'Cancelado'
    };
    return statusMap[registrationStatus] || registrationStatus;
  };

  const canSendCertificate = (registration) => {
    // Must be registered (not cancelled)
    if (registration.registration_status !== 'REGISTERED') {
      return false;
    }
    
    // Event must have ended
    if (!event.date_end || new Date(event.date_end) >= new Date()) {
      return false;
    }
    
    // For paid events, payment must be accepted
    if (event.reference_price > 0) {
      return registration.payment_status === 'PAID';
    }
    
    // For free events, can send certificate after event ends
    return true;
  };

  const hasCertificate = (registration) => {
    // Check if the registration has a certificate based on the API response
    return registration.has_certificate === true;
  };

  const hasEventEnded = () => {
    return event.date_end && new Date(event.date_end) <= new Date();
  };

  const handleMessageUser = (userId) => {
    window.open(`/messages/thread/${userId}`, '_blank');
  };

  const handleStatusUpdate = async (registrationId, action) => {
    try {
      setUpdatingStatus(registrationId);
      setError(null);
      
      await updateParticipantStatus(eventId, registrationId, action);
      
      // Refresh participants list
      const participantsData = await getEventParticipants(eventId);
      setParticipants(participantsData);
      
      // Show success message for certificate generation
      if (action === 'send_certificate') {
        setSnackbar({
          open: true,
          message: '¡Certificado generado y enviado exitosamente!',
          severity: 'success'
        });
      }
    } catch (err) {
      console.error('Error updating participant status:', err);
      setError(err.error || 'Error al actualizar el estado del participante');
      setSnackbar({
        open: true,
        message: err.error || 'Error al actualizar el estado del participante',
        severity: 'error'
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const openCertificateDialog = (registration) => {
    setSelectedRegistration(registration);
    setCertificateNote('');
    setCertificateDialogOpen(true);
  };

  const openPaymentConfirmationDialog = (registration) => {
    setSelectedPaymentRegistration(registration);
    setPaymentConfirmationDialog(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedPaymentRegistration) return;

    try {
      setUpdatingStatus(selectedPaymentRegistration.id);
      setPaymentConfirmationDialog(false);
      setError(null);
      
      await updateParticipantStatus(eventId, selectedPaymentRegistration.id, 'accept_payment');
      
      // Refresh participants list
      const participantsData = await getEventParticipants(eventId);
      setParticipants(participantsData);
      
      setSnackbar({
        open: true,
        message: '¡Pago aceptado exitosamente!',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error accepting payment:', err);
      const errorMessage = err.error || 'Error al aceptar el pago';
      setError(errorMessage);
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setUpdatingStatus(null);
      setSelectedPaymentRegistration(null);
    }
  };

  const handleGenerateCertificate = async () => {
    if (!selectedRegistration) return;

    try {
      setUpdatingStatus(selectedRegistration.id);
      setCertificateDialogOpen(false);
      setError(null);
      
      // Use the new certificate generation API
      const result = await certificatesApi.generateEventCertificate(
        eventId, 
        selectedRegistration.id, 
        {
          note: certificateNote
        }
      );
      
      // Refresh participants list
      const participantsData = await getEventParticipants(eventId);
      setParticipants(participantsData);
      
        setSnackbar({
          open: true,
          message: '¡Certificado generado y enviado exitosamente!',
          severity: 'success'
        });
    } catch (err) {
      console.error('Error generating certificate:', err);
      const errorMessage = err.error || err.details || 'Error al generar el certificado';
      setError(errorMessage);
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setUpdatingStatus(null);
      setSelectedRegistration(null);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={1.5} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>Gestionar Evento</Typography>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary">Cargando datos del evento...</Typography>
        </Stack>
      </Container>
    );
  }

  if (error && !event) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>Gestionar Evento</Typography>
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
          <Typography variant="h4" sx={{ fontWeight: 600 }}>Gestionar Evento</Typography>
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
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Gestionar Evento: {event.title}
        </Typography>
        <Stack direction="row" spacing={1.2} sx={{ flexWrap: 'wrap' }}>
          <Button component={Link} to={`/events/${eventId}`} variant="outlined" color="inherit">
            Ver Evento
          </Button>
          <Button component={Link} to={`/events/${eventId}/edit`} variant="contained">
            Editar Evento
          </Button>
        </Stack>
      </Box>

      {/* Event Summary */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Resumen del Evento
          </Typography>
          <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
            <Typography variant="body2"><strong>Tipo de Evento:</strong> {event.event_type}</Typography>
            <Typography variant="body2"><strong>Fecha de Inicio:</strong> {formatDate(event.date_start)}</Typography>
            <Typography variant="body2"><strong>Fecha de Fin:</strong> {formatDate(event.date_end)}</Typography>
            <Typography variant="body2"><strong>Plataforma:</strong> {event.platform || 'No especificado'}</Typography>
            <Typography variant="body2"><strong>Precio:</strong> {event.reference_price > 0 ? `$${event.reference_price}` : 'Gratis'}</Typography>
            <Typography variant="body2"><strong>Participantes:</strong> {participants.length}</Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
          <Tab value="participants" label={`Participantes (${participants.length})`} />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box>
        {activeTab === 'participants' && (
          <Box>
            {participants.length === 0 ? (
              <Alert severity="info">Aún no hay participantes registrados.</Alert>
            ) : (
              <Stack spacing={1.5}>
                {participants.map((registration) => (
                  <Paper key={registration.id} variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {registration.user.username}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {registration.user_email}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Registrado: {formatDate(registration.registered_at)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.8} sx={{ alignSelf: 'flex-start' }}>
                        <Chip size="small" variant="outlined" color="primary" label={getRegistrationStatusLabel(registration.registration_status)} />
                        <Chip size="small" variant="outlined" color="success" label={getPaymentStatusLabel(registration.payment_status)} />
                      </Stack>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleMessageUser(registration.user.id)}
                        >
                          Enviar Mensaje
                        </Button>
                        
                        {/* Only show actions for registered participants */}
                        {registration.registration_status === 'REGISTERED' && (
                          <>
                            {/* Accept Payment - only for paid events with pending payment */}
                            {event.reference_price > 0 && registration.payment_status === 'PENDING' && (
                              <Button
                                variant="contained"
                                color="success"
                                size="small"
                                onClick={() => openPaymentConfirmationDialog(registration)}
                                disabled={updatingStatus === registration.id}
                              >
                                {updatingStatus === registration.id ? 'Actualizando...' : 'Aceptar Pago'}
                              </Button>
                            )}
                            
                            {/* Send Certificate - after event end date and payment accepted (or free event) */}
                            {canSendCertificate(registration) && (
                              <Button
                                variant={hasCertificate(registration) ? 'outlined' : 'contained'}
                                color={hasCertificate(registration) ? 'inherit' : 'primary'}
                                size="small"
                                onClick={() => hasCertificate(registration) ? null : openCertificateDialog(registration)}
                                disabled={updatingStatus === registration.id || hasCertificate(registration)}
                              >
                                {updatingStatus === registration.id ? 'Enviando...' : 
                                 hasCertificate(registration) ? 'Certificado Enviado' : 'Enviar Certificado'}
                              </Button>
                            )}
                            
                            {/* Cancel Registration - only show if event hasn't ended */}
                            {!hasEventEnded() && (
                              <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                onClick={() => handleStatusUpdate(registration.id, 'cancel_registration')}
                                disabled={updatingStatus === registration.id}
                              >
                                {updatingStatus === registration.id ? 'Cancelando...' : 'Cancelar Registro'}
                              </Button>
                            )}
                          </>
                        )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>
        )}
      </Box>

      {/* Certificate Generation Dialog */}
      <Dialog 
        open={certificateDialogOpen} 
        onClose={() => setCertificateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Enviar Certificado</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>Nota:</strong> Cualquier mensaje que agregue a continuación será visible para el estudiante en su certificado.
            </Alert>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Mensaje Personal (opcional)"
              placeholder="Agregue un mensaje personal para felicitar al estudiante o agregar notas especiales..."
              value={certificateNote}
              onChange={(e) => setCertificateNote(e.target.value)}
              variant="outlined"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCertificateDialogOpen(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleGenerateCertificate}
            variant="contained"
            color="primary"
          >
            Enviar Certificado
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Confirmation Dialog */}
      <Dialog 
        open={paymentConfirmationDialog} 
        onClose={() => setPaymentConfirmationDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirmar Aceptación de Pago</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>Importante:</strong> Esta acción marcará el pago como aceptado y no se puede deshacer.
            </Alert>
            {selectedPaymentRegistration && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2"><strong>Usuario:</strong> {selectedPaymentRegistration.user.username}</Typography>
                <Typography variant="body2"><strong>Correo:</strong> {selectedPaymentRegistration.user_email}</Typography>
                <Typography variant="body2"><strong>Evento:</strong> {event.title}</Typography>
                <Typography variant="body2"><strong>Cantidad:</strong> ${event.reference_price}</Typography>
              </Box>
            )}
            <Typography variant="body2">¿Está seguro de que desea aceptar este pago?</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentConfirmationDialog(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmPayment}
            variant="contained"
            color="success"
          >
            Aceptar Pago
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ManageEvent; 