import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import TopicTimelineContentSelector from './TopicTimelineContentSelector';

const buildInitialState = (entry) => {
  const links = [...(entry?.contents || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const selectedIds = links.map((link) => String(link.content?.id)).filter(Boolean);
  const primary = links.find((link) => link.role === 'PRIMARY') || links[0];
  return {
    title: entry?.title || '',
    description: entry?.description || '',
    display_date: entry?.display_date || '',
    start_date: entry?.start_date || '',
    end_date: entry?.end_date || '',
    selectedContentIds: selectedIds,
    primaryContentId: primary?.content?.id ? String(primary.content.id) : (selectedIds[0] || ''),
  };
};

const TopicTimelineEntryForm = ({
  open,
  entry,
  availableContents,
  loadingContents,
  saving,
  error,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState(buildInitialState(entry));

  useEffect(() => {
    if (open) {
      setForm(buildInitialState(entry));
    }
  }, [entry, open]);

  const handleFieldChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleContentSelectionChange = (selectedIds) => {
    setForm((prev) => {
      const nextPrimary = selectedIds.includes(prev.primaryContentId)
        ? prev.primaryContentId
        : (selectedIds[0] || '');
      return {
        ...prev,
        selectedContentIds: selectedIds,
        primaryContentId: nextPrimary,
      };
    });
  };

  const handlePrimaryContentChange = (contentId) => {
    setForm((prev) => ({ ...prev, primaryContentId: contentId }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const contents = form.selectedContentIds.map((id, index) => ({
      content_id: Number(id),
      order: index + 1,
      role: id === form.primaryContentId ? 'PRIMARY' : 'REFERENCE',
      caption: '',
    }));
    onSubmit({
      title: form.title.trim(),
      description: form.description,
      display_date: form.display_date.trim(),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      contents,
    });
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>
          {entry ? 'Editar entrada de la linea de tiempo' : 'Nueva entrada de la linea de tiempo'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Titulo"
              value={form.title}
              onChange={handleFieldChange('title')}
              required
              fullWidth
            />
            <TextField
              label="Descripcion narrativa"
              value={form.description}
              onChange={handleFieldChange('description')}
              fullWidth
              multiline
              minRows={3}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Etiqueta temporal opcional"
                placeholder="Ej. Antes de Bitcoin, Decada de 1990"
                value={form.display_date}
                onChange={handleFieldChange('display_date')}
                fullWidth
              />
              <TextField
                label="Fecha inicial"
                type="date"
                value={form.start_date}
                onChange={handleFieldChange('start_date')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Fecha final"
                type="date"
                value={form.end_date}
                onChange={handleFieldChange('end_date')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>

            <TopicTimelineContentSelector
              items={availableContents}
              selectedIds={form.selectedContentIds}
              primaryContentId={form.primaryContentId}
              loading={loadingContents}
              onSelectionChange={handleContentSelectionChange}
              onPrimaryChange={handlePrimaryContentChange}
            />

            <Typography variant="caption" color="text.secondary">
              La fecha es opcional. Si no agregas fecha ni etiqueta, la entrada se mostrara como una etapa numerada.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={saving || !form.title.trim()}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default TopicTimelineEntryForm;
