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
import { useTranslation } from 'react-i18next';
import ContentSuggestionPicker, { getProfileContentId } from '../../content/ContentSuggestionPicker';
import { useDateLocales } from '../../hooks/useDateLocales';
import i18n from '../../i18n';
import { applyApiErrorsToForm } from '../../utils/apiFormErrors';

const formatDate = (value, locale) => {
  if (!value) return null;
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

const schema = yup.object({
  message: yup
    .string()
    .max(500, () => i18n.t('topics:timeline.messageMax'))
    .default(''),
});

const TopicTimelineEntryContentSuggestionForm = ({
  entry,
  saving = false,
  onCancel,
  onSubmit,
}) => {
  const { t } = useTranslation('topics');
  const { intl } = useDateLocales();
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
  const dateLabel = entry.start_date && entry.end_date
    ? `${formatDate(entry.start_date, intl)} - ${formatDate(entry.end_date, intl)}`
    : entry.start_date
      ? formatDate(entry.start_date, intl)
      : t('common.noDate');

  const handleFormSubmit = async (form) => {
    setGeneralError('');
    const profile = externalProfiles[0];
    const contentId = profile ? getProfileContentId(profile) : null;
    if (!contentId) {
      setError('content', {
        type: 'manual',
        message: t('timeline.selectContent'),
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
            {t('timeline.entryOverline')}
          </Typography>
          <Chip
            icon={<CalendarTodayIcon />}
            label={dateLabel}
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
          title={t('timeline.contentToLink')}
          description={t('timeline.contentToLinkHelp')}
        />

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
          disabled={pending}
        >
          {pending ? t('common.sending') : t('timeline.sendSuggestion')}
        </Button>
      </Box>
    </Paper>
  );
};

export default TopicTimelineEntryContentSuggestionForm;
