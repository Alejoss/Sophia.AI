import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VerifiedIcon from '@mui/icons-material/Verified';
import contentApi from '../api/contentApi';

const STATUS_LABELS = {
  pending: 'Pendiente (preparado)',
  btc_broadcast: 'Enviado a Bitcoin',
  anchored: 'Anclado en Bitcoin',
  failed: 'Fallido',
};

const BTC_EXPLORER = {
  mainnet: (txid) => `https://mempool.space/tx/${txid}`,
  testnet: (txid) => `https://mempool.space/testnet/tx/${txid}`,
  signet: (txid) => `https://mempool.space/signet/tx/${txid}`,
};

const CopyableMono = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Box sx={{ mb: 1.25 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            wordBreak: 'break-all',
            flex: 1,
          }}
        >
          {value}
        </Typography>
        <Tooltip title={copied ? 'Copiado' : 'Copiar'}>
          <IconButton size="small" onClick={handleCopy} aria-label={`Copiar ${label}`}>
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

/**
 * Certification panel: prepare and display a Bitcoin OP_RETURN anchor for the transcript hash.
 * Broadcast to Bitcoin is wired in a later step; this UI drives the Django anchor API.
 */
const TranscriptAnchorPanel = ({ contentId, textHash }) => {
  const [loading, setLoading] = useState(true);
  const [certifying, setCertifying] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await contentApi.getTranscriptAnchor(contentId);
      setInfo(data);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar el estado de certificación.');
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCertify = async () => {
    setCertifying(true);
    setError(null);
    try {
      await contentApi.createTranscriptAnchor(contentId, {
        btc_network: 'signet',
      });
      await load();
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'No se pudo crear el anclaje.';
      setError(message);
      if (err?.response?.status === 409 && err?.response?.data?.anchor) {
        await load();
      }
    } finally {
      setCertifying(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const anchor = info?.anchor;
  const hash = info?.current_text_hash || textHash;
  const statusLabel = anchor ? STATUS_LABELS[anchor.status] || anchor.status : null;
  const explorerUrl =
    anchor?.btc_txid && BTC_EXPLORER[anchor.btc_network]
      ? BTC_EXPLORER[anchor.btc_network](anchor.btc_txid)
      : null;

  return (
    <Box
      sx={{
        mt: 3,
        pt: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <VerifiedIcon color="primary" fontSize="small" />
        <Typography variant="subtitle1" component="h2">
          Certificación en Bitcoin
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        El hash SHA-256 del texto se ancla en Bitcoin con un OP_RETURN. Cualquiera
        con el transcript puede recalcular el hash y comprobarlo en el explorador.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <CopyableMono label="text_hash (SHA-256)" value={hash} />

      {anchor ? (
        <Stack spacing={0.5} sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
            <Chip
              size="small"
              color={anchor.is_btc_confirmed ? 'success' : 'default'}
              label={statusLabel}
            />
            <Chip size="small" variant="outlined" label={anchor.btc_network} />
            {anchor.matches_current_transcript && (
              <Chip size="small" variant="outlined" label="Coincide con transcript actual" />
            )}
          </Box>
          <CopyableMono label="OP_RETURN (hex)" value={anchor.btc_op_return_hex} />
          <CopyableMono label="Bitcoin txid" value={anchor.btc_txid || null} />
          {explorerUrl && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              <Link href={explorerUrl} target="_blank" rel="noopener noreferrer">
                Ver transacción en mempool.space
              </Link>
            </Typography>
          )}
          {anchor.status === 'pending' && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Anclaje preparado (payload OP_RETURN listo). El envío a la red Bitcoin
              se completará en un paso posterior.
            </Alert>
          )}
          {anchor.status === 'btc_broadcast' && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Transacción enviada; esperando confirmaciones en Bitcoin.
            </Alert>
          )}
        </Stack>
      ) : (
        <>
          <Divider sx={{ my: 1.5 }} />
          {info?.can_certify ? (
            <Button
              variant="contained"
              onClick={handleCertify}
              disabled={certifying || !hash}
              sx={{ textTransform: 'none' }}
            >
              {certifying ? 'Preparando…' : 'Preparar anclaje en Bitcoin'}
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Aún no hay anclaje en Bitcoin para este transcript.
              {hash
                ? ' Cuando exista, cualquiera podrá verificar recalculando el SHA-256 y comparándolo con el OP_RETURN.'
                : ''}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
};

export default TranscriptAnchorPanel;
