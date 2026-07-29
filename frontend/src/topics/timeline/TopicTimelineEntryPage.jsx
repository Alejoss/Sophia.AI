import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Breadcrumbs,
  CircularProgress,
  Link as MuiLink,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import contentApi from '../../api/contentApi';
import { useAuth } from '../../context/AuthContext';
import { getTopicDetailPath, TOPIC_TABS } from '../../utils/urlUtils';
import TopicTimelineEntryContentLinkForm from './TopicTimelineEntryContentLinkForm';
import TopicTimelineEntryForm from './TopicTimelineEntryForm';

const EDIT_TABS = {
  details: 'details',
  content: 'content',
};

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const isEdit = Boolean(entryId);
  const fromEdit = searchParams.get('from') === 'edit';
  const justCreated = searchParams.get('created') === '1';
  const activeEditTab = searchParams.get('step') === 'content'
    ? EDIT_TABS.content
    : EDIT_TABS.details;
  const isContentTab = isEdit && activeEditTab === EDIT_TABS.content;

  const [topicTitle, setTopicTitle] = useState('');
  const [entry, setEntry] = useState(null);
  const [availableContents, setAvailableContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingContents, setLoadingContents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingContents, setSavingContents] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [contentFormError, setContentFormError] = useState(null);
  const [canEdit, setCanEdit] = useState(false);

  const timelineUrl = useMemo(
    () => (fromEdit
      ? `/content/topics/${topicId}/edit?tab=timeline`
      : getTopicDetailPath(topicId, TOPIC_TABS.TIMELINE)),
    [fromEdit, topicId],
  );

  const linkedContentCount = entry?.contents?.length || 0;

  const refreshTopicContents = useCallback(async () => {
    setLoadingContents(true);
    try {
      const contentsData = await contentApi.getTopicDetailsSimple(topicId);
      setAvailableContents(contentsData?.contents || []);
    } finally {
      setLoadingContents(false);
    }
  }, [topicId]);

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

  const handleEditTabChange = (_event, nextTab) => {
    const params = new URLSearchParams(searchParams);
    if (nextTab === EDIT_TABS.content) {
      params.set('step', 'content');
    } else {
      params.delete('step');
      params.delete('created');
    }
    setSearchParams(params, { replace: true });
    setFormError(null);
    setContentFormError(null);
  };

  const handleEntrySubmit = async (payload) => {
    try {
      setSaving(true);
      setFormError(null);
      if (isEdit) {
        await contentApi.updateTopicTimelineEntry(topicId, entryId, payload);
        navigate(timelineUrl);
        return;
      }

      const created = await contentApi.createTopicTimelineEntry(topicId, payload);
      const params = new URLSearchParams();
      if (fromEdit) params.set('from', 'edit');
      params.set('step', 'content');
      params.set('created', '1');
      navigate(
        `/content/topics/${topicId}/timeline/${created.id}/edit?${params.toString()}`,
        { replace: true },
      );
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar la entrada.'));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const linkContentsToEntry = async ({ contents, newProfiles }) => {
    const targetEntryId = entry?.id || entryId;
    if (!targetEntryId) {
      throw new Error('No se encontro la entrada.');
    }

    const profileIds = (newProfiles || [])
      .map((profile) => profile?.id)
      .filter(Boolean);

    if (profileIds.length > 0) {
      await contentApi.addContentToTopic(topicId, profileIds);
      await refreshTopicContents();
    }

    const updated = await contentApi.updateTopicTimelineEntry(topicId, targetEntryId, {
      contents,
    });
    setEntry(updated);
    return updated;
  };

  const handleContentSubmit = async ({ contents, newProfiles }) => {
    try {
      setSavingContents(true);
      setContentFormError(null);
      await linkContentsToEntry({ contents, newProfiles });
      navigate(timelineUrl);
    } catch (err) {
      setContentFormError(getErrorMessage(err, 'No se pudieron vincular los contenidos.'));
      throw err;
    } finally {
      setSavingContents(false);
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

  const pageTitle = (() => {
    if (!isEdit) return 'Nueva entrada de la linea de tiempo';
    if (justCreated && isContentTab) return 'Vincular contenidos a la entrada';
    return 'Editar entrada de la linea de tiempo';
  })();

  const breadcrumbLabel = (() => {
    if (!isEdit) return 'Nueva entrada';
    if (justCreated && isContentTab) return 'Vincular contenidos';
    return 'Editar entrada';
  })();

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
          {breadcrumbLabel}
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
        {pageTitle}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: isEdit ? 2 : 3 }}>
        {topicTitle ? `Tema: ${topicTitle}` : ''}
        {entry?.title ? ` · ${entry.title}` : ''}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {canEdit && !error && isEdit && (
        <Tabs
          value={activeEditTab}
          onChange={handleEditTabChange}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            value={EDIT_TABS.details}
            label="Detalles"
            icon={<EventNoteIcon />}
            iconPosition="start"
            sx={{ textTransform: 'none', minHeight: 48 }}
          />
          <Tab
            value={EDIT_TABS.content}
            label={linkedContentCount > 0 ? `Contenidos (${linkedContentCount})` : 'Contenidos'}
            icon={<PermMediaIcon />}
            iconPosition="start"
            sx={{ textTransform: 'none', minHeight: 48 }}
          />
        </Tabs>
      )}

      {canEdit && !error && justCreated && isContentTab && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Entrada creada. Ahora puedes vincular contenidos que evidencien ese evento de la línea de tiempo o que aporten un comentario relevante.
        </Alert>
      )}

      {canEdit && !error && !isEdit && (
        <TopicTimelineEntryForm
          entry={null}
          saving={saving}
          error={formError}
          onCancel={handleCancel}
          onSubmit={handleEntrySubmit}
          submitLabel="Crear entrada"
        />
      )}

      {canEdit && !error && isEdit && activeEditTab === EDIT_TABS.details && (
        <TopicTimelineEntryForm
          entry={entry}
          saving={saving}
          error={formError}
          onCancel={handleCancel}
          onSubmit={handleEntrySubmit}
          submitLabel="Guardar"
        />
      )}

      {canEdit && !error && isEdit && activeEditTab === EDIT_TABS.content && (
        <TopicTimelineEntryContentLinkForm
          entry={entry}
          topicId={topicId}
          availableContents={availableContents}
          loadingContents={loadingContents}
          saving={savingContents}
          error={contentFormError}
          showSkip={justCreated}
          onSkip={handleCancel}
          onCancel={handleCancel}
          onSubmit={handleContentSubmit}
        />
      )}
    </Box>
  );
};

export default TopicTimelineEntryPage;
