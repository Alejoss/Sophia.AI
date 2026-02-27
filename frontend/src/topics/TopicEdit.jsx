import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Divider,
  Alert,
  IconButton,
  Modal,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SaveIcon from "@mui/icons-material/Save";
import contentApi from "../api/contentApi";
import { useAuth } from "../context/AuthContext";
import TopicModerators from "./TopicModerators";
import ContentSuggestionsManager from "./ContentSuggestionsManager";

const ImageUploadModal = ({
  open,
  handleClose,
  handleImageUpload,
  existingImageUrl,
  existingFocalX = 0.5,
  existingFocalY = 0.5,
  onFocalOnlyUpdate,
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

  React.useEffect(() => {
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
          {showChoice ? "Editar imagen del tema" : showPreview && mode === "focal_only" ? "Cambiar zona de la portada" : "Subir Imagen del Tema"}
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

const TopicEdit = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageCacheBuster, setImageCacheBuster] = useState(0);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  const isFormDirty =
    topic &&
    (formData.title !== (topic.title || "") ||
      formData.description !== (topic.description || ""));

  const isCreator = user && topic && topic.creator === user.id;

  useEffect(() => {
    const fetchTopic = async () => {
      try {
        const data = await contentApi.getTopicDetails(topicId);
        setTopic(data);
        setFormData({
          title: data.title || "",
          description: data.description || "",
        });
        setLoading(false);
      } catch (err) {
        setError("Error al cargar los detalles del tema");
        setLoading(false);
      }
    };

    fetchTopic();
  }, [topicId]);

  const handleImageUpload = async (file, focalX = 0.5, focalY = 0.5) => {
    const formData = new FormData();
    formData.append("topic_image", file);
    formData.append("topic_image_focal_x", String(focalX));
    formData.append("topic_image_focal_y", String(focalY));

    try {
      const updatedTopic = await contentApi.updateTopicImage(topicId, formData);
      setTopic((prev) => (prev ? { ...prev, ...updatedTopic } : updatedTopic));
      setImageCacheBuster(Date.now());
      setError(null);
    } catch (err) {
      setError("Error al actualizar la imagen del tema");
    }
  };

  const handleFocalOnlyUpdate = async (focalX, focalY) => {
    try {
      const updatedTopic = await contentApi.updateTopic(topicId, {
        topic_image_focal_x: focalX,
        topic_image_focal_y: focalY,
      });
      setTopic((prev) => (prev ? { ...prev, ...updatedTopic } : updatedTopic));
      setImageCacheBuster(Date.now());
      setError(null);
    } catch (err) {
      setError("Error al actualizar el foco de la imagen");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updatedTopic = await contentApi.updateTopic(topicId, formData);
      setTopic(updatedTopic);
      setError(null);
      navigate(`/content/topics/${topicId}`);
    } catch (err) {
      setError("Error al actualizar los detalles del tema");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Typography>Cargando detalles del tema...</Typography>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!topic) return <Alert severity="info">Tema no encontrado</Alert>;

  return (
    <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 1.5 }, maxWidth: 800, mx: "auto" }}>
      <Paper sx={{ p: 1.5, position: "relative" }}>
        {/* Ver Tema (left), Editar Contenido + Guardar Cambios (right) */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
            minWidth: 0,
          }}
        >
          <Button
            component={Link}
            to={`/content/topics/${topicId}`}
            variant="text"
            startIcon={<ArrowBackIcon />}
            size="small"
            sx={{ textTransform: "none" }}
          >
            Ver Tema
          </Button>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/content/topics/${topicId}/edit-content`)}
              size="small"
            >
              Editar Contenido
            </Button>
            <Button
              type="submit"
              form="topic-edit-form"
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              disabled={saving || !formData.title || !isFormDirty}
              size="small"
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </Box>
        </Box>

        {/* Topic Image - portada (más ancha que alta, 16:9) */}
        <Box
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            maxHeight: 280,
            borderRadius: "4px",
            overflow: "hidden",
            mb: 3,
          }}
        >
          <img
            src={
              topic.topic_image
                ? `${topic.topic_image}${imageCacheBuster ? `?t=${imageCacheBuster}` : ""}`
                : "/default-topic-image.png"
            }
            alt={topic.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `${((topic.topic_image_focal_x ?? 0.5) * 100).toFixed(1)}% ${((topic.topic_image_focal_y ?? 0.5) * 100).toFixed(1)}%`,
            }}
          />
          <Button
            component="span"
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => setIsModalOpen(true)}
            sx={{
              position: "absolute",
              bottom: 8,
              right: 8,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.8)",
              },
            }}
          >
            Editar Imagen
          </Button>
        </Box>

        {/* Topic Title and Description Form */}
        <Box>
            <form id="topic-edit-form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Título"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                margin="normal"
                required
                error={!formData.title}
                helperText={!formData.title ? "El título es requerido" : ""}
              />
              <TextField
                fullWidth
                label="Descripción"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                margin="normal"
                multiline
                minRows={8}
                maxRows={24}
                placeholder="Describe el tema"
              />
            </form>
          </Box>

        <Divider sx={{ my: 3 }} />

        {/* Moderators Section - Only visible to creator */}
        {isCreator && (
          <Box sx={{ mb: 3 }}>
            <TopicModerators
              topicId={topicId}
              onModeratorsUpdate={(updatedTopic) => {
                setTopic(updatedTopic);
              }}
            />
          </Box>
        )}

        {isCreator && <Divider sx={{ my: 3 }} />}

        {/* Content Suggestions Section - Only visible to creator/moderators */}
        {(isCreator || (topic.moderators && topic.moderators.some(mod => mod.id === user?.id))) && (
          <>
            <Box sx={{ mb: 3 }}>
              <ContentSuggestionsManager
                topicId={topicId}
                onSuggestionProcessed={async () => {
                  // Refresh topic data after suggestion is processed
                  try {
                    const updatedTopic = await contentApi.getTopicDetails(topicId);
                    setTopic(updatedTopic);
                  } catch (err) {
                    console.error('Error refreshing topic:', err);
                  }
                }}
              />
            </Box>
            <Divider sx={{ my: 3 }} />
          </>
        )}

        <Box sx={{ mb: 3 }}>
          <Typography 
            variant="h6" 
            gutterBottom 
            color="text.primary"
            sx={{
              fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "18px"
            }}
          >
            Contenido del Tema
          </Typography>

          {topic.contents?.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              {(() => {
                // Contar contenido por tipo
                const counts = {
                  VIDEO: 0,
                  AUDIO: 0,
                  TEXT: 0,
                  IMAGE: 0
                };
                
                topic.contents.forEach(content => {
                  const mediaType = content.media_type;
                  if (mediaType && counts.hasOwnProperty(mediaType)) {
                    counts[mediaType]++;
                  }
                });

                const typeLabels = {
                  VIDEO: 'Videos',
                  AUDIO: 'Audios',
                  TEXT: 'Textos',
                  IMAGE: 'Imágenes'
                };

                const typesWithContent = Object.keys(counts).filter(type => counts[type] > 0);

                return (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                    {typesWithContent.map(type => (
                      <Chip
                        key={type}
                        label={`${typeLabels[type]}: ${counts[type]}`}
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: '0.875rem' }}
                      />
                    ))}
                    {typesWithContent.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Sin contenido clasificado
                      </Typography>
                    )}
                  </Box>
                );
              })()}
            </Box>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Aún no se ha agregado contenido a este tema.
            </Alert>
          )}
        </Box>
      </Paper>

      <ImageUploadModal
        open={isModalOpen}
        handleClose={() => setIsModalOpen(false)}
        handleImageUpload={handleImageUpload}
        existingImageUrl={topic?.topic_image}
        existingFocalX={topic?.topic_image_focal_x ?? 0.5}
        existingFocalY={topic?.topic_image_focal_y ?? 0.5}
        onFocalOnlyUpdate={handleFocalOnlyUpdate}
      />
    </Box>
  );
};

export default TopicEdit;
