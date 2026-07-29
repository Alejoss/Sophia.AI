import React, { useEffect, useMemo, useState } from 'react';
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
import TopicTimelineContentSelector from './TopicTimelineContentSelector';

const buildInitialSelectedIds = (entry) => {
  const links = [...(entry?.contents || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return links.map((link) => String(link.content?.id)).filter(Boolean);
};

const getTopicItemTitle = (item) => {
  const content = item?.content || item;
  return (
    item?.title
    || item?.selected_profile?.title
    || content?.original_title
    || 'Contenido'
  );
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
  showSkip = false,
}) => {
  const [sourceMode, setSourceMode] = useState(null);
  const [uploadMode, setUploadMode] = useState('file');
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [selectedContentIds, setSelectedContentIds] = useState(() => buildInitialSelectedIds(entry));
  const [externalProfiles, setExternalProfiles] = useState([]);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    setSelectedContentIds(buildInitialSelectedIds(entry));
    setExternalProfiles([]);
    setLocalError(null);
    setSourceMode(null);
  }, [entry]);

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

  const selectedProfileIds = useMemo(
    () => externalProfiles.map((profile) => profile.id).filter(Boolean),
    [externalProfiles],
  );

  const backToChoice = () => setSourceMode(null);

  const handleLibrarySelectionChange = (profiles) => {
    const valid = (profiles || []).filter((profile) => profile?.id);
    const map = new Map(externalProfiles.map((profile) => [profile.id, profile]));
    valid.forEach((profile) => map.set(profile.id, profile));
    setExternalProfiles([...map.values()]);
  };

  const handleContentUploaded = (contentProfile) => {
    if (contentProfile?.id) {
      handleLibrarySelectionChange([contentProfile]);
    }
    setSourceMode(null);
  };

  const handleRemoveTopicContent = (contentId) => {
    setSelectedContentIds((prev) => prev.filter((id) => id !== String(contentId)));
  };

  const handleRemoveProfile = (profileId) => {
    setExternalProfiles((prev) => prev.filter((profile) => profile.id !== profileId));
  };

  const filterLibraryContent = (contentProfile) => {
    if (!topicId) return true;
    const topics = contentProfile?.content?.topics || [];
    const alreadyInTopic = topics.some(
      (id) => String(id) === String(topicId),
    );
    return !alreadyInTopic;
  };

  const handleSubmit = async () => {
    setLocalError(null);

    const orderedIds = [];
    const seen = new Set();

    selectedContentIds.forEach((id) => {
      const key = String(id);
      if (!seen.has(key)) {
        seen.add(key);
        orderedIds.push(key);
      }
    });

    const newProfiles = [];
    externalProfiles.forEach((profile) => {
      const contentId = getProfileContentId(profile);
      if (!contentId) return;
      const key = String(contentId);
      if (seen.has(key)) return;
      seen.add(key);
      orderedIds.push(key);
      if (!topicContentIdSet.has(key) && profile?.id) {
        newProfiles.push(profile);
      }
    });

    const contents = orderedIds.map((id, index) => ({
      content_id: Number(id),
      order: index + 1,
      caption: '',
    }));

    try {
      await onSubmit({ contents, newProfiles });
    } catch {
      // Parent surfaces API errors via `error`.
    }
  };

  const secondaryAction = showSkip ? onSkip : onCancel;
  const secondaryLabel = showSkip ? 'Omitir' : 'Cancelar';
  const busy = saving || uploadInProgress;

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
          Volver
        </Button>
        <TopicTimelineContentSelector
          items={availableContents}
          selectedIds={selectedContentIds}
          loading={loadingContents}
          onSelectionChange={setSelectedContentIds}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            onClick={backToChoice}
            disabled={busy}
            sx={{ textTransform: 'none' }}
          >
            Listo
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
          Volver
        </Button>
        <LibrarySelectMultiple
          title="Seleccionar contenido"
          description="Selecciona contenido de tu biblioteca para vincular a esta entrada"
          onCancel={backToChoice}
          onSave={backToChoice}
          onSelectionChange={handleLibrarySelectionChange}
          filterFunction={filterLibraryContent}
          selectedIds={selectedProfileIds}
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
          Volver
        </Button>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {uploadMode === 'url'
              ? 'Indica la URL del contenido que quieres vincular.'
              : 'Sube el archivo del contenido que quieres vincular.'}
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
        {(error || localError) && (
          <Alert severity="error">{error || localError}</Alert>
        )}

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Vincular contenidos
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {showSkip
              ? 'Este paso es opcional. Elige contenidos del tema o agrega uno nuevo desde tu biblioteca, una URL o un archivo.'
              : 'Elige contenidos del tema o agrega uno nuevo desde tu biblioteca, una URL o un archivo.'}
          </Typography>
        </Box>

        {(selectedContentIds.length > 0 || externalProfiles.length > 0) && (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {selectedContentIds.map((id) => {
              const item = topicContentById.get(String(id));
              return (
                <Chip
                  key={`topic-${id}`}
                  label={item ? getTopicItemTitle(item) : `Contenido ${id}`}
                  onDelete={busy ? undefined : () => handleRemoveTopicContent(id)}
                  variant="outlined"
                  size="small"
                />
              );
            })}
            {externalProfiles.map((profile) => (
              <Chip
                key={`profile-${profile.id}`}
                label={profile.title || profile.content?.original_title || 'Contenido'}
                onDelete={busy ? undefined : () => handleRemoveProfile(profile.id)}
                variant="outlined"
                size="small"
                color="primary"
              />
            ))}
          </Stack>
        )}

        <Stack spacing={1.5}>
          <Button
            variant="contained"
            onClick={() => setSourceMode('topic')}
            disabled={busy}
            sx={{ textTransform: 'none', py: 1.5 }}
          >
            Contenidos del tema
          </Button>
          <Button
            variant="outlined"
            onClick={() => setSourceMode('library')}
            disabled={busy}
            sx={{ textTransform: 'none', py: 1.5 }}
          >
            Elegir de tu Biblioteca
          </Button>
          <Button
            variant="outlined"
            onClick={() => { setUploadMode('url'); setSourceMode('upload'); }}
            disabled={busy}
            sx={{ textTransform: 'none', py: 1.5 }}
          >
            Desde URL
          </Button>
          <Button
            variant="outlined"
            onClick={() => { setUploadMode('file'); setSourceMode('upload'); }}
            disabled={busy}
            sx={{ textTransform: 'none', py: 1.5 }}
          >
            Subir archivo
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
        <Button
          type="button"
          variant="contained"
          onClick={handleSubmit}
          disabled={busy}
        >
          {saving ? 'Guardando...' : 'Guardar contenidos'}
        </Button>
      </Box>
    </Paper>
  );
};

export default TopicTimelineEntryContentLinkForm;
