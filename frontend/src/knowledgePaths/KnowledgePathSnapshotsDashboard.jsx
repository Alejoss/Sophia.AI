import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

const bitcoinStatusChip = (blockchain, t) => {
  const status = blockchain?.status || 'none';
  if (status === 'anchored') {
    return <Chip size="small" color="success" label={t('snapshots.btcAnchored')} />;
  }
  if (status === 'btc_broadcast') {
    return <Chip size="small" color="info" label="BTC broadcast" />;
  }
  if (status === 'pending') {
    return <Chip size="small" color="warning" label="BTC pending" />;
  }
  if (status === 'failed') {
    return <Chip size="small" color="error" label={t('snapshots.btcFailed')} />;
  }
  return <Chip size="small" variant="outlined" label={t('snapshots.noBtc')} />;
};

const KnowledgePathSnapshotsDashboard = () => {
  const { t } = useTranslation('paths');
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
      setError(formatError(err, t('snapshots.loadError')));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
        created.created
          ? t('snapshots.created', {
              version: created.version,
              title: created.knowledgePathTitle,
              digest: created.digest.slice(0, 16),
            })
          : t('snapshots.unchanged', {
              title: created.knowledgePathTitle,
              version: created.version,
            }),
      );
      await load();
    } catch (err) {
      setError(formatError(err, t('snapshots.createError')));
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
      setError(formatError(err, t('snapshots.loadOneError')));
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
      setError(err?.message || t('snapshots.downloadError'));
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
          ? t('snapshots.confirmations', { version, status: chain.status })
          : chain.txid
            ? t('snapshots.digestSentTx', {
                version,
                status: chain.status,
                txid: chain.txid.slice(0, 16),
              })
            : t('snapshots.digestSent', { version, status: chain.status }),
      );
      if (detail && detail.knowledgePathDbId === pathId && detail.version === version) {
        setDetail((prev) => ({ ...prev, blockchain: chain }));
      }
      await load();
    } catch (err) {
      setError(formatError(err, t('snapshots.anchorError')));
    } finally {
      setAnchoringKey(null);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        {t('snapshots.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('snapshots.intro1')} {t('snapshots.intro2')} {t('snapshots.intro3')} {t('snapshots.intro4')}
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
                <TableCell>{t('snapshots.path')}</TableCell>
                <TableCell>{t('snapshots.nodes')}</TableCell>
                <TableCell>{t('snapshots.status')}</TableCell>
                  <TableCell>{t('snapshots.latest')}</TableCell>
                  <TableCell>{t('snapshots.bitcoin')}</TableCell>
                  <TableCell align="right">{t('snapshots.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paths.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary">
                      {t('snapshots.empty')}
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
                        label={path.isVisible ? t('common.public') : t('common.private')}
                        color={path.isVisible ? 'success' : 'default'}
                      />
                      {path.certificatesEnabled && (
                        <Chip size="small" label={t('snapshots.certificates')} color="info" />
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
                        {t('snapshots.noSnapshot')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {latest ? (
                      <Stack spacing={0.5}>
                        {bitcoinStatusChip(chain, t)}
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
                          {t('snapshots.view')}
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
                            ? t('snapshots.anchoring')
                            : t('snapshots.anchor')}
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
                        {publishingId === path.id ? t('common.saving') : t('snapshots.takeSnapshot')}
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
            ? t('snapshots.dialogTitle', {
                version: detail.version,
                title: detail.knowledgePathTitle,
              })
            : t('snapshots.loading')}
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
                <strong>{t('snapshots.digest')}</strong>{' '}
                <Box component="code" sx={{ wordBreak: 'break-all' }}>
                  {detail.digest}
                </Box>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('snapshots.published', { date: detail.publishedAt })}
                {detail.publishedBy?.username
                  ? t('snapshots.byUser', { name: detail.publishedBy.username })
                  : ''}
              </Typography>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                {t('snapshots.downloadBefore')}<code>.sha256</code>{t('snapshots.downloadMid')}<code>sha256sum archivo.jcs.json</code>{t('snapshots.downloadAfter')}
              </Alert>
              {detail.blockchain && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {t('snapshots.opReturn')}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    {bitcoinStatusChip(detail.blockchain, t)}
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
                        {detail.blockchain.message || t('snapshots.notAnchored')}
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
            {t('snapshots.downloadJcs')}
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
                {t('snapshots.anchor')}
              </Button>
            )}
          <Button onClick={() => setDetail(null)} sx={{ textTransform: 'none' }}>
            {t('snapshots.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KnowledgePathSnapshotsDashboard;
