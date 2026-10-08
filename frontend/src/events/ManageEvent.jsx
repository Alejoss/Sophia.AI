import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useDateLocales } from '../hooks/useDateLocales';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link, useParams } from 'react-router-dom';
import { fetchEventById, getEventParticipants, updateParticipantStatus } from '../api/eventsApi';
import { getPaymentGatewayStatus } from '../api/paymentsApi';
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
import useAuthErrorHandler, { AUTH_ERROR_STRATEGY } from '../hooks/useAuthErrorHandler';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';

const certificateSchema = yup.object({
  certificateNote: yup.string().trim().default(''),
});

const ManageEvent = () => {
  const { t } = useTranslation('events');
  const { intl } = useDateLocales();
  const { eventId } = useParams();
  const { handleAuthError, getErrorMessage } = useAuthErrorHandler({
    strategy: AUTH_ERROR_STRATEGY.REDIRECT,
  });
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('participants');
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [certificateDialogOpen, setCertificateDialogOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [certificateGeneralError, setCertificateGeneralError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const {
    register: registerCertificate,
    handleSubmit: handleCertificateSubmit,
    reset: resetCertificateForm,
    setError: setCertificateFormError,
    formState: { errors: certificateErrors, isSubmitting: isCertificateSubmitting },
  } = useForm({
    resolver: yupResolver(certificateSchema),
    defaultValues: { certificateNote: '' },
  });
  const [paymentConfirmationDialog, setPaymentConfirmationDialog] = useState(false);
  const [selectedPaymentRegistration, setSelectedPaymentRegistration] = useState(null);
  const [cryptoPaymentsEnabled, setCryptoPaymentsEnabled] = useState(false);

  useEffect(() => {
    getPaymentGatewayStatus()
      .then((data) => setCryptoPaymentsEnabled(!!data.enabled))
      .catch(() => setCryptoPaymentsEnabled(false));
  }, []);

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
      if (handleAuthError(err).handled) {
        return;
      }
      console.error('Error loading event data:', err);
      setError(getErrorMessage(err, t('errors.loadManage')));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('notSpecified');
      return new Date(dateString).toLocaleDateString(intl, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentStatusLabel = (paymentStatus) => (
    t(`manage.paymentStatus.${paymentStatus}`, { defaultValue: paymentStatus })
  );

  const getRegistrationStatusLabel = (registrationStatus) => (
    t(`manage.registrationStatus.${registrationStatus}`, { defaultValue: registrationStatus })
  );

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
          message: t('manage.certificateSuccess'),
          severity: 'success'
        });
      }
    } catch (err) {
      console.error('Error updating participant status:', err);
      setError(err.error || t('manage.statusError'));
      setSnackbar({
        open: true,
        message: err.error || t('manage.statusError'),
        severity: 'error'
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const openCertificateDialog = (registration) => {
    setSelectedRegistration(registration);
    resetCertificateForm({ certificateNote: '' });
    setCertificateGeneralError('');
    setCertificateDialogOpen(true);
  };

  const handleCloseCertificateDialog = () => {
    if (!isCertificateSubmitting) {
      setCertificateDialogOpen(false);
      setCertificateGeneralError('');
    }
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
        message: t('manage.paymentSuccess'),
        severity: 'success'
      });
    } catch (err) {
      console.error('Error accepting payment:', err);
      const errorMessage = err.error || t('manage.paymentError');
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

  const onCertificateSubmit = async ({ certificateNote }) => {
    if (!selectedRegistration) return;

    setCertificateGeneralError('');
    setError(null);
    setUpdatingStatus(selectedRegistration.id);

    try {
      await certificatesApi.generateEventCertificate(
        eventId,
        selectedRegistration.id,
        { note: certificateNote },
      );

      const participantsData = await getEventParticipants(eventId);
      setParticipants(participantsData);

      setCertificateDialogOpen(false);
      setSelectedRegistration(null);
      setSnackbar({
        open: true,
        message: t('manage.certificateSuccess'),
        severity: 'success',
      });
    } catch (err) {
      console.error('Error generating certificate:', err);
      const { generalError } = applyApiErrorsToForm(
        err,
        setCertificateFormError,
        t('manage.certificateError'),
        { note: 'certificateNote' },
      );
      if (generalError) {
        setCertificateGeneralError(generalError);
      }
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={1.5} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>{t('manageEvent')}</Typography>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary">{t('loadingEventData')}</Typography>
        </Stack>
      </Container>
    );
  }

  if (error && !event) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>{t('manageEvent')}</Typography>
          <Alert severity="error">{error}</Alert>
          <Button component={Link} to="/events" variant="contained">
            {t('backToEvents')}
          </Button>
        </Stack>
      </Container>
    );
  }

  if (!event) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>{t('manageEvent')}</Typography>
          <Alert severity="warning">{t('notFound')}</Alert>
          <Button component={Link} to="/events" variant="contained">
            {t('backToEvents')}
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
          {t('manageTitle', { title: event.title })}
        </Typography>
        <Stack direction="row" spacing={1.2} sx={{ flexWrap: 'wrap' }}>
          <Button component={Link} to={`/events/${eventId}`} variant="outlined" color="inherit">
            {t('viewEvent')}
          </Button>
          <Button component={Link} to={`/events/${eventId}/edit`} variant="contained">
            {t('editEvent')}
          </Button>
        </Stack>
      </Box>

      {/* Event Summary */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            {t('manage.summary')}
          </Typography>
          <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
            <Typography variant="body2"><strong>{t('manage.type')}</strong> {t(`eventTypes.${event.event_type}`, { defaultValue: event.event_type })}</Typography>
            <Typography variant="body2"><strong>{t('card.startDate')}</strong> {formatDate(event.date_start)}</Typography>
            <Typography variant="body2"><strong>{t('card.endDate')}</strong> {formatDate(event.date_end)}</Typography>
            <Typography variant="body2"><strong>{t('card.platform')}</strong> {event.platform || t('notSpecified')}</Typography>
            <Typography variant="body2"><strong>{t('manage.price')}</strong> {event.reference_price > 0 ? `$${event.reference_price}` : t('free')}</Typography>
            <Typography variant="body2"><strong>{t('manage.participants')}</strong> {participants.length}</Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
          <Tab value="participants" label={t('manage.participantsTab', { count: participants.length })} />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box>
        {activeTab === 'participants' && (
          <Box>
            {participants.length === 0 ? (
              <Alert severity="info">{t('manage.none')}</Alert>
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
                          {t('manage.registeredAt', { date: formatDate(registration.registered_at) })}
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
                          {t('manage.sendMessage')}
                        </Button>
                        
                        {/* Only show actions for registered participants */}
                        {registration.registration_status === 'REGISTERED' && (
                          <>
                            {/* Accept Payment - only for paid events with pending payment */}
                            {event.reference_price > 0 &&
                              registration.payment_status === 'PENDING' &&
                              !cryptoPaymentsEnabled && (
                              <Button
                                variant="contained"
                                color="success"
                                size="small"
                                onClick={() => openPaymentConfirmationDialog(registration)}
                                disabled={updatingStatus === registration.id}
                              >
                                {updatingStatus === registration.id ? t('manage.updating') : t('manage.acceptPayment')}
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
                                {updatingStatus === registration.id ? t('manage.sending') :
                                 hasCertificate(registration) ? t('manage.certificateSent') : t('manage.sendCertificate')}
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
                                {updatingStatus === registration.id ? t('manage.cancelling') : t('manage.cancelRegistration')}
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
        onClose={handleCloseCertificateDialog}
        maxWidth="md"
        fullWidth
      >
        <Box
          component="form"
          onSubmit={handleCertificateSubmit(onCertificateSubmit)}
          noValidate
        >
          <DialogTitle>{t('manage.sendCertificate')}</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              {certificateGeneralError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {certificateGeneralError}
                </Alert>
              )}
              <Alert severity="info" sx={{ mb: 2 }}>
                <strong>{t('manage.noteLabel')}</strong> {t('manage.noteBody')}
              </Alert>
              <TextField
                fullWidth
                multiline
                rows={4}
                label={t('manage.personalMessage')}
                placeholder={t('manage.personalPlaceholder')}
                variant="outlined"
                error={!!certificateErrors.certificateNote}
                helperText={certificateErrors.certificateNote?.message}
                disabled={isCertificateSubmitting}
                {...registerCertificate('certificateNote')}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCertificateDialog} disabled={isCertificateSubmitting}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isCertificateSubmitting}
            >
              {isCertificateSubmitting ? t('manage.sending') : t('manage.sendCertificate')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Payment Confirmation Dialog */}
      <Dialog 
        open={paymentConfirmationDialog} 
        onClose={() => setPaymentConfirmationDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('manage.paymentTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>{t('manage.important')}</strong> {t('manage.paymentWarning')}
            </Alert>
            {selectedPaymentRegistration && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2"><strong>{t('manage.user')}</strong> {selectedPaymentRegistration.user.username}</Typography>
                <Typography variant="body2"><strong>{t('manage.email')}</strong> {selectedPaymentRegistration.user_email}</Typography>
                <Typography variant="body2"><strong>{t('manage.event')}</strong> {event.title}</Typography>
                <Typography variant="body2"><strong>{t('manage.amount')}</strong> ${event.reference_price}</Typography>
              </Box>
            )}
            <Typography variant="body2">{t('manage.confirmPayment')}</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentConfirmationDialog(false)}>
            {t('cancel')}
          </Button>
          <Button 
            onClick={handleConfirmPayment}
            variant="contained"
            color="success"
          >
            {t('manage.acceptPayment')}
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