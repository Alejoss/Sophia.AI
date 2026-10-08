import React, { useEffect, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { applyApiErrorsToForm } from '../../utils/apiFormErrors';
import i18n from '../../i18n';
import TopicTimelineDateFields from './TopicTimelineDateFields';

const buildInitialValues = (entry) => ({
  title: entry?.title || '',
  description: entry?.description || '',
  start_date: entry?.start_date || '',
  end_date: entry?.end_date || '',
});

const schema = yup.object({
  title: yup
    .string()
    .trim()
    .required(() => i18n.t('topics:timeline.titleRequired')),
  description: yup.string().default(''),
  start_date: yup.string().default(''),
  end_date: yup
    .string()
    .default('')
    .test(
      'date-range',
      () => i18n.t('topics:timeline.dateRangeError'),
      function dateRange(value) {
        const { start_date: startDate } = this.parent;
        if (!value || !startDate) return true;
        return !dayjs(value).isBefore(dayjs(startDate), 'day');
      },
    ),
});

const TopicTimelineEntryForm = ({
  entry,
  saving = false,
  onCancel,
  onSubmit,
  submitLabel,
}) => {
  const { t } = useTranslation('topics');
  const [generalError, setGeneralError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors, isValid, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: buildInitialValues(entry),
    mode: 'onChange',
  });

  const startDate = watch('start_date');
  const endDate = watch('end_date');
  const pending = saving || isSubmitting;

  useEffect(() => {
    reset(buildInitialValues(entry));
    setGeneralError('');
  }, [entry?.id, reset]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when switching entries

  const handleFormSubmit = async (form) => {
    setGeneralError('');
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      });
    } catch (err) {
      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setError,
        t('timeline.saveError'),
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

        <TextField
          label={t('common.title')}
          {...register('title')}
          error={Boolean(errors.title)}
          helperText={errors.title?.message}
          fullWidth
        />
        <TextField
          label={t('timeline.narrative')}
          placeholder={t('timeline.narrativePlaceholder')}
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
          disabled={pending}
          isNewEntry={!entry}
        />
        {errors.end_date && (
          <Alert severity="error">{errors.end_date.message}</Alert>
        )}
        {errors.start_date && (
          <Alert severity="error">{errors.start_date.message}</Alert>
        )}
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
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={pending || !isValid}
        >
          {pending
            ? t('common.saving')
            : (submitLabel || t('common.save'))}
        </Button>
      </Box>
    </Paper>
  );
};

export default TopicTimelineEntryForm;
