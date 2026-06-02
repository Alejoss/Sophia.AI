import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import TimelineIcon from '@mui/icons-material/Timeline';
import { useNavigate } from 'react-router-dom';
import contentApi from '../../api/contentApi';
import TopicTimelineEntryCard from './TopicTimelineEntryCard';
import TopicTimelineEntryForm from './TopicTimelineEntryForm';

const sortEntries = (entries) => [...(entries || [])].sort((a, b) => {
  const orderA = a.order ?? 0;
  const orderB = b.order ?? 0;
  if (orderA !== orderB) return orderA - orderB;
  return String(a.created_at || '').localeCompare(String(b.created_at || ''));
});

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

const TopicTimeline = ({ topicId, canEdit }) => {
  const navigate = useNavigate();
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableContents, setAvailableContents] = useState([]);
  const [loadingContents, setLoadingContents] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const entries = useMemo(() => sortEntries(timeline?.entries || []), [timeline]);

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

  const loadAvailableContents = useCallback(async () => {
    if (!canEdit) return;
    try {
      setLoadingContents(true);
      const data = await contentApi.getTopicDetailsSimple(topicId);
      setAvailableContents(data.contents || []);
    } catch (err) {
      setAvailableContents([]);
    } finally {
      setLoadingContents(false);
    }
  }, [canEdit, topicId]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  useEffect(() => {
    loadAvailableContents();
  }, [loadAvailableContents]);

  const handleCreate = () => {
    setEditingEntry(null);
    setFormError(null);
    setFormOpen(true);
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (payload) => {
    try {
      setSaving(true);
      setFormError(null);
      if (editingEntry) {
        await contentApi.updateTopicTimelineEntry(topicId, editingEntry.id, payload);
      } else {
        await contentApi.createTopicTimelineEntry(topicId, payload);
      }
      setFormOpen(false);
      setEditingEntry(null);
      await loadTimeline();
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar la entrada.'));
    } finally {
      setSaving(false);
    }
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
    const index = entries.findIndex((entry) => entry.id === entryId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= entries.length) return;

    const nextEntries = [...entries];
    const [moved] = nextEntries.splice(index, 1);
    nextEntries.splice(targetIndex, 0, moved);
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
          {entries.map((entry, index) => (
            <TopicTimelineEntryCard
              key={entry.id}
              entry={entry}
              index={index}
              topicId={topicId}
              navigate={navigate}
              canEdit={canEdit}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onMoveUp={(id) => reorder(id, -1)}
              onMoveDown={(id) => reorder(id, 1)}
              isFirst={index === 0}
              isLast={index === entries.length - 1}
            />
          ))}
        </Box>
      )}

      <TopicTimelineEntryForm
        open={formOpen}
        entry={editingEntry}
        availableContents={availableContents}
        loadingContents={loadingContents}
        saving={saving}
        error={formError}
        onClose={() => {
          if (!saving) {
            setFormOpen(false);
            setEditingEntry(null);
          }
        }}
        onSubmit={handleSubmit}
      />
    </Box>
  );
};

export default TopicTimeline;
