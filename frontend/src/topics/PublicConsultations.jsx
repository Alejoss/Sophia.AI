import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Link,
  CircularProgress,
  Alert,
  Collapse,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import VoteComponent from '../votes/VoteComponent';
import { getTopicContentPath } from '../utils/urlUtils';
import { useDateLocales } from '../hooks/useDateLocales';

function formatQueryDate(iso, intl) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(intl, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function SourcesList({ sources, topicId }) {
  const { t } = useTranslation('topics');
  if (!sources?.length) return null;
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        {t('chat.sources')}
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.25, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {sources.map((src) => {
          let sourceTo = null;
          if (src.content_id) {
            if (src.media_type === 'TEXT') {
              sourceTo = topicId
                ? getTopicContentPath(src.content_id, topicId)
                : `/content/${src.content_id}/library`;
            } else {
              sourceTo = `/content/${src.content_id}/transcript?context=topic${
                topicId ? `&topicId=${topicId}` : ''
              }`;
            }
          } else {
            sourceTo = src.url || src.transcript_url;
          }
          return (
            <Box component="li" key={`${src.index}-${src.content_id}-${src.chunk_index}`}>
              <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                [{src.index}]{' '}
                {sourceTo ? (
                  <Link component={RouterLink} to={sourceTo} underline="hover">
                    {src.title || t('chat.contentId', { id: src.content_id })}
                  </Link>
                ) : (
                  src.title || t('chat.source', { index: src.index })
                )}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function PublicConsultationCard({ item, topicId, onUnpin, unpinning }) {
  const { t } = useTranslation('topics');
  const { intl } = useDateLocales();
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        px: { xs: 1.5, sm: 2.5 },
        py: 2,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary">
          {t('chat.pinnedBy', { name: item.author_username })}
          {item.pinned_at ? ` · ${formatQueryDate(item.pinned_at, intl)}` : ''}
        </Typography>
        <VoteComponent
          type="consultation"
          ids={{ topicId, queryId: item.id }}
          initialVoteCount={item.vote_count || 0}
          initialUserVote={item.user_vote || 0}
        />
      </Box>
      <Typography variant="body1" sx={{ mt: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {item.question}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.65 }}>
        {item.answer}
      </Typography>
      <SourcesList sources={item.sources} topicId={topicId} />
      {item.can_unpin && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
          <Button
            size="small"
            color="inherit"
            onClick={() => onUnpin(item.id)}
            disabled={unpinning}
          >
            {t('chat.unpin')}
          </Button>
        </Box>
      )}
    </Box>
  );
}

/**
 * Consultations an author pinned to one or more texts in this topic.
 * Pass contentId to show only pins on that text. showEmpty renders the
 * empty state; the transcript page omits the section when nothing is pinned.
 */
function PublicConsultations({ topicId, contentId = null, showEmpty = true }) {
  const { t } = useTranslation('topics');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unpinning, setUnpinning] = useState(false);

  const load = useCallback(async () => {
    if (!topicId) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await contentApi.listPublicTopicChatQueries(topicId, {
        contentId: contentId || undefined,
      });
      const results = data.results || [];
      setItems(results);
      setTotal(typeof data.count === 'number' ? data.count : results.length);
    } catch {
      setItems([]);
      setTotal(null);
      setError(t('chat.communityLoadError'));
    } finally {
      setLoading(false);
    }
  }, [topicId, contentId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const unpin = async (queryId) => {
    setUnpinning(true);
    setError(null);
    try {
      await contentApi.unpinTopicChatQuery(topicId, queryId);
      await load();
    } catch {
      setError(t('chat.unpinError'));
    } finally {
      setUnpinning(false);
    }
  };

  if (!loading && !error && items.length === 0 && !showEmpty) {
    return null;
  }

  const panelId = `pinned-consultations-${topicId}${contentId ? `-${contentId}` : ''}`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box
        component="button"
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls={panelId}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          width: '100%',
          p: 0,
          border: 'none',
          bgcolor: 'transparent',
          color: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2">{t('chat.communityTitle')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('chat.communityHelp')}
            {typeof total === 'number' && (
              <Box component="span" sx={{ fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap' }}>
                {` · ${t('chat.communityCount', { count: total })}`}
              </Box>
            )}
          </Typography>
        </Box>
        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>
      {error && (
        <Alert severity="error" sx={{ borderRadius: 0 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box id={panelId} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                {t('chat.communityLoading')}
              </Typography>
            </Box>
          )}
          {!loading && !error && items.length === 0 && showEmpty && (
            <Typography variant="body2" color="text.secondary">
              {t('chat.communityEmpty')}
            </Typography>
          )}
          {!loading && items.map((item) => (
            <PublicConsultationCard
              key={item.id}
              item={item}
              topicId={topicId}
              onUnpin={unpin}
              unpinning={unpinning}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

export default PublicConsultations;
