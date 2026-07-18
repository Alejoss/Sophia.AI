import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import contentApi from '../api/contentApi';
import TopicTimeline from '../topics/timeline/TopicTimeline';
import { useBookClub } from './BookClubLayout';
import { CLUB_ACCENT, CLUB_ACCENT_HOVER, CLUB_BG } from './clubTheme';

// TopicTimeline colors dots/chips with `primary` from the ambient MUI theme
// (indigo). Re-theme it locally so everything uses the club accent instead.
const clubTimelineTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: CLUB_ACCENT },
    background: { default: CLUB_BG, paper: '#161616' },
    divider: 'rgba(255,255,255,0.12)',
  },
});

const MEDIA_TYPES = [
  { key: 'VIDEO', label: 'Videos' },
  { key: 'IMAGE', label: 'Imágenes' },
  { key: 'AUDIO', label: 'Podcasts' },
  { key: 'TEXT', label: 'Textos' },
];

const emptyCounts = { VIDEO: 0, IMAGE: 0, AUDIO: 0, TEXT: 0 };

const BookClubInvestigation = () => {
  const { hub, club, isAuthenticated, isGuest } = useBookClub();
  const topicId = hub?.quick_links?.topic_id ?? club?.topic ?? null;

  const [topic, setTopic] = useState(null);
  const [counts, setCounts] = useState(emptyCounts);
  const [loadingMeta, setLoadingMeta] = useState(Boolean(topicId));
  const [metaError, setMetaError] = useState('');

  useEffect(() => {
    if (!topicId) {
      setTopic(null);
      setCounts(emptyCounts);
      setLoadingMeta(false);
      setMetaError('');
      return;
    }
    if (!isAuthenticated) {
      setLoadingMeta(false);
      setMetaError('');
      return;
    }

    let cancelled = false;
    setLoadingMeta(true);
    setMetaError('');

    const load = async () => {
      try {
        const [basic, ...countResponses] = await Promise.all([
          contentApi.getTopicBasicDetails(topicId),
          ...MEDIA_TYPES.map((m) =>
            contentApi.getTopicContentByType(topicId, m.key, { page: 1, page_size: 1 })
          ),
        ]);
        if (cancelled) return;
        setTopic(basic);
        const next = { ...emptyCounts };
        MEDIA_TYPES.forEach((m, i) => {
          const data = countResponses[i];
          next[m.key] = data?.count ?? (data?.contents || []).length ?? 0;
        });
        setCounts(next);
      } catch (err) {
        if (!cancelled) {
          setMetaError(
            err?.response?.data?.detail ||
              err?.response?.data?.error ||
              'No se pudo cargar el tema de investigación.'
          );
        }
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [topicId, isAuthenticated]);

  if (!topicId) {
    return (
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Investigación
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
            Aquí verás la línea de tiempo y el material del tema vinculado a este ciclo.
          </Typography>
        </Box>
        <Alert severity="info" sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }}>
          Este club todavía no tiene un tema de investigación vinculado. El equipo lo asignará
          desde Conexiones en el panel de administración.
        </Alert>
      </Stack>
    );
  }

  if (!isAuthenticated) {
    return (
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Investigación
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
            Inicia sesión o crea tu cuenta para ver la línea de tiempo y el material del tema.
          </Typography>
        </Box>
        <Alert severity="info" sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }}>
          {isGuest
            ? 'Estás en modo invitado. Crea tu cuenta para explorar la investigación del club.'
            : 'Necesitas una cuenta para ver esta sección.'}
        </Alert>
        <Button
          variant="contained"
          component={RouterLink}
          to={`/profiles/login?next=${encodeURIComponent(
            `/club-de-lectura/${hub?.club?.slug || ''}/investigacion`
          )}`}
          sx={{ alignSelf: 'flex-start', bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
        >
          Iniciar sesión
        </Button>
      </Stack>
    );
  }

  const topicUrl = `/content/topics/${topicId}?tab=timeline`;

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
        spacing={2}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="overline" sx={{ color: CLUB_ACCENT, fontWeight: 700 }}>
            Investigación
          </Typography>
          {loadingMeta ? (
            <CircularProgress size={22} sx={{ color: CLUB_ACCENT, mt: 1 }} />
          ) : (
            <>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                {topic?.title || 'Tema del club'}
              </Typography>
              {topic?.description && (
                <Typography sx={{ color: 'rgba(255,255,255,0.65)', mt: 1, maxWidth: 640 }}>
                  {topic.description}
                </Typography>
              )}
            </>
          )}
        </Box>
        <Button
          variant="outlined"
          component="a"
          href={topicUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            borderColor: CLUB_ACCENT,
            color: CLUB_ACCENT,
            whiteSpace: 'nowrap',
            '&:hover': { borderColor: CLUB_ACCENT_HOVER, bgcolor: 'rgba(255,107,53,0.08)' },
          }}
        >
          Ver detalles ↗
        </Button>
      </Stack>

      {metaError && (
        <Alert severity="error" onClose={() => setMetaError('')}>
          {metaError}
        </Alert>
      )}

      {!loadingMeta && !metaError && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
            gap: 1.5,
          }}
        >
          {MEDIA_TYPES.map((m) => (
            <Box
              key={m.key}
              sx={{
                p: 2,
                borderRadius: 1,
                border: '1px solid rgba(255,255,255,0.12)',
                bgcolor: 'rgba(255,255,255,0.03)',
              }}
            >
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, color: CLUB_ACCENT, lineHeight: 1.1 }}
              >
                {counts[m.key]}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mt: 0.5 }}>
                {m.label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box
        sx={{
          // Adapt TopicTimeline surfaces to the dark club chrome.
          '& .MuiTypography-root': { color: 'inherit' },
          '& .MuiTypography-colorTextSecondary, & .MuiTypography-body2': {
            color: 'rgba(255,255,255,0.6) !important',
          },
          '& .MuiPaper-root, & .MuiCard-root': {
            bgcolor: 'rgba(255,255,255,0.04)',
            color: '#fff',
            backgroundImage: 'none',
            borderColor: 'rgba(255,255,255,0.12)',
          },
          // Date pills: soft accent tint instead of a solid primary block.
          '& .MuiChip-filledPrimary': {
            bgcolor: 'rgba(255,107,53,0.16)',
            color: CLUB_ACCENT,
            '& .MuiChip-icon': { color: CLUB_ACCENT },
          },
          '& .MuiChip-outlined': {
            borderColor: 'rgba(255,107,53,0.45)',
            color: CLUB_ACCENT,
            '& .MuiChip-icon': { color: CLUB_ACCENT },
          },
          '& .MuiSvgIcon-colorPrimary': { color: `${CLUB_ACCENT} !important` },
          '& .MuiSvgIcon-colorDisabled': { color: 'rgba(255,255,255,0.35) !important' },
          '& .MuiCircularProgress-root': { color: CLUB_ACCENT },
          '& .MuiAlert-root': { color: '#fff' },
        }}
      >
        <ThemeProvider theme={clubTimelineTheme}>
          <TopicTimeline topicId={topicId} canEdit={false} canSuggest={false} />
        </ThemeProvider>
      </Box>
    </Stack>
  );
};

export default BookClubInvestigation;
