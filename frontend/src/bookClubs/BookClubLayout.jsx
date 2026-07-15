import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, NavLink, Outlet, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import bookClubsApi from '../api/bookClubsApi';
import {
  CLUB_ACCENT,
  CLUB_ACCENT_HOVER,
  CLUB_BG,
} from './clubTheme';
import { resolveWeekLabel, shortTagline } from './clubExperience';

export const BookClubContext = createContext(null);

export const useBookClub = () => {
  const ctx = useContext(BookClubContext);
  if (!ctx) throw new Error('useBookClub must be used within BookClubLayout');
  return ctx;
};

const NAV_ITEMS = [
  { to: '.', end: true, label: 'Inicio' },
  { to: 'misiones', label: 'Misiones' },
  { to: 'preguntas', label: 'Debates' },
  { to: 'comunidad', label: 'Comunidad' },
  { to: 'reuniones', label: 'Reuniones' },
  { to: 'cuaderno', label: 'Mi cuaderno' },
];

const WeekDots = ({ total, completed }) => {
  const n = Math.min(Math.max(total || 0, 0), 16);
  if (!n) return null;
  return (
    <Stack direction="row" spacing={0.75} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
      {Array.from({ length: n }).map((_, i) => {
        const done = i < completed;
        const current = i === completed && completed < n;
        return (
          <Box
            key={i}
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: done ? CLUB_ACCENT : current ? 'transparent' : 'rgba(255,255,255,0.2)',
              border: current ? `2px solid ${CLUB_ACCENT}` : 'none',
            }}
          />
        );
      })}
    </Stack>
  );
};

