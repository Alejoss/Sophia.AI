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
import { useTranslation } from 'react-i18next';
import { applyApiErrorsToForm } from '../../utils/apiFormErrors';
import i18n from '../../i18n';
import TopicTimelineDateFields from './TopicTimelineDateFields';

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
  message: yup
    .string()
    .max(500, () => i18n.t('topics:timeline.messageMax'))
    .default(''),
});

const TopicTimelineEntrySuggestionForm = ({
  saving = false,
  onCancel,
  onSubmit,
}) => {
  const { t } = useTranslation('topics');
  const [externalProfiles, setExternalProfiles] = useState([]);
  const [generalError, setGeneralError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isValid, isSubmitting },
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
  const pending = saving || isSubmitting;

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
    setGeneralError('');
    const profile = externalProfiles[0];
    const contents = [];
    if (profile) {
      const contentId = getProfileContentId(profile);
      if (contentId) {
        contents.push({ content_id: contentId, order: 1, caption: '' });
      }
    }

    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        message: form.message.trim(),
        contents,
      });
    } catch (err) {
      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setError,
        t('timeline.suggestionError'),
      );
      if (parsed) setGeneralError(parsed);
    }
  };

  // Not a <form>: ContentSuggestionPicker embeds UploadContentForm (its own form).
  // Nested forms are invalid HTML and break URL/file uploads into the library.
  return (
    <Paper
      variant="outlined"
      sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}
    >
      <Stack spacing={2.5}>
        {generalError && <Alert severity="error">{generalError}</Alert>}

        <ContentSuggestionPicker
          selectedProfiles={externalProfiles}
          onSelectionChange={setExternalProfiles}
          onFileSelected={handleFileSelected}
          maxSelections={1}
          disabled={pending}
          title={t('timeline.pickerTitle')}
          description={t('timeline.materialHint')}
        />

        <TextField
          label={t('timeline.entryTitle')}
          {...register('title')}
          error={Boolean(errors.title)}
          helperText={errors.title?.message}
          fullWidth
          required
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
          startDate={startDate}
          endDate={endDate}
          onChange={({ start_date, end_date }) => {
            setValue('start_date', start_date, { shouldValidate: true });
            setValue('end_date', end_date, { shouldValidate: true });
          }}
          disabled={pending}
          isNewEntry
        />
        {errors.end_date && (
          <Alert severity="error">{errors.end_date.message}</Alert>
        )}
        {errors.start_date && (
          <Alert severity="error">{errors.start_date.message}</Alert>
        )}

        <TextField
          label={t('suggestion.messageLabel')}
          {...register('message')}
          error={Boolean(errors.message)}
          helperText={errors.message?.message || t('timeline.charCount', { count: messageValue.length })}
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
          {t('common.cancel')}
        </Button>
        <Button
          type="button"
          variant="contained"
          onClick={handleSubmit(handleFormSubmit)}
          disabled={pending || !isValid}
        >
          {pending ? t('common.sending') : t('timeline.sendSuggestion')}
        </Button>
      </Box>
    </Paper>
  );
};

export default TopicTimelineEntrySuggestionForm;
