import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import bookClubsApi from '../../api/bookClubsApi';
import contentApi from '../../api/contentApi';
import knowledgePathsApi from '../../api/knowledgePathsApi';
import { extractApiError } from '../clubTheme';

const MEDIA_TYPES = [
  { key: 'VIDEO' },
  { key: 'IMAGE' },
  { key: 'AUDIO' },
  { key: 'TEXT' },
];

const BookClubAdminConnections = () => {
  const { t } = useTranslation('bookClubs');
  const { slug } = useParams();
  const { club, reload } = useOutletContext();
  const [paths, setPaths] = useState([]);
  const [topics, setTopics] = useState([]);
  const [knowledgePath, setKnowledgePath] = useState(
    club?.knowledge_path ? String(club.knowledge_path) : ''
  );
  const [topic, setTopic] = useState(club?.topic != null ? String(club.topic) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [topicPreview, setTopicPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [timelineEntries, setTimelineEntries] = useState(null);

  useEffect(() => {
    setKnowledgePath(club?.knowledge_path ? String(club.knowledge_path) : '');
    setTopic(club?.topic != null ? String(club.topic) : '');
  }, [club]);

  useEffect(() => {
    (async () => {
      const [topicsData, pathsData] = await Promise.all([
        contentApi.getTopics().catch(() => []),
        knowledgePathsApi.getUserKnowledgePaths(1, 100).catch(() => ({ results: [] })),
      ]);
      setTopics(Array.isArray(topicsData) ? topicsData : topicsData?.results || []);
      setPaths(Array.isArray(pathsData) ? pathsData : pathsData?.results || []);
    })();
  }, []);

  // Preview what Investigación will show for the selected topic.
  useEffect(() => {
    if (!topic) {
      setTopicPreview(null);
      setTimelineEntries(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      try {
        const [basic, timeline, ...countResponses] = await Promise.all([
          contentApi.getTopicBasicDetails(topic),
          contentApi.getTopicTimeline(topic).catch(() => ({ entries: [] })),
          ...MEDIA_TYPES.map((m) =>
            contentApi
              .getTopicContentByType(topic, m.key, { page: 1, page_size: 1 })
              .catch(() => ({ count: 0 }))
          ),
        ]);
        if (cancelled) return;
        const counts = {};
        MEDIA_TYPES.forEach((m, i) => {
          const data = countResponses[i];
          counts[m.key] = data?.count ?? (data?.contents || []).length ?? 0;
        });
        setTopicPreview({ ...basic, counts });
        setTimelineEntries(Array.isArray(timeline?.entries) ? timeline.entries.length : 0);
      } catch {
        if (!cancelled) {
          setTopicPreview(null);
          setTimelineEntries(null);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topic]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        topic: topic === '' ? null : Number(topic),
      };
      if (knowledgePath !== '') {
        payload.knowledge_path = Number(knowledgePath);
      }
      await bookClubsApi.updateClub(slug, payload);
      setSuccess(
        topic
          ? t('connections.savedWithTopic')
          : t('connections.savedWithoutTopic')
      );
      await reload();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const selectedTopicInList = topics.some((item) => String(item.id) === String(topic));

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('connections.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        <Trans t={t} i18nKey="connections.intro" components={{ strong: <strong /> }} />
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Stack spacing={3} maxWidth={720}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            {t('connections.missions')}
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="path-label">{t('connections.pathLabel')}</InputLabel>
            <Select
              labelId="path-label"
              label={t('connections.pathLabel')}
              value={knowledgePath}
              onChange={(e) => setKnowledgePath(e.target.value)}
            >
              <MenuItem value="">
                {club?.knowledge_path_title
                  ? t('connections.currentPath', { title: club.knowledge_path_title })
                  : t('connections.noChange')}
              </MenuItem>
              {paths.map((path) => (
                <MenuItem key={path.id} value={String(path.id)}>
                  {path.title} (#{path.id})
                </MenuItem>
              ))}
              {club?.knowledge_path &&
                !paths.some((p) => String(p.id) === String(club.knowledge_path)) && (
                  <MenuItem value={String(club.knowledge_path)}>
                    {club.knowledge_path_title || t('connections.pathFallback', { id: club.knowledge_path })}
                  </MenuItem>
                )}
            </Select>
          </FormControl>
          {club?.knowledge_path && (
            <Button
              component={RouterLink}
              to={`/knowledge_path/${club.knowledge_path}/edit`}
              variant="outlined"
              sx={{ mt: 1.5 }}
            >
              {t('connections.editPathMissions')}
            </Button>
          )}
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
            {t('connections.investigation')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t('connections.topicHelp')}
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="topic-label">{t('connections.topicLabel')}</InputLabel>
            <Select
              labelId="topic-label"
              label={t('connections.topicLabel')}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            >
              <MenuItem value="">{t('connections.noTopic')}</MenuItem>
              {topics.map((item) => (
                <MenuItem key={item.id} value={String(item.id)}>
                  {item.title} (#{item.id})
                </MenuItem>
              ))}
              {topic && !selectedTopicInList && (
                <MenuItem value={String(topic)}>
                  {t('connections.topicCurrent', {
                    title: topicPreview?.title || t('connections.topicFallback', { id: topic }),
                  })}
                </MenuItem>
              )}
            </Select>
          </FormControl>

          {topic && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'action.hover',
              }}
            >
              {previewLoading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={18} />
                  <Typography variant="body2">{t('connections.loadingPreview')}</Typography>
                </Stack>
              ) : topicPreview ? (
                <>
                  <Typography fontWeight={700}>{topicPreview.title}</Typography>
                  {topicPreview.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {topicPreview.description.length > 180
                        ? `${topicPreview.description.slice(0, 180)}…`
                        : topicPreview.description}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                    {MEDIA_TYPES.map((m) => (
                      <Typography key={m.key} variant="body2">
                        <strong>{topicPreview.counts?.[m.key] ?? 0}</strong> {t(`media.${m.key}`)}
                      </Typography>
                    ))}
                    <Typography variant="body2">
                      <strong>{timelineEntries ?? 0}</strong> {t('connections.timelineEntries')}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
                    <Button
                      size="small"
                      variant="outlined"
                      component={RouterLink}
                      to={`/club-de-lectura/${slug}/investigacion`}
                    >
                      {t('connections.viewInHub')}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      component="a"
                      href={`/content/topics/${topic}?tab=timeline`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('connections.openTopic')}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      component="a"
                      href={`/content/topics/${topic}/edit?tab=timeline`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('connections.editTimeline')}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      component="a"
                      href={`/content/topics/${topic}/edit?tab=content`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('connections.manageContent')}
                    </Button>
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('connections.previewError', { id: topic })}
                </Typography>
              )}
            </Box>
          )}

          <Button
            component={RouterLink}
            to="/content/topics"
            variant="text"
            sx={{ mt: 1, px: 0 }}
          >
            {t('connections.topicList')}
          </Button>
        </Box>

        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{ alignSelf: 'flex-start' }}
        >
          {saving ? t('connections.saving') : t('connections.save')}
        </Button>
      </Stack>
    </Box>
  );
};

export default BookClubAdminConnections;
