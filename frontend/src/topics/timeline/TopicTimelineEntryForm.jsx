import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import TopicTimelineContentSelector from './TopicTimelineContentSelector';
import TopicTimelineDateFields from './TopicTimelineDateFields';

const buildInitialValues = (entry) => {
  const links = [...(entry?.contents || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const selectedIds = links.map((link) => String(link.content?.id)).filter(Boolean);

  return {
    title: entry?.title || '',
    description: entry?.description || '',
    start_date: entry?.start_date || '',
    end_date: entry?.end_date || '',
    selectedContentIds: selectedIds,
  };
};

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
  selectedContentIds: yup.array().of(yup.string()).default([]),
});

const TopicTimelineEntryForm = ({
  entry,
  availableContents,
  loadingContents,
  saving,
  error,
  onCancel,
  onSubmit,
}) => {
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: buildInitialValues(entry),
    mode: 'onChange',
  });

  const startDate = watch('start_date');
  const endDate = watch('end_date');

  useEffect(() => {
    reset(buildInitialValues(entry));
  }, [entry, reset]);

  const handleFormSubmit = async (form) => {
    const contents = form.selectedContentIds.map((id, index) => ({
      content_id: Number(id),
      order: index + 1,
      caption: '',
    }));

    await onSubmit({
      title: form.title.trim(),
      description: form.description,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
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

        <TextField
          label="Titulo"
          {...register('title')}
          error={Boolean(errors.title)}
          helperText={errors.title?.message}
          fullWidth
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
          key={entry?.id ?? 'new'}
          startDate={startDate}
          endDate={endDate}
          onChange={({ start_date, end_date }) => {
            setValue('start_date', start_date, { shouldValidate: true });
            setValue('end_date', end_date, { shouldValidate: true });
          }}
          disabled={saving}
          isNewEntry={!entry}
        />
        {errors.end_date && (
          <Alert severity="error">{errors.end_date.message}</Alert>
        )}

        <Controller
          name="selectedContentIds"
          control={control}
          render={({ field }) => (
            <TopicTimelineContentSelector
              items={availableContents}
              selectedIds={field.value}
              loading={loadingContents}
              onSelectionChange={field.onChange}
            />
          )}
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
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </Box>
    </Paper>
  );
};

export default TopicTimelineEntryForm;
