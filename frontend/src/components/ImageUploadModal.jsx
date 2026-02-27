import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Modal,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

/**
 * Reusable modal for image upload with focal point selection.
 * @param {string} entityLabel - Label for the entity (e.g. "tema", "camino de conocimiento")
 */
const ImageUploadModal = ({
  open,
  handleClose,
  handleImageUpload,
  existingImageUrl,
  existingFocalX = 0.5,
  existingFocalY = 0.5,
  onFocalOnlyUpdate,
  entityLabel = "tema",
}) => {
  const [error, setError] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [focalX, setFocalX] = useState(0.5);
  const [focalY, setFocalY] = useState(0.5);
  /** 'choice' = pick "new image" vs "focal only"; 'upload' = file then focal; 'focal_only' = only adjust focal on existing image */
  const [mode, setMode] = useState(null);

  const hasExistingImage = Boolean(existingImageUrl);

  const validateFile = (file) => {
    const maxSize = 2 * 1024 * 1024; // 2MB in bytes
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];

    if (!allowedTypes.includes(file.type)) {
      return "El archivo debe ser una imagen (JPEG, PNG o GIF)";
    }

    if (file.size > maxSize) {
      return "El tamaño del archivo debe ser menor a 2MB";
    }

    return null;
  };

  const onClose = () => {
    if (previewUrl && previewFile) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
    setMode(null);
    setFocalX(0.5);
    setFocalY(0.5);
    setError(null);
    handleClose();
  };

  useEffect(() => {
    if (open) {
      setMode(hasExistingImage ? "choice" : "upload");
      if (hasExistingImage) {
        setFocalX(existingFocalX);
        setFocalY(existingFocalY);
      }
    }
  }, [open, hasExistingImage, existingFocalX, existingFocalY]);

  const onFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setPreviewFile(file);
    setFocalX(0.5);
    setFocalY(0.5);
    e.target.value = "";
  };

  const onPreviewClick = (e) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setFocalX(Math.max(0, Math.min(1, x)));
    setFocalY(Math.max(0, Math.min(1, y)));
  };

  const onConfirmUpload = () => {
    if (!previewFile) return;
    handleImageUpload(previewFile, focalX, focalY);
    onClose();
  };

  const onConfirmFocalOnly = () => {
    if (typeof onFocalOnlyUpdate === "function") {
      onFocalOnlyUpdate(focalX, focalY);
    }
    onClose();
  };

  const showChoice = open && hasExistingImage && mode === "choice";
  const showUploadForm = mode === "upload" && !previewFile;
  const showPreview = (mode === "upload" && previewFile) || mode === "focal_only";
  const previewSrc = mode === "focal_only" ? existingImageUrl : previewUrl;

  const titleEdit = `Editar imagen del ${entityLabel}`;
  const titleChangeZone = "Cambiar zona de la portada";
  const titleUpload = `Subir Imagen del ${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="image-upload-modal"
    >
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: showPreview ? 480 : 400,
          maxWidth: "95vw",
          bgcolor: "background.paper",
          borderRadius: 0.5,
          boxShadow: 24,
          p: 4,
        }}
      >
        <Typography
          variant="h6"
          gutterBottom
          color="text.primary"
          sx={{
            fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
            fontWeight: 400,
            fontSize: "18px",
          }}
        >
          {showChoice ? titleEdit : showPreview && mode === "focal_only" ? titleChangeZone : titleUpload}
        </Typography>

        {showChoice ? (
          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Puedes subir una imagen nueva o solo ajustar qué parte de la imagen actual se muestra en la portada.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setMode("upload")}
            >
              Subir nueva imagen
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setMode("focal_only")}
            >
              Cambiar el foco de la imagen actual
            </Button>
            <Button variant="text" onClick={onClose} sx={{ mt: 1 }}>
              Cancelar
            </Button>
          </Box>
        ) : showUploadForm ? (
          <>
            <List>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="disabled" />
                </ListItemIcon>
                <ListItemText primary="Formatos: JPEG, PNG o GIF" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="disabled" />
                </ListItemIcon>
                <ListItemText primary="Tamaño máximo: 2MB" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="disabled" />
                </ListItemIcon>
                <ListItemText primary="Recomendado: imagen más ancha que alta (ej. 16:9, como miniatura de YouTube)" />
              </ListItem>
            </List>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
              <Button variant="contained" color="primary" component="label">
                Elegir imagen
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={onFileSelect}
                />
              </Button>
              <Button variant="outlined" onClick={onClose}>
                Cancelar
              </Button>
            </Box>
          </>
        ) : showPreview && previewSrc ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Haz clic en la zona que quieras centrar en la portada.
            </Typography>
            <Box
              onClick={onPreviewClick}
              sx={{
                position: "relative",
                width: "100%",
                aspectRatio: "16/9",
                maxHeight: 220,
                borderRadius: 1,
                overflow: "hidden",
                cursor: "crosshair",
                bgcolor: "grey.200",
                "& img": { width: "100%", height: "100%", objectFit: "cover" },
              }}
            >
              <img src={previewSrc} alt="Vista previa" />
              <Box
                sx={{
                  position: "absolute",
                  left: `${focalX * 100}%`,
                  top: `${focalY * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: "2px solid white",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
                  pointerEvents: "none",
                }}
              />
            </Box>
            <Box sx={{ mt: 2, display: "flex", gap: 2, justifyContent: "flex-end" }}>
              <Button variant="outlined" onClick={onClose}>
                Cancelar
              </Button>
              {mode === "focal_only" ? (
                <Button variant="contained" color="primary" onClick={onConfirmFocalOnly}>
                  Guardar foco
                </Button>
              ) : (
                <Button variant="contained" color="primary" onClick={onConfirmUpload}>
                  Subir imagen
                </Button>
              )}
            </Box>
          </>
        ) : null}
      </Box>
    </Modal>
  );
};

export default ImageUploadModal;
