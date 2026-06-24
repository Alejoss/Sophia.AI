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
import TopicTimelineEntryForm from './TopicTimelineEntryForm';

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

const TopicTimelineEntryPage = () => {
  const { topicId, entryId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const isEdit = Boolean(entryId);

  const [topicTitle, setTopicTitle] = useState('');
  const [entry, setEntry] = useState(null);
  const [availableContents, setAvailableContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [canEdit, setCanEdit] = useState(false);

  const timelineUrl = useMemo(
    () => getTopicDetailPath(topicId, TOPIC_TABS.TIMELINE),
    [topicId],
  );

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [topicData, timelineData, contentsData] = await Promise.all([
        contentApi.getTopicDetails(topicId, { include_contents: false }),
        contentApi.getTopicTimeline(topicId),
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
      const allowed = isCreator || isModerator;
      setCanEdit(allowed);

      if (!allowed) {
        setError('No tienes permiso para editar la linea de tiempo de este tema.');
        return;
      }

      if (isEdit) {
        const found = (timelineData?.entries || []).find(
          (item) => String(item.id) === String(entryId),
        );
        if (!found) {
          setError('No se encontro la entrada de la linea de tiempo.');
          return;
        }
        setEntry(found);
      } else {
        setEntry(null);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo cargar la linea de tiempo.'));
    } finally {
      setLoading(false);
    }
  }, [entryId, isAuthenticated, isEdit, topicId, user?.id]);

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
      if (isEdit) {
        await contentApi.updateTopicTimelineEntry(topicId, entryId, payload);
      } else {
        await contentApi.createTopicTimelineEntry(topicId, payload);
      }
      navigate(timelineUrl);
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar la entrada.'));
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
        <Typography color="text.primary">
          {isEdit ? 'Editar entrada' : 'Nueva entrada'}
        </Typography>
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
        {isEdit ? 'Editar entrada de la linea de tiempo' : 'Nueva entrada de la linea de tiempo'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {topicTitle ? `Tema: ${topicTitle}` : ''}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {canEdit && !error && (
        <TopicTimelineEntryForm
          entry={entry}
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

export default TopicTimelineEntryPage;
