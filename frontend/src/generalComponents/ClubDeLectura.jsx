import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { AuthContext } from '../context/AuthContext';
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
    if (joining) return 'Entrando…';
    if (!authState.isAuthenticated) return 'Entrar al club';
    if (activeClub?.is_member) return 'Ir al hub del club';
    return 'Unirme al club';
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
        alt="Club de Lectura — Seminario Cypherpunk. El secuestro de Bitcoin de Roger Ver y Steve Patterson."
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
              El Club de Lectura ya comenzó
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
              El ciclo «{activeClub.title}» inició el 20 de Julio.
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.65)', mb: 3 }}>
              Todavía puedes unirte: entra al hub para sumarte a las misiones, el foro y la
              comunidad.
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
                ¿Ya tienes cuenta? Inicia sesión
              </Button>
            )}
          </>
        ) : (
          <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
            Por ahora no hay un ciclo activo publicado. Vuelve pronto.
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ClubDeLectura;
