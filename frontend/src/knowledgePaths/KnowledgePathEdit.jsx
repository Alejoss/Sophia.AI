import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import knowledgePathsApi from "../api/knowledgePathsApi";
import quizzesApi from "../api/quizzesApi";

const KnowledgePathEdit = () => {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  // Autosave state
  const [saveState, setSaveState] = useState({ status: "idle", message: null, updatedAt: null });
  const lastSavedRef = useRef({ title: "", description: "", isVisible: false, imageUrl: null });
  const autosaveTimerRef = useRef(null);
  const isHydratingRef = useRef(true);

  // Curriculum state
  const [reorderState, setReorderState] = useState({ status: "idle", message: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, node: null });
  const [isDeletingNode, setIsDeletingNode] = useState(false);

  const tabFromQuery = (searchParams.get("tab") || "").toLowerCase();
  const initialTab = tabFromQuery === "details" ? 0 : 1; // Default to Curriculum (tab 1)
  const [activeTab, setActiveTab] = useState(initialTab);

  const canBePublic = useMemo(() => {
    // Prefer backend signal if present; also enforce at least 2 nodes client-side.
    const backendCan = Boolean(knowledgePath?.can_be_visible);
    return backendCan && (nodes?.length || 0) >= 2;
  }, [knowledgePath?.can_be_visible, nodes?.length]);

  const statusChips = useMemo(() => {
    const chips = [];
    chips.push(
      isVisible ? { label: "Público", color: "success", icon: <VisibilityIcon fontSize="small" /> } : { label: "Privado", color: "default", icon: <VisibilityOffIcon fontSize="small" /> }
    );
    return chips;
  }, [isVisible, canBePublic]);

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

        const data = await knowledgePathsApi.getKnowledgePath(pathId);
        setKnowledgePath(data);
        setNodes(Array.isArray(data.nodes) ? data.nodes : []);

        // Hydrate details fields
        setTitle(data.title || "");
        setDescription(data.description || "");
        setIsVisible(Boolean(data.is_visible));
        setImageFile(null);
        setImagePreviewUrl(data.image || null);

        lastSavedRef.current = {
          title: data.title || "",
          description: data.description || "",
          isVisible: Boolean(data.is_visible),
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
          setQuizWarning("No pudimos cargar la información de cuestionarios. Puedes seguir editando nodos.");
        }
      } catch (err) {
        setLoadError(err.response?.data?.error || err.message || "Error al cargar el camino de conocimiento");
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgePath();
  }, [pathId]);

  // Keep tab selection in URL
  useEffect(() => {
    const tab = activeTab === 1 ? "curriculum" : "details";
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

  const isDirty = useMemo(() => {
    const last = lastSavedRef.current;
    const fieldsDirty = title !== last.title || description !== last.description || isVisible !== last.isVisible;
    return fieldsDirty || Boolean(imageFile);
  }, [title, description, isVisible, imageFile]);

  const runAutosave = async () => {
    if (isHydratingRef.current) return;
    if (!isDirty) return;

    setSaveState({ status: "saving", message: null, updatedAt: null });
    try {
      const payload = {
        title,
        description,
        is_visible: isVisible,
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
        title: updated?.title ?? title,
        description: updated?.description ?? description,
        isVisible: typeof updated?.is_visible === "boolean" ? updated.is_visible : isVisible,
        imageUrl: updated?.image ?? lastSavedRef.current.imageUrl,
      };

      setSaveState({ status: "saved", message: "Guardado", updatedAt: Date.now() });
    } catch (err) {
      setSaveState({
        status: "error",
        message: err.response?.data?.error || err.message || "No se pudo guardar",
        updatedAt: null,
      });
    }
  };

  // Debounced autosave
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
  }, [title, description, isVisible, imageFile]);

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
      setReorderState({ status: "saved", message: "Orden actualizado" });
    } catch (err) {
      setReorderState({ status: "error", message: "Error al reordenar los nodos" });
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
      setReorderState({ status: "error", message: err.response?.data?.error || "Error al eliminar el nodo" });
    } finally {
      setIsDeletingNode(false);
    }
  };

  const handleAddNode = () => navigate(`/knowledge_path/${pathId}/add-node`);
  const handleAddQuiz = () => navigate(`/quizzes/${pathId}/create`);

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
          <AlertTitle>Error</AlertTitle>
          {loadError}
        </Alert>
        <Box sx={{ mt: 2 }}>
          <Button component={Link} to={`/knowledge_path/${pathId}`} variant="outlined">
            Volver al Camino de Conocimiento
          </Button>
        </Box>
      </Container>
    );
  }

  if (!knowledgePath) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          <AlertTitle>No encontrado</AlertTitle>
          Camino de conocimiento no encontrado
        </Alert>
        <Box sx={{ mt: 2 }}>
          <Button component={Link} to="/knowledge_path" variant="outlined">
            Volver a la lista
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
          to={`/knowledge_path/${pathId}`}
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: "none", borderRadius: 2 }}
        >
          Volver
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
            src={imagePreviewUrl || knowledgePath?.image || null}
            alt={title || knowledgePath?.title || "Knowledge path"}
            sx={{
              width: "100%",
              height: { xs: 180, md: 240 },
              objectFit: "cover",
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
              {title || knowledgePath?.title || "Camino de conocimiento"}
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
                <Chip key={c.label} icon={c.icon} label={c.label} color={c.color} size="small" variant={c.color === "default" ? "outlined" : "filled"} />
              ))}
              <Typography variant="caption" color="text.secondary">
                {knowledgePath?.author ? `Autor: ${knowledgePath.author}` : ""}
              </Typography>
            </Stack>
          </Box>
        </Box>

        <Divider sx={{ mx: { xs: 2, md: 3 }, my: 2 }} />

        <Box sx={{ px: { xs: 2, md: 3 }, pb: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
            <Box sx={{ flex: 1 }}>
              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} aria-label="knowledge path edit tabs">
                <Tab icon={<SettingsIcon />} iconPosition="start" label="Detalles" />
                <Tab icon={<SchoolIcon />} iconPosition="start" label={`Currículum (${nodes.length})`} />
              </Tabs>
            </Box>

            {/* Autosave indicator */}
            <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: "flex-start", md: "flex-end" }}>
              {saveState.status === "saving" && (
                <Chip size="small" color="info" label="Guardando…" />
              )}
              {saveState.status === "saved" && (
                <Chip size="small" color="success" label="Guardado" />
              )}
              {saveState.status === "error" && (
                <Chip size="small" color="error" label="Error al guardar" />
              )}
              {saveState.status === "error" && (
                <Button size="small" variant="text" onClick={runAutosave} sx={{ textTransform: "none" }}>
                  Reintentar
                </Button>
              )}
              {isDirty && saveState.status !== "saving" && (
                <Typography variant="caption" color="text.secondary">
                  Cambios sin guardar
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
              <AlertTitle sx={{ fontWeight: 700 }}>Aún no puedes publicarlo</AlertTitle>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Para que sea público necesitas <strong>al menos 2 nodos</strong>.
              </Typography>
              <Button size="small" variant="outlined" onClick={() => setActiveTab(1)} sx={{ textTransform: "none", borderRadius: 2 }}>
                Ir a Currículum
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
                        src={imagePreviewUrl || knowledgePath?.image || null}
                        alt={title || "Portada"}
                        sx={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
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
                    <input
                      accept="image/*"
                      style={{ display: "none" }}
                      id="knowledge-path-cover-upload"
                      type="file"
                      onChange={(e) => handlePickImage(e.target.files?.[0])}
                    />
                    <label htmlFor="knowledge-path-cover-upload">
                      <Button component="span" variant="outlined" startIcon={<PhotoCameraIcon />} sx={{ textTransform: "none", borderRadius: 2, mb: 1 }}>
                        Cambiar portada
                      </Button>
                    </label>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      Recomendado: imagen 16:9 para mejor visualización.
                    </Typography>
                  </Box>
                </Stack>

                {/* Visibility */}
                <Tooltip
                  title={!canBePublic && !isVisible ? "Necesitas al menos 2 nodos para hacerlo público." : ""}
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
                            Público
                          </Typography>
                        </Stack>
                      }
                    />
                  </span>
                </Tooltip>
              </Stack>

              <TextField
                label="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                placeholder="Ej. Introducción a Blockchain"
                sx={{ mt: 1 }}
              />
              <TextField
                label="Descripción"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                minRows={4}
                placeholder="Explica qué aprenderá el alumno y cómo está organizado el camino."
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
                  Currículum
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Organiza los nodos, agrega contenido y configura cuestionarios.
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button variant="contained" color="success" startIcon={<AddIcon />} onClick={handleAddNode} sx={{ textTransform: "none", borderRadius: 2 }}>
                  Agregar nodo
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<QuizIcon />}
                  onClick={handleAddQuiz}
                  disabled={nodes.length < 2}
                  sx={{ textTransform: "none", borderRadius: 2 }}
                >
                  Agregar cuestionario
                </Button>
              </Stack>
            </Stack>

            <Divider sx={{ my: 2 }} />

            {nodes.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                <AlertTitle sx={{ fontWeight: 700 }}>Tu currículum está vacío</AlertTitle>
                Agrega tu primer nodo para comenzar a construir el camino.
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
                              {node.title || "Sin título"}
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
                          <Tooltip title="Mover arriba">
                            <span>
                              <IconButton size="small" onClick={() => handleMoveNode(node.id, "up")} disabled={index === 0 || reorderState.status === "saving"}>
                                <ArrowUpwardIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Mover abajo">
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
                            Ver
                          </Button>
                          <Button
                            component={Link}
                            to={`/knowledge_path/${pathId}/nodes/${node.id}/edit`}
                            size="small"
                            variant="contained"
                            startIcon={<EditIcon />}
                            sx={{ textTransform: "none", borderRadius: 2 }}
                          >
                            Editar
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => openDeleteNode(node)}
                            sx={{ textTransform: "none", borderRadius: 2 }}
                          >
                            Eliminar
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

      {/* Delete node dialog */}
      <Dialog open={deleteDialog.open} onClose={closeDeleteNode} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar nodo</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            ¿Seguro que deseas eliminar <strong>{deleteDialog.node?.title || "este nodo"}</strong>? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteNode} disabled={isDeletingNode} sx={{ textTransform: "none" }}>
            Cancelar
          </Button>
          <Button onClick={confirmDeleteNode} disabled={isDeletingNode} color="error" variant="contained" sx={{ textTransform: "none" }}>
            {isDeletingNode ? "Eliminando…" : "Eliminar"}
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
    </Container>
  );
};

export default KnowledgePathEdit;
