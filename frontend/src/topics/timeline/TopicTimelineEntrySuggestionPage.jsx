import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Breadcrumbs,
  CircularProgress,
  Link as MuiLink,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import contentApi from '../../api/contentApi';
import { useAuth } from '../../context/AuthContext';
import { parseApiValidationErrors } from '../../utils/apiFormErrors';
import { getTopicDetailPath, TOPIC_TABS } from '../../utils/urlUtils';
import TopicTimelineEntrySuggestionForm from './TopicTimelineEntrySuggestionForm';

const TopicTimelineEntrySuggestionPage = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('topics');
  const { user, isAuthenticated } = useAuth();

  const [topicTitle, setTopicTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [canSuggest, setCanSuggest] = useState(false);

  const timelineUrl = useMemo(
    () => getTopicDetailPath(topicId, TOPIC_TABS.TIMELINE),
    [topicId],
  );

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const topicData = await contentApi.getTopicDetails(topicId, { include_contents: false });

      setTopicTitle(topicData?.title || '');

      const creatorId = typeof topicData?.creator === 'object'
        ? topicData.creator?.id
        : topicData?.creator;
      const userId = user?.id;
      const isCreator = isAuthenticated
        && creatorId != null
        && userId != null
        && String(creatorId) === String(userId);
      const isModerator = (topicData?.moderators || []).some(
        (mod) => String(mod?.id ?? mod) === String(userId),
      );
      const allowed = isAuthenticated && !isCreator && !isModerator;
      setCanSuggest(allowed);

      if (!allowed) {
        setLoadError(t('timeline.suggestOnly'));
      }
    } catch (err) {
      const { generalError } = parseApiValidationErrors(err, t('timeline.loadTopicError'));
      setLoadError(generalError);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, topicId, user?.id, t]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const handleCancel = () => {
    navigate(timelineUrl);
  };

  const handleSubmit = async (payload) => {
    setSaving(true);
    try {
      await contentApi.createTopicTimelineEntrySuggestion(topicId, payload);
      navigate(timelineUrl);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack alignItems="center" spacing={1.5} sx={{ py: 8 }}>
        <CircularProgress size={28} />
        <Typography color="text.secondary">{t('timeline.loadingForm')}</Typography>
      </Stack>
    );
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', py: { xs: 2, sm: 3 }, px: { xs: 2, sm: 3 } }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <MuiLink component={RouterLink} to="/content/topics" underline="hover" color="inherit">
          {t('list.title')}
        </MuiLink>
        <MuiLink component={RouterLink} to={`/content/topics/${topicId}`} underline="hover" color="inherit">
          {topicTitle || t('user.topicFallback')}
        </MuiLink>
        <MuiLink component={RouterLink} to={timelineUrl} underline="hover" color="inherit">
          {t('timeline.title')}
        </MuiLink>
        <Typography color="text.primary">{t('timeline.suggestEntry')}</Typography>
      </Breadcrumbs>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <ArrowBackIcon fontSize="small" color="action" />
        <MuiLink
          component={RouterLink}
          to={timelineUrl}
          underline="hover"
          color="text.secondary"
          variant="body2"
        >
          {t('timeline.backToTimeline')}
        </MuiLink>
      </Stack>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        {t('timeline.suggestEntryPage')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {topicTitle ? t('timeline.topicLine', { title: topicTitle }) : ''}
      </Typography>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      {canSuggest && !loadError && (
        <TopicTimelineEntrySuggestionForm
          saving={saving}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
        />
      )}
    </Box>
  );
};

export default TopicTimelineEntrySuggestionPage;
