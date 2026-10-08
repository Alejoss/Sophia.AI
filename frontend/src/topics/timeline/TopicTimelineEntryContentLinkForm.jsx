import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import LibrarySelectMultiple from '../../content/LibrarySelectMultiple';
import UploadContentForm from '../../content/UploadContentForm';
import { getProfileContentId } from '../../content/ContentSuggestionPicker';
import { useTranslation } from 'react-i18next';
import { parseApiValidationErrors } from '../../utils/apiFormErrors';
import TopicTimelineContentSelector from './TopicTimelineContentSelector';

const buildInitialSelectedIds = (entry) => {
  const links = [...(entry?.contents || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return links.map((link) => String(link.content?.id)).filter(Boolean);
};

const getTopicItemTitle = (item, fallback) => {
  const content = item?.content || item;
  return (
    item?.title
    || item?.selected_profile?.title
    || content?.original_title
    || fallback
  );
};

const uniqueContentIds = (ids) => {
  const ordered = [];
  const seen = new Set();
  ids.forEach((id) => {
    const key = String(id);
    if (!key || seen.has(key)) return;
    seen.add(key);
    ordered.push(key);
  });
  return ordered;
};

const TopicTimelineEntryContentLinkForm = ({
  entry,
  topicId,
  availableContents,
  loadingContents,
  saving,
  error,
  onSkip,
  onCancel,
  onSubmit,
  onLinked,
  showSkip = false,
}) => {
  const { t } = useTranslation('topics');
  const [sourceMode, setSourceMode] = useState(null);
  const [uploadMode, setUploadMode] = useState('file');
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [selectedContentIds, setSelectedContentIds] = useState(() => buildInitialSelectedIds(entry));
  const [generalError, setGeneralError] = useState('');
  const entryId = entry?.id;

  useEffect(() => {
    setSelectedContentIds(buildInitialSelectedIds(entry));
    setGeneralError('');
    setSourceMode(null);
    setUploadInProgress(false);
  }, [entryId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when switching entries

  const topicContentById = useMemo(() => {
    const map = new Map();
    (availableContents || []).forEach((item) => {
      const content = item?.content || item;
      if (content?.id != null) {
        map.set(String(content.id), item);
      }
    });
    return map;
  }, [availableContents]);

  const topicContentIdSet = useMemo(
    () => new Set(topicContentById.keys()),
    [topicContentById],
  );

  const backToChoice = () => {
    setUploadInProgress(false);
    setSourceMode(null);
  };

  const filterLibraryContent = useCallback((contentProfile) => {
    if (!topicId) return true;
    const topics = contentProfile?.content?.topics || [];
    return !topics.some((id) => String(id) === String(topicId));
  }, [topicId]);

  const persistLinks = async ({ contentIds, newProfiles = [], finish = false }) => {
    setGeneralError('');
    const orderedIds = uniqueContentIds(contentIds);
    const contents = orderedIds.map((id, index) => ({
      content_id: Number(id),
      order: index + 1,
      caption: '',
    }));

    try {
      await onSubmit({ contents, newProfiles });
      if (finish) {
        onLinked?.();
      }
    } catch (err) {
      const { fieldErrors, generalError: parsed } = parseApiValidationErrors(
        err,
        t('timeline.linkError'),
      );
      const contentsError = fieldErrors.contents;
      const message = contentsError || parsed || t('timeline.linkError');
      setGeneralError(message);
      throw err;
    }
  };

  const buildNewProfiles = (profiles) => (
    (profiles || [])
      .filter((profile) => profile?.id && getProfileContentId(profile))
      .filter((profile) => !topicContentIdSet.has(String(getProfileContentId(profile))))
  );

  const handleLibrarySave = async (_ids, profiles) => {
    const validProfiles = (profiles || []).filter(
      (profile) => profile?.id && getProfileContentId(profile),
    );
    if (validProfiles.length === 0) {
      setGeneralError(t('timeline.selectAtLeast'));
      return;
    }

    const existingIds = buildInitialSelectedIds(entry);
    const addedIds = validProfiles.map((profile) => String(getProfileContentId(profile)));
    try {
      await persistLinks({
        contentIds: [...existingIds, ...addedIds],
        newProfiles: buildNewProfiles(validProfiles),
        finish: true,
      });
    } catch {
      // Error already surfaced via generalError.
    }
  };

  const handleContentUploaded = async (contentProfile) => {
    setUploadInProgress(false);
    if (!contentProfile?.id || !getProfileContentId(contentProfile)) {
      setGeneralError(t('timeline.uploadMissing'));
      setSourceMode(null);
      return;
    }

    try {
      const existingIds = buildInitialSelectedIds(entry);
      const uploadedId = String(getProfileContentId(contentProfile));
      await persistLinks({
        contentIds: [...existingIds, uploadedId],
        newProfiles: buildNewProfiles([contentProfile]),
        finish: true,
      });
    } catch {
      // Error already surfaced via generalError; return to choice so the user can retry.
      setSourceMode(null);
    }
  };

  const handleTopicConfirm = async () => {
    if (selectedContentIds.length === 0) {
      setGeneralError(t('timeline.selectOrBack'));
      return;
    }
    try {
      await persistLinks({
        contentIds: selectedContentIds,
        newProfiles: [],
        finish: true,
      });
    } catch {
      // Error already surfaced via generalError.
    }
  };

  const handleRemoveLinkedContent = async (contentId) => {
    const nextIds = selectedContentIds.filter((id) => id !== String(contentId));
    setSelectedContentIds(nextIds);
    try {
      await persistLinks({ contentIds: nextIds, newProfiles: [] });
    } catch {
      setSelectedContentIds(buildInitialSelectedIds(entry));
    }
  };

  const secondaryAction = showSkip ? onSkip : onCancel;
  const secondaryLabel = showSkip ? t('timeline.skip') : t('common.back');
  const busy = saving || uploadInProgress;
  const errorAlert = (error || generalError) && (
    <Alert severity="error" sx={{ mb: 2 }}>
      {error || generalError}
    </Alert>
  );

  if (sourceMode === 'topic') {
    return (
      <Box>
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={backToChoice}
          sx={{ mb: 2, textTransform: 'none' }}
          disabled={busy}
        >
          {t('common.back')}
        </Button>
        {errorAlert}
        <TopicTimelineContentSelector
          items={availableContents}
          selectedIds={selectedContentIds}
          loading={loadingContents}
          onSelectionChange={setSelectedContentIds}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            onClick={handleTopicConfirm}
            disabled={busy}
            sx={{ textTransform: 'none' }}
          >
            {busy ? t('timeline.linking') : t('timeline.linkSelected')}
          </Button>
        </Box>
      </Box>
    );
  }

  if (sourceMode === 'library') {
    return (
      <Box>
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={backToChoice}
          sx={{ mb: 2, textTransform: 'none' }}
          disabled={busy}
        >
          {t('common.back')}
        </Button>
        {errorAlert}
        <LibrarySelectMultiple
          title={t('suggestion.selectTitle')}
          description={t('timeline.libraryConfirmHelp')}
          onCancel={backToChoice}
          onSave={handleLibrarySave}
          filterFunction={filterLibraryContent}
          confirmLabel={t('timeline.link')}
          confirmingLabel={t('timeline.linking')}
          compact
        />
      </Box>
    );
  }

  if (sourceMode === 'upload') {
    return (
      <Box>
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={backToChoice}
          sx={{ mb: 2, textTransform: 'none' }}
          disabled={busy}
        >
          {t('common.back')}
        </Button>
        {errorAlert}
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {uploadMode === 'url'
              ? t('timeline.urlLinkHelp')
              : t('timeline.fileLinkHelp')}
          </Typography>
          <UploadContentForm
            onContentUploaded={handleContentUploaded}
            onUploadingChange={setUploadInProgress}
            initialUrlMode={uploadMode === 'url'}
            showModeToggle={false}
          />
        </Paper>
      </Box>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}
    >
      <Stack spacing={2.5}>
        {errorAlert}

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t('timeline.linkRelatedTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {showSkip
              ? t('timeline.linkOptionalHelp')
              : t('timeline.linkRequiredHelp')}
          </Typography>
        </Box>

        {selectedContentIds.length > 0 && (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {selectedContentIds.map((id) => {
              const item = topicContentById.get(String(id));
              return (
                <Chip
                  key={`linked-${id}`}
                  label={item ? getTopicItemTitle(item, t('common.content')) : t('chat.contentId', { id })}
                  onDelete={busy ? undefined : () => handleRemoveLinkedContent(id)}
                  variant="outlined"
                  size="small"
                />
              );
            })}
          </Stack>
        )}

        <Stack spacing={1.5}>
          <Button
            variant="contained"
            onClick={() => { setGeneralError(''); setSourceMode('topic'); }}
            disabled={busy}
            sx={{ textTransform: 'none', py: 1.5 }}
          >
            {t('timeline.topicContents')}
          </Button>
          <Button
            variant="outlined"
            onClick={() => { setGeneralError(''); setSourceMode('library'); }}
            disabled={busy}
            sx={{ textTransform: 'none', py: 1.5 }}
          >
            {t('timeline.fromLibrary')}
          </Button>
          <Button
            variant="outlined"
            onClick={() => { setGeneralError(''); setUploadMode('url'); setSourceMode('upload'); }}
            disabled={busy}
            sx={{ textTransform: 'none', py: 1.5 }}
          >
            {t('suggestion.fromUrl')}
          </Button>
          <Button
            variant="outlined"
            onClick={() => { setGeneralError(''); setUploadMode('file'); setSourceMode('upload'); }}
            disabled={busy}
            sx={{ textTransform: 'none', py: 1.5 }}
          >
            {t('suggestion.uploadFile')}
          </Button>
        </Stack>
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
        {secondaryAction && (
          <Button type="button" onClick={secondaryAction} disabled={busy}>
            {secondaryLabel}
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default TopicTimelineEntryContentLinkForm;
