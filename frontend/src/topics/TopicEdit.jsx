import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import SettingsIcon from "@mui/icons-material/Settings";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import TimelineIcon from "@mui/icons-material/Timeline";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import contentApi from "../api/contentApi";
import { useAuth } from "../context/AuthContext";
import { applyApiErrorsToForm } from "../utils/apiFormErrors";
import ImageUploadModal from "../components/ImageUploadModal";
import TopicModerators from "./TopicModerators";
import TopicContentManager from "./TopicContentManager";
import ContentSuggestionsManager from "./ContentSuggestionsManager";
import TimelineEntrySuggestionsManager from "./timeline/TimelineEntrySuggestionsManager";
import TimelineEntryContentSuggestionsManager from "./timeline/TimelineEntryContentSuggestionsManager";
import TopicTimeline from "./timeline/TopicTimeline";

const topicSchema = yup.object({
  title: yup
    .string()
    .trim()
    .required("El título es requerido."),
  description: yup.string().trim().default(""),
});

const TAB_IDS = {
  general: "general",
  content: "content",
  timeline: "timeline",
  suggestions: "suggestions",
  moderators: "moderators",
  danger: "danger",
};

const normalizeTab = (raw, { isCreator, canManage }) => {
  const tab = (raw || "").toLowerCase();
  if (tab === "timeline-suggestions") return TAB_IDS.suggestions;
  if (tab === TAB_IDS.content) return TAB_IDS.content;
  if (tab === TAB_IDS.timeline) return TAB_IDS.timeline;
  if (tab === TAB_IDS.suggestions) return TAB_IDS.suggestions;
  if (tab === TAB_IDS.moderators && isCreator) return TAB_IDS.moderators;
  if (tab === TAB_IDS.danger && isCreator) return TAB_IDS.danger;
  if (tab === TAB_IDS.general) return TAB_IDS.general;
  return canManage ? TAB_IDS.general : TAB_IDS.general;
};

