import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link,
  Paper,
  Typography,
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import contentApi from '../api/contentApi';
import { getBtcExplorerTxUrl } from '../utils/bitcoinExplorer';

const FEE_TOO_HIGH_FALLBACK =
  'Las comisiones por transacción están muy altas por el momento, por favor vuelve a intentarlo más tarde';

/**
 * Bitcoin OP_RETURN certification block (content detail + transcript page).
 * Shows hash, txid, and mempool explorer link when an on-chain anchor exists.
 * Uploaders/staff can trigger broadcast; fee over budget surfaces as an Alert.
 */
const ContentBitcoinAnchor = ({ contentId }) => {
  const [info, setInfo] = useState(undefined);
  const [certifying, setCertifying] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setInfo(undefined);
    setActionError(null);

    if (!contentId) {
      setInfo(null);
      return undefined;
    }

    contentApi
      .getTranscriptAnchor(contentId)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => {
        if (!cancelled) setInfo(null);
      });

    return () => {
      cancelled = true;
    };
  }, [contentId]);

  const handleCertify = async () => {
    if (!contentId || certifying) return;
    setCertifying(true);
    setActionError(null);
    try {
      const data = await contentApi.broadcastTranscriptAnchor(contentId);
      setInfo(data);
    } catch (err) {
      const payload = err?.response?.data;
      const message =
        payload?.error ||
        (payload?.code === 'fee_too_high' ? FEE_TOO_HIGH_FALLBACK : null) ||
        'No se pudo anclar la transcripción en Bitcoin.';
      setActionError(message);
    } finally {
      setCertifying(false);
    }
  };

  if (info === undefined) {
    return (
      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Comprobando anclaje Bitcoin…
        </Typography>
      </Box>
    );
  }

  const anchor = info?.anchor;
  const canCertify = Boolean(info?.can_certify);
  const hasTxid = Boolean(anchor?.btc_txid);

  if (!hasTxid && !canCertify && !actionError) {
    return null;
  }

  if (!hasTxid) {
    return (
      <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
        {actionError && (
          <Alert severity="warning" sx={{ mb: canCertify ? 1.5 : 0 }}>
            {actionError}
          </Alert>
        )}
        {canCertify && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              Puedes anclar el hash de esta transcripción en Bitcoin.
            </Typography>
            <Button
              variant="contained"
              size="small"
              disabled={certifying}
              onClick={handleCertify}
              startIcon={certifying ? <CircularProgress size={14} color="inherit" /> : null}
            >
              {certifying ? 'Anclando…' : 'Anclar en Bitcoin'}
            </Button>
          </Box>
        )}
      </Paper>
    );
  }

  const explorerUrl = getBtcExplorerTxUrl(anchor.btc_txid, anchor.btc_network);
  const isConfirmed = Boolean(anchor.is_btc_confirmed || anchor.status === 'anchored');
  const textHash = anchor.text_hash || info.current_text_hash || null;
  const monoSx = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    wordBreak: 'break-all',
    fontSize: '0.8rem',
    lineHeight: 1.4,
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 2,
        p: 2,
      }}
    >
      {actionError && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {actionError}
        </Alert>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <Chip
          size="small"
          color={isConfirmed ? 'success' : 'info'}
          icon={<VerifiedIcon />}
          label={
            isConfirmed
              ? 'Anclada en BTC'
              : 'Anclada en BTC (pendiente de confirmación)'
          }
        />
        {anchor.btc_network && (
          <Chip size="small" variant="outlined" label={anchor.btc_network} />
        )}
      </Box>

      {textHash && (
        <Box sx={{ mb: 0.75 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            text_hash (SHA-256)
          </Typography>
          <Typography variant="body2" sx={monoSx}>
            {textHash}
          </Typography>
        </Box>
      )}

      <Box sx={{ mb: explorerUrl ? 1 : 0 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          Bitcoin txid
        </Typography>
        <Typography variant="body2" sx={monoSx}>
          {anchor.btc_txid}
        </Typography>
      </Box>

      {explorerUrl && (
        <Typography variant="body2">
          <Link
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
          >
            Ver en mempool.space
            <OpenInNewIcon sx={{ fontSize: 14 }} />
          </Link>
        </Typography>
      )}
    </Paper>
  );
};

export default ContentBitcoinAnchor;
