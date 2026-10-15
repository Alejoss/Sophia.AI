import React, { useContext, useEffect, useMemo, useState } from 'react';
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
import { AuthContext } from '../context/AuthContext';
import TranscriptGenerationCheckout from '../payments/adapters/TranscriptGenerationCheckout';

/**
 * Compact teaser on content detail pages. Links to the dedicated transcript page
 * without loading the full transcript body. When there is no transcript, offers
 * a $1 generation that becomes public and is indexed for Consultas.
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
  const auth = useContext(AuthContext);
  const isAuthenticated = Boolean(auth?.authState?.isAuthenticated);
  const [meta, setMeta] = useState(undefined);
  const [offer, setOffer] = useState(undefined);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setMeta(undefined);
    setOffer(undefined);
    setStartError('');

    if (!contentId) {
      setMeta(null);
      setOffer(null);
      return undefined;
    }

    contentApi
      .getContentTranscript(contentId, { summary: true })
      .then((data) => {
        if (cancelled) return;
        setMeta(data);
        if (data?.has_transcript) {
          setOffer(null);
          return;
        }
        return contentApi.getTranscriptGeneration(contentId).then((generation) => {
          if (!cancelled) setOffer(generation);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setMeta(null);
          setOffer(null);
        }
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

  const reloadOffer = () => {
    if (!contentId) return;
    contentApi.getTranscriptGeneration(contentId).then(setOffer).catch(() => setOffer(null));
  };

  const startGeneration = async () => {
    if (!isAuthenticated) {
      const next = `${window.location.pathname}${window.location.search}`;
      navigate(`/profiles/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setStarting(true);
    setStartError('');
    try {
      const data = await contentApi.createTranscriptGeneration(contentId);
      setOffer(data);
      const id = data?.request?.id;
      if (data?.request?.status === 'pending_payment' && id != null) {
        setRequestId(id);
        setCheckoutOpen(true);
      }
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || t('transcriptLink.startError');
      setStartError(message);
    } finally {
      setStarting(false);
    }
  };

  const hasTranscript = Boolean(meta?.has_transcript);
  const waitingForOffer = meta !== undefined && !hasTranscript && offer === undefined;

  if (meta === undefined || waitingForOffer) {
    return (
      <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">
          {t('transcriptLink.searching')}
        </Typography>
      </Box>
    );
  }

  if (hasTranscript) {
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
  }

  const request = offer?.request;
  const queued = request?.status === 'queued';
  const awaitingOther = request?.status === 'pending_payment' && !request?.requester_is_me;
  const showPurchase = Boolean(offer?.can_request) || (request?.status === 'pending_payment' && request?.requester_is_me);

  if (!queued && !awaitingOther && !showPurchase) {
    return null;
  }

  const price = offer?.price_usd ?? 1;

  return (
    <>
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
        <Box sx={{ flexGrow: 1, minWidth: 220 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {queued ? t('transcriptLink.generating') : t('transcriptLink.generateTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {queued
              ? t('transcriptLink.generatingBody')
              : awaitingOther
                ? t('transcriptLink.awaitingOther')
                : t('transcriptLink.generateBody', { price })}
          </Typography>
          {startError && (
            <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
              {startError}
            </Typography>
          )}
        </Box>
        {showPurchase && (
          <Button
            variant="contained"
            disabled={starting}
            onClick={startGeneration}
            sx={{ textTransform: 'none' }}
          >
            {isAuthenticated
              ? (request?.requester_is_me
                ? t('transcriptLink.continuePayment')
                : t('transcriptLink.generateCta', { price }))
              : t('transcriptLink.loginToGenerate')}
          </Button>
        )}
      </Paper>
      {checkoutOpen && (
        <TranscriptGenerationCheckout
          open
          onClose={() => {
            setCheckoutOpen(false);
            reloadOffer();
          }}
          requestId={requestId}
          title={t('transcriptLink.checkoutTitle')}
          priceUsd={price}
          priceTokens={offer?.price_tokens ?? 100}
          tokenBalance={offer?.token_balance ?? 0}
          onPaid={() => {
            setCheckoutOpen(false);
            reloadOffer();
          }}
        />
      )}
    </>
  );
};

export default ContentTranscriptLink;
