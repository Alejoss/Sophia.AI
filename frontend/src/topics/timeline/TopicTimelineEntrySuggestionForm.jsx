import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
} from '@mui/material';
import dayjs from 'dayjs';
import ContentSuggestionPicker, { getProfileContentId } from '../../content/ContentSuggestionPicker';
import { suggestEntryTitleFromFileName } from '../../content/inferTitleAuthorFromFileName';
import TopicTimelineDateFields from './TopicTimelineDateFields';

const schema = yup.object({
  title: yup
    .string()
    .trim()
    .required('El título es requerido.'),
  description: yup.string().default(''),
  start_date: yup.string().default(''),
  end_date: yup
    .string()
    .default('')
    .test(
      'date-range',
      'La fecha final no puede ser anterior a la fecha inicial.',
      function dateRange(value) {
        const { start_date: startDate } = this.parent;
        if (!value || !startDate) return true;
        return !dayjs(value).isBefore(dayjs(startDate), 'day');
      },
    ),
  message: yup
    .string()
    .max(500, 'El mensaje no puede exceder 500 caracteres.')
    .default(''),
});

const TopicTimelineEntrySuggestionForm = ({
  saving,
  error,
  onCancel,
  onSubmit,
}) => {
  const [externalProfiles, setExternalProfiles] = useState([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      start_date: '',
      end_date: '',
      message: '',
    },
    mode: 'onChange',
  });

  const startDate = watch('start_date');
  const endDate = watch('end_date');
  const messageValue = watch('message');

  const applyAutoTitleFromFileName = (filename) => {
    const suggested = suggestEntryTitleFromFileName(filename);
    if (!suggested) return;
    setValue('title', suggested, { shouldValidate: true });
  };

  const handleFileSelected = (file) => {
    const name = file?.name;
    if (name) applyAutoTitleFromFileName(name);
  };

  const handleFormSubmit = async (form) => {
    const profile = externalProfiles[0];
    const contents = [];
    if (profile) {
      const contentId = getProfileContentId(profile);
      if (contentId) {
        contents.push({ content_id: contentId, order: 1, caption: '' });
      }
    }

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
    <Paper
      variant="outlined"
      component="form"
      onSubmit={handleSubmit(handleFormSubmit)}
      noValidate
      sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}
    >
      <Stack spacing={2.5}>
        {error && <Alert severity="error">{error}</Alert>}

        <ContentSuggestionPicker
          selectedProfiles={externalProfiles}
          onSelectionChange={setExternalProfiles}
          onFileSelected={handleFileSelected}
          maxSelections={1}
          disabled={saving}
          title="Contenido de tu biblioteca o nuevo"
          description="Opcional: propón un material que aun no esta en el tema. Si se acepta la entrada, tambien se evaluara para el tema."
        />

        <TextField
          label="Titulo de la entrada"
          {...register('title')}
          error={Boolean(errors.title)}
          helperText={errors.title?.message}
          fullWidth
          required
        />
        <TextField
          label="Descripcion narrativa"
          placeholder="Descripción narrativa para la línea de tiempo"
          {...register('description')}
          error={Boolean(errors.description)}
          helperText={errors.description?.message}
          fullWidth
          multiline
          minRows={3}
        />

        <TopicTimelineDateFields
          startDate={startDate}
          endDate={endDate}
          onChange={({ start_date, end_date }) => {
            setValue('start_date', start_date, { shouldValidate: true });
            setValue('end_date', end_date, { shouldValidate: true });
          }}
          disabled={saving}
          isNewEntry
        />
        {errors.end_date && (
          <Alert severity="error">{errors.end_date.message}</Alert>
        )}

        <TextField
          label="Mensaje para moderadores (opcional)"
          {...register('message')}
          error={Boolean(errors.message)}
          helperText={errors.message?.message || `${messageValue.length}/500 caracteres`}
          fullWidth
          multiline
          minRows={2}
          inputProps={{ maxLength: 500 }}
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
          type="submit"
          variant="contained"
          disabled={saving || !isValid}
        >
          {saving ? 'Enviando...' : 'Enviar sugerencia'}
        </Button>
      </Box>
    </Paper>
  );
};

export default TopicTimelineEntrySuggestionForm;
