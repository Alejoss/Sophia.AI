import React, { useState, useEffect, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDateLocales } from '../hooks/useDateLocales';
import {
  fetchEventById,
  peekEventDetailCache,
  registerForEvent,
  cancelEventRegistration,
  getUserEventRegistrations,
  invalidateEventDetailCache,
} from '../api/eventsApi';
import {
  getEventDetailSessionSnapshot,
  loadEventDetailOnce,
  resetEventDetailSession,
} from '../api/eventDetailSession';
import { AuthContext } from '../context/AuthContext';
import { AUTH_ERROR_STRATEGY, getErrorMessage, handleAuthError } from '../utils/authErrorHandler';
import EventCheckout from '../payments/adapters/EventCheckout';
import EventRegistrationModal from './EventRegistrationModal';
import EventPaymentMethods from './EventPaymentMethods';
import { getPaymentStatus, listRegistrationPayments } from '../api/paymentsApi';
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
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PaymentsIcon from '@mui/icons-material/Payments';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingActionsIcon from '@mui/icons-material/PendingActions';

const EventDetail = () => {
  const { t } = useTranslation('events');
  const { intl } = useDateLocales();
  const { eventId } = useParams();
  const { authState } = useContext(AuthContext);
  const navigate = useNavigate();
  const [event, setEvent] = useState(() => {
    const cached = peekEventDetailCache(eventId);
    if (cached) return cached;
    const session = getEventDetailSessionSnapshot(eventId);
    return session.status === 'done' ? session.data : null;
  });
  const [loading, setLoading] = useState(() => {
    if (peekEventDetailCache(eventId)) return false;
    const session = getEventDetailSessionSnapshot(eventId);
    if (session.status === 'done' || session.status === 'error') return false;
    return true;
  });
  const [error, setError] = useState(() => {
    const session = getEventDetailSessionSnapshot(eventId);
    return session.status === 'error'
      ? getErrorMessage(session.error, t('errors.loadEvent'))
      : null;
  });
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const shareButtonText = shareCopied ? t('registration.urlCopied') : t('registration.share');
  const [userRegistration, setUserRegistration] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const userId = authState.user?.id;
  const isAuthenticated = authState.isAuthenticated;
  const eventOwnerId = event?.owner?.id;

  useEffect(() => {
    const cached = peekEventDetailCache(eventId);
    if (cached) {
      setEvent(cached);
      setError(null);
      setLoading(false);
      return undefined;
    }

    const session = getEventDetailSessionSnapshot(eventId);
    if (session.status === 'done' && session.data) {
      setEvent(session.data);
      setError(null);
      setLoading(false);
      return undefined;
    }

    if (session.status === 'error') {
      setEvent(null);
      setError(getErrorMessage(session.error, t('errors.loadEvent')));
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setError(null);
    setLoading(session.status !== 'done');

    loadEventDetailOnce(eventId, () => fetchEventById(eventId))
      .then((data) => {
        if (cancelled) return;
        setEvent(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled || err?.code === 'ERR_CANCELED') return;
        setError(getErrorMessage(err, t('errors.loadEvent')));
        console.error('Error loading event:', err);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    setIsRegistered(false);
    setUserRegistration(null);
  }, [eventId]);

  useEffect(() => {
    if (
      !isAuthenticated
      || !userRegistration?.id
      || !(event?.reference_price > 0)
      || userRegistration.payment_status === 'PAID'
    ) {
      return undefined;
    }

    let cancelled = false;

    const syncPendingPayment = async () => {
      try {
        const payments = await listRegistrationPayments(userRegistration.id);
        if (cancelled) return;
        const paidPayment = payments.find((payment) => payment.is_paid);
        if (paidPayment) {
          setUserRegistration((prev) => (prev ? { ...prev, payment_status: 'PAID' } : prev));
          return;
        }
        const openPayment = payments.find((payment) => payment.payment_status !== 'finished');
        if (!openPayment) return;
        const data = await getPaymentStatus(openPayment.id);
        if (cancelled) return;
        if (data.is_paid) {
          setUserRegistration((prev) => (prev ? { ...prev, payment_status: 'PAID' } : prev));
        }
      } catch (err) {
        handleAuthError(err, { strategy: AUTH_ERROR_STRATEGY.IGNORE });
      }
    };

    syncPendingPayment();
    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    event?.reference_price,
    userRegistration?.id,
    userRegistration?.payment_status,
  ]);

  useEffect(() => {
    const ownerId = eventOwnerId;
    const viewerId = userId;
    if (!isAuthenticated || ownerId == null || Number(ownerId) === Number(viewerId)) {
      return;
    }

    let cancelled = false;

    const loadRegistration = async () => {
      try {
        const userRegistrations = await getUserEventRegistrations();
        if (cancelled) return;
        const activeRegistration = userRegistrations.find(
          (reg) => reg.event === parseInt(eventId, 10) && reg.registration_status === 'REGISTERED',
        );
        setIsRegistered(!!activeRegistration);
        setUserRegistration(activeRegistration || null);
      } catch (err) {
        if (cancelled) return;
        handleAuthError(err, { strategy: AUTH_ERROR_STRATEGY.IGNORE });
        setIsRegistered(false);
        setUserRegistration(null);
      }
    };

    loadRegistration();
    return () => {
      cancelled = true;
    };
  }, [eventId, isAuthenticated, userId, eventOwnerId]);

  useEffect(() => {
    setImageError(false);
  }, [event?.image]);

  const formatDate = (dateString) => {
    if (!dateString) return t('toBeDetermined');
    return new Date(dateString).toLocaleDateString(intl, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventTypeLabel = (eventType) => t(`eventTypes.${eventType}`, { defaultValue: eventType });

  const getPlatformLabel = (platform) => {
    if (platform === 'other') return t('platforms.other');
    const platformMap = {
      google_meet: 'Google Meet',
      jitsi: 'Jitsi',
      microsoft_teams: 'Microsoft Teams',
      telegram: 'Telegram',
      tox: 'Tox',
      twitch: 'Twitch',
      zoom: 'Zoom',
    };
    return platformMap[platform] || platform;
  };

  const isEventCreator = () =>
    authState.isAuthenticated
    && event?.owner?.id != null
    && authState.user?.id != null
    && Number(event.owner.id) === Number(authState.user.id);

  const isEventStarted = () => {
    if (!event?.date_start) return false;
    return new Date(event.date_start) < new Date();
  };

  const isPaidEvent = event?.reference_price > 0;
  const needsPayment =
    isPaidEvent &&
    userRegistration?.payment_status !== 'PAID';

  const handleRegister = async () => {
    setActionError(null);
    setActionSuccess(null);
    if (!authState.isAuthenticated) {
      setActionError(t('registration.loginRequired'));
      return;
    }
    if (isEventStarted()) {
      setActionError(t('registration.alreadyStarted'));
      return;
    }
    setShowRegistrationModal(true);
  };

  const confirmRegistration = async () => {
    try {
      setRegistrationLoading(true);
      setActionError(null);
      const registration = await registerForEvent(eventId);
      setIsRegistered(true);
      setUserRegistration(registration);
      setShowRegistrationModal(false);
      if (isPaidEvent && registration?.payment_status !== 'PAID') {
        setActionSuccess(null);
        setShowPaymentModal(true);
      } else {
        setActionSuccess(t('registration.confirmed'));
      }
    } catch (err) {
      const errorMessage = err.error || err.detail || t('registration.registerError');
      setActionError(errorMessage);
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
  };

  const handlePaymentComplete = () => {
    setUserRegistration((prev) => (prev ? { ...prev, payment_status: 'PAID' } : prev));
    setShowPaymentModal(false);
    setActionSuccess(t('registration.paid'));
  };

  const handleCancelRegistration = async () => {
    try {
      setRegistrationLoading(true);
      setActionError(null);
      await cancelEventRegistration(eventId);
      setIsRegistered(false);
      setUserRegistration(null);
      setShowCancelDialog(false);
      setActionSuccess(t('registration.cancelled'));
    } catch (err) {
      const errorMessage = err.error || err.detail || t('registration.cancelError');
      setActionError(errorMessage);
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleShareEvent = async () => {
    try {
      const eventUrl = `${window.location.origin}/events/${eventId}`;
      await navigator.clipboard.writeText(eventUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      const eventUrl = `${window.location.origin}/events/${eventId}`;
      const textArea = document.createElement('textarea');
      textArea.value = eventUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
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
          <Typography variant="h4" sx={{ fontWeight: 600 }}>{t('detailsTitle')}</Typography>
          <Typography color="text.secondary">{t('loadingEvent')}</Typography>
        </Stack>
      </Container>
    );
  }

  if (error && !event) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={2} alignItems="center">
          <Alert severity="error">{error}</Alert>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              onClick={() => {
                resetEventDetailSession(eventId);
                invalidateEventDetailCache(eventId);
                setError(null);
                setLoading(true);
                loadEventDetailOnce(eventId, () => fetchEventById(eventId, { bypassCache: true }))
                  .then((data) => {
                    setEvent(data);
                    setError(null);
                  })
                  .catch((err) => {
                    setError(getErrorMessage(err, t('errors.loadEvent')));
                  })
                  .finally(() => setLoading(false));
              }}
            >
              {t('retryShort')}
            </Button>
            <Button component={Link} to="/events" variant="outlined">{t('backToEvents')}</Button>
          </Stack>
        </Stack>
      </Container>
    );
  }

  if (!event) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={2} alignItems="center">
          <Alert severity="warning">{t('notFound')}</Alert>
          <Button component={Link} to="/events" variant="contained">{t('backToEvents')}</Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <Button component={Link} to="/events" variant="outlined" color="inherit">
          {t('backToEventsArrow')}
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>{event.title}</Typography>
        <Chip color="primary" variant="outlined" label={getEventTypeLabel(event.event_type)} />
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
                <EventAvailableIcon sx={{ fontSize: 48, color: 'text.secondary', mr: 1 }} />
                <Typography variant="h6" color="text.secondary">{event.title}</Typography>
              </Box>
            )}

            <Typography variant="h6" sx={{ mb: 1 }}>{t('card.description')}</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>{event.description}</Typography>

            <Stack spacing={1.2}>
              <Typography variant="body2">
                <strong>{t('card.host')}</strong>{' '}
                <MuiLink component={Link} to={`/profiles/user_profile/${event.owner.id}`} underline="hover">
                  {event.owner.username}
                </MuiLink>
              </Typography>
              {event.platform && (
                <Typography variant="body2">
                  <strong>{t('card.platform')}</strong> {getPlatformLabel(event.platform)}
                  {event.platform === 'other' && event.other_platform && ` (${event.other_platform})`}
                </Typography>
              )}
              <Typography variant="body2"><strong>{t('card.created')}</strong> {formatDate(event.date_created)}</Typography>
              <Typography variant="body2"><strong>{t('card.startDate')}</strong> {formatDate(event.date_start)}</Typography>
              {event.date_end && (
                <Typography variant="body2"><strong>{t('card.endDate')}</strong> {formatDate(event.date_end)}</Typography>
              )}
              {event.schedule_description && (
                <Typography variant="body2"><strong>{t('card.schedule')}</strong> {event.schedule_description}</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={2}>
          {/* Pricing card */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderColor: isPaidEvent ? 'primary.light' : 'divider',
              bgcolor: isPaidEvent ? 'action.hover' : 'background.paper',
            }}
          >
            <Typography variant="overline" color="text.secondary">{t('card.eventPrice')}</Typography>
            {isPaidEvent ? (
              <>
                <Typography variant="h4" fontWeight={800} color="primary.main" sx={{ mt: 0.5 }}>
                  ${event.reference_price} USD
                </Typography>
                <EventPaymentMethods
                  ownerAcceptedCryptos={event.owner_accepted_cryptos}
                  compact
                />
              </>
            ) : (
              <Typography variant="h5" fontWeight={700} color="success.main" sx={{ mt: 0.5 }}>
                {t('free')}
              </Typography>
            )}
          </Paper>

          {/* Actions card */}
          <Card variant="outlined">
            <CardContent>
              {actionSuccess && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setActionSuccess(null)}>{actionSuccess}</Alert>}
              {actionError && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setActionError(null)}>{actionError}</Alert>}

              {isRegistered && (
                <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'action.hover' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <CheckCircleIcon color="success" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={700}>{t('registration.enrolled')}</Typography>
                  </Stack>
                  {isPaidEvent && (
                    <Chip
                      size="small"
                      icon={needsPayment ? <PendingActionsIcon /> : <CheckCircleIcon />}
                      label={t(`registration.payment.${userRegistration?.payment_status}`, {
                        defaultValue: userRegistration?.payment_status,
                      })}
                      color={userRegistration?.payment_status === 'PAID' ? 'success' : 'warning'}
                      variant="outlined"
                      sx={{ mb: needsPayment ? 1 : 0 }}
                    />
                  )}
                  {needsPayment && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('registration.completePaymentHint')}
                    </Typography>
                  )}
                </Paper>
              )}

              <Typography variant="h6" sx={{ mb: 1.5 }}>{t('registration.actions')}</Typography>
              <Stack spacing={1.2}>
                {isEventCreator() && (
                  <>
                    <Button component={Link} to={`/events/${eventId}/edit`} variant="contained">{t('editEvent')}</Button>
                    <Button component={Link} to={`/events/${eventId}/manage`} variant="outlined">{t('manageEvent')}</Button>
                  </>
                )}

                {!isEventCreator() && authState.isAuthenticated && (
                  <>
                    {!isRegistered ? (
                      <Button
                        onClick={handleRegister}
                        disabled={registrationLoading || isEventStarted()}
                        variant="contained"
                        size="large"
                      >
                        {registrationLoading ? t('processing') : isEventStarted() ? t('registration.started') : t('registration.register')}
                      </Button>
                    ) : (
                      <>
                        {needsPayment && (
                          <Button
                            variant="contained"
                            size="large"
                            startIcon={<PaymentsIcon />}
                            onClick={() => setShowPaymentModal(true)}
                          >
                            {t('registration.completePayment')}
                          </Button>
                        )}
                        <Button
                          variant="outlined"
                          color="inherit"
                          onClick={handleContactCreator}
                        >
                          {t('registration.contactHost')}
                        </Button>
                        <Button
                          onClick={() => setShowCancelDialog(true)}
                          disabled={registrationLoading || userRegistration?.payment_status === 'PAID'}
                          variant="outlined"
                          color="error"
                          size="small"
                        >
                          {t('registration.cancel')}
                        </Button>
                      </>
                    )}
                  </>
                )}

                {!authState.isAuthenticated && (
                  <Button component={Link} to="/profiles/login" variant="contained" size="large">
                    {t('registration.loginToRegister')}
                  </Button>
                )}

                <Button variant="outlined" color="inherit" onClick={handleShareEvent}>
                  {shareButtonText}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      <EventRegistrationModal
        open={showRegistrationModal}
        onClose={() => setShowRegistrationModal(false)}
        onConfirm={confirmRegistration}
        loading={registrationLoading}
        event={event}
        formatDate={formatDate}
        ownerAcceptedCryptos={event?.owner_accepted_cryptos}
      />

      <Dialog open={showCancelDialog} onClose={() => !registrationLoading && setShowCancelDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('registration.cancelTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            <Trans
              t={t}
              i18nKey="registration.loseSpot"
              values={{ title: event.title }}
              components={{ strong: <strong /> }}
            />
            {needsPayment && t('registration.paymentRestart')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCancelDialog(false)} disabled={registrationLoading}>
            {t('back')}
          </Button>
          <Button onClick={handleCancelRegistration} disabled={registrationLoading} color="error" variant="contained">
            {registrationLoading ? t('registration.cancelling') : t('registration.yesCancel')}
          </Button>
        </DialogActions>
      </Dialog>

      <EventCheckout
        open={showPaymentModal}
        onClose={handleClosePaymentModal}
        registrationId={userRegistration?.id}
        title={event?.title}
        priceUsd={event?.reference_price}
        onPaid={handlePaymentComplete}
      />
    </Container>
  );
};

export default EventDetail;
