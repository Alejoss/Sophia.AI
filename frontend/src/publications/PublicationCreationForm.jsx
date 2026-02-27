import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TextField,
  Button,
  Box,
  Typography,
  Paper,
  Divider,
} from "@mui/material";
import contentApi from "../api/contentApi";
import ContentSelector from "../content/ContentSelector";

const PublicationCreationForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    text_content: "",
    status: "PUBLISHED",
  });
  const [selectedContent, setSelectedContent] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingContent, setIsUploadingContent] = useState(false);
  const [hasPendingContent, setHasPendingContent] = useState(false);

  const handleContentSelected = (contentProfile) => {
    console.log("Content selected for publication:", contentProfile);
    setSelectedContent(contentProfile);
  };

  const handleContentRemoved = () => {
    setSelectedContent(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const publicationData = {
        ...formData,
        content_profile_id: selectedContent?.id || null,
      };
      console.log("Sending publication data:", publicationData);
      await contentApi.createPublication(publicationData);
      navigate("/profiles/my_profile");
    } catch (err) {
      setError("Error al crear la publicación");
      console.error("Error creating publication:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/profiles/my_profile");
  };

  return (
    <Box sx={{ p: 3 }}>
<Typography
  variant="h4"
  color="#000"
  gutterBottom
  sx={{
    fontSize: {
      xs: "1.5rem",  // ~24px on mobile
      sm: "1.75rem", // ~28px on small screens
      md: "2.125rem" // ~34px (default h4) on desktop
    },
    fontWeight: 600, // optional if you want it bolder
  }}
>
        Crear Nueva Publicación
      </Typography>

      <ContentSelector
        selectedContent={selectedContent}
        onContentSelected={handleContentSelected}
        onContentRemoved={handleContentRemoved}
        previewVariant="detailed"
        onUploadingChange={setIsUploadingContent}
        onPendingContentChange={setHasPendingContent}
      />

      <Paper elevation={2} sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Detalles de la Publicación
        </Typography>

        <TextField
          fullWidth
          multiline
          minRows={5}
          maxRows={24}
          label="Contenido de Texto"
          value={formData.text_content}
          onChange={(e) =>
            setFormData({ ...formData, text_content: e.target.value })
          }
          required
          sx={{ mb: 3 }}
        />

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: {
                xs: "block",
                md: "flex",
              }, gap: 2, justifyContent: "flex-end" }}>
          <Button  sx={{
                mb: {
                  xs: 1.25, // 10px on mobile (xs–sm) → 1.25 * 8px = 10px
                  md: 0, // 0 on desktop (md+)
                },
              }}
            variant="outlined"
            onClick={handleCancel}
            disabled={isLoading || isUploadingContent}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isLoading || isUploadingContent || hasPendingContent}
          >
            {isLoading ? "Creando..." : "Crear Publicación"}
          </Button>
        </Box>
      </Paper>

      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

export default PublicationCreationForm;
