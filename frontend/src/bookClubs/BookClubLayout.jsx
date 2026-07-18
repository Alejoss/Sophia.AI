import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, NavLink, Outlet, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import createThemeConfig from '../theme/theme';
import { AuthContext } from '../context/AuthContext';
import GoogleOAuthInitializer from '../components/GoogleOAuthInitializer';
import SocialLogin from '../components/SocialLogin';
import bookClubsApi from '../api/bookClubsApi';
import { CLUB_ACCENT, CLUB_ACCENT_HOVER, CLUB_BG, CLUB_TEXT_FIELD_SX, formatClubDateRange } from './clubTheme';
import { resolveWeekLabel, shortTagline } from './clubExperience';
import {
  clearGuestSession,
  getGuestSession,
  guestCompleteAccountUrl,
  setGuestSession,
} from './guestStorage';

export const BookClubContext = createContext(null);

export const useBookClub = () => {
  const ctx = useContext(BookClubContext);
  if (!ctx) throw new Error('useBookClub must be used within BookClubLayout');
  return ctx;
};

const NAV_ITEMS = [
  { to: '.', end: true, label: 'Inicio' },
  { to: 'misiones', label: 'Misiones' },
  { to: 'foro', label: 'Foro' },
  { to: 'comunidad', label: 'Comunidad' },
  { to: 'reuniones', label: 'Reuniones' },
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

const EmailGate = ({ clubTitle, clubSlug, onSubmit, loading, error }) => {
  const [email, setEmail] = useState('');
  const clubPath = clubSlug ? `/club-de-lectura/${clubSlug}` : window.location.pathname;
  const loginNext = encodeURIComponent(clubPath);

  return (
    <Box sx={{ bgcolor: CLUB_BG, minHeight: '100vh', color: '#fff', py: 8 }}>
      <Container maxWidth="sm">
        <Typography
          variant="overline"
          sx={{ color: CLUB_ACCENT, letterSpacing: 2, fontWeight: 700 }}
        >
          Club de Lectura
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, mb: 1 }}>
          {clubTitle || 'Entra al club'}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
          Deja tu correo para explorar el club en solo lectura, o regístrate con Google para
          participar de inmediato. Con el correo te enviaremos un enlace para crear tu cuenta.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Stack
          component="form"
          spacing={2}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(email.trim());
          }}
        >
          <TextField
            type="email"
            required
            fullWidth
            label="Tu correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            sx={CLUB_TEXT_FIELD_SX}
          />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !email.trim()}
              sx={{
                flex: 1,
                bgcolor: CLUB_ACCENT,
                '&:hover': { bgcolor: CLUB_ACCENT_HOVER },
                py: 1.1,
              }}
            >
              {loading ? 'Entrando…' : 'Entrar con mi correo'}
            </Button>
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.45)',
                textAlign: 'center',
                px: { sm: 0.5 },
                display: { xs: 'none', sm: 'block' },
              }}
            >
              o
            </Typography>
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                justifyContent: { xs: 'stretch', sm: 'flex-start' },
                '& > div': { width: '100%', margin: 0 },
                '& iframe, & div[role="button"]': { width: '100% !important' },
              }}
            >
              <GoogleOAuthInitializer>
                <SocialLogin redirectTo={clubPath} text="signup_with" />
              </GoogleOAuthInitializer>
            </Box>
          </Stack>
          <Typography
            variant="body2"
            sx={{ color: 'rgba(255,255,255,0.45)', display: { xs: 'block', sm: 'none' }, textAlign: 'center' }}
          >
            — o regístrate con Google arriba —
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)' }}>
            ¿Ya tienes cuenta?{' '}
            <Box
              component={RouterLink}
              to={`/profiles/login?next=${loginNext}`}
              sx={{ color: CLUB_ACCENT }}
            >
              Inicia sesión
            </Box>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
};

// The club always renders on a dark background, regardless of the user's
// global light/dark preference, so it needs its own dark MUI theme (otherwise
// Typography defaults to the light theme's near-black text.primary).
const clubDarkTheme = createTheme(createThemeConfig('dark'));