const TopicEdit = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageCacheBuster, setImageCacheBuster] = useState(0);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: yupResolver(topicSchema),
    defaultValues: { title: "", description: "" },
  });

  const titleValue = watch("title");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingTopic, setIsDeletingTopic] = useState(false);
  const [pendingTimelineSuggestionsCount, setPendingTimelineSuggestionsCount] = useState(0);
  const [pendingTimelineEntryContentSuggestionsCount, setPendingTimelineEntryContentSuggestionsCount] = useState(0);
  const [pendingContentSuggestionsCount, setPendingContentSuggestionsCount] = useState(0);

  const creatorId = topic ? (typeof topic.creator === "object" ? topic.creator?.id : topic.creator) : null;
  const userId = user?.id;
  const isCreator = !!user && !!topic && creatorId != null && userId != null && String(creatorId) === String(userId);
  const isModerator = !!topic && (topic.moderators || []).some((mod) => String(mod?.id ?? mod) === String(userId));
  const canManage = isCreator || isModerator;

  const activeTab = normalizeTab(searchParams.get("tab"), { isCreator, canManage });

  const fetchPendingCounts = async () => {
    try {
      const [contentSugg, timelineSugg, entryContentSugg] = await Promise.all([
        contentApi.getTopicContentSuggestions(topicId, { status: "PENDING" }),
        contentApi.getTopicTimelineEntrySuggestions(topicId, { status: "PENDING" }),
        contentApi.getTopicTimelineEntryContentSuggestions(topicId, { status: "PENDING" }),
      ]);
      setPendingContentSuggestionsCount(Array.isArray(contentSugg) ? contentSugg.length : 0);
      setPendingTimelineSuggestionsCount(Array.isArray(timelineSugg) ? timelineSugg.length : 0);
      setPendingTimelineEntryContentSuggestionsCount(Array.isArray(entryContentSugg) ? entryContentSugg.length : 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const fetchTopic = async () => {
      try {
        setLoading(true);
        const data = await contentApi.getTopicDetails(topicId, { include_contents: false });
        setTopic(data);
        reset({
          title: data.title || "",
          description: data.description || "",
        });
        setPageError(null);
      } catch {
        setPageError("Error al cargar los detalles del tema");
      } finally {
        setLoading(false);
      }
    };
    fetchTopic();
  }, [topicId, reset]);

  useEffect(() => {
    if (canManage) fetchPendingCounts();
  }, [topicId, canManage]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (!tab) return;
    const normalized = normalizeTab(tab, { isCreator, canManage });
    if (normalized !== tab && tab !== "timeline-suggestions") {
      setSearchParams({ tab: normalized }, { replace: true });
    }
  }, [searchParams, isCreator, canManage, setSearchParams]);

  const handleTabChange = (_, value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  const handleImageUpload = async (file, focalX = 0.5, focalY = 0.5) => {
    const payload = new FormData();
    payload.append("topic_image", file);
    payload.append("topic_image_focal_x", String(focalX));
    payload.append("topic_image_focal_y", String(focalY));
    try {
      const updatedTopic = await contentApi.updateTopicImage(topicId, payload);
      setTopic((prev) => (prev ? { ...prev, ...updatedTopic } : updatedTopic));
      setImageCacheBuster(Date.now());
      setSaveMessage("Imagen actualizada.");
    } catch {
      setPageError("Error al actualizar la imagen del tema");
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
    } catch {
      setPageError("Error al actualizar el foco de la imagen");
    }
  };

  const onSubmit = async (formData) => {
    try {
      const updatedTopic = await contentApi.updateTopic(topicId, formData);
      setTopic(updatedTopic);
      reset({
        title: updatedTopic.title || "",
        description: updatedTopic.description || "",
      });
      setSaveMessage("Cambios guardados.");
      setPageError(null);
    } catch (err) {
      const { generalError } = applyApiErrorsToForm(
        err,
        setError,
        "Error al actualizar los detalles del tema",
      );
      if (generalError) {
        setPageError(generalError);
      }
    }
  };

  const handleDeleteTopic = async () => {
    setIsDeletingTopic(true);
    try {
      await contentApi.deleteTopic(topicId);
      setDeleteDialogOpen(false);
      navigate("/content/topics", { replace: true });
    } catch (err) {
      setPageError(err?.error || err?.detail || "Error al eliminar el tema.");
    } finally {
      setIsDeletingTopic(false);
    }
  };

  const pendingSuggestionsTotal = pendingContentSuggestionsCount
    + pendingTimelineSuggestionsCount
    + pendingTimelineEntryContentSuggestionsCount;

  const tabs = useMemo(() => {
    const items = [
      { id: TAB_IDS.general, label: "General", icon: <SettingsIcon fontSize="small" /> },
      { id: TAB_IDS.content, label: "Contenido", icon: <VideoLibraryIcon fontSize="small" /> },
      { id: TAB_IDS.timeline, label: "Linea de tiempo", icon: <TimelineIcon fontSize="small" /> },
      {
        id: TAB_IDS.suggestions,
        label: pendingSuggestionsTotal > 0 ? `Sugerencias (${pendingSuggestionsTotal})` : "Sugerencias",
        icon: <LightbulbIcon fontSize="small" />,
      },
    ];
    if (isCreator) {
      items.push({ id: TAB_IDS.moderators, label: "Moderadores", icon: <SupervisorAccountIcon fontSize="small" /> });
      items.push({ id: TAB_IDS.danger, label: "Peligro", icon: <WarningAmberIcon fontSize="small" /> });
    }
    return items;
  }, [isCreator, pendingSuggestionsTotal]);

  if (loading) return <Typography sx={{ p: 3 }}>Cargando edicion del tema...</Typography>;
  if (!topic) return <Alert severity="info" sx={{ m: 3 }}>Tema no encontrado</Alert>;

  if (!canManage) {
    return (
      <Box sx={{ p: 3, maxWidth: 640, mx: "auto" }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          No tienes permiso para editar este tema.
        </Alert>
        <Button component={RouterLink} to={`/content/topics/${topicId}`} startIcon={<ArrowBackIcon />}>
          Volver al tema
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: { xs: 2, md: 3 }, px: { xs: 1, md: 2 }, pb: 4, maxWidth: 1200, mx: "auto" }}>
      <Paper elevation={1} sx={{ borderRadius: 2, overflow: "hidden", mb: 2 }}>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            justifyContent: "space-between",
            alignItems: "center",
            px: { xs: 2, md: 3 },
            py: 2,
          }}
        >
          <Button
            component={RouterLink}
            to={`/content/topics/${topicId}`}
            variant="text"
            startIcon={<ArrowBackIcon />}
            size="small"
            sx={{ textTransform: "none" }}
          >
            Ver tema
          </Button>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            {activeTab === TAB_IDS.general && isDirty && (
              <Chip size="small" label="Cambios sin guardar" color="warning" variant="outlined" />
            )}
            {activeTab === TAB_IDS.general && (
              <Button
                type="submit"
                form="topic-edit-form"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={isSubmitting || !titleValue?.trim() || !isDirty}
                size="small"
                sx={{ textTransform: "none" }}
              >
                {isSubmitting ? "Guardando..." : "Guardar cambios"}
              </Button>
            )}
          </Box>
        </Box>

        <Box
          sx={{
            position: "relative",
            aspectRatio: "16 / 9",
            maxHeight: 240,
            mx: { xs: 2, md: 3 },
            mb: 2,
            borderRadius: 1,
            overflow: "hidden",
            width: { xs: "calc(100% - 32px)", md: "calc(100% - 48px)" },
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
          {activeTab === TAB_IDS.general && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => setIsModalOpen(true)}
              sx={{
                position: "absolute",
                bottom: 8,
                right: 8,
                bgcolor: "rgba(0,0,0,0.6)",
                "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                textTransform: "none",
              }}
            >
              Editar imagen
            </Button>
          )}
        </Box>

        <Typography variant="h5" sx={{ px: { xs: 2, md: 3 }, fontWeight: 700, mb: 0.5 }}>
          Editar tema
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ px: { xs: 2, md: 3 }, mb: 1 }}>
          {topic.title}
        </Typography>

        <Divider sx={{ mt: 2 }} />

        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ px: { xs: 1, md: 2 } }}
        >
          {tabs.map((tab) => (
            <Tab key={tab.id} value={tab.id} label={tab.label} icon={tab.icon} iconPosition="start" />
          ))}
        </Tabs>
      </Paper>

      {pageError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPageError(null)}>
          {pageError}
        </Alert>
      )}

      <Paper elevation={1} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        {activeTab === TAB_IDS.general && (
          <Box component="form" id="topic-edit-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              fullWidth
              label="Titulo"
              {...register("title")}
              error={Boolean(errors.title)}
              helperText={errors.title?.message}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Descripcion"
              {...register("description")}
              error={Boolean(errors.description)}
              helperText={errors.description?.message}
              margin="normal"
              multiline
              minRows={8}
              maxRows={24}
              placeholder="Describe el tema"
            />
          </Box>
        )}

        {activeTab === TAB_IDS.content && (
          <TopicContentManager topicId={topicId} topicTitle={topic.title} />
        )}

        {activeTab === TAB_IDS.timeline && (
          <TopicTimeline
            topicId={topicId}
            canEdit
            returnContext="edit"
          />
        )}

        {activeTab === TAB_IDS.suggestions && (
          <Box>
            <ContentSuggestionsManager
              topicId={topicId}
              onSuggestionProcessed={fetchPendingCounts}
            />
            <Divider sx={{ my: 3 }} />
            <TimelineEntrySuggestionsManager
              topicId={topicId}
              onSuggestionProcessed={fetchPendingCounts}
            />
            <Divider sx={{ my: 3 }} />
            <TimelineEntryContentSuggestionsManager
              topicId={topicId}
              onSuggestionProcessed={fetchPendingCounts}
            />
          </Box>
        )}

        {activeTab === TAB_IDS.moderators && isCreator && (
          <TopicModerators
            topicId={topicId}
            onModeratorsUpdate={(updatedTopic) => setTopic(updatedTopic)}
          />
        )}

        {activeTab === TAB_IDS.danger && isCreator && (
          <Box>
            <Typography variant="h6" color="error" sx={{ fontWeight: 700, mb: 1 }}>
              Zona de peligro
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Si eliminas este tema se borraran tambien su contenido asociado, moderadores e invitaciones.
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
          </Box>
        )}
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={() => !isDeletingTopic && setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar tema</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Seguro que deseas eliminar <strong>{topic.title}</strong>? Esta accion no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeletingTopic}>
            Cancelar
          </Button>
          <Button onClick={handleDeleteTopic} disabled={isDeletingTopic} color="error" variant="contained">
            {isDeletingTopic ? "Eliminando..." : "Eliminar"}
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

      <Snackbar
        open={Boolean(saveMessage)}
        autoHideDuration={3000}
        onClose={() => setSaveMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSaveMessage(null)}>
          {saveMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TopicEdit;
