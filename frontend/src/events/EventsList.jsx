import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useDateLocales } from '../hooks/useDateLocales';
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
  const { t } = useTranslation('events');
  const { intl } = useDateLocales();
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
        setError(t('errors.loadEvents'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return t('tbd');
    try {
      return new Date(dateString).toLocaleDateString(intl, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return t('invalidDate');
    }
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

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={1.5} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>{t('listTitle')}</Typography>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary">{t('loadingEvents')}</Typography>
        </Stack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600 }}>{t('listTitle')}</Typography>
          <Alert severity="error">{error}</Alert>
          <Button onClick={loadEvents} variant="contained">
            {t('retry')}
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          {t('listTitle')}
        </Typography>
        <Button component={Link} to="/events/create" variant="contained">
            {t('createEvent')}
        </Button>
      </Box>

      {events.length === 0 ? (
        <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
          <Typography color="text.secondary">{t('empty')}</Typography>
          <Button component={Link} to="/events/create" variant="contained">
            {t('createYourEvent')}
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
                <CardMedia component="img" height="180" image={event.image} alt={event.title || t('imageAlt')} />
              ) : (
                <Box sx={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                  <Typography variant="h5">📅</Typography>
                </Box>
              )}
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 1, mb: 1.5 }}>
                  <Typography variant="h6">{event.title || t('untitled')}</Typography>
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
                    : t('noDescription')}
                </Typography>
                
                <Stack spacing={0.6}>
                  <Typography variant="body2">
                    <strong>{t('card.host')}</strong> {event.owner?.username || t('unknownHost')}
                  </Typography>
                  
                  {event.platform && (
                    <Typography variant="body2">
                      <strong>{t('card.platform')}</strong> {getPlatformLabel(event.platform)}
                      {event.platform === 'other' && event.other_platform && (
                        <span> ({event.other_platform})</span>
                      )}
                    </Typography>
                  )}
                  
                  {event.reference_price > 0 && (
                    <Typography variant="body2">
                      <strong>{t('card.price')}</strong> ${event.reference_price}
                    </Typography>
                  )}
                  
                  <Typography variant="body2">
                    <strong>{t('card.start')}</strong> {formatDate(event.date_start)}
                  </Typography>
                  
                  {event.date_end && (
                    <Typography variant="body2">
                      <strong>{t('card.end')}</strong> {formatDate(event.date_end)}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
              <CardActions>
                <Button component={Link} to={`/events/${event.id}`} variant="outlined" size="small">
                  {t('viewDetails')}
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
