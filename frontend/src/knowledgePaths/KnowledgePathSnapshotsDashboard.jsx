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
import DownloadIcon from '@mui/icons-material/Download';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import knowledgePathsApi from '../api/knowledgePathsApi';
import { downloadSnapshotForHashVerification } from './snapshotDownload';
import { getBtcExplorerTxUrl } from '../utils/bitcoinExplorer';

const formatError = (err, fallback) => {
  const data = err?.response?.data;
  const msg = data?.error || data?.detail || err?.message;
  if (typeof msg === 'string') return msg;
  return fallback;
};

const bitcoinStatusChip = (blockchain) => {
  const status = blockchain?.status || 'none';
  if (status === 'anchored') {
    return <Chip size="small" color="success" label="BTC anclado" />;
  }
  if (status === 'btc_broadcast') {
    return <Chip size="small" color="info" label="BTC broadcast" />;
  }
  if (status === 'pending') {
    return <Chip size="small" color="warning" label="BTC pending" />;
  }
  if (status === 'failed') {
    return <Chip size="small" color="error" label="BTC falló" />;
  }
  return <Chip size="small" variant="outlined" label="Sin BTC" />;
};

const KnowledgePathSnapshotsDashboard = () => {
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const [anchoringKey, setAnchoringKey] = useState(null);
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

  const handleDownloadDetail = () => {
    if (!detail) return;
    try {
      downloadSnapshotForHashVerification({
        canonical: detail.canonical,
        digest: detail.digest,
        knowledgePathId: detail.knowledgePathId,
        knowledgePathDbId: detail.knowledgePathDbId,
        version: detail.version,
      });
    } catch (err) {
      setError(err?.message || 'No se pudo descargar el snapshot');
    }
  };

  const handleAnchorBitcoin = async (pathId, version, { refresh = false } = {}) => {
    const key = `${pathId}:${version}`;
    try {
      setAnchoringKey(key);
      setError(null);
      setSuccess(null);
      const result = await knowledgePathsApi.broadcastPathSnapshotAnchor(
        pathId,
        version,
        { refresh },
      );
      const chain = result.blockchain || {};
      setSuccess(
        refresh
          ? `Confirmaciones actualizadas (v${version}): ${chain.status}`
          : `Digest enviado a Bitcoin (v${version}): ${chain.status}${
              chain.txid ? ` · ${chain.txid.slice(0, 16)}…` : ''
            }`,
      );
      if (detail && detail.knowledgePathDbId === pathId && detail.version === version) {
        setDetail((prev) => ({ ...prev, blockchain: chain }));
      }
      await load();
    } catch (err) {
      setError(formatError(err, 'No se pudo anclar el digest en Bitcoin'));
    } finally {
      setAnchoringKey(null);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Snapshots de knowledge paths
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Solo administradores. Primero “Tomar snapshot” (Postgres), luego
        “Anclar en Bitcoin” para escribir el digest en OP_RETURN (prefijo ACBC2),
        reutilizando la misma wallet/Esplora que los transcripts.
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
                  <TableCell>Bitcoin</TableCell>
                  <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paths.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary">
                      No hay knowledge paths.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {paths.map((path) => {
                const latest = path.latestSnapshot;
                const chain = latest?.blockchain;
                const anchorKey = latest
                  ? `${path.id}:${latest.version}`
                  : null;
                const canBroadcast =
                  latest &&
                  (!chain?.status ||
                    ['none', 'pending', 'failed'].includes(chain.status));
                const canRefresh =
                  latest &&
                  chain?.txid &&
                  ['btc_broadcast', 'anchored'].includes(chain.status);
                return (
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
                    {latest ? (
                      <Box>
                        <Typography variant="body2">
                          v{latest.version}
                        </Typography>
                        <Typography
                          variant="caption"
                          component="code"
                          sx={{ display: 'block', wordBreak: 'break-all' }}
                        >
                          {latest.digest.slice(0, 20)}…
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {latest.publishedAt}
                          {latest.publishedBy?.username
                            ? ` · ${latest.publishedBy.username}`
                            : ''}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Sin snapshot
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {latest ? (
                      <Stack spacing={0.5}>
                        {bitcoinStatusChip(chain)}
                        {chain?.txid ? (
                          <Typography
                            variant="caption"
                            component="a"
                            href={
                              chain.explorerUrl ||
                              getBtcExplorerTxUrl(chain.txid, chain.network)
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ wordBreak: 'break-all' }}
                          >
                            {chain.txid.slice(0, 18)}…
                          </Typography>
                        ) : null}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                      {latest && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openDetail(path.id, latest.version)}
                          sx={{ textTransform: 'none' }}
                        >
                          Ver
                        </Button>
                      )}
                      {canBroadcast && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          startIcon={<CurrencyBitcoinIcon />}
                          disabled={anchoringKey === anchorKey}
                          onClick={() =>
                            handleAnchorBitcoin(path.id, latest.version)
                          }
                          sx={{ textTransform: 'none' }}
                        >
                          {anchoringKey === anchorKey
                            ? 'Anclando…'
                            : 'Anclar en Bitcoin'}
                        </Button>
                      )}
                      {canRefresh && (
                        <Button
                          size="small"
                          variant="text"
                          disabled={anchoringKey === anchorKey}
                          onClick={() =>
                            handleAnchorBitcoin(path.id, latest.version, {
                              refresh: true,
                            })
                          }
                          sx={{ textTransform: 'none' }}
                        >
                          Refresh BTC
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
                        to={`/knowledge_path/${path.id}/edit?tab=snapshot&from=dashboard`}
                        sx={{ textTransform: 'none' }}
                      >
                        Preview
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
                );
              })}
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
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Descarga el JCS canónico (y el sidecar <code>.sha256</code>) para reconstruir
                el digest: <code>sha256sum archivo.jcs.json</code> debe coincidir con el
                digest mostrado arriba.
              </Alert>
              {detail.blockchain && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Bitcoin OP_RETURN
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    {bitcoinStatusChip(detail.blockchain)}
                    {detail.blockchain.txid ? (
                      <Typography
                        variant="body2"
                        component="a"
                        href={
                          detail.blockchain.explorerUrl ||
                          getBtcExplorerTxUrl(
                            detail.blockchain.txid,
                            detail.blockchain.network,
                          )
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ wordBreak: 'break-all' }}
                      >
                        {detail.blockchain.txid}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {detail.blockchain.message || 'Aún no anclado'}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}
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
        <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadDetail}
            disabled={!detail?.canonical}
            sx={{ textTransform: 'none' }}
          >
            Descargar JCS + digest
          </Button>
          {detail &&
            (!detail.blockchain?.status ||
              ['none', 'pending', 'failed'].includes(detail.blockchain.status)) && (
              <Button
                variant="outlined"
                color="warning"
                startIcon={<CurrencyBitcoinIcon />}
                disabled={
                  anchoringKey ===
                  `${detail.knowledgePathDbId}:${detail.version}`
                }
                onClick={() =>
                  handleAnchorBitcoin(detail.knowledgePathDbId, detail.version)
                }
                sx={{ textTransform: 'none' }}
              >
                Anclar en Bitcoin
              </Button>
            )}
          <Button onClick={() => setDetail(null)} sx={{ textTransform: 'none' }}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KnowledgePathSnapshotsDashboard;
