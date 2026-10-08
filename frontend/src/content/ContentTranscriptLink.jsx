import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDateLocales } from '../hooks/useDateLocales';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import contentApi from '../api/contentApi';

/**
 * Compact teaser on content detail pages. Links to the dedicated transcript page
 * without loading the full transcript body.
 *
 * @param {object} props
 * @param {string|number} props.contentId
 * @param {'library'|'topic'|'search'} [props.context='library']
 * @param {string|number} [props.topicId]
 */
const ContentTranscriptLink = ({ contentId, context = 'library', topicId = null }) => {
  const { t } = useTranslation('content');
  const { intl } = useDateLocales();
  const navigate = useNavigate();
  const [meta, setMeta] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    setMeta(undefined);

    if (!contentId) {
      setMeta(null);
      return undefined;
    }

    contentApi
      .getContentTranscript(contentId, { summary: true })
      .then((data) => {
        if (!cancelled) setMeta(data);
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      });

    return () => {
      cancelled = true;
    };
  }, [contentId]);

  const transcriptPath = useMemo(() => {
    const params = new URLSearchParams();
    if (context) params.set('context', context);
    if (topicId) params.set('topicId', String(topicId));
    const query = params.toString();
    return `/content/${contentId}/transcript${query ? `?${query}` : ''}`;
  }, [contentId, context, topicId]);

  if (meta === undefined) {
    return (
      <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">
          {t('transcriptLink.searching')}
        </Typography>
      </Box>
    );
  }

  if (!meta?.has_transcript) {
    return null;
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 3,
        p: 2,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <SubtitlesIcon color="primary" />
      <Box sx={{ flexGrow: 1, minWidth: 180 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {t('transcriptLink.available')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
          {meta.language && (
            <Chip size="small" label={String(meta.language).toUpperCase()} />
          )}
          {meta.text_length != null && (
            <Chip
              size="small"
              variant="outlined"
              label={t('charCount', { value: Number(meta.text_length).toLocaleString(intl) })}
            />
          )}
          {meta.segment_count > 0 ? (
            <Chip
              size="small"
              variant="outlined"
              label={t('segmentCountTimed', { count: meta.segment_count })}
            />
          ) : (
            <Chip size="small" variant="outlined" label={t('transcriptLink.continuous')} />
          )}
        </Box>
      </Box>
      <Button
        variant="contained"
        endIcon={<ArrowForwardIcon />}
        onClick={() => navigate(transcriptPath)}
        sx={{ textTransform: 'none' }}
      >
        {t('transcriptLink.view')}
      </Button>
    </Paper>
  );
};

export default ContentTranscriptLink;
