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
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Tooltip,
  Stack,
  AlertTitle,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SaveIcon from "@mui/icons-material/Save";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import contentApi from "../api/contentApi";
import { useAuth } from "../context/AuthContext";
import TopicModerators from "./TopicModerators";
import ContentSuggestionsManager from "./ContentSuggestionsManager";
import ImageUploadModal from "../components/ImageUploadModal";

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
    is_visible: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingTopic, setIsDeletingTopic] = useState(false);

  const contentCount = topic?.contents?.length ?? 0;
  const canBePublic =
    Boolean(topic?.can_be_visible) && contentCount >= 3;

  const isFormDirty =
    topic &&
    (formData.title !== (topic.title || "") ||
      formData.description !== (topic.description || "") ||
      Boolean(formData.is_visible) !== Boolean(topic.is_visible));

  const creatorId = topic ? (typeof topic.creator === "object" ? topic.creator?.id : topic.creator) : null;
  const userId = user?.id;
  const isCreator =
    !!user &&
    !!topic &&
    creatorId != null &&
    userId != null &&
    String(creatorId) === String(userId);

  useEffect(() => {
    const fetchTopic = async () => {
      try {
        const data = await contentApi.getTopicDetails(topicId);
        setTopic(data);
        setFormData({
          title: data.title || "",
          description: data.description || "",
          is_visible: Boolean(data.is_visible),
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
    setSaveError(null);
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
      };
      if (isCreator) {
        payload.is_visible = Boolean(formData.is_visible);
      }
      const updatedTopic = await contentApi.updateTopic(topicId, payload);
      setTopic(updatedTopic);
      setFormData((prev) => ({
        ...prev,
        is_visible: Boolean(updatedTopic.is_visible),
      }));
      setError(null);
      navigate(`/content/topics/${topicId}`);
    } catch (err) {
      const msg =
        err?.response?.data?.is_visible?.[0] ||
        err?.response?.data?.is_visible ||
        err?.response?.data?.detail ||
        err?.response?.data?.error;
      setSaveError(msg || "Error al actualizar los detalles del tema");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTopic = async () => {
    setIsDeletingTopic(true);
    try {
      await contentApi.deleteTopic(topicId);
      setDeleteDialogOpen(false);
      navigate("/content/topics", { replace: true });
    } catch (err) {
      setError(err?.error || err?.detail || "Error al eliminar el tema. Por favor, inténtelo de nuevo.");
    } finally {
      setIsDeletingTopic(false);
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
              {saveError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
                  {saveError}
                </Alert>
              )}
              {isCreator && !canBePublic && (
                <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ borderRadius: 2, mb: 2 }}>
                  <AlertTitle sx={{ fontWeight: 700 }}>Aún no puedes marcarlo como público</AlertTitle>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Para que el tema sea público en listados y búsqueda necesitas <strong>al menos 3 contenidos</strong> en el tema.
                    Actualmente hay <strong>{contentCount}</strong>.
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/content/topics/${topicId}/edit-content`)}
                    sx={{ textTransform: "none", borderRadius: 2 }}
                  >
                    Ir a editar contenido
                  </Button>
                </Alert>
              )}

              {isCreator && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: "wrap" }}>
                  <Chip
                    size="small"
                    icon={formData.is_visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                    label={formData.is_visible ? "Público" : "No público"}
                    color={formData.is_visible ? "success" : "default"}
                    variant={formData.is_visible ? "filled" : "outlined"}
                  />
                  <Tooltip
                    title={
                      !canBePublic && !formData.is_visible
                        ? "Necesitas al menos 3 contenidos en el tema para hacerlo público."
                        : ""
                    }
                    disableHoverListener={canBePublic || formData.is_visible}
                  >
                    <span>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(formData.is_visible)}
                            disabled={!canBePublic && !formData.is_visible}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, is_visible: e.target.checked }))
                            }
                          />
                        }
                        label={
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            {formData.is_visible ? (
                              <VisibilityIcon fontSize="small" />
                            ) : (
                              <VisibilityOffIcon fontSize="small" />
                            )}
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Visible en listados y búsqueda
                            </Typography>
                          </Stack>
                        }
                      />
                    </span>
                  </Tooltip>
                </Stack>
              )}

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

        {isCreator && (
          <Paper
            elevation={1}
            sx={{
              mt: 4,
              p: 3,
              borderRadius: 3,
              border: "1px solid",
              borderColor: "error.light",
            }}
          >
            <Typography variant="h6" color="error" sx={{ fontWeight: 700, mb: 1 }}>
              Zona de peligro
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Si eliminas este tema se borrarán también su contenido asociado, moderadores e invitaciones y no podrás recuperarlos.
            </Typography>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={() => setDeleteDialogOpen(true)}
              sx={{ textTransform: "none" }}
            >
              Eliminar tema
            </Button>
          </Paper>
        )}
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={() => !isDeletingTopic && setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar tema</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            ¿Seguro que deseas eliminar <strong>{topic?.title || "este tema"}</strong>? Se eliminará el contenido asociado, moderadores e invitaciones y esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeletingTopic} sx={{ textTransform: "none" }}>
            Cancelar
          </Button>
          <Button onClick={handleDeleteTopic} disabled={isDeletingTopic} color="error" variant="contained" sx={{ textTransform: "none" }}>
            {isDeletingTopic ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>

      <ImageUploadModal
        open={isModalOpen}
        handleClose={() => setIsModalOpen(false)}
        handleImageUpload={handleImageUpload}
        existingImageUrl={topic?.topic_image}
        existingFocalX={topic?.topic_image_focal_x ?? 0.5}
        existingFocalY={topic?.topic_image_focal_y ?? 0.5}
        onFocalOnlyUpdate={handleFocalOnlyUpdate}
        entityLabel="tema"
      />
    </Box>
  );
};

export default TopicEdit;
