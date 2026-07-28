import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VerifiedIcon from '@mui/icons-material/Verified';
import contentApi from '../api/contentApi';

const STATUS_LABELS = {
  pending: 'Pendiente (preparado)',
  btc_broadcast: 'Bitcoin enviado',
  btc_confirmed: 'Bitcoin confirmado',
  evm_broadcast: 'EVM enviado',
  anchored: 'Anclado',
  failed: 'Fallido',
};

const shortHash = (value) => {
  if (!value) return '—';
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
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
 * Certification panel: prepare Bitcoin OP_RETURN payload + show EVM/IPFS index fields.
 * BTC broadcast and on-chain EVM write are wired later; this UI drives the Django anchor API.
 */
const TranscriptAnchorPanel = ({ contentId, textHash }) => {
  const [loading, setLoading] = useState(true);
  const [certifying, setCertifying] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [ipfsCid, setIpfsCid] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await contentApi.getTranscriptAnchor(contentId);
      setInfo(data);
      if (data?.anchor?.ipfs_cid) {
        setIpfsCid(data.anchor.ipfs_cid);
      }
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
        ipfs_cid: ipfsCid.trim(),
        btc_network: 'testnet',
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
          Certificación on-chain
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        El hash SHA-256 del texto se ancla en Bitcoin (OP_RETURN). Un contrato EVM
        puede indexar el mismo hash, el CID de IPFS y el txid de Bitcoin.
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
          <CopyableMono label="IPFS CID" value={anchor.ipfs_cid || null} />
          <CopyableMono label="EVM tx" value={anchor.evm_tx_hash || null} />
          {anchor.evm_contract_address && (
            <Typography variant="caption" color="text.secondary">
              Contrato EVM: {shortHash(anchor.evm_contract_address)}
              {anchor.evm_chain_id ? ` (chain ${anchor.evm_chain_id})` : ''}
            </Typography>
          )}
          {anchor.status === 'pending' && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Anclaje preparado. El broadcast a Bitcoin y el registro en el contrato EVM
              se completarán en un paso posterior.
            </Alert>
          )}
        </Stack>
      ) : (
        <>
          <Divider sx={{ my: 1.5 }} />
          {info?.can_certify ? (
            <Stack spacing={1.5}>
              <TextField
                label="IPFS CID (opcional)"
                size="small"
                value={ipfsCid}
                onChange={(e) => setIpfsCid(e.target.value)}
                placeholder="bafy…"
                helperText="Puntero al texto; se puede dejar vacío y completar después."
              />
              <Button
                variant="contained"
                onClick={handleCertify}
                disabled={certifying || !hash}
                sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
              >
                {certifying ? 'Preparando…' : 'Preparar certificación'}
              </Button>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Aún no hay certificación para este transcript.
              {hash
                ? ' Cualquiera puede verificar recalculando el SHA-256 del texto y comparándolo con el OP_RETURN de Bitcoin cuando exista.'
                : ''}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
};

export default TranscriptAnchorPanel;
