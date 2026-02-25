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

const ImageUploadModal = ({ open, handleClose, handleImageUpload }) => {
  const [error, setError] = useState(null);

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

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="image-upload-modal"
    >
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 400,
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
            fontSize: "18px"
          }}
        >
          Subir Imagen del Tema
        </Typography>

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
            <ListItemText primary="Recomendado: imagen en proporción 1:1 (cuadrada)" />
          </ListItem>
        </List>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
          <Button variant="contained" color="primary" component="label">
            Subir Imagen
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const validationError = validateFile(file);
                  if (validationError) {
                    setError(validationError);
                  } else {
                    setError(null);
                    handleImageUpload(file);
                    handleClose();
                  }
                }
                e.target.value = "";
              }}
            />
          </Button>
          <Button variant="outlined" onClick={handleClose}>
            Cancelar
          </Button>
        </Box>
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

  const handleImageUpload = async (file) => {
    const formData = new FormData();
    formData.append("topic_image", file);

    try {
      const updatedTopic = await contentApi.updateTopicImage(topicId, formData);
      setTopic((prev) => (prev ? { ...prev, ...updatedTopic } : updatedTopic));
      setImageCacheBuster(Date.now());
      setError(null);
    } catch (err) {
      setError("Error al actualizar la imagen del tema");
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

        <Box
          sx={{
            display: {
              xs: "block", // mobile
              md: "flex", // from md and up
            },
            alignItems: "flex-start",
            gap: 3,
            mb: 3,
          }}
        >
          {/* Topic Image */}
         <Box
  sx={{
    position: "relative",
    width: {
      xs: 160, // smaller on mobile
      sm: 160, // small tablets
      md: 200, // default on desktop
    },
    height: {
      xs: 160,
      sm: 160,
      md: 200,
    },
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
                borderRadius: "2px",
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
          <Box sx={{ flex: 1 }}>
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
      />
    </Box>
  );
};

export default TopicEdit;
