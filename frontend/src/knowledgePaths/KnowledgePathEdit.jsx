import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  AlertTitle,
  Avatar,
  Box,
  Button,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import EditIcon from "@mui/icons-material/Edit";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import QuizIcon from "@mui/icons-material/Quiz";
import SchoolIcon from "@mui/icons-material/School";
import SettingsIcon from "@mui/icons-material/Settings";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import DataObjectIcon from "@mui/icons-material/DataObject";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import DownloadIcon from "@mui/icons-material/Download";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import knowledgePathsApi from "../api/knowledgePathsApi";
import quizzesApi from "../api/quizzesApi";
import ImageUploadModal from "../components/ImageUploadModal";
import { useAuth } from "../context/AuthContext";
import { downloadSnapshotForHashVerification } from "./snapshotDownload";

const buildSnapshotNodeRows = (preview) => {
  if (!preview) return [];

  const issuesByNode = {};
  for (const issue of preview.issues || []) {
    if (issue?.nodeId && !issuesByNode[issue.nodeId]) {
      issuesByNode[issue.nodeId] = issue;
    }
  }

  const digests = Array.isArray(preview.materialDigests) ? preview.materialDigests : [];
  if (digests.length > 0) {
    return digests.map((item, index) => {
      const ready = Boolean(item.hasCertifiedText ?? item.complete);
      const issueCode = item.issueCode || issuesByNode[item.nodeId]?.code || "";
      return {
        key: item.nodeId || `digest-${index}`,
        position: item.position ?? index + 1,
        title: item.nodeTitle || "",
        mediaType: item.mediaType || "",
        contentId: item.contentId || "",
        ready,
        issueCode,
      };
    });
  }

  return (preview.document?.nodes || []).map((node, index) => {
    const material = (node.materials || [])[0] || {};
    const ready = Boolean((material.text || "").trim());
    const issue = issuesByNode[node.nodeId];
    const issueCode = issue?.code || "";
    return {
      key: node.nodeId || `node-${index}`,
      position: node.position ?? index + 1,
      title: node.title || "",
      mediaType: node.mediaType || "",
      contentId: material.contentId || "",
      ready,
      issueCode,
    };
  });
};

