import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import TimelineIcon from '@mui/icons-material/Timeline';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { useNavigate } from 'react-router-dom';
import contentApi from '../../api/contentApi';
import TopicTimelineEntryCard from './TopicTimelineEntryCard';
import { hasTimelineDate, sortTimelineEntries } from './timelineUtils';

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

const TopicTimeline = ({ topicId, canEdit, canSuggest = false, pendingSuggestionsCount = 0 }) => {
  const navigate = useNavigate();
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const entries = useMemo(() => sortTimelineEntries(timeline?.entries || []), [timeline]);
  const undatedEntries = useMemo(
    () => entries.filter((entry) => !hasTimelineDate(entry)),
    [entries],
  );

  const loadTimeline = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await contentApi.getTopicTimeline(topicId);
      setTimeline(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Error al cargar la linea de tiempo.'));
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const handleCreate = () => {
    navigate(`/content/topics/${topicId}/timeline/new`);
  };

  const handleEdit = (entry) => {
    navigate(`/content/topics/${topicId}/timeline/${entry.id}/edit`);
  };

  const handleDelete = async (entry) => {
    const confirmed = window.confirm(`Eliminar "${entry.title}" de la linea de tiempo?`);
    if (!confirmed) return;
    try {
      await contentApi.deleteTopicTimelineEntry(topicId, entry.id);
      await loadTimeline();
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo eliminar la entrada.'));
    }
  };

  const reorder = async (entryId, direction) => {
    const undatedIndex = undatedEntries.findIndex((entry) => entry.id === entryId);
    const targetIndex = undatedIndex + direction;
    if (undatedIndex < 0 || targetIndex < 0 || targetIndex >= undatedEntries.length) return;

    const nextUndated = [...undatedEntries];
    const [moved] = nextUndated.splice(undatedIndex, 1);
    nextUndated.splice(targetIndex, 0, moved);

    const datedEntries = entries.filter((entry) => hasTimelineDate(entry));
    const nextEntries = [...datedEntries, ...nextUndated];
    const nextIds = nextEntries.map((entry) => entry.id);

    setTimeline((prev) => ({
      ...prev,
      entries: nextEntries.map((entry, nextIndex) => ({ ...entry, order: nextIndex + 1 })),
    }));

    try {
      await contentApi.reorderTopicTimeline(topicId, nextIds);
      await loadTimeline();
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo reordenar la linea de tiempo.'));
      await loadTimeline();
    }
  };

  if (loading) {
    return (
      <Stack alignItems="center" spacing={1.5} sx={{ py: 5 }}>
        <CircularProgress size={28} />
        <Typography color="text.secondary">Cargando linea de tiempo...</Typography>
      </Stack>
    );
  }

  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <TimelineIcon color="primary" />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Linea de tiempo
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Una narrativa curada del tema con videos, audios, imagenes y textos relacionados.
          </Typography>
        </Box>
        {canEdit && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            Agregar entrada
          </Button>
        )}
        {canSuggest && (
          <Button
            variant="outlined"
            startIcon={<LightbulbIcon />}
            onClick={() => navigate(`/content/topics/${topicId}/timeline/suggest`)}
          >
            Sugerir entrada
          </Button>
        )}
        {canEdit && pendingSuggestionsCount > 0 && (
          <Badge badgeContent={pendingSuggestionsCount} color="error">
            <Button
              variant="outlined"
              onClick={() => navigate(`/content/topics/${topicId}/edit?tab=timeline-suggestions`)}
            >
              Gestionar sugerencias
            </Button>
          </Badge>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {entries.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            py: 6,
            px: 3,
            textAlign: 'center',
            borderRadius: 2,
            bgcolor: 'background.paper',
          }}
        >
          <TimelineIcon color="disabled" sx={{ fontSize: 48, mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Este tema todavia no tiene linea de tiempo
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 560, mx: 'auto' }}>
            La linea de tiempo permite organizar el contenido como una historia: etapas, contexto,
            explicaciones y materiales principales o complementarios.
          </Typography>
          {canEdit && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate} sx={{ mt: 3 }}>
              Crear primera entrada
            </Button>
          )}
        </Paper>
      ) : (
        <Box>
          {entries.map((entry, index) => {
            const undatedIndex = undatedEntries.findIndex((item) => item.id === entry.id);
            const canReorder = !hasTimelineDate(entry);

            return (
            <TopicTimelineEntryCard
              key={entry.id}
              entry={entry}
              index={index}
              topicId={topicId}
              canEdit={canEdit}
              canReorder={canReorder}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onMoveUp={(id) => reorder(id, -1)}
              onMoveDown={(id) => reorder(id, 1)}
              isFirst={canReorder && undatedIndex === 0}
              isLast={canReorder && undatedIndex === undatedEntries.length - 1}
            />
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default TopicTimeline;
