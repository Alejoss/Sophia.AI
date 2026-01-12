import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Grid,
  TextField,
  Button,
  Box,
  Typography,
  Paper,
  Divider,
} from "@mui/material";
import UploadContentForm from "../content/UploadContentForm";
import ContentSearchModal from "../content/ContentSearchModal";
import contentApi from "../api/contentApi";

const PublicationCreationForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    text_content: "",
    status: "PUBLISHED",
  });
  const [content, setContent] = useState(null);
  const [error, setError] = useState(null);
  const [showContentOptions, setShowContentOptions] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleContentUpload = (uploadedContent) => {
    console.log("Uploaded content received:", uploadedContent);
    setContent(uploadedContent);
    setShowUploadForm(false);
    setShowContentOptions(false);
    setIsUploading(false);
  };

  const handleContentSelect = (selectedContent) => {
    console.log("Selected content received:", selectedContent);
    setContent(selectedContent);
    setShowContentModal(false);
    setShowContentOptions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const publicationData = {
        ...formData,
        content_profile_id: content?.id || null,
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

  const handleUploadClick = () => {
    setShowUploadForm(true);
    setIsUploading(true);
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

      {showContentOptions && !content && (
        <Paper
          elevation={2}
          sx={{
             p: {
              xs: 1.25, // 10px on mobile (xs–sm) → 1.25 * 8px = 10px
              md: 4, // 0 on desktop (md+)
            },
            mb: {
              xs: 1.25, // 10px on mobile (xs–sm) → 1.25 * 8px = 10px
              md: 4, // 0 on desktop (md+)
            },
          }}
        >
          <Typography variant="h6" gutterBottom align="center">
            Elegir Fuente de Contenido (Opcional)
          </Typography>
          <Box
            sx={{
              display: {
                xs: "block", // mobile
                md: "flex", // md and up
              },
              justifyContent: "center",
              gap: 2,
              mt: {
                xs: 1.25, // 10px on mobile (xs–sm) → 1.25 * 8px = 10px
                md: 3, // 0 on desktop (md+)
              },
            }}
          >
            <Button
              sx={{
                mb: {
                  xs: 1.25, // 10px on mobile (xs–sm) → 1.25 * 8px = 10px
                  md: 0, // 0 on desktop (md+)
                },
              }}
              variant="contained"
              color="primary"
              size="large"
              onClick={() => setShowContentModal(true)}
            >
              Elegir Contenido de la Biblioteca
            </Button>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              onClick={handleUploadClick}
            >
              Subir Nuevo Contenido
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
            ← Volver
          </Button>
          <UploadContentForm onContentUploaded={handleContentUpload} />
        </Box>
      )}

      <Paper elevation={2} sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Detalles de la Publicación
        </Typography>

        {content && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Contenido Seleccionado:
            </Typography>
            {console.log("Content being displayed:", content)}
            <Paper
              variant="outlined"
              sx={{ p: 2, bgcolor: "background.default" }}
            >
              {content.content?.media_type === "IMAGE" &&
                content.content?.file_details?.url && (
                  <Box
                    sx={{
                      mb: 2,
                       display: {
                xs: "block", // mobile
                md: "flex", // md and up
              },
                      flexDirection: "column",
                      alignItems: "center",
                      width: "100%",
                      overflow: "hidden",
                      borderRadius: "2px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    }}
                  >
                    <img
                      src={content.content.file_details.url}
                      alt={
                        content.title ||
                        content.content?.original_title ||
                        "Sin título"
                      }
                      style={{
                        maxWidth: "100%",
                        maxHeight: "300px",
                        objectFit: "contain",
                        borderRadius: "2px 2px 0 0",
                        transition: "transform 0.3s ease",
                        cursor: "pointer",
                      }}
                      onError={(e) => {
                        console.error(
                          "Image failed to load:",
                          content.content.file_details.url
                        );
                        e.target.style.display = "none";
                      }}
                      onClick={() =>
                        window.open(content.content.file_details.url, "_blank")
                      }
                      onMouseOver={(e) =>
                        (e.target.style.transform = "scale(1.02)")
                      }
                      onMouseOut={(e) =>
                        (e.target.style.transform = "scale(1)")
                      }
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        mt: 1,
                        textAlign: "center",
                        color: "text.secondary",
                        fontStyle: "italic",
                      }}
                    >
                      {content.title ||
                        content.content?.original_title ||
                        "Sin título"}
                    </Typography>
                  </Box>
                )}
              <Typography variant="body1">
                {content.title || content.content?.original_title || "Untitled"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tipo: {content.content?.media_type}
              </Typography>
            </Paper>
            <Button
              variant="text"
              color="primary"
              onClick={() => {
                setContent(null);
                setShowContentOptions(true);
              }}
              sx={{ mt: 1 }}
            >
              Eliminar Contenido
            </Button>
          </Box>
        )}

        <TextField
          fullWidth
          multiline
          rows={4}
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
                xs: "block", // mobile
                md: "flex", // md and up
              }, gap: 2, justifyContent: "flex-end" }}>
          <Button  sx={{
                mb: {
                  xs: 1.25, // 10px on mobile (xs–sm) → 1.25 * 8px = 10px
                  md: 0, // 0 on desktop (md+)
                },
              }}
            variant="outlined"
            onClick={handleCancel}
            disabled={isLoading || isUploading}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isLoading || isUploading}
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

      <ContentSearchModal
        isOpen={showContentModal}
        onClose={() => setShowContentModal(false)}
        onSelectContent={handleContentSelect}
        isLoading={isLoading}
      />
    </Box>
  );
};

export default PublicationCreationForm;
