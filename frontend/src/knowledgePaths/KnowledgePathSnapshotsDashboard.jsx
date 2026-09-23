import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import knowledgePathsApi from '../api/knowledgePathsApi';

const formatError = (err, fallback) => {
  const data = err?.response?.data;
  const msg = data?.error || data?.detail || err?.message;
  if (typeof msg === 'string') return msg;
  return fallback;
};

const KnowledgePathSnapshotsDashboard = () => {
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const [success, setSuccess] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await knowledgePathsApi.getAdminSnapshotDashboard();
      setPaths(Array.isArray(data.paths) ? data.paths : []);
    } catch (err) {
      setError(formatError(err, 'No se pudo cargar el panel de snapshots'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePublish = async (pathId) => {
    try {
      setPublishingId(pathId);
      setError(null);
      setSuccess(null);
      const created = await knowledgePathsApi.publishPathSnapshot(pathId);
      setSuccess(
        `Snapshot v${created.version} creado para “${created.knowledgePathTitle}”. Digest: ${created.digest.slice(0, 16)}…`,
      );
      await load();
    } catch (err) {
      setError(formatError(err, 'No se pudo crear el snapshot'));
    } finally {
      setPublishingId(null);
    }
  };

  const openDetail = async (pathId, version) => {
    try {
      setDetailLoading(true);
      setDetail(null);
      const data = await knowledgePathsApi.getPathSnapshot(pathId, version);
      setDetail(data);
    } catch (err) {
      setError(formatError(err, 'No se pudo cargar el snapshot'));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Snapshots de knowledge paths
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Solo administradores. El snapshot se toma cuando haces clic en “Tomar snapshot”,
        no al crear o publicar el camino. Se guarda el JSON canónico exacto (texto de
        transcripciones incluido) y su digest SHA-256.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper elevation={1} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress size={32} />
          </Stack>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Camino</TableCell>
                <TableCell>Nodos</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Último snapshot</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paths.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary">
                      No hay knowledge paths.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {paths.map((path) => (
                <TableRow key={path.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {path.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      #{path.id}
                      {path.author ? ` · ${path.author}` : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>{path.nodeCount}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={path.isVisible ? 'Público' : 'Privado'}
                        color={path.isVisible ? 'success' : 'default'}
                      />
                      {path.certificatesEnabled && (
                        <Chip size="small" label="Certificados" color="info" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {path.latestSnapshot ? (
                      <Box>
                        <Typography variant="body2">
                          v{path.latestSnapshot.version}
                        </Typography>
                        <Typography
                          variant="caption"
                          component="code"
                          sx={{ display: 'block', wordBreak: 'break-all' }}
                        >
                          {path.latestSnapshot.digest.slice(0, 20)}…
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {path.latestSnapshot.publishedAt}
                          {path.latestSnapshot.publishedBy?.username
                            ? ` · ${path.latestSnapshot.publishedBy.username}`
                            : ''}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Sin snapshot
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {path.latestSnapshot && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openDetail(path.id, path.latestSnapshot.version)}
                          sx={{ textTransform: 'none' }}
                        >
                          Ver
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="contained"
                        disabled={publishingId === path.id}
                        onClick={() => handlePublish(path.id)}
                        sx={{ textTransform: 'none' }}
                      >
                        {publishingId === path.id ? 'Guardando…' : 'Tomar snapshot'}
                      </Button>
                      <Button
                        size="small"
                        component={RouterLink}
                        to={`/knowledge_path/${path.id}/edit?tab=snapshot`}
                        sx={{ textTransform: 'none' }}
                      >
                        Preview
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog
        open={Boolean(detail) || detailLoading}
        onClose={() => setDetail(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {detail
            ? `Snapshot v${detail.version} — ${detail.knowledgePathTitle}`
            : 'Cargando snapshot…'}
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading && (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
            </Stack>
          )}
          {detail && (
            <Stack spacing={2}>
              <Typography variant="body2">
                <strong>Digest:</strong>{' '}
                <Box component="code" sx={{ wordBreak: 'break-all' }}>
                  {detail.digest}
                </Box>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Publicado {detail.publishedAt}
                {detail.publishedBy?.username ? ` por ${detail.publishedBy.username}` : ''}
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  overflow: 'auto',
                  maxHeight: 420,
                  fontSize: 12,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                {JSON.stringify(detail.document, null, 2)}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)} sx={{ textTransform: 'none' }}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KnowledgePathSnapshotsDashboard;
