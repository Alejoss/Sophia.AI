import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import contentApi from '../api/contentApi';
import { AuthContext } from '../context/AuthContext';
import { getTopicContentPath } from '../utils/urlUtils';

const formatMs = (ms) => {
  if (ms == null || Number.isNaN(Number(ms))) return '';
  const totalSec = Math.max(0, Math.floor(Number(ms) / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const ContentTranscriptPage = () => {
  const { contentId } = useParams();
  const [searchParams] = useSearchParams();
  const { authState } = useContext(AuthContext);
  const context = searchParams.get('context') || 'library';
  const topicId = searchParams.get('topicId');
  const currentUserId = authState?.user?.id;

  const [content, setContent] = useState(null);
  const [transcript, setTranscript] = useState(undefined);
  const [error, setError] = useState(null);
  const [copyLabel, setCopyLabel] = useState('Copiar texto');

  const backPath = useMemo(() => {
    if (context === 'topic' && topicId) {
      return getTopicContentPath(contentId, topicId);
    }
    if (context === 'search') {
      return `/content/search/${contentId}`;
    }
    return `/content/${contentId}/library`;
  }, [contentId, context, topicId]);

  const backLabel = useMemo(() => {
    if (context === 'topic') return 'Volver al contenido del tema';
    if (context === 'search') return 'Volver al contenido';
    return 'Volver al contenido';
  }, [context]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setError(null);
      setTranscript(undefined);
      setContent(null);

      try {
        let detailContext = null;
        let detailContextId = null;
        if (context === 'topic' && topicId) {
          detailContext = 'topic';
          detailContextId = topicId;
        } else if (context === 'library' && currentUserId) {
          detailContext = 'library';
          detailContextId = currentUserId;
        }

        const [contentData, transcriptData] = await Promise.all([
          contentApi.getContentDetails(
            contentId,
            detailContext,
            detailContextId,
          ).catch(() => null),
          contentApi.getContentTranscript(contentId),
        ]);

        if (cancelled) return;

        setContent(contentData);
        if (!transcriptData) {
          setTranscript(null);
          setError('Este contenido aún no tiene transcripción.');
          return;
        }
        setTranscript(transcriptData);
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading transcript page:', err);
        setError('No se pudo cargar la transcripción.');
        setTranscript(null);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [contentId, context, topicId, currentUserId]);

  const title =
    content?.selected_profile?.title ||
    content?.original_title ||
    `Contenido ${contentId}`;

  const handleCopy = async () => {
    if (!transcript?.text) return;
    try {
      await navigator.clipboard.writeText(transcript.text);
      setCopyLabel('Copiado');
      setTimeout(() => setCopyLabel('Copiar texto'), 1800);
    } catch {
      setCopyLabel('No se pudo copiar');
      setTimeout(() => setCopyLabel('Copiar texto'), 1800);
    }
  };

  if (transcript === undefined) {
    return (
      <Container maxWidth="md" sx={{ pt: 12, pb: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  const segments = Array.isArray(transcript?.segments) ? transcript.segments : [];
  const hasSegments = segments.length > 0;

  return (
    <Container maxWidth="md" sx={{ pt: { xs: 8, md: 12 }, pb: 6 }}>
      <Button
        component={RouterLink}
        to={backPath}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2, textTransform: 'none' }}
      >
        {backLabel}
      </Button>

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
          <SubtitlesIcon color="primary" sx={{ mt: 0.5 }} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary">
              Transcripción
            </Typography>
            <Typography variant="h5" component="h1" sx={{ wordBreak: 'break-word' }}>
              {title}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
              {transcript?.language && (
                <Chip size="small" label={String(transcript.language).toUpperCase()} />
              )}
              {transcript?.text_length != null && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${Number(transcript.text_length).toLocaleString()} caracteres`}
                />
              )}
              {hasSegments && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${segments.length} segmentos`}
                />
              )}
            </Box>
          </Box>
          {transcript?.text && (
            <Tooltip title={copyLabel}>
              <IconButton onClick={handleCopy} aria-label="Copiar transcripción">
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {error && (
          <Typography color="error" sx={{ py: 4 }}>
            {error}
          </Typography>
        )}

        {!error && hasSegments && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              pt: 1,
            }}
          >
            {segments.map((segment, index) => (
              <Box
                key={`${segment.index ?? index}-${segment.start_ms ?? index}`}
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  alignItems: 'flex-start',
                  py: 0.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="caption"
                  color="primary"
                  sx={{
                    minWidth: 52,
                    pt: 0.25,
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}
                >
                  {formatMs(segment.start_ms)}
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', pb: 1 }}>
                  {segment.text}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {!error && !hasSegments && transcript?.text && (
          <Typography
            variant="body1"
            sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, pt: 1 }}
          >
            {transcript.text}
          </Typography>
        )}
      </Paper>
    </Container>
  );
};

export default ContentTranscriptPage;
