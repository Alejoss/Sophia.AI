import React, { useState, useCallback, memo } from "react";
import { Box, Button, Typography, Paper, ToggleButtonGroup, ToggleButton } from "@mui/material";
import LibrarySelectSingle from "./LibrarySelectSingle";
import UploadContentForm from "./UploadContentForm";
import ContentDisplay from "./ContentDisplay";

// ContentDisplay Mode: "simple" - Fast loading for content selection interface
const ContentSelector = ({
  onContentSelected,
  selectedContent,
  onContentRemoved,
  showPreview = true,
  previewVariant = "detailed",
  onUploadingChange,
  onPendingContentChange,
}) => {
  const [showContentOptions, setShowContentOptions] = useState(
    !selectedContent
  );
  const [contentMode, setContentMode] = useState(null); // null, 'library', 'upload'
  const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'url'
  const [showContentModal, setShowContentModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hasPendingContent, setHasPendingContent] = useState(false);

  const handlePendingContentChange = useCallback((pending) => {
    setHasPendingContent(pending);
    if (onPendingContentChange) onPendingContentChange(pending);
  }, [onPendingContentChange]);

  const handleUploadingChange = useCallback((uploading) => {
    setIsUploading(uploading);
    if (onUploadingChange) {
      onUploadingChange(uploading);
    }
  }, [onUploadingChange]);
  
  const handleModeSelect = useCallback((mode) => {
    if (mode === 'library') {
      setShowContentModal(true);
    } else {
      setContentMode(mode);
    }
  }, []);
  
  const handleCancelUpload = useCallback(() => {
    setContentMode(null);
    setIsUploading(false);
    setHasPendingContent(false);
    if (onPendingContentChange) onPendingContentChange(false);
    if (onUploadingChange) {
      onUploadingChange(false);
    }
  }, [onUploadingChange, onPendingContentChange]);

  const handleContentUpload = useCallback((uploadedContent) => {
    console.log("Uploaded content received:", uploadedContent);
    onContentSelected(uploadedContent);
    setContentMode(null);
    setShowContentOptions(false);
    setIsUploading(false);
    setHasPendingContent(false);
    if (onPendingContentChange) onPendingContentChange(false);
    if (onUploadingChange) {
      onUploadingChange(false);
    }
  }, [onContentSelected, onUploadingChange, onPendingContentChange]);

  const handleContentSelect = useCallback((selectedContent) => {
    console.log("Selected content received:", selectedContent);
    onContentSelected(selectedContent);
    setShowContentModal(false);
    setShowContentOptions(false);
    setContentMode(null);
  }, [onContentSelected]);

  const handleRemoveContent = useCallback(() => {
    onContentRemoved();
    setShowContentOptions(true);
    setContentMode(null);
  }, [onContentRemoved]);

  return (
    <Box>
      {showContentOptions && !contentMode && (
        <Paper elevation={2} sx={{ p: 4, mb: 4 }}>
          <Typography
            variant="h6"
            gutterBottom
            align="center"
            sx={{
              fontSize: {
                xs: "0.9rem",
                sm: "1rem",
                md: "1.25rem",
              },
              mb: 3,
            }}
          >
            Elegir fuente de contenido (Opcional)
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleModeSelect('library')}
              disabled={isUploading}
              size="large"
              sx={{ 
                textTransform: 'none',
                py: 2,
                fontSize: '1rem',
                fontWeight: 500,
                boxShadow: 2,
                '&:hover': {
                  boxShadow: 3,
                  backgroundColor: 'primary.dark',
                }
              }}
            >
              Elegir de la biblioteca
            </Button>
            
            {/* Integrated Upload Mode Selection */}
            <Box>
              <ToggleButtonGroup
                value={uploadMode}
                exclusive
                onChange={(e, newMode) => {
                  if (newMode !== null) {
                    // User clicked a button - set the mode and show form
                    setUploadMode(newMode);
                    setContentMode('upload');
                  } else {
                    // User clicked the selected button - still show the form with current mode
                    setContentMode('upload');
                  }
                }}
                fullWidth
                sx={{
                  '& .MuiToggleButton-root': {
                    py: 2,
                    px: 3,
                    textTransform: 'none',
                    fontSize: '1rem',
                    fontWeight: 500,
                    border: '2px solid',
                    borderColor: 'divider',
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      borderColor: 'primary.main',
                      boxShadow: 2,
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                        boxShadow: 3,
                      }
                    },
                    '&:not(.Mui-selected)': {
                      backgroundColor: 'background.paper',
                      color: 'text.primary',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      }
                    }
                  }
                }}
              >
                <ToggleButton value="url" aria-label="subir contenido desde url">
                  Desde URL
                </ToggleButton>
                <ToggleButton value="file" aria-label="subir archivo">
                  Subir Archivo
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
        </Paper>
      )}

      {contentMode === 'upload' && (
        <Box sx={{ mb: 4 }}>
          <Button
            variant="text"
            onClick={handleCancelUpload}
            sx={{ mb: 2, textTransform: 'none' }}
            disabled={isUploading}
          >
            ← Cancelar
          </Button>
          <UploadContentForm 
            onContentUploaded={handleContentUpload}
            onUploadingChange={handleUploadingChange}
            onHasPendingContentChange={handlePendingContentChange}
            initialUrlMode={uploadMode === 'url'}
            showModeToggle={false}
          />
        </Box>
      )}

      {selectedContent && showPreview && (
        <ContentDisplay
          content={selectedContent}
          variant="simple"
          showActions={true}
          onRemove={handleRemoveContent}
          onEdit={() => {
            setShowContentOptions(true);
            setContentMode(null);
          }}
        />
      )}

      <LibrarySelectSingle
        isOpen={showContentModal}
        onClose={() => setShowContentModal(false)}
        onSelect={handleContentSelect}
        isLoading={isUploading}
        compact={true}
      />
    </Box>
  );
};

export default memo(ContentSelector);
