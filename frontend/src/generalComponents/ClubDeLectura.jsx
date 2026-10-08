import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import bookClubsApi from '../api/bookClubsApi';

const CLUB_ACCENT = '#FF6B35';
const CLUB_ACCENT_HOVER = '#E55A2B';

/** Prefer the most recently created active cycle. */
const pickLatestActiveClub = (clubs = []) => {
  const active = clubs.filter((club) => club.status === 'active');
  if (!active.length) return null;
  return [...active].sort((a, b) => {
    const aTime = new Date(a.created_at || a.starts_at || 0).getTime();
    const bTime = new Date(b.created_at || b.starts_at || 0).getTime();
    return bTime - aTime;
  })[0];
};

const ClubDeLectura = () => {
  const { t } = useTranslation('public');
  const { authState, authInitialized } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeClub, setActiveClub] = useState(null);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!authInitialized) return undefined;
    let cancelled = false;
    setClubsLoading(true);
    bookClubsApi
      .listClubs()
      .then((clubs) => {
        if (!cancelled) setActiveClub(pickLatestActiveClub(clubs));
      })
      .catch(() => {
        if (!cancelled) setActiveClub(null);
      })
      .finally(() => {
        if (!cancelled) setClubsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authInitialized, authState.isAuthenticated]);

  const handleEnterClub = async () => {
    if (!activeClub) return;
    setJoining(true);
    try {
      if (authState.isAuthenticated && !activeClub.is_member) {
        await bookClubsApi.joinClub(activeClub.slug);
      }
      navigate(`/club-de-lectura/${activeClub.slug}`);
    } catch {
      // Layout shows the email gate if join fails for guests / outsiders.
      navigate(`/club-de-lectura/${activeClub.slug}`);
    } finally {
      setJoining(false);
    }
  };

  const ctaLabel = (() => {
    if (joining) return t('club.entering');
    if (!authState.isAuthenticated) return t('club.enter');
    if (activeClub?.is_member) return t('club.goToHub');
    return t('club.join');
  })();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#0d0d0d',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: { xs: 2, md: 4 },
        px: { xs: 2, md: 4 },
      }}
    >
      <Box
        component="img"
        src="/images/club-de-lectura.png"
        alt={t('club.imageAlt')}
        sx={{
          width: '100%',
          maxWidth: 1200,
          height: 'auto',
          borderRadius: 1,
          mb: 3,
        }}
      />

      <Box sx={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
        {clubsLoading ? (
          <CircularProgress size={28} sx={{ color: CLUB_ACCENT }} />
        ) : activeClub ? (
          <>
            <Typography
              variant="h5"
              component="h1"
              sx={{ color: '#fff', fontWeight: 700, mb: 1.5 }}
            >
              {t('club.started')}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
              {t('club.cycleStarted', { title: activeClub.title })}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.65)', mb: 3 }}>
              {t('club.stillJoin')}
            </Typography>

            <Button
              variant="contained"
              onClick={handleEnterClub}
              disabled={joining}
              sx={{
                bgcolor: CLUB_ACCENT,
                '&:hover': { bgcolor: CLUB_ACCENT_HOVER },
                textTransform: 'none',
                fontWeight: 600,
                py: 1.2,
                mb: 1.5,
              }}
              fullWidth
            >
              {ctaLabel}
            </Button>

            {!authState.isAuthenticated && (
              <Button
                component={RouterLink}
                to={`/profiles/login?next=${encodeURIComponent(
                  `/club-de-lectura/${activeClub.slug}`
                )}`}
                sx={{ color: CLUB_ACCENT, textTransform: 'none' }}
              >
                {t('club.login')}
              </Button>
            )}
          </>
        ) : (
          <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
            {t('club.none')}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ClubDeLectura;