const BookClubLayout = () => {
  const { slug } = useParams();
  const { authState, authInitialized } = useContext(AuthContext);
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await bookClubsApi.getHub(slug);
      setHub(data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo cargar el club.');
      setHub(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!authInitialized) return;
    if (!authState.isAuthenticated) {
      setLoading(false);
      setError('Inicia sesión para entrar al Club de Lectura.');
      return;
    }
    loadHub();
  }, [authInitialized, authState.isAuthenticated, loadHub]);

  const handleJoin = async () => {
    setJoining(true);
    setError('');
    try {
      await bookClubsApi.joinClub(slug);
      await loadHub();
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo unir al club.');
    } finally {
      setJoining(false);
    }
  };

  const ctx = useMemo(
    () => ({
      slug,
      hub,
      club: hub?.club,
      reload: loadHub,
      setError,
    }),
    [slug, hub, loadHub]
  );

  if (!authInitialized || loading) {
    return (
      <Box sx={{ bgcolor: CLUB_BG, minHeight: '100vh', display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: CLUB_ACCENT }} />
      </Box>
    );
  }

  if (!authState.isAuthenticated) {
    return (
      <Box sx={{ bgcolor: CLUB_BG, minHeight: '100vh', color: '#fff', py: 8 }}>
        <Container maxWidth="sm">
          <Alert severity="info" sx={{ mb: 2 }}>
            {error || 'Inicia sesión para acceder al Club de Lectura.'}
          </Alert>
          <Button
            variant="contained"
            component={RouterLink}
            to="/profiles/login"
            sx={{ bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
          >
            Iniciar sesión
          </Button>
        </Container>
      </Box>
    );
  }

  if (error && !hub) {
    return (
      <Box sx={{ bgcolor: CLUB_BG, minHeight: '100vh', color: '#fff', py: 8 }}>
        <Container maxWidth="sm">
          <Alert severity="error">{error}</Alert>
        </Container>
      </Box>
    );
  }

  const club = hub.club;
  const week = resolveWeekLabel({ club, progress: hub.progress });
  const tagline = shortTagline(club.description);
  const coverUrl = club.cover_image;

  return (
    <BookClubContext.Provider value={ctx}>
      <Box sx={{ bgcolor: CLUB_BG, minHeight: '100vh', color: '#fff' }}>
        <Box
          sx={{
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background:
              'radial-gradient(ellipse at 20% 0%, rgba(255,107,53,0.18), transparent 55%), #0d0d0d',
          }}
        >
          <Container maxWidth="md" sx={{ pt: { xs: 3, md: 4 }, pb: 0 }}>
            {error && (
              <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <Typography
              variant="overline"
              sx={{ color: CLUB_ACCENT, letterSpacing: 2, fontWeight: 700 }}
            >
              Club de Lectura
            </Typography>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2.5}
              alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
              sx={{ mt: 1.5, mb: 2 }}
            >
              <Box
                sx={{
                  width: { xs: 112, sm: 128 },
                  flexShrink: 0,
                  aspectRatio: '2 / 3',
                  borderRadius: 1,
                  overflow: 'hidden',
                  bgcolor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                }}
              >
                {coverUrl ? (
                  <Box
                    component="img"
                    src={coverUrl}
                    alt={`Portada de ${club.title}`}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <Box
                    sx={{
                      height: '100%',
                      display: 'flex',
                      alignItems: 'flex-end',
                      p: 1.5,
                      background:
                        'linear-gradient(160deg, rgba(255,107,53,0.35), rgba(20,20,20,0.9))',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                      {club.title}
                    </Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="h4"
                  component="h1"
                  sx={{ fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em' }}
                >
                  {club.title}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.65)', mt: 1, maxWidth: 520 }}>
                  {tagline}
                </Typography>
                {hub.is_member && (
                  <>
                    <Typography
                      variant="body2"
                      sx={{ color: 'rgba(255,255,255,0.5)', mt: 1.5, fontWeight: 600 }}
                    >
                      Semana {week.weekNum} de {week.weeksTotal}
                      {hub.club_pulse?.member_count
                        ? ` · ${hub.club_pulse.member_count} lectores`
                        : ''}
                    </Typography>
                    <WeekDots
                      total={hub.progress?.total_nodes || week.weeksTotal}
                      completed={hub.progress?.completed_nodes || 0}
                    />
                  </>
                )}

                {!hub.is_member && (
                  <Button
                    variant="contained"
                    onClick={handleJoin}
                    disabled={joining}
                    sx={{
                      mt: 2,
                      bgcolor: CLUB_ACCENT,
                      '&:hover': { bgcolor: CLUB_ACCENT_HOVER },
                    }}
                  >
                    {joining ? 'Uniéndote…' : 'Unirme al club'}
                  </Button>
                )}
              </Box>
            </Stack>

            <Stack
              direction="row"
              spacing={0}
              sx={{
                overflowX: 'auto',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                mt: 1,
                mx: { xs: -2, sm: 0 },
                px: { xs: 1, sm: 0 },
              }}
            >
              {NAV_ITEMS.map((item) => (
                <Box
                  key={item.label}
                  component={NavLink}
                  to={item.to}
                  end={item.end}
                  style={({ isActive }) => ({
                    color: isActive ? CLUB_ACCENT : 'rgba(255,255,255,0.7)',
                    borderBottom: isActive
                      ? `2px solid ${CLUB_ACCENT}`
                      : '2px solid transparent',
                    fontWeight: isActive ? 700 : 500,
                    textDecoration: 'none',
                  })}
                  sx={{
                    fontSize: '0.9rem',
                    letterSpacing: 0.3,
                    py: 1.25,
                    px: { xs: 1, sm: 1.5 },
                    whiteSpace: 'nowrap',
                    '&:hover': { color: `${CLUB_ACCENT} !important` },
                  }}
                >
                  {item.label}
                </Box>
              ))}
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="md" sx={{ py: { xs: 3, md: 4 } }}>
          {!hub.is_member ? (
            <Alert severity="info" sx={{ bgcolor: 'rgba(255,107,53,0.08)', color: '#fff' }}>
              Únete para seguir la lectura colectiva: misiones, debates, reuniones y tu cuaderno.
            </Alert>
          ) : (
            <Outlet />
          )}
        </Container>
      </Box>
    </BookClubContext.Provider>
  );
};

export default BookClubLayout;
