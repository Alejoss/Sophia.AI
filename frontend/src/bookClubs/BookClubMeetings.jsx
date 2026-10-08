import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import bookClubsApi from '../api/bookClubsApi';
import { resolveMediaUrl } from '../utils/fileUtils';
import { useBookClub } from './BookClubLayout';
import { CLUB_ACCENT, formatClubDate } from './clubTheme';

const BookClubMeetings = () => {
  const { t } = useTranslation('bookClubs');
  const { slug } = useParams();
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
      setError(err?.response?.data?.detail || t('errors.loadMeetings'));
    } finally {
      setLoading(false);
    }
  }, [slug, guestToken, t]);

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
        {t('meetings.title')}
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.65)', mb: 3 }}>
        {t('meetings.intro')}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {!events.length ? (
        <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
          {t('meetings.empty')}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {events.map((ev) => {
            const imageUrl = resolveMediaUrl(ev.image);
            return (
              <Box
                key={ev.id}
                sx={{
                  p: 2.5,
                  borderRadius: 1,
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  gap: 2,
                  alignItems: 'stretch',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{ev.title}</Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mt: 0.5 }}>
                    {formatClubDate(ev.date_start, { dateStyle: 'full', timeStyle: 'short' }) ||
                      t('dates.unconfirmed')}
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
                    {t('meetings.viewEvent')}
                  </Button>
                </Box>
                {imageUrl && (
                  <Box
                    component="img"
                    src={imageUrl}
                    alt=""
                    sx={{
                      width: { xs: 88, sm: 120 },
                      height: { xs: 88, sm: 120 },
                      flexShrink: 0,
                      objectFit: 'cover',
                      borderRadius: 1,
                      alignSelf: 'center',
                      bgcolor: 'rgba(255,255,255,0.06)',
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

export default BookClubMeetings;
