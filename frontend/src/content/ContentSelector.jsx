import React, { useState } from "react";
import { Box, Button, Typography, Paper } from "@mui/material";
import ContentSearchModal from "./ContentSearchModal";
import UploadContentForm from "./UploadContentForm";
import ContentDisplay from "./ContentDisplay";

// ContentDisplay Mode: "simple" - Fast loading for content selection interface
const ContentSelector = ({
  onContentSelected,
  selectedContent,
  onContentRemoved,
  showPreview = true,
  previewVariant = "detailed",
}) => {
  const [showContentOptions, setShowContentOptions] = useState(
    !selectedContent
  );
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleContentUpload = (uploadedContent) => {
    console.log("Uploaded content received:", uploadedContent);
    onContentSelected(uploadedContent);
    setShowUploadForm(false);
    setShowContentOptions(false);
    setIsUploading(false);
  };

  const handleContentSelect = (selectedContent) => {
    console.log("Selected content received:", selectedContent);
    onContentSelected(selectedContent);
    setShowContentModal(false);
    setShowContentOptions(false);
  };

  const handleRemoveContent = () => {
    onContentRemoved();
    setShowContentOptions(true);
  };

  return (
    <Box>
      {showContentOptions && (
        <Paper elevation={2} sx={{ p: 4, mb: 4 }}>
          <Typography
            variant="h6"
            gutterBottom
            align="center"
            sx={{
              fontSize: {
                xs: "0.9rem", // smaller on mobile (~14px)
                sm: "1rem", // normal (~16px) on small screens
                md: "1.25rem", // default h6 size (~20px) on desktop
              },
            }}
          >
            Choose Content Source (Optional)
          </Typography>
          <Box
            sx={{
              display: {
                xs: "block", // mobile
                md: "flex", // md and up
              },
              justifyContent: "center",
              gap: {
                xs: 2, // add vertical spacing on mobile
                md: 2, // normal horizontal gap on flex
              },
              mt: 3,
              "& > *:not(:last-child)": {
                mb: {
                  xs: 2, // margin-bottom on mobile
                  md: 0, // reset on desktop
                },
              },
            }}
          >
            <Button
              variant="contained"
              color="primary"
              onClick={() => setShowContentModal(true)}
              disabled={isUploading}
            >
              Choose from Library
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                setShowUploadForm(true);
                setIsUploading(true);
              }}
              disabled={isUploading}
            >
              Upload New Content
            </Button>
          </Box>
        </Paper>
      )}

      {showUploadForm && (
        <Box sx={{ mb: 4 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setShowUploadForm(false);
              setIsUploading(false);
            }}
            sx={{ mb: 2 }}
          >
            ← Back
          </Button>
          <UploadContentForm onContentUploaded={handleContentUpload} />
        </Box>
      )}

      {selectedContent && showPreview && (
        <ContentDisplay
          content={selectedContent}
          variant="simple"
          showActions={true}
          onRemove={handleRemoveContent}
          onEdit={() => setShowContentOptions(true)}
        />
      )}

      <ContentSearchModal
        isOpen={showContentModal}
        onClose={() => setShowContentModal(false)}
        onSelectContent={handleContentSelect}
        isLoading={isUploading}
      />
    </Box>
  );
};

export default ContentSelector;
