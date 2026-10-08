import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';

export const consultationStatus = (topic) => {
  const indexed = Boolean(topic?.chat_can_enable) || Number(topic?.indexed_transcript_count) > 0;
  if (topic?.chat_enabled && indexed) return 'visible';
  if (topic?.chat_enabled) return 'on_no_index';
  if (indexed) return 'ready';
  return 'none';
};

const STATUS_COLORS = {
  visible: 'success',
  ready: 'info',
  on_no_index: 'warning',
  none: 'default',
};

const TopicsConsultationsDashboard = () => {
  const { t } = useTranslation('topics');
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [savingId, setSavingId] = useState(null);

  const loadTopics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await contentApi.getAdminTopics();
      const results = Array.isArray(data?.results) ? data.results : [];
      setTopics(results);
      setError(null);
    } catch (err) {
      setError(t('consultationsDashboard.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const filteredTopics = useMemo(() => {
    if (filter === 'all') return topics;
    if (filter === 'none') {
      return topics.filter((topic) => {
        const status = consultationStatus(topic);
        return status === 'none' || status === 'on_no_index';
      });
    }
    return topics.filter((topic) => consultationStatus(topic) === filter);
  }, [topics, filter]);

  const summary = useMemo(() => {
    const counts = { visible: 0, ready: 0, none: 0 };
    topics.forEach((topic) => {
      const status = consultationStatus(topic);
      if (status === 'visible') counts.visible += 1;
      else if (status === 'ready') counts.ready += 1;
      else counts.none += 1;
    });
    return counts;
  }, [topics]);

  const handleToggle = async (topic, nextEnabled) => {
    if (nextEnabled && !topic.chat_can_enable) return;
    setSavingId(topic.id);
    setError(null);
    try {
      const updated = await contentApi.updateTopic(topic.id, { chat_enabled: nextEnabled });
      setTopics((prev) =>
        prev.map((item) =>
          item.id === topic.id
            ? {
                ...item,
                chat_enabled: Boolean(updated.chat_enabled),
                chat_can_enable: updated.chat_can_enable ?? item.chat_can_enable,
                indexed_transcript_count:
                  updated.indexed_transcript_count ?? item.indexed_transcript_count,
              }
            : item,
        ),
      );
    } catch (err) {
      const apiError =
        err?.response?.data?.chat_enabled?.[0]
        || err?.response?.data?.error
        || t('consultationsDashboard.updateError');
      setError(apiError);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 6 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" gutterBottom>
            {t('consultationsDashboard.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('consultationsDashboard.intro')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" color="success" label={t('consultationsDashboard.visibleCount', { count: summary.visible })} />
          <Chip size="small" color="info" label={t('consultationsDashboard.readyCount', { count: summary.ready })} />
          <Chip size="small" label={t('consultationsDashboard.noEmbeddingsCount', { count: summary.none })} />
        </Stack>
      </Stack>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={filter}
        onChange={(_event, value) => {
          if (value) setFilter(value);
        }}
        sx={{ mb: 2 }}
      >
        {[
          { value: 'all', label: t('consultationsDashboard.filterAll') },
          { value: 'visible', label: t('consultationsDashboard.filterVisible') },
          { value: 'ready', label: t('consultationsDashboard.filterReady') },
          { value: 'none', label: t('consultationsDashboard.filterNoEmbeddings') },
        ].map((item) => (
          <ToggleButton key={item.value} value={item.value}>
            {item.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {filteredTopics.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('consultationsDashboard.emptyFilter')}
        </Typography>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('consultationsDashboard.topic')}</TableCell>
                <TableCell>{t('common.status')}</TableCell>
                <TableCell>{t('consultationsDashboard.embeddings')}</TableCell>
                <TableCell>{t('consultationsDashboard.columnConsultations')}</TableCell>
                <TableCell align="right">{t('consultationsDashboard.columnActions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTopics.map((topic) => {
                const status = consultationStatus(topic);
                const statusLabels = {
                  visible: t('consultationsDashboard.visible'),
                  ready: t('consultationsDashboard.ready'),
                  on_no_index: t('consultationsDashboard.enabledNoEmbeddings'),
                  none: t('consultationsDashboard.noEmbeddings'),
                };
                const canTurnOn = Boolean(topic.chat_can_enable) || Boolean(topic.chat_enabled);
                return (
                  <TableRow key={topic.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {topic.title}
                      </Typography>
                      {!topic.is_public && (
                        <Chip size="small" label={t('consultationsDashboard.private')} sx={{ mt: 0.5 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={STATUS_COLORS[status]} label={statusLabels[status]} />
                    </TableCell>
                    <TableCell>
                      {topic.indexed_transcript_count ?? 0}
                    </TableCell>
                    <TableCell>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={Boolean(topic.chat_enabled)}
                            disabled={!canTurnOn || savingId === topic.id}
                            onChange={(event) => handleToggle(topic, event.target.checked)}
                          />
                        }
                        label={topic.chat_enabled ? t('consultationsDashboard.on') : t('consultationsDashboard.off')}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          component={RouterLink}
                          to={`/content/topics/${topic.id}`}
                        >
                          {t('consultationsDashboard.view')}
                        </Button>
                        <Button
                          size="small"
                          component={RouterLink}
                          to={`/content/topics/${topic.id}/edit`}
                        >
                          {t('consultationsDashboard.edit')}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
};

export default TopicsConsultationsDashboard;
