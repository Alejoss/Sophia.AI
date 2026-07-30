import React, { useEffect, useState } from 'react';
import {
  Box,
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

/**
 * Bitcoin OP_RETURN certification block for content detail pages only.
 * Shows hash, txid, and mempool explorer link when an on-chain anchor exists.
 */
const ContentBitcoinAnchor = ({ contentId }) => {
  const [info, setInfo] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    setInfo(undefined);

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
  if (!anchor?.btc_txid) {
    return null;
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
