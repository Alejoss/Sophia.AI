import React, { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
  FormControlLabel,
  Paper,
  Snackbar,
  Switch,
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
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useTranslation } from "react-i18next";
import contentApi from "../api/contentApi";
import i18n from "../i18n";
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
    .required(() => i18n.t("topics:edit.titleRequired")),
  description: yup.string().trim().default(""),
  is_public: yup.boolean().default(true),
  chat_enabled: yup.boolean().default(false),
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
  const { t } = useTranslation("topics");
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
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: yupResolver(topicSchema),
    defaultValues: { title: "", description: "", is_public: true, chat_enabled: false },
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
          is_public: data.is_public !== false,
          chat_enabled: Boolean(data.chat_enabled),
        });
        setPageError(null);
      } catch {
        setPageError(t("edit.loadError"));
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
      setSaveMessage(t("edit.imageSaved"));
    } catch {
      setPageError(t("edit.imageError"));
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
      setPageError(t("edit.focalError"));
    }
  };

  const onSubmit = async (formData) => {
    try {
      const updatedTopic = await contentApi.updateTopic(topicId, formData);
      setTopic(updatedTopic);
      reset({
        title: updatedTopic.title || "",
        description: updatedTopic.description || "",
        is_public: updatedTopic.is_public !== false,
        chat_enabled: Boolean(updatedTopic.chat_enabled),
      });
      setSaveMessage(t("edit.saved"));
      setPageError(null);
    } catch (err) {
      const { generalError } = applyApiErrorsToForm(
        err,
        setError,
        t("edit.updateError"),
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
      setPageError(err?.error || err?.detail || t("edit.deleteError"));
    } finally {
      setIsDeletingTopic(false);
    }
  };

  const pendingSuggestionsTotal = pendingContentSuggestionsCount
    + pendingTimelineSuggestionsCount
    + pendingTimelineEntryContentSuggestionsCount;

  const tabs = useMemo(() => {
    const items = [
      { id: TAB_IDS.general, label: t("edit.tabGeneral"), icon: <SettingsIcon fontSize="small" /> },
      { id: TAB_IDS.content, label: t("edit.tabContent"), icon: <VideoLibraryIcon fontSize="small" /> },
      { id: TAB_IDS.timeline, label: t("edit.tabTimeline"), icon: <TimelineIcon fontSize="small" /> },
      {
        id: TAB_IDS.suggestions,
        label: pendingSuggestionsTotal > 0
          ? t("edit.suggestionsCount", { count: pendingSuggestionsTotal })
          : t("edit.tabSuggestions"),
        icon: <LightbulbIcon fontSize="small" />,
      },
    ];
    if (isCreator) {
      items.push({ id: TAB_IDS.moderators, label: t("edit.tabModerators"), icon: <SupervisorAccountIcon fontSize="small" /> });
      items.push({ id: TAB_IDS.danger, label: t("edit.tabDanger"), icon: <WarningAmberIcon fontSize="small" /> });
    }
    return items;
  }, [isCreator, pendingSuggestionsTotal, t]);

  if (loading) return <Typography sx={{ p: 3 }}>{t("edit.loading")}</Typography>;
  if (!topic) return <Alert severity="info" sx={{ m: 3 }}>{t("edit.notFound")}</Alert>;

  if (!canManage) {
    return (
      <Box sx={{ p: 3, maxWidth: 640, mx: "auto" }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("edit.noPermission")}
        </Alert>
        <Button component={RouterLink} to={`/content/topics/${topicId}`} startIcon={<ArrowBackIcon />}>
          {t("edit.backToTopic")}
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
            {t("edit.viewTopic")}
          </Button>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            {activeTab === TAB_IDS.general && isDirty && (
              <Chip size="small" label={t("edit.unsaved")} color="warning" variant="outlined" />
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
                {isSubmitting ? t("common.saving") : t("edit.save")}
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
              {t("edit.editImage")}
            </Button>
          )}
        </Box>

        <Typography variant="h5" sx={{ px: { xs: 2, md: 3 }, fontWeight: 700, mb: 0.5 }}>
          {t("edit.pageTitle")}
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
              label={t("edit.titleLabel")}
              {...register("title")}
              error={Boolean(errors.title)}
              helperText={errors.title?.message}
              margin="normal"
            />
            <TextField
              fullWidth
              label={t("edit.descriptionLabel")}
              {...register("description")}
              error={Boolean(errors.description)}
              helperText={errors.description?.message}
              margin="normal"
              multiline
              minRows={8}
              maxRows={24}
              placeholder={t("edit.descriptionPlaceholder")}
            />
            <Box sx={{ mt: 2, mb: 1 }}>
              <Controller
                name="is_public"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(field.value)}
                        onChange={(e) => field.onChange(e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {field.value ? (
                          <VisibilityIcon fontSize="small" />
                        ) : (
                          <VisibilityOffIcon fontSize="small" />
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {t("edit.public")}
                        </Typography>
                      </Box>
                    }
                  />
                )}
              />
              {errors.is_public && (
                <Typography variant="body2" color="error" sx={{ ml: 0.5, mb: 0.5 }}>
                  {errors.is_public.message}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5, mb: 2 }}>
                {t("edit.visibilityHelp")} {t("edit.visibilityStaff")}
              </Typography>

              <Controller
                name="chat_enabled"
                control={control}
                render={({ field }) => {
                  const chatCanEnable = Boolean(topic?.chat_can_enable);
                  const canTurnOn = chatCanEnable || Boolean(field.value);
                  return (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(field.value)}
                          disabled={!canTurnOn && !field.value}
                          onChange={(e) => {
                            const next = e.target.checked;
                            if (next && !chatCanEnable) return;
                            field.onChange(next);
                          }}
                          color="primary"
                        />
                      }
                      label={t("edit.showConsultations")}
                    />
                  );
                }}
              />
              {errors.chat_enabled && (
                <Typography variant="body2" color="error" sx={{ ml: 0.5, mb: 0.5 }}>
                  {errors.chat_enabled.message}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                {topic?.chat_can_enable
                  ? t("edit.ready", { count: topic.indexed_transcript_count })
                  : t("edit.unavailable")}
              </Typography>
            </Box>
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
              {t("edit.dangerZone")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("edit.dangerBody")}
            </Typography>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={() => setDeleteDialogOpen(true)}
              sx={{ textTransform: "none" }}
            >
              {t("edit.deleteTopic")}
            </Button>
          </Box>
        )}
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={() => !isDeletingTopic && setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("edit.deleteTopic")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t("edit.deleteBefore")}<strong>{topic.title}</strong>{t("edit.deleteAfter")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeletingTopic}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleDeleteTopic} disabled={isDeletingTopic} color="error" variant="contained">
            {isDeletingTopic ? t("edit.deleting") : t("common.delete")}
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
        entityLabel={t("edit.entityLabel")}
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
