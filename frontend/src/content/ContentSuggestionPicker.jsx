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
import LibrarySelectMultiple from './LibrarySelectMultiple';
import UploadContentForm from './UploadContentForm';

const getProfileContentId = (profile) => profile?.content?.id;

const ContentSuggestionPicker = ({
  selectedProfiles = [],
  onSelectionChange,
  disabled = false,
  title = 'Contenidos de tu biblioteca o nuevos',
  description = 'Elige contenidos de tu biblioteca, desde una URL o subiendo un archivo.',
}) => {
  const [step, setStep] = useState('choice');
  const [uploadMode, setUploadMode] = useState('file');
  const [uploadInProgress, setUploadInProgress] = useState(false);

  const selectedIds = useMemo(
    () => selectedProfiles.map((profile) => profile.id).filter(Boolean),
    [selectedProfiles],
  );

  const handleAddProfiles = (profiles) => {
    const map = new Map(selectedProfiles.map((profile) => [profile.id, profile]));
    profiles.forEach((profile) => {
      if (profile?.id) map.set(profile.id, profile);
    });
    onSelectionChange([...map.values()]);
  };

  const handleContentUploaded = (contentProfile) => {
    if (contentProfile?.id) {
      onSelectionChange([...selectedProfiles, contentProfile].filter(
        (profile, index, arr) => arr.findIndex((item) => item.id === profile.id) === index,
      ));
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
          Volver
        </Button>
        <LibrarySelectMultiple
          onCancel={() => setStep('choice')}
          onSave={(profiles) => {
            handleAddProfiles(profiles);
            setStep('choice');
          }}
          onSelectionChange={handleAddProfiles}
          title="Seleccionar contenido"
          maxSelections={null}
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
          Volver
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {uploadMode === 'url'
            ? 'Indica la URL del contenido que quieres proponer.'
            : 'Sube el archivo del contenido que quieres proponer.'}
        </Typography>
        <UploadContentForm
          onContentUploaded={handleContentUploaded}
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
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {description}
      </Typography>

      {selectedProfiles.length > 0 && (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
          {selectedProfiles.map((profile) => (
            <Chip
              key={profile.id}
              label={profile.title || profile.content?.original_title || 'Contenido'}
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
          Elegir de la biblioteca
        </Button>
        <Button
          variant="outlined"
          onClick={() => { setUploadMode('url'); setStep('upload'); }}
          disabled={disabled}
          sx={{ textTransform: 'none' }}
        >
          Desde URL
        </Button>
        <Button
          variant="outlined"
          onClick={() => { setUploadMode('file'); setStep('upload'); }}
          disabled={disabled}
          sx={{ textTransform: 'none' }}
        >
          Subir archivo
        </Button>
      </Stack>

      {selectedProfiles.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Opcional: puedes proponer contenidos relacionados ademas de los que ya estan en el tema.
        </Alert>
      )}
    </Paper>
  );
};

export { getProfileContentId };
export default ContentSuggestionPicker;