const KnowledgePathEdit = () => {
  const { t } = useTranslation("paths");
  const { pathId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { authState } = useAuth();
  const isStaff = Boolean(authState.user?.is_staff || authState.user?.is_superuser);
  const fromDashboard = (searchParams.get("from") || "").toLowerCase() === "dashboard";
  const backTarget = fromDashboard
    ? "/dashboard/snapshots"
    : `/knowledge_path/${pathId}`;
  const backLabel = fromDashboard
    ? t("edit.backToSnapshots")
    : t("edit.back");

  const [knowledgePath, setKnowledgePath] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [quizzesByNodeId, setQuizzesByNodeId] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [quizWarning, setQuizWarning] = useState(null);

  // Details editable state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [certificatesEnabled, setCertificatesEnabled] = useState(false);
  const [referencePrice, setReferencePrice] = useState(0);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageCacheBuster, setImageCacheBuster] = useState(0);

  // Autosave state (title, description, visibility, certificates — not price)
  const [saveState, setSaveState] = useState({ status: "idle", message: null, updatedAt: null });
  const [priceSaveState, setPriceSaveState] = useState({ status: "idle", message: null });
  const lastSavedRef = useRef({
    title: "",
    description: "",
    isVisible: false,
    certificatesEnabled: false,
    referencePrice: 0,
    imageUrl: null,
  });
  const autosaveTimerRef = useRef(null);
  const isHydratingRef = useRef(true);

  // Curriculum state
  const [reorderState, setReorderState] = useState({ status: "idle", message: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, node: null });
  const [isDeletingNode, setIsDeletingNode] = useState(false);
  const [deletePathDialogOpen, setDeletePathDialogOpen] = useState(false);
  const [isDeletingPath, setIsDeletingPath] = useState(false);

  const [snapshotPreview, setSnapshotPreview] = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState(null);
  const [snapshotPublishing, setSnapshotPublishing] = useState(false);
  const [snapshotPublishSuccess, setSnapshotPublishSuccess] = useState(null);
  const [publishedSnapshot, setPublishedSnapshot] = useState(null);
  const snapshotNodeRows = useMemo(
    () => buildSnapshotNodeRows(snapshotPreview),
    [snapshotPreview],
  );
  const snapshotNodesReadyCount = useMemo(
    () => snapshotNodeRows.filter((row) => row.ready).length,
    [snapshotNodeRows],
  );

  const tabFromQuery = (searchParams.get("tab") || "").toLowerCase();
  const initialTab =
    tabFromQuery === "details" ? 0 : tabFromQuery === "snapshot" ? 2 : 1;
  const [activeTab, setActiveTab] = useState(initialTab);

  const canBePublic = useMemo(() => {
    // Prefer backend signal if present; also enforce at least 1 node client-side.
    const backendCan = Boolean(knowledgePath?.can_be_visible);
    return backendCan && (nodes?.length || 0) >= 1;
  }, [knowledgePath?.can_be_visible, nodes?.length]);

  const statusChips = useMemo(() => {
    const chips = [];
    chips.push(
      isVisible
        ? { label: t("common.public"), color: "success", icon: <VisibilityIcon fontSize="small" />, private: false }
        : { label: t("common.private"), color: "error", icon: <VisibilityOffIcon fontSize="small" />, private: true }
    );
    return chips;
  }, [isVisible, canBePublic, t]);

  const headerDescription = description || knowledgePath?.description || "";
  // Support stored `<br>` tags while staying safe (no HTML execution):
  // convert <br>, <br/>, <br /> to newline and render with `whiteSpace: pre-line`.
  const headerDescriptionForDisplay = useMemo(() => {
    return String(headerDescription || "")
      .replace(/<br\s*\/?>/gi, "\n");
  }, [headerDescription]);

  useEffect(() => {
    const fetchKnowledgePath = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        setQuizWarning(null);
        setSaveState({ status: "idle", message: null, updatedAt: null });
        setPriceSaveState({ status: "idle", message: null });

        const data = await knowledgePathsApi.getKnowledgePath(pathId);
        setKnowledgePath(data);
        setNodes(Array.isArray(data.nodes) ? data.nodes : []);

        // Hydrate details fields
        setTitle(data.title || "");
        setDescription(data.description || "");
        setIsVisible(Boolean(data.is_visible));
        setCertificatesEnabled(Boolean(data.certificates_enabled));
        setReferencePrice(Number(data.reference_price) || 0);
        setImageFile(null);
        setImagePreviewUrl(data.image || null);

        lastSavedRef.current = {
          title: data.title || "",
          description: data.description || "",
          isVisible: Boolean(data.is_visible),
          certificatesEnabled: Boolean(data.certificates_enabled),
          referencePrice: Number(data.reference_price) || 0,
          imageUrl: data.image || null,
        };
        isHydratingRef.current = false;

        // Quizzes (non-blocking)
        try {
          const quizzesData = await quizzesApi.getQuizzesByPathId(pathId);
          const map = Array.isArray(quizzesData)
            ? quizzesData.reduce((acc, quiz) => {
                const nodeId = quiz.node;
                if (!acc[nodeId]) acc[nodeId] = [];
                acc[nodeId].push(quiz);
                return acc;
              }, {})
            : {};
          setQuizzesByNodeId(map);
        } catch (quizErr) {
          setQuizWarning(t("edit.quizWarning"));
        }
      } catch (err) {
        setLoadError(err.response?.data?.error || err.message || t("common.loadPathError"));
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgePath();
  }, [pathId]);

  // Keep tab selection in URL
  useEffect(() => {
    const tab =
      activeTab === 0 ? "details" : activeTab === 2 ? "snapshot" : "curriculum";
    const current = (searchParams.get("tab") || "").toLowerCase();
    if (current !== tab) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        return next;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadSnapshotPreview = async () => {
    try {
      setSnapshotLoading(true);
      setSnapshotError(null);
      const data = await knowledgePathsApi.getSnapshotPreview(pathId);
      setSnapshotPreview(data);
    } catch (err) {
      setSnapshotError(
        err.response?.data?.error || err.message || t("edit.snapshotLoadError")
      );
      setSnapshotPreview(null);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleDownloadPreviewCanonical = () => {
    if (!snapshotPreview?.canonical) {
      setSnapshotError(t("edit.noPreviewBytes"));
      return;
    }
    try {
      downloadSnapshotForHashVerification({
        canonical: snapshotPreview.canonical,
        digest: snapshotPreview.digest,
        knowledgePathId: snapshotPreview.knowledgePathId,
        knowledgePathDbId: pathId,
        label: "preview",
      });
    } catch (err) {
      setSnapshotError(err?.message || t("edit.previewDownloadError"));
    }
  };

  const handleDownloadPublishedSnapshot = () => {
    if (!publishedSnapshot?.canonical) {
      setSnapshotError(t("edit.noPublishedSnapshot"));
      return;
    }
    try {
      downloadSnapshotForHashVerification({
        canonical: publishedSnapshot.canonical,
        digest: publishedSnapshot.digest,
        knowledgePathId: publishedSnapshot.knowledgePathId,
        knowledgePathDbId: publishedSnapshot.knowledgePathDbId || pathId,
        version: publishedSnapshot.version,
      });
    } catch (err) {
      setSnapshotError(err?.message || t("edit.snapshotDownloadError"));
    }
  };

  const handleTakeSnapshot = async () => {
    if (!isStaff) return;
    try {
      setSnapshotPublishing(true);
      setSnapshotError(null);
      setSnapshotPublishSuccess(null);
      const created = await knowledgePathsApi.publishPathSnapshot(pathId);
      setPublishedSnapshot(created);
      setSnapshotPublishSuccess(
        created.created
          ? t("edit.snapshotSaved", {
              version: created.version,
              digest: String(created.digest || "").slice(0, 16),
            })
          : t("edit.snapshotUnchanged", { version: created.version }),
      );
      await loadSnapshotPreview();
    } catch (err) {
      setSnapshotError(
        err.response?.data?.error || err.message || t("edit.snapshotError"),
      );
    } finally {
      setSnapshotPublishing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 2 && !loading && !loadError) {
      loadSnapshotPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, pathId, loading, loadError]);

  // Cleanup object URL for image preview
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  const handlePickImage = (file) => {
    if (!file) return;
    setImageFile(file);
    const nextUrl = URL.createObjectURL(file);
    setImagePreviewUrl(nextUrl);
  };

  const handleImageUpload = async (file, focalX = 0.5, focalY = 0.5) => {
    try {
      const payload = {
        title,
        description,
        is_visible: isVisible,
        certificates_enabled: certificatesEnabled,
        // Keep the last confirmed price; draft price only saves via explicit submit.
        reference_price: Number(lastSavedRef.current.referencePrice) || 0,
        image: file,
        image_focal_x: focalX,
        image_focal_y: focalY,
      };
      const updated = await knowledgePathsApi.updateKnowledgePath(pathId, payload);
      setKnowledgePath((prev) => ({ ...(prev || {}), ...(updated || {}) }));
      if (updated?.image) setImagePreviewUrl(updated.image);
      setImageFile(null);
      setImageCacheBuster(Date.now());
      lastSavedRef.current = {
        ...lastSavedRef.current,
        imageUrl: updated?.image ?? lastSavedRef.current.imageUrl,
        referencePrice:
          updated?.reference_price !== undefined
            ? Number(updated.reference_price) || 0
            : lastSavedRef.current.referencePrice,
      };
    } catch (err) {
      setSaveState({
        status: "error",
        message: err.response?.data?.error || err.message || t("edit.imageError"),
        updatedAt: null,
      });
    }
  };

  const handleFocalOnlyUpdate = async (focalX, focalY) => {
    try {
      const updated = await knowledgePathsApi.updateKnowledgePath(pathId, {
        image_focal_x: focalX,
        image_focal_y: focalY,
      });
      setKnowledgePath((prev) => ({ ...(prev || {}), ...(updated || {}) }));
      setImageCacheBuster(Date.now());
    } catch (err) {
      setSaveState({
        status: "error",
        message: err.response?.data?.error || err.message || t("edit.focalError"),
        updatedAt: null,
      });
    }
  };

  const isDirty = useMemo(() => {
    const last = lastSavedRef.current;
    const fieldsDirty =
      title !== last.title ||
      description !== last.description ||
      isVisible !== last.isVisible ||
      certificatesEnabled !== last.certificatesEnabled;
    return fieldsDirty || Boolean(imageFile);
  }, [title, description, isVisible, certificatesEnabled, imageFile]);

  const isPriceDirty = useMemo(() => {
    return Number(referencePrice) !== Number(lastSavedRef.current.referencePrice);
  }, [referencePrice, knowledgePath?.reference_price, priceSaveState.status]);

  const runAutosave = async () => {
    if (isHydratingRef.current) return;
    if (!isDirty) return;

    setSaveState({ status: "saving", message: null, updatedAt: null });
    try {
      const payload = {
        title,
        description,
        is_visible: isVisible,
        certificates_enabled: certificatesEnabled,
      };
      if (imageFile) payload.image = imageFile;

      const updated = await knowledgePathsApi.updateKnowledgePath(pathId, payload);

      // Update local state with canonical server response
      setKnowledgePath((prev) => ({ ...(prev || {}), ...(updated || {}) }));
      if (updated?.nodes) setNodes(Array.isArray(updated.nodes) ? updated.nodes : nodes);

      if (updated?.image) {
        setImagePreviewUrl(updated.image);
      }
      setImageFile(null);

      lastSavedRef.current = {
        ...lastSavedRef.current,
        title: updated?.title ?? title,
        description: updated?.description ?? description,
        isVisible: typeof updated?.is_visible === "boolean" ? updated.is_visible : isVisible,
        certificatesEnabled:
          typeof updated?.certificates_enabled === "boolean"
            ? updated.certificates_enabled
            : certificatesEnabled,
        imageUrl: updated?.image ?? lastSavedRef.current.imageUrl,
      };

      setSaveState({ status: "saved", message: t("common.saved"), updatedAt: Date.now() });
    } catch (err) {
      setSaveState({
        status: "error",
        message: err.response?.data?.error || err.message || t("edit.saveError"),
        updatedAt: null,
      });
    }
  };

  const handlePriceSave = async () => {
    const price = Number(referencePrice);
    if (Number.isNaN(price) || price < 0) {
      setPriceSaveState({
        status: "error",
        message: t("edit.priceInvalid"),
      });
      return;
    }

    setPriceSaveState({ status: "saving", message: null });
    try {
      const updated = await knowledgePathsApi.updateKnowledgePath(pathId, {
        reference_price: price || 0,
      });
      setKnowledgePath((prev) => ({ ...(prev || {}), ...(updated || {}) }));
      const savedPrice =
        updated?.reference_price !== undefined
          ? Number(updated.reference_price) || 0
          : price || 0;
      setReferencePrice(savedPrice);
      lastSavedRef.current = {
        ...lastSavedRef.current,
        referencePrice: savedPrice,
      };
      setPriceSaveState({ status: "saved", message: t("edit.priceSaved") });
    } catch (err) {
      setPriceSaveState({
        status: "error",
        message: err.response?.data?.error || err.message || t("edit.priceError"),
      });
    }
  };

  // Debounced autosave (excludes price — price requires explicit submit)
  useEffect(() => {
    if (isHydratingRef.current) return;
    if (!isDirty) return;

    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      runAutosave();
    }, 900);

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, isVisible, certificatesEnabled, imageFile]);

  const refreshPath = async () => {
    try {
      const updated = await knowledgePathsApi.getKnowledgePath(pathId);
      setKnowledgePath(updated);
      setNodes(Array.isArray(updated.nodes) ? updated.nodes : []);
    } catch (_) {
      // Ignore refresh errors
    }
  };

  const handleMoveNode = async (nodeId, direction) => {
    const currentIndex = nodes.findIndex((n) => n.id === nodeId);
    if (currentIndex === -1) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= nodes.length) return;

    setReorderState({ status: "saving", message: null });
    const newNodes = [...nodes];
    [newNodes[currentIndex], newNodes[targetIndex]] = [newNodes[targetIndex], newNodes[currentIndex]];
    setNodes(newNodes);

    try {
      const nodeOrders = newNodes.map((node, index) => ({ id: node.id, order: index + 1 }));
      const updatedNodes = await knowledgePathsApi.reorderNodes(pathId, nodeOrders);
      setNodes(Array.isArray(updatedNodes) ? updatedNodes : newNodes);
      setReorderState({ status: "saved", message: t("edit.orderUpdated") });
    } catch (err) {
      setReorderState({ status: "error", message: t("edit.reorderError") });
      // Re-sync with server state
      await refreshPath();
    }
  };

  const openDeleteNode = (node) => setDeleteDialog({ open: true, node });
  const closeDeleteNode = () => setDeleteDialog({ open: false, node: null });

  const confirmDeleteNode = async () => {
    const node = deleteDialog.node;
    if (!node) return;
    setIsDeletingNode(true);
    try {
      await knowledgePathsApi.removeNode(pathId, node.id);
      setNodes((prev) => prev.filter((n) => n.id !== node.id));
      closeDeleteNode();
      await refreshPath();
    } catch (err) {
      setReorderState({ status: "error", message: err.response?.data?.error || t("edit.deleteNodeError") });
    } finally {
      setIsDeletingNode(false);
    }
  };

  const handleAddNode = () => navigate(`/knowledge_path/${pathId}/add-node`);
  const handleAddQuiz = () => navigate(`/quizzes/${pathId}/create`);

  const openDeletePathDialog = () => setDeletePathDialogOpen(true);
  const closeDeletePathDialog = () => setDeletePathDialogOpen(false);

  const confirmDeletePath = async () => {
    setIsDeletingPath(true);
    try {
      await knowledgePathsApi.deleteKnowledgePath(pathId);
      closeDeletePathDialog();
      navigate("/profiles/my_profile?section=knowledge-paths", { replace: true });
    } catch (err) {
      setReorderState({
        status: "error",
        message: err.response?.data?.error || t("edit.deletePathError"),
      });
    } finally {
      setIsDeletingPath(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  if (loadError && !knowledgePath) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          <AlertTitle>{t("edit.errorTitle")}</AlertTitle>
          {loadError}
        </Alert>
        <Box sx={{ mt: 2 }}>
          <Button component={Link} to={`/knowledge_path/${pathId}`} variant="outlined">
            {t("edit.backToPath")}
          </Button>
        </Box>
      </Container>
    );
  }

  if (!knowledgePath) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          <AlertTitle>{t("edit.notFoundTitle")}</AlertTitle>
          {t("edit.notFound")}
        </Alert>
        <Box sx={{ mt: 2 }}>
          <Button component={Link} to="/knowledge_path" variant="outlined">
            {t("edit.backToList")}
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      {/* Back Button */}
      <Box sx={{ mb: 2 }}>
        <Button
          component={Link}
          to={backTarget}
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: "none", borderRadius: 2 }}
        >
          {backLabel}
        </Button>
      </Box>

      {/* Header */}
      <Paper 
        elevation={2} 
        sx={{ 
          borderRadius: 3, 
          mb: 3,
          overflow: 'hidden',
        }}
      >
        {/* Cover Image */}
        {imagePreviewUrl || knowledgePath?.image ? (
          <Box
            component="img"
            src={`${imagePreviewUrl || knowledgePath?.image || ""}${imageCacheBuster ? `?t=${imageCacheBuster}` : ""}`}
            alt={title || knowledgePath?.title || t("edit.entityLabel")}
            sx={{
              width: "100%",
              height: { xs: 180, md: 240 },
              objectFit: "cover",
              objectPosition: `${((knowledgePath?.image_focal_x ?? 0.5) * 100).toFixed(1)}% ${((knowledgePath?.image_focal_y ?? 0.5) * 100).toFixed(1)}%`,
              display: "block",
            }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: { xs: 180, md: 240 },
              bgcolor: "grey.300",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: { xs: "4rem", md: "6rem" },
              color: "text.secondary",
              fontWeight: 700,
            }}
          >
            {(title || knowledgePath?.title || "K").charAt(0).toUpperCase()}
          </Box>
        )}
        
        {/* Content Overlay */}
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }} noWrap>
              {title || knowledgePath?.title || t("edit.fallbackTitle")}
            </Typography>
            {!!headerDescriptionForDisplay.trim() && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mb: 1,
                  whiteSpace: "pre-line",
                  wordBreak: "break-word",
                }}
              >
                {headerDescriptionForDisplay}
              </Typography>
            )}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
              {statusChips.map((c) => (
                <Chip
                  key={c.label}
                  icon={c.icon}
                  label={c.label}
                  color={c.color}
                  size="small"
                  variant={c.private ? "outlined" : (c.color === "default" ? "outlined" : "filled")}
                  sx={
                    c.private
                      ? {
                          color: "error.main",
                          borderColor: "error.main",
                          "& .MuiChip-icon": { color: "error.main" },
                        }
                      : undefined
                  }
                />
              ))}
              <Typography variant="caption" color="text.secondary">
                {knowledgePath?.author ? t("common.author", { name: knowledgePath.author }) : ""}
              </Typography>
            </Stack>
          </Box>
        </Box>

        <Divider sx={{ mx: { xs: 2, md: 3 }, my: 2 }} />

        <Box sx={{ px: { xs: 2, md: 3 }, pb: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
            <Box sx={{ flex: 1 }}>
              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} aria-label={t("edit.tabsAria")}>
                <Tab icon={<SettingsIcon />} iconPosition="start" label={t("edit.details")} />
                <Tab icon={<SchoolIcon />} iconPosition="start" label={t("edit.curriculumTab", { count: nodes.length })} />
                <Tab icon={<DataObjectIcon />} iconPosition="start" label={t("edit.snapshotTab")} />
              </Tabs>
            </Box>

            {/* Autosave indicator */}
            <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: "flex-start", md: "flex-end" }}>
              {saveState.status === "saving" && (
                <Chip size="small" color="info" label={t("common.saving")} />
              )}
              {saveState.status === "saved" && (
                <Chip size="small" color="success" label={t("common.saved")} />
              )}
              {saveState.status === "error" && (
                <Chip size="small" color="error" label={t("edit.saveFailed")} />
              )}
              {saveState.status === "error" && (
                <Button size="small" variant="text" onClick={runAutosave} sx={{ textTransform: "none" }}>
                  {t("edit.retry")}
                </Button>
              )}
              {isDirty && saveState.status !== "saving" && (
                <Typography variant="caption" color="text.secondary">
                  {t("edit.unsaved")}
                </Typography>
              )}
            </Stack>
          </Stack>
        </Box>
      </Paper>

      {/* Details Tab */}
      {activeTab === 0 && (
        <Stack spacing={3}>
          {/* Publish readiness */}
          {!canBePublic && (
            <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ borderRadius: 2 }}>
              <AlertTitle sx={{ fontWeight: 700 }}>{t("edit.cannotPublish")}</AlertTitle>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t("edit.publishBefore")}<strong>{t("edit.publishHighlight")}</strong>{t("edit.publishAfter")}
              </Typography>
              <Button size="small" variant="outlined" onClick={() => setActiveTab(1)} sx={{ textTransform: "none", borderRadius: 2 }}>
                {t("edit.goToCurriculum")}
              </Button>
            </Alert>
          )}

          <Paper elevation={1} sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
            <Stack spacing={3}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems={{ xs: "stretch", md: "flex-start" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ flex: 1 }}>
                  <Box
                    sx={{
                      width: { xs: "100%", sm: 280 },
                      height: { xs: 158, sm: 158 },
                      borderRadius: 2,
                      bgcolor: "grey.300",
                      overflow: "hidden",
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    {imagePreviewUrl || knowledgePath?.image ? (
                      <Box
                        component="img"
                        src={`${imagePreviewUrl || knowledgePath?.image || ""}${imageCacheBuster ? `?t=${imageCacheBuster}` : ""}`}
                        alt={title || t("edit.coverAlt")}
                        sx={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition: `${((knowledgePath?.image_focal_x ?? 0.5) * 100).toFixed(1)}% ${((knowledgePath?.image_focal_y ?? 0.5) * 100).toFixed(1)}%`,
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "3rem",
                          color: "text.secondary",
                          fontWeight: 700,
                        }}
                      >
                        {(title || "K").charAt(0).toUpperCase()}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
                    <Button
                      variant="outlined"
                      startIcon={<PhotoCameraIcon />}
                      onClick={() => setIsImageModalOpen(true)}
                      sx={{ textTransform: "none", borderRadius: 2, mb: 1 }}
                    >
                      {t("edit.changeCover")}
                    </Button>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {t("edit.coverHint")}
                    </Typography>
                  </Box>
                </Stack>

                {/* Visibility */}
                <Tooltip
                  title={!canBePublic && !isVisible ? t("edit.needsNode") : ""}
                  disableHoverListener={canBePublic || isVisible}
                >
                  <span>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={isVisible}
                          disabled={!canBePublic && !isVisible}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setIsVisible(next);
                          }}
                        />
                      }
                      label={
                        <Stack direction="row" spacing={1} alignItems="center">
                          {isVisible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {t("common.public")}
                          </Typography>
                        </Stack>
                      }
                    />
                  </span>
                </Tooltip>
              </Stack>

              <FormControlLabel
                control={
                  <Switch
                    checked={certificatesEnabled}
                    onChange={(e) => setCertificatesEnabled(e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <SchoolIcon fontSize="small" color={certificatesEnabled ? "success" : "disabled"} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {t("edit.allowCertificate")}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                      {t("edit.certificateHelp")}
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start", mt: 1, ml: 0 }}
              />

              <Box sx={{ mt: 1 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "flex-start" }}>
                  <TextField
                    label={t("edit.priceLabel")}
                    type="number"
                    value={referencePrice}
                    onChange={(e) => {
                      setReferencePrice(e.target.value === "" ? 0 : Number(e.target.value));
                      if (priceSaveState.status !== "idle") {
                        setPriceSaveState({ status: "idle", message: null });
                      }
                    }}
                    inputProps={{ min: 0, step: "0.01" }}
                    fullWidth
                    helperText={t("edit.priceHelp")}
                  />
                  <Button
                    variant="contained"
                    onClick={handlePriceSave}
                    disabled={!isPriceDirty || priceSaveState.status === "saving"}
                    sx={{ flexShrink: 0, mt: { sm: 0.5 }, minWidth: 140 }}
                  >
                    {priceSaveState.status === "saving" ? t("common.saving") : t("edit.savePrice")}
                  </Button>
                </Stack>
                {priceSaveState.status === "saved" && (
                  <Typography variant="caption" color="success.main" sx={{ display: "block", mt: 0.75 }}>
                    {priceSaveState.message}
                  </Typography>
                )}
                {priceSaveState.status === "error" && (
                  <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.75 }}>
                    {priceSaveState.message}
                  </Typography>
                )}
              </Box>

              <TextField
                label={t("common.title")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                placeholder={t("edit.titlePlaceholder")}
                sx={{ mt: 1 }}
              />
              <TextField
                label={t("common.description")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                minRows={5}
                maxRows={24}
                placeholder={t("edit.descriptionPlaceholder")}
                sx={{ mt: 1 }}
              />
            </Stack>
          </Paper>
        </Stack>
      )}

      {/* Curriculum Tab */}
      {activeTab === 1 && (
        <Stack spacing={3}>
          {quizWarning && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              {quizWarning}
            </Alert>
          )}

          <Paper elevation={1} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between">
              <Box>
                <Typography variant="subtitle1" component="div" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                  {t("edit.curriculum")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("edit.curriculumHelp")}
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button variant="contained" color="success" startIcon={<AddIcon />} onClick={handleAddNode} sx={{ textTransform: "none", borderRadius: 2 }}>
                  {t("edit.addNode")}
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<QuizIcon />}
                  onClick={handleAddQuiz}
                  disabled={nodes.length < 2}
                  sx={{ textTransform: "none", borderRadius: 2 }}
                >
                  {t("edit.addQuiz")}
                </Button>
              </Stack>
            </Stack>

            <Divider sx={{ my: 2 }} />

            {nodes.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                <AlertTitle sx={{ fontWeight: 700 }}>{t("edit.emptyCurriculum")}</AlertTitle>
                {t("edit.emptyCurriculumHelp")}
              </Alert>
            ) : (
              <Stack spacing={1.5}>
                {nodes.map((node, index) => {
                  const nodeQuizzes = quizzesByNodeId?.[node.id] || [];
                  return (
                    <Paper key={node.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                          <Box
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              bgcolor: "primary.main",
                              color: "primary.contrastText",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {index + 1}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                              {node.title || t("common.untitled")}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                              {node.media_type && <Chip size="small" label={node.media_type} variant="outlined" />}
                              {nodeQuizzes.length > 0 ? (
                                <Chip 
                                  size="small" 
                                  label={nodeQuizzes.length === 1 ? "quiz" : `${nodeQuizzes.length} quiz`} 
                                  variant="filled"
                                  color="secondary"
                                  component={Link}
                                  to={`/quizzes/${nodeQuizzes[0].id}/edit`}
                                  clickable
                                  sx={{ 
                                    textDecoration: 'none',
                                    '&:hover': {
                                      bgcolor: 'secondary.dark'
                                    }
                                  }}
                                />
                              ) : (
                                <Chip 
                                  size="small" 
                                  label="0 quiz" 
                                  variant="outlined" 
                                  color="default" 
                                />
                              )}
                            </Stack>
                          </Box>
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" sx={{ flexWrap: "wrap" }}>
                          <Tooltip title={t("edit.moveUp")}>
                            <span>
                              <IconButton size="small" onClick={() => handleMoveNode(node.id, "up")} disabled={index === 0 || reorderState.status === "saving"}>
                                <ArrowUpwardIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={t("edit.moveDown")}>
                            <span>
                              <IconButton size="small" onClick={() => handleMoveNode(node.id, "down")} disabled={index === nodes.length - 1 || reorderState.status === "saving"}>
                                <ArrowDownwardIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>

                          <Button
                            component={Link}
                            to={`/knowledge_path/${pathId}/nodes/${node.id}`}
                            size="small"
                            variant="outlined"
                            startIcon={<OpenInNewIcon />}
                            sx={{ textTransform: "none", borderRadius: 2 }}
                          >
                            {t("edit.view")}
                          </Button>
                          <Button
                            component={Link}
                            to={`/knowledge_path/${pathId}/nodes/${node.id}/edit`}
                            size="small"
                            variant="contained"
                            startIcon={<EditIcon />}
                            sx={{ textTransform: "none", borderRadius: 2 }}
                          >
                            {t("common.edit")}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => openDeleteNode(node)}
                            sx={{ textTransform: "none", borderRadius: 2 }}
                          >
                            {t("common.delete")}
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Stack>
      )}

      {/* Snapshot Tab */}
      {activeTab === 2 && (
        <Stack spacing={3}>
          <Paper elevation={1} sx={{ p: 3, borderRadius: 3 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {t("edit.snapshotTitle")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("edit.snapshotHelp1")} {t("edit.snapshotHelp2")}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadSnapshotPreview}
                  disabled={snapshotLoading || snapshotPublishing}
                  sx={{ textTransform: "none", borderRadius: 2 }}
                >
                  {t("edit.refresh")}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadPreviewCanonical}
                  disabled={
                    snapshotLoading ||
                    snapshotPublishing ||
                    !snapshotPreview?.canonical
                  }
                  sx={{ textTransform: "none", borderRadius: 2 }}
                >
                  {t("edit.downloadPreview")}
                </Button>
                {isStaff && (
                  <Button
                    variant="contained"
                    startIcon={<CameraAltIcon />}
                    onClick={handleTakeSnapshot}
                    disabled={
                      snapshotLoading ||
                      snapshotPublishing ||
                      !snapshotPreview?.readyForStrictPublish
                    }
                    sx={{ textTransform: "none", borderRadius: 2 }}
                  >
                    {snapshotPublishing ? t("common.saving") : t("edit.takeSnapshot")}
                  </Button>
                )}
              </Stack>
            </Stack>

            {!isStaff && (
              <Alert severity="info" sx={{ borderRadius: 2, mb: 2 }}>
                {t("edit.staffOnly")}
              </Alert>
            )}

            {fromDashboard && (
              <Alert severity="info" sx={{ borderRadius: 2, mb: 2 }}>
                {t("edit.fromDashboard1")} {t("edit.fromDashboard2")}
              </Alert>
            )}

            {snapshotLoading && (
              <Stack alignItems="center" sx={{ py: 4 }}>
                <CircularProgress size={32} />
              </Stack>
            )}

            {snapshotError && (
              <Alert
                severity="error"
                sx={{ borderRadius: 2 }}
                onClose={() => setSnapshotError(null)}
              >
                {snapshotError}
              </Alert>
            )}

            {snapshotPublishSuccess && (
              <Alert
                severity="success"
                sx={{ borderRadius: 2 }}
                onClose={() => setSnapshotPublishSuccess(null)}
                action={
                  publishedSnapshot?.canonical ? (
                    <Button
                      color="inherit"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={handleDownloadPublishedSnapshot}
                      sx={{ textTransform: "none" }}
                    >
                      {t("edit.download")}
                    </Button>
                  ) : null
                }
              >
                {snapshotPublishSuccess}
              </Alert>
            )}

            {!snapshotLoading && snapshotPreview && (
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    color={snapshotPreview.validForHash ? "success" : "error"}
                    label={
                      snapshotPreview.validForHash
                        ? t("edit.hashValid")
                        : t("edit.hashInvalid")
                    }
                  />
                  <Chip
                    size="small"
                    color={snapshotPreview.readyForStrictPublish ? "success" : "warning"}
                    label={
                      snapshotPreview.readyForStrictPublish
                        ? t("edit.publishReady")
                        : t("edit.publishNotReady")
                    }
                  />
                  {snapshotNodeRows.length > 0 && (
                    <Chip
                      size="small"
                      variant="outlined"
                      color={
                        snapshotNodesReadyCount === snapshotNodeRows.length
                          ? "success"
                          : "default"
                      }
                      label={t("edit.transcriptsCount", {
                        ready: snapshotNodesReadyCount,
                        total: snapshotNodeRows.length,
                      })}
                    />
                  )}
                </Stack>

                {snapshotNodeRows.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      {t("edit.transcriptByNode")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {t("edit.transcriptHelp1")} {t("edit.transcriptHelp2")}
                    </Typography>
                    <Stack spacing={1}>
                      {snapshotNodeRows.map((row) => (
                        <Paper
                          key={row.key}
                          variant="outlined"
                          sx={{
                            px: 1.5,
                            py: 1.25,
                            borderRadius: 2,
                            bgcolor: "action.hover",
                            borderColor: row.ready ? "success.main" : "divider",
                          }}
                        >
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            alignItems={{ xs: "flex-start", sm: "center" }}
                            justifyContent="space-between"
                          >
                            <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {row.position}. {row.title || t("common.untitled")}
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {row.mediaType ? (
                                  <Chip size="small" label={row.mediaType} variant="outlined" />
                                ) : null}
                                {row.contentId ? (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      fontFamily:
                                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                                      wordBreak: "break-all",
                                    }}
                                  >
                                    {row.contentId}
                                  </Typography>
                                ) : null}
                              </Stack>
                            </Stack>
                            <Chip
                              size="small"
                              icon={
                                row.ready ? (
                                  <CheckCircleOutlineIcon />
                                ) : (
                                  <HighlightOffIcon />
                                )
                              }
                              color={row.ready ? "success" : "warning"}
                              label={
                                row.ready
                                  ? t("edit.transcriptReady")
                                  : row.issueCode === "NO_CONTENT"
                                    ? t("edit.noContent")
                                    : row.issueCode === "NO_TRANSCRIPT_TEXT"
                                      ? t("edit.noTranscript")
                                      : row.issueCode === "EMPTY_TRANSCRIPT"
                                        ? t("edit.emptyTranscript")
                                        : t("edit.textNotReady")
                              }
                              sx={{ flexShrink: 0 }}
                            />
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                )}

                {snapshotPreview.digest && (
                  <Box>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ xs: "stretch", sm: "center" }}
                      justifyContent="space-between"
                      sx={{ mb: 0.5 }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Digest SHA-256 (preview)
                      </Typography>
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<DownloadIcon />}
                        onClick={handleDownloadPreviewCanonical}
                        disabled={!snapshotPreview.canonical}
                        sx={{ textTransform: "none" }}
                      >
                        {t("edit.downloadJcs")}
                      </Button>
                    </Stack>
                    <Typography
                      component="code"
                      variant="body2"
                      sx={{
                        display: "block",
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: "action.hover",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        wordBreak: "break-all",
                      }}
                    >
                      {snapshotPreview.digest}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      {t("edit.digestNoteBefore")}<code>publishedAt</code>{t("edit.digestNoteAfter")}
                    </Typography>
                  </Box>
                )}

                {Array.isArray(snapshotPreview.issues) && snapshotPreview.issues.length > 0 && (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    <AlertTitle>{t("edit.certificationPending")}</AlertTitle>
                    <Box component="ul" sx={{ m: 0, pl: 2 }}>
                      {snapshotPreview.issues.map((issue, index) => {
                        const nodeLabel = issue.nodeTitle
                          ? issue.nodeTitle
                          : issue.nodeId || null;
                        return (
                          <li key={`${issue.code}-${issue.nodeId}-${index}`}>
                            <Typography variant="body2">
                              <strong>{issue.code}</strong>
                              {nodeLabel ? (
                                <>
                                  {" — "}
                                  <strong>{nodeLabel}</strong>
                                  {issue.nodeTitle && issue.nodeId
                                    ? ` (${issue.nodeId})`
                                    : ""}
                                </>
                              ) : null}
                              : {issue.message}
                            </Typography>
                          </li>
                        );
                      })}
                    </Box>
                  </Alert>
                )}

                {snapshotPreview.validationError && (
                  <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {snapshotPreview.validationError}
                  </Alert>
                )}

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Documento (pretty JSON)
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 2,
                      borderRadius: 2,
                      bgcolor: "grey.900",
                      color: "grey.100",
                      overflow: "auto",
                      maxHeight: 520,
                      fontSize: 12,
                      lineHeight: 1.5,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    }}
                  >
                    {JSON.stringify(snapshotPreview.document, null, 2)}
                  </Box>
                </Box>

                {snapshotPreview.canonical && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      {t("edit.canonicalBytes")}
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        m: 0,
                        p: 2,
                        borderRadius: 2,
                        bgcolor: "grey.900",
                        color: "grey.100",
                        overflow: "auto",
                        maxHeight: 240,
                        fontSize: 12,
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      }}
                    >
                      {snapshotPreview.canonical}
                    </Box>
                  </Box>
                )}
              </Stack>
            )}
          </Paper>
        </Stack>
      )}

      {/* Zona de peligro: eliminar camino */}
      <Paper elevation={1} sx={{ mt: 4, p: 3, borderRadius: 3, border: "1px solid", borderColor: "error.light" }}>
        <Typography variant="h6" color="error" sx={{ fontWeight: 700, mb: 1 }}>
          {t("edit.dangerZone")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("edit.dangerBody")}
        </Typography>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteForeverIcon />}
          onClick={openDeletePathDialog}
          sx={{ textTransform: "none" }}
        >
          {t("edit.deletePath")}
        </Button>
      </Paper>

      {/* Delete path dialog */}
      <Dialog open={deletePathDialogOpen} onClose={closeDeletePathDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{t("edit.deletePathTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t("edit.deletePathBefore")}<strong>{knowledgePath?.title || t("edit.thisPath")}</strong>{t("edit.deletePathAfter")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeletePathDialog} disabled={isDeletingPath} sx={{ textTransform: "none" }}>
            {t("common.cancel")}
          </Button>
          <Button onClick={confirmDeletePath} disabled={isDeletingPath} color="error" variant="contained" sx={{ textTransform: "none" }}>
            {isDeletingPath ? t("common.deleting") : t("common.delete")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete node dialog */}
      <Dialog open={deleteDialog.open} onClose={closeDeleteNode} maxWidth="xs" fullWidth>
        <DialogTitle>{t("edit.deleteNodeTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t("edit.deleteNodeBefore")}<strong>{deleteDialog.node?.title || t("edit.thisNode")}</strong>{t("edit.deleteNodeAfter")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteNode} disabled={isDeletingNode} sx={{ textTransform: "none" }}>
            {t("common.cancel")}
          </Button>
          <Button onClick={confirmDeleteNode} disabled={isDeletingNode} color="error" variant="contained" sx={{ textTransform: "none" }}>
            {isDeletingNode ? t("common.deleting") : t("common.delete")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toasts */}
      <Snackbar
        open={Boolean(reorderState.message)}
        autoHideDuration={3500}
        onClose={() => setReorderState({ status: "idle", message: null })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={reorderState.status === "error" ? "error" : "success"}
          onClose={() => setReorderState({ status: "idle", message: null })}
          sx={{ borderRadius: 2 }}
        >
          {reorderState.message}
        </Alert>
      </Snackbar>

      <ImageUploadModal
        open={isImageModalOpen}
        handleClose={() => setIsImageModalOpen(false)}
        handleImageUpload={handleImageUpload}
        existingImageUrl={imagePreviewUrl || knowledgePath?.image}
        existingFocalX={knowledgePath?.image_focal_x ?? 0.5}
        existingFocalY={knowledgePath?.image_focal_y ?? 0.5}
        onFocalOnlyUpdate={handleFocalOnlyUpdate}
        entityLabel={t("edit.entityLabel")}
      />
    </Container>
  );
};

export default KnowledgePathEdit;
