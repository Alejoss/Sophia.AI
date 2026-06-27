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
import contentApi from '../../api/contentApi';
import { useAuth } from '../../context/AuthContext';
import { getTopicDetailPath, TOPIC_TABS } from '../../utils/urlUtils';
import TopicTimelineEntrySuggestionForm from './TopicTimelineEntrySuggestionForm';

const getErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.error) return data.error;
  const firstKey = Object.keys(data)[0];
  const firstValue = firstKey ? data[firstKey] : null;
  if (Array.isArray(firstValue)) return firstValue.join(' ');
  if (typeof firstValue === 'string') return firstValue;
  return fallback;
};

const TopicTimelineEntrySuggestionPage = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [topicTitle, setTopicTitle] = useState('');
  const [availableContents, setAvailableContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [canSuggest, setCanSuggest] = useState(false);

  const timelineUrl = useMemo(
    () => getTopicDetailPath(topicId, TOPIC_TABS.TIMELINE),
    [topicId],
  );

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [topicData, contentsData] = await Promise.all([
        contentApi.getTopicDetails(topicId, { include_contents: false }),
        contentApi.getTopicDetailsSimple(topicId),
      ]);

      setTopicTitle(topicData?.title || '');
      setAvailableContents(contentsData?.contents || []);

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
        setError('Solo usuarios que no son moderadores pueden sugerir entradas de linea de tiempo.');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo cargar el tema.'));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, topicId, user?.id]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const handleCancel = () => {
    navigate(timelineUrl);
  };

  const handleSubmit = async (payload) => {
    try {
      setSaving(true);
      setFormError(null);
      await contentApi.createTopicTimelineEntrySuggestion(topicId, payload);
      navigate(timelineUrl);
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo enviar la sugerencia.'));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack alignItems="center" spacing={1.5} sx={{ py: 8 }}>
        <CircularProgress size={28} />
        <Typography color="text.secondary">Cargando formulario...</Typography>
      </Stack>
    );
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', py: { xs: 2, sm: 3 }, px: { xs: 2, sm: 3 } }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <MuiLink component={RouterLink} to="/content/topics" underline="hover" color="inherit">
          Temas
        </MuiLink>
        <MuiLink component={RouterLink} to={`/content/topics/${topicId}`} underline="hover" color="inherit">
          {topicTitle || 'Tema'}
        </MuiLink>
        <MuiLink component={RouterLink} to={timelineUrl} underline="hover" color="inherit">
          Linea de tiempo
        </MuiLink>
        <Typography color="text.primary">Sugerir entrada</Typography>
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
          Volver a la linea de tiempo
        </MuiLink>
      </Stack>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        Sugerir entrada en la linea de tiempo
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {topicTitle ? `Tema: ${topicTitle}` : ''}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {canSuggest && !error && (
        <TopicTimelineEntrySuggestionForm
          availableContents={availableContents}
          loadingContents={loading}
          saving={saving}
          error={formError}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
        />
      )}
    </Box>
  );
};

export default TopicTimelineEntrySuggestionPage;
