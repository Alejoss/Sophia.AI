import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import LibrarySelectMultiple from './LibrarySelectMultiple';
import UploadContentForm from './UploadContentForm';

const getProfileContentId = (profile) => {
  const content = profile?.content;
  if (content == null) return null;
  if (typeof content === 'object') return content.id ?? null;
  return content;
};

const ContentSuggestionPicker = ({
  selectedProfiles = [],
  onSelectionChange,
  onFileSelected,
  disabled = false,
  maxSelections = null,
  title,
  description,
}) => {
  const { t } = useTranslation('content');
  const heading = title ?? t('suggestionPicker.defaultTitle');
  const intro = description ?? t('suggestionPicker.defaultDescription');
  const singleSelection = maxSelections === 1;

  const applyProfiles = (profiles) => {
    const valid = (profiles || []).filter((profile) => profile?.id);
    if (singleSelection) {
      onSelectionChange(valid.length ? [valid[valid.length - 1]] : []);
      return;
    }
    const map = new Map(selectedProfiles.map((profile) => [profile.id, profile]));
    valid.forEach((profile) => map.set(profile.id, profile));
    onSelectionChange([...map.values()]);
  };
  const [step, setStep] = useState('choice');
  const [uploadMode, setUploadMode] = useState('file');
  const [uploadInProgress, setUploadInProgress] = useState(false);

  const selectedIds = useMemo(
    () => selectedProfiles.map((profile) => profile.id).filter(Boolean),
    [selectedProfiles],
  );

  const handleAddProfiles = applyProfiles;

  const notifyTitleHint = (name) => {
    if (onFileSelected && name) onFileSelected({ name });
  };

  const handleContentUploaded = (contentProfile) => {
    if (contentProfile?.id) {
      applyProfiles([contentProfile]);
      notifyTitleHint(
        contentProfile.title || contentProfile.content?.original_title,
      );
    }
    setStep('choice');
  };

  const handleRemoveProfile = (profileId) => {
    onSelectionChange(selectedProfiles.filter((profile) => profile.id !== profileId));
  };

  if (step === 'library') {
    return (
      <Box>
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={() => setStep('choice')}
          sx={{ mb: 2, textTransform: 'none' }}
          disabled={disabled}
        >
          {t('suggestionPicker.back')}
        </Button>
        <LibrarySelectMultiple
          onCancel={() => setStep('choice')}
          onSave={() => {
            const latest = selectedProfiles[selectedProfiles.length - 1];
            if (latest) {
              notifyTitleHint(latest.title || latest.content?.original_title);
            }
            setStep('choice');
          }}
          onSelectionChange={handleAddProfiles}
          title={t('suggestionPicker.selectTitle')}
          maxSelections={singleSelection ? 1 : maxSelections}
          selectedIds={selectedIds}
          compact
        />
      </Box>
    );
  }

  if (step === 'upload') {
    return (
      <Box>
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={() => setStep('choice')}
          sx={{ mb: 2, textTransform: 'none' }}
          disabled={disabled || uploadInProgress}
        >
          {t('suggestionPicker.back')}
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {uploadMode === 'url'
            ? t('suggestionPicker.urlHint')
            : t('suggestionPicker.fileHint')}
        </Typography>
        <UploadContentForm
          onContentUploaded={handleContentUploaded}
          onFileSelected={onFileSelected}
          onUploadingChange={setUploadInProgress}
          initialUrlMode={uploadMode === 'url'}
          showModeToggle={false}
        />
      </Box>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
        {heading}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {intro}
      </Typography>

      {selectedProfiles.length > 0 && (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
          {selectedProfiles.map((profile) => (
            <Chip
              key={profile.id}
              label={profile.title || profile.content?.original_title || t('common.contentFallback')}
              onDelete={disabled ? undefined : () => handleRemoveProfile(profile.id)}
              variant="outlined"
              size="small"
            />
          ))}
        </Stack>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Button
          variant="outlined"
          onClick={() => setStep('library')}
          disabled={disabled}
          sx={{ textTransform: 'none' }}
        >
          {t('suggestionPicker.fromLibrary')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => { setUploadMode('url'); setStep('upload'); }}
          disabled={disabled}
          sx={{ textTransform: 'none' }}
        >
          {t('suggestionPicker.fromUrl')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => { setUploadMode('file'); setStep('upload'); }}
          disabled={disabled}
          sx={{ textTransform: 'none' }}
        >
          {t('suggestionPicker.uploadFile')}
        </Button>
      </Stack>

      {selectedProfiles.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {singleSelection
            ? t('suggestionPicker.optionalOne')
            : t('suggestionPicker.optionalMany')}
        </Alert>
      )}

      {singleSelection && selectedProfiles.length > 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('suggestionPicker.replaceHint')}
        </Alert>
      )}
    </Paper>
  );
};

export { getProfileContentId };
export default ContentSuggestionPicker;
