import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDateLocales } from '../hooks/useDateLocales';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { useBookClub } from './BookClubLayout';
import { CLUB_ACCENT, CLUB_ACCENT_HOVER } from './clubTheme';
import { getGuestSession, guestCompleteAccountUrl } from './guestStorage';

const BookClubMissions = () => {
  const { t } = useTranslation('bookClubs');
  const { intl } = useDateLocales();
  const { slug, hub, isGuest, canParticipate } = useBookClub();
  const progressPct = Math.round(hub.progress?.percentage || 0);
  const pathId = hub.quick_links?.knowledge_path_id;
  const next = hub.next_mission;
  const readOnly = isGuest || !canParticipate;
  const guest = getGuestSession(slug);
  const accountUrl = guest?.token
    ? guestCompleteAccountUrl(slug, guest.token)
    : `/profiles/register?next=${encodeURIComponent(`/club-de-lectura/${slug}`)}`;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          {t('missions.title')}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
          {t('missions.intro')}
        </Typography>
      </Box>

      {readOnly && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" component={RouterLink} to={accountUrl} sx={{ fontWeight: 700 }}>
              {t('createAccount')}
            </Button>
          }
          sx={{ bgcolor: 'rgba(255,107,53,0.1)', color: '#fff', border: '1px solid rgba(255,107,53,0.35)' }}
        >
          {t('missions.readOnly')}
        </Alert>
      )}

      <Box
        sx={{
          p: 2.5,
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 1,
        }}
      >
        <Typography sx={{ color: 'rgba(255,255,255,0.85)', mb: 1 }}>
          {t('missions.progress', {
            completed: hub.progress.completed_nodes,
            total: hub.progress.total_nodes,
            percent: progressPct,
          })}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progressPct}
          sx={{
            height: 10,
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.08)',
            '& .MuiLinearProgress-bar': { bgcolor: CLUB_ACCENT },
          }}
        />
      </Box>

      {next ? (
        <Box
          sx={{
            p: 2.5,
            border: `1px solid ${CLUB_ACCENT}`,
            borderRadius: 1,
            bgcolor: 'rgba(255,107,53,0.06)',
          }}
        >
          <Typography variant="overline" sx={{ color: CLUB_ACCENT, fontWeight: 700 }}>
            {t('missions.next')}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
            {t('missions.missionLine', { order: next.order, title: next.title })}
          </Typography>
          {readOnly ? (
            <Button
              variant="contained"
              component={RouterLink}
              to={accountUrl}
              sx={{ mt: 2, bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
            >
              {t('missions.createToOpen')}
            </Button>
          ) : next.locked ? (
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', mt: 1 }}>
              {next.club_schedule_locked
                ? next.opens_at
                  ? t('missions.opensAt', { date: new Date(next.opens_at).toLocaleString(intl) })
                  : t('missions.notYet')
                : t('missions.lockedPrevious')}
            </Typography>
          ) : (
            <Button
              variant="contained"
              component={RouterLink}
              to={`/knowledge_path/${next.path_id}/nodes/${next.node_id}?club=${encodeURIComponent(slug)}`}
              sx={{ mt: 2, bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
            >
              {t('missions.open')}
            </Button>
          )}
        </Box>
      ) : hub.progress.is_completed ? (
        <Alert severity="success">{t('missions.allDone')}</Alert>
      ) : (
        <Box>
          <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
            {t('missions.preparing')}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.75 }}>
            {t('missions.preparingBody')}
          </Typography>
        </Box>
      )}

      {pathId && !readOnly && (
        <Button
          variant="outlined"
          component={RouterLink}
          to={`/knowledge_path/${pathId}?club=${encodeURIComponent(slug)}`}
          sx={{ alignSelf: 'flex-start', borderColor: CLUB_ACCENT, color: CLUB_ACCENT }}
        >
          {t('missions.viewPath')}
        </Button>
      )}
    </Stack>
  );
};

export default BookClubMissions;
