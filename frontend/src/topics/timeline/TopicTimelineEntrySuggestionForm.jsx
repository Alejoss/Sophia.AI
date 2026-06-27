import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import ContentSuggestionPicker, { getProfileContentId } from '../../content/ContentSuggestionPicker';
import TopicTimelineContentSelector from './TopicTimelineContentSelector';
import TopicTimelineDateFields from './TopicTimelineDateFields';

const TopicTimelineEntrySuggestionForm = ({
  availableContents,
  loadingContents,
  saving,
  error,
  onCancel,
  onSubmit,
}) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    message: '',
    selectedTopicContentIds: [],
  });
  const [externalProfiles, setExternalProfiles] = useState([]);
  const [dateRangeError, setDateRangeError] = useState('');

  const handleFieldChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleDateChange = ({ start_date, end_date }) => {
    setForm((prev) => ({ ...prev, start_date, end_date }));
    if (start_date && end_date && dayjs(end_date).isBefore(dayjs(start_date), 'day')) {
      setDateRangeError('La fecha final no puede ser anterior a la fecha inicial.');
    } else {
      setDateRangeError('');
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    if (form.start_date && form.end_date && dayjs(form.end_date).isBefore(dayjs(form.start_date), 'day')) {
      setDateRangeError('La fecha final no puede ser anterior a la fecha inicial.');
      return;
    }

    const contentIdSet = new Set();
    const contents = [];

    form.selectedTopicContentIds.forEach((id, index) => {
      const numericId = Number(id);
      if (!contentIdSet.has(numericId)) {
        contentIdSet.add(numericId);
        contents.push({ content_id: numericId, order: contents.length + 1, caption: '' });
      }
    });

    externalProfiles.forEach((profile) => {
      const contentId = getProfileContentId(profile);
      if (contentId && !contentIdSet.has(contentId)) {
        contentIdSet.add(contentId);
        contents.push({ content_id: contentId, order: contents.length + 1, caption: '' });
      }
    });

    await onSubmit({
      title: form.title.trim(),
      description: form.description,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      message: form.message.trim(),
      contents,
    });
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
      <Stack spacing={2.5}>
        {error && <Alert severity="error">{error}</Alert>}
        {dateRangeError && <Alert severity="error">{dateRangeError}</Alert>}

        <TextField
          label="Titulo de la entrada"
          value={form.title}
          onChange={handleFieldChange('title')}
          fullWidth
          required
        />
        <TextField
          label="Descripcion narrativa"
          value={form.description}
          onChange={handleFieldChange('description')}
          fullWidth
          multiline
          minRows={3}
        />

        <TopicTimelineDateFields
          startDate={form.start_date}
          endDate={form.end_date}
          onChange={handleDateChange}
          disabled={saving}
          isNewEntry
        />

        <TextField
          label="Mensaje para moderadores (opcional)"
          value={form.message}
          onChange={handleFieldChange('message')}
          fullWidth
          multiline
          minRows={2}
          helperText={`${form.message.length}/500 caracteres`}
          inputProps={{ maxLength: 500 }}
        />

        <Divider />

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Contenidos ya en el tema
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Opcional: relaciona contenidos que ya forman parte del tema.
          </Typography>
          <TopicTimelineContentSelector
            items={availableContents}
            selectedIds={form.selectedTopicContentIds}
            loading={loadingContents}
            onSelectionChange={(selectedIds) => {
              setForm((prev) => ({ ...prev, selectedTopicContentIds: selectedIds }));
            }}
          />
        </Box>

        <ContentSuggestionPicker
          selectedProfiles={externalProfiles}
          onSelectionChange={setExternalProfiles}
          disabled={saving}
          title="Contenidos de tu biblioteca o nuevos"
          description="Propón materiales que aun no estan en el tema. Si se acepta la entrada, tambien se evaluaran para el tema."
        />
      </Stack>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1.5,
          mt: 3,
          pt: 2,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Button type="button" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || !form.title.trim()}
        >
          {saving ? 'Enviando...' : 'Enviar sugerencia'}
        </Button>
      </Box>
    </Paper>
  );
};

export default TopicTimelineEntrySuggestionForm;