const BookClubLayoutInner = () => {
  const { slug } = useParams();
  const { authState, authInitialized } = useContext(AuthContext);
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gateError, setGateError] = useState('');
  const [gateLoading, setGateLoading] = useState(false);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [guestToken, setGuestToken] = useState(() => getGuestSession(slug)?.token || null);

  const isAuthenticated = Boolean(authState.isAuthenticated);

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const session = getGuestSession(slug);
      const token = isAuthenticated ? null : session?.token || guestToken;
      const data = await bookClubsApi.getHub(slug, { guestToken: token || undefined });
      setHub(data);
      setNeedsEmail(false);
      if (isAuthenticated) {
        clearGuestSession(slug);
        setGuestToken(null);
        if (!data.is_member) {
          try {
            await bookClubsApi.joinClub(slug);
            const refreshed = await bookClubsApi.getHub(slug);
            setHub(refreshed);
          } catch {
            /* join may fail if closed; hub still useful for staff */
          }
        }
      }
    } catch (err) {
      const code = err?.response?.data?.code;
      const detail = err?.response?.data?.detail || 'No se pudo cargar el club.';
      if (code === 'email_required' || err?.response?.status === 401) {
        setNeedsEmail(true);
        setHub(null);
        if (code === 'guest_token_invalid') {
          clearGuestSession(slug);
          setGuestToken(null);
          setGateError(detail);
        }
      } else {
        setError(detail);
        setHub(null);
      }
    } finally {
      setLoading(false);
    }
  }, [slug, isAuthenticated, guestToken]);

  useEffect(() => {
    if (!authInitialized) return;
    loadHub();
  }, [authInitialized, loadHub]);

  const handleEmailSubmit = async (email) => {
    setGateLoading(true);
    setGateError('');
    try {
      const data = await bookClubsApi.requestGuestAccess(slug, email);
      setGuestSession(slug, { token: data.guest_token, email: data.email });
      setGuestToken(data.guest_token);
      setNeedsEmail(false);
      const hubData = await bookClubsApi.getHub(slug, { guestToken: data.guest_token });
      setHub(hubData);
    } catch (err) {
      setGateError(err?.response?.data?.detail || 'No se pudo registrar el correo.');
    } finally {
      setGateLoading(false);
    }
  };

  const ctx = useMemo(
    () => ({
      slug,
      hub,
      club: hub?.club,
      guestToken: isAuthenticated ? null : guestToken,
      isGuest: Boolean(hub?.is_guest),
      canParticipate: Boolean(hub?.can_participate),
      reload: loadHub,
      setError,
    }),
    [slug, hub, guestToken, isAuthenticated, loadHub]
  );

  if (!authInitialized || loading) {
    return (
      <Box sx={{ bgcolor: CLUB_BG, minHeight: '100vh', display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: CLUB_ACCENT }} />
      </Box>
    );
  }

  if (needsEmail && !isAuthenticated) {
    return (
      <EmailGate
        clubTitle={hub?.club?.title}
        clubSlug={slug}
        onSubmit={handleEmailSubmit}
        loading={gateLoading}
        error={gateError}
      />
    );
  }

  if (error && !hub) {
    return (
      <Box sx={{ bgcolor: CLUB_BG, minHeight: '100vh', color: '#fff', py: 8 }}>
        <Container maxWidth="sm">
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button component={RouterLink} to="/club-de-lectura" sx={{ color: CLUB_ACCENT }}>
            Volver
          </Button>
        </Container>
      </Box>
    );
  }

  if (!hub) {
    return (
      <EmailGate
        clubTitle=""
        clubSlug={slug}
        onSubmit={handleEmailSubmit}
        loading={gateLoading}
        error={gateError || error}
      />
    );
  }

  const club = hub.club;
  const week = resolveWeekLabel({ club, progress: hub.progress });
  const tagline = shortTagline(club.description);
  const coverUrl = club.cover_image;
  const cycleDates = formatClubDateRange(club.starts_at, club.ends_at);
  const showGuestBanner = hub.is_guest && !hub.can_participate;
  const completeUrl = guestToken
    ? guestCompleteAccountUrl(slug, guestToken)
    : `/profiles/register?next=${encodeURIComponent(`/club-de-lectura/${slug}`)}`;

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

            {showGuestBanner && (
              <Alert
                severity="info"
                sx={{
                  mb: 2,
                  bgcolor: 'rgba(255,107,53,0.12)',
                  color: '#fff',
                  border: '1px solid rgba(255,107,53,0.35)',
                }}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    component={RouterLink}
                    to={completeUrl}
                    sx={{ fontWeight: 700, color: CLUB_ACCENT }}
                  >
                    Crear cuenta
                  </Button>
                }
              >
                Estás explorando en solo lectura
                {hub.guest_email ? ` (${hub.guest_email})` : ''}. Para comentar, completar misiones y
                unirte de verdad, crea tu cuenta — te enviamos el enlace también por correo.
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
                {cycleDates && (
                  <Typography
                    variant="body2"
                    sx={{ color: 'rgba(255,255,255,0.55)', mt: 1, fontWeight: 600 }}
                  >
                    Ciclo: {cycleDates}
                  </Typography>
                )}
                {(hub.is_member || hub.is_guest) && (
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
          <Outlet />
        </Container>
      </Box>
    </BookClubContext.Provider>
  );
};

const BookClubLayout = () => (
  <MuiThemeProvider theme={clubDarkTheme}>
    <BookClubLayoutInner />
  </MuiThemeProvider>
);

export default BookClubLayout;
