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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import { useDateLocales } from '../hooks/useDateLocales';
import { AuthContext } from '../context/AuthContext';
import { getTopicContentPath } from '../utils/urlUtils';
import ContentBitcoinAnchor from './ContentBitcoinAnchor';

export const formatMs = (ms) => {
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

export const plainTextFromSegments = (segments) =>
  (Array.isArray(segments) ? segments : [])
    .map((segment) => (segment?.text || '').trim())
    .filter(Boolean)
    .join(' ');

const ContentTranscriptPage = () => {
  const { t } = useTranslation('content');
  const { intl } = useDateLocales();
  const { contentId } = useParams();
  const [searchParams] = useSearchParams();
  const { authState } = useContext(AuthContext);
  const context = searchParams.get('context') || 'library';
  const topicId = searchParams.get('topicId');
  const currentUserId = authState?.user?.id;

  const [content, setContent] = useState(null);
  const [transcript, setTranscript] = useState(undefined);
  const [error, setError] = useState(null);
  const [copyState, setCopyState] = useState('idle');
  /** 'timed' | 'plain' — only meaningful when segments exist. */
  const [viewMode, setViewMode] = useState('plain');

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
    if (context === 'topic') return t('transcript.backTopic');
    return t('transcript.backContent');
  }, [context, t]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setError(null);
      setTranscript(undefined);
      setContent(null);
      setViewMode('plain');

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
          setError(t('transcript.missing'));
          return;
        }
        setTranscript(transcriptData);
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading transcript page:', err);
        setError(t('transcript.loadError'));
        setTranscript(null);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [contentId, context, topicId, currentUserId, t]);

  const title =
    content?.selected_profile?.title ||
    content?.original_title ||
    t('common.contentWithId', { id: contentId });

  const segments = Array.isArray(transcript?.segments) ? transcript.segments : [];
  const hasSegments = segments.length > 0;
  const plainText = useMemo(() => {
    if (transcript?.text) return transcript.text;
    if (hasSegments) return plainTextFromSegments(segments);
    return '';
  }, [transcript?.text, hasSegments, segments]);

  const showTimed = hasSegments && viewMode === 'timed';
  const charCount = transcript?.text_length ?? plainText.length;

  const handleCopy = async () => {
    if (!plainText) return;
    try {
      await navigator.clipboard.writeText(plainText);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('failed');
      setTimeout(() => setCopyState('idle'), 1800);
    }
  };

  const copyLabel = copyState === 'copied'
    ? t('transcript.copied')
    : copyState === 'failed'
      ? t('transcript.copyFailed')
      : t('transcript.copy');

  if (transcript === undefined) {
    return (
      <Container maxWidth="md" sx={{ pt: 12, pb: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

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
              {t('transcript.heading')}
            </Typography>
            <Typography variant="h5" component="h1" sx={{ wordBreak: 'break-word' }}>
              {title}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
              {transcript?.language && (
                <Chip size="small" label={String(transcript.language).toUpperCase()} />
              )}
              {charCount > 0 && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('charCount', { value: Number(charCount).toLocaleString(intl) })}
                />
              )}
              {hasSegments ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('segmentCount', { value: segments.length })}
                />
              ) : (
                !error &&
                plainText && (
                  <Chip size="small" variant="outlined" label={t('transcript.continuous')} />
                )
              )}
            </Box>
          </Box>
          {plainText && (
            <Tooltip title={copyLabel}>
              <IconButton onClick={handleCopy} aria-label={t('transcript.copyAria')}>
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {!error && (
          <Box sx={{ mb: 2 }}>
            <ContentBitcoinAnchor contentId={contentId} />
          </Box>
        )}

        {error && (
          <Typography color="error" sx={{ py: 4 }}>
            {error}
          </Typography>
        )}

        {!error && hasSegments && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              mb: 1.5,
            }}
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={viewMode}
              onChange={(_, next) => {
                if (next) setViewMode(next);
              }}
              aria-label={t('transcript.viewModeAria')}
            >
              <ToggleButton value="timed" sx={{ textTransform: 'none', px: 1.5 }}>
                {t('transcript.withTimes')}
              </ToggleButton>
              <ToggleButton value="plain" sx={{ textTransform: 'none', px: 1.5 }}>
                {t('transcript.continuous')}
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}

        {!error && showTimed && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              pt: 0.5,
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

        {!error && plainText && transcript?.text_hash && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, mt: showTimed ? 0 : 0 }}>
            {t('transcript.hashBefore')}{' '}
            <Box component="span" sx={{ fontFamily: 'ui-monospace, monospace' }}>text_hash</Box>
            {' '}{t('transcript.hashAfter')}
          </Typography>
        )}

        {!error && !showTimed && plainText && (
          <Typography
            variant="body1"
            sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, pt: 0.5 }}
          >
            {plainText}
          </Typography>
        )}

      </Paper>
    </Container>
  );
};

export default ContentTranscriptPage;
