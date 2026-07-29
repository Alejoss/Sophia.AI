import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ContentSuggestionPicker, { getProfileContentId } from '../../content/ContentSuggestionPicker';
import { applyApiErrorsToForm } from '../../utils/apiFormErrors';

const formatDate = (value) => {
  if (!value) return null;
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

const getEntryDateLabel = (entry) => {
  if (entry.start_date && entry.end_date) {
    return `${formatDate(entry.start_date)} - ${formatDate(entry.end_date)}`;
  }
  if (entry.start_date) return formatDate(entry.start_date);
  return 'Sin fecha';
};

const schema = yup.object({
  message: yup
    .string()
    .max(500, 'El mensaje no puede exceder 500 caracteres.')
    .default(''),
});

const TopicTimelineEntryContentSuggestionForm = ({
  entry,
  saving = false,
  onCancel,
  onSubmit,
}) => {
  const [externalProfiles, setExternalProfiles] = useState([]);
  const [generalError, setGeneralError] = useState('');

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { message: '' },
  });

  const messageValue = watch('message');
  const pending = saving || isSubmitting;

  const handleFormSubmit = async (form) => {
    setGeneralError('');
    const profile = externalProfiles[0];
    const contentId = profile ? getProfileContentId(profile) : null;
    if (!contentId) {
      setError('content', {
        type: 'manual',
        message: 'Selecciona un contenido para vincular a esta entrada.',
      });
      return;
    }

    try {
      await onSubmit({
        content_id: contentId,
        message: form.message.trim(),
      });
    } catch (err) {
      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setError,
        'No se pudo enviar la sugerencia. Inténtalo de nuevo.',
      );
      if (parsed) setGeneralError(parsed);
    }
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
        {generalError && <Alert severity="error">{generalError}</Alert>}
        {errors.content && <Alert severity="error">{errors.content.message}</Alert>}

        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: 'action.hover',
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="overline" color="text.secondary" display="block">
            Entrada de la linea de tiempo
          </Typography>
          <Chip
            icon={<CalendarTodayIcon />}
            label={getEntryDateLabel(entry)}
            size="small"
            color={entry.start_date ? 'primary' : 'default'}
            variant={entry.start_date ? 'filled' : 'outlined'}
            sx={{ mt: 1, fontWeight: 600 }}
          />
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 1.5 }}>
            {entry.title}
          </Typography>
          {entry.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-line' }}>
              {entry.description}
            </Typography>
          )}
        </Box>

        <ContentSuggestionPicker
          selectedProfiles={externalProfiles}
          onSelectionChange={(profiles) => {
            setExternalProfiles(profiles);
            if (profiles.length > 0) {
              clearErrors('content');
            }
          }}
          maxSelections={1}
          disabled={pending}
          title="Contenido a vincular"
          description="Elige material de tu biblioteca o sube uno nuevo. Si se acepta, se vincula a esta entrada y se anade al tema si aun no forma parte de el."
        />

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
        <Button type="button" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={pending}
        >
          {pending ? 'Enviando...' : 'Enviar sugerencia'}
        </Button>
      </Box>
    </Paper>
  );
};

export default TopicTimelineEntryContentSuggestionForm;
