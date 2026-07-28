import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ContentSuggestionPicker, { getProfileContentId } from '../../content/ContentSuggestionPicker';
import TopicTimelineContentSelector from './TopicTimelineContentSelector';

const buildInitialSelectedIds = (entry) => {
  const links = [...(entry?.contents || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return links.map((link) => String(link.content?.id)).filter(Boolean);
};

const TopicTimelineEntryContentLinkForm = ({
  entry,
  availableContents,
  loadingContents,
  saving,
  error,
  onSkip,
  onCancel,
  onSubmit,
  showSkip = false,
}) => {
  const [selectedContentIds, setSelectedContentIds] = useState(() => buildInitialSelectedIds(entry));
  const [externalProfiles, setExternalProfiles] = useState([]);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    setSelectedContentIds(buildInitialSelectedIds(entry));
    setExternalProfiles([]);
    setLocalError(null);
  }, [entry]);

  const topicContentIdSet = useMemo(() => {
    const ids = new Set();
    (availableContents || []).forEach((item) => {
      const content = item?.content || item;
      if (content?.id != null) ids.add(String(content.id));
    });
    return ids;
  }, [availableContents]);

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
            Este paso es opcional. Puedes adjuntar contenidos que ya estan en el tema
            o agregar uno nuevo desde tu biblioteca, una URL o un archivo.
          </Typography>
        </Box>

        <TopicTimelineContentSelector
          items={availableContents}
          selectedIds={selectedContentIds}
          loading={loadingContents}
          onSelectionChange={setSelectedContentIds}
        />

        <Divider>o</Divider>

        <ContentSuggestionPicker
          selectedProfiles={externalProfiles}
          onSelectionChange={setExternalProfiles}
          disabled={saving}
          title="Nuevo contenido"
          description="Elige material de tu biblioteca, desde una URL o subiendo un archivo. Se agregara al tema y se vincula a esta entrada."
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
        {secondaryAction && (
          <Button type="button" onClick={secondaryAction} disabled={saving}>
            {secondaryLabel}
          </Button>
        )}
        <Button
          type="button"
          variant="contained"
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Guardar contenidos'}
        </Button>
      </Box>
    </Paper>
  );
};

export default TopicTimelineEntryContentLinkForm;
