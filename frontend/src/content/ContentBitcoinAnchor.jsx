import React, { useCallback, useContext, useEffect, useState } from 'react';
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
import { AuthContext } from '../context/AuthContext';
import AnchorPaymentCheckout from './AnchorPaymentCheckout';
import { getBtcExplorerTxUrl } from '../utils/bitcoinExplorer';

const REQUEST_STATUS_LABELS = {
  pending_payment: 'Pago pendiente',
  paid_pending_review: 'Pagada — en revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

/**
 * Bitcoin OP_RETURN block + paid anchor request CTA (any authenticated user).
 */
const ContentBitcoinAnchor = ({ contentId, contentTitle }) => {
  const { authState } = useContext(AuthContext);
  const isAuthenticated = Boolean(authState?.isAuthenticated);
  const [info, setInfo] = useState(undefined);
  const [requestInfo, setRequestInfo] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payRequestId, setPayRequestId] = useState(null);
  const [priceUsd, setPriceUsd] = useState(1);

  const loadAnchor = useCallback(async () => {
    if (!contentId) {
      setInfo(null);
      return;
    }
    try {
      const data = await contentApi.getTranscriptAnchor(contentId);
      setInfo(data);
    } catch {
      setInfo(null);
    }
  }, [contentId]);

  const loadRequest = useCallback(async () => {
    if (!contentId || !isAuthenticated) {
      setRequestInfo(null);
      return;
    }
    try {
      const data = await contentApi.getTranscriptAnchorRequest(contentId);
      setRequestInfo(data);
      if (data?.price_usd != null) setPriceUsd(Number(data.price_usd));
    } catch {
      setRequestInfo(null);
    }
  }, [contentId, isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    setInfo(undefined);
    setActionError(null);
    (async () => {
      await loadAnchor();
      if (!cancelled) await loadRequest();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAnchor, loadRequest]);

  const handleStartRequest = async () => {
    if (!contentId || requesting) return;
    setRequesting(true);
    setActionError(null);
    try {
      const created = await contentApi.createTranscriptAnchorRequest(contentId);
      setPayRequestId(created.id);
      setCheckoutOpen(true);
      await loadRequest();
    } catch (err) {
      const message =
        err?.response?.data?.error
        || err?.error
        || 'No se pudo crear la solicitud de anclaje a Bitcoin.';
      setActionError(message);
    } finally {
      setRequesting(false);
    }
  };

  if (info === undefined) {
    return (
      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Comprobando anclaje a Bitcoin…
        </Typography>
      </Box>
    );
  }

  const anchor = info?.anchor;
  const hasTxid = Boolean(anchor?.btc_txid);
  const hasTranscript = Boolean(
    info?.has_transcript && (info?.current_text_hash || anchor?.text_hash),
  );
  const req = requestInfo?.request;
  const reqStatus = req?.status;
  const isMine = Boolean(requestInfo?.is_mine);

  // No transcript → no request CTA (and nothing to show unless already on-chain).
  if (!hasTxid && !hasTranscript) {
    return null;
  }

  if (hasTxid) {
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
      <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 1 }}>
          <Chip
            size="small"
            color={isConfirmed ? 'success' : 'info'}
            icon={<VerifiedIcon />}
            label={
              isConfirmed
                ? 'Anclada a Bitcoin'
                : 'Anclada a Bitcoin (pendiente de confirmación)'
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
  }

  const showRequestCta = isAuthenticated;
  if (!showRequestCta && !actionError) {
    return null;
  }

  return (
    <>
      <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
        {actionError && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {actionError}
          </Alert>
        )}

        {reqStatus === 'paid_pending_review' && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            {isMine
              ? 'Tu pago fue recibido. La solicitud de anclaje a Bitcoin está en revisión.'
              : 'Ya hay una solicitud de anclaje a Bitcoin en revisión para este hash.'}
          </Alert>
        )}

        {reqStatus === 'pending_payment' && isMine && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip size="small" label={REQUEST_STATUS_LABELS.pending_payment} />
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                setPayRequestId(req.id);
                setCheckoutOpen(true);
              }}
            >
              Continuar pago (${priceUsd})
            </Button>
          </Box>
        )}

        {reqStatus === 'rejected' && isMine && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            Tu solicitud fue rechazada.
            {req.review_note ? ` Motivo: ${req.review_note}` : ''}
          </Alert>
        )}

        {isAuthenticated
          && (!req || reqStatus === 'rejected' || (reqStatus === 'pending_payment' && !isMine))
          && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              Solicita el anclaje a Bitcoin del hash de esta transcripción por ${priceUsd} USD.
              Un administrador revisará la solicitud antes de emitirla.
            </Typography>
            <Button
              variant="contained"
              size="small"
              disabled={requesting || (reqStatus === 'pending_payment' && !isMine)}
              onClick={handleStartRequest}
              startIcon={requesting ? <CircularProgress size={14} color="inherit" /> : null}
            >
              {requesting ? 'Creando…' : `Solicitar anclaje a Bitcoin ($${priceUsd})`}
            </Button>
          </Box>
        )}

        {!isAuthenticated && (
          <Typography variant="body2" color="text.secondary">
            Inicia sesión para solicitar el anclaje a Bitcoin de esta transcripción.
          </Typography>
        )}
      </Paper>

      <AnchorPaymentCheckout
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        anchorRequestId={payRequestId}
        title={contentTitle || `Contenido ${contentId}`}
        priceUsd={priceUsd}
        onPaid={async () => {
          await loadRequest();
          await loadAnchor();
        }}
      />
    </>
  );
};

export default ContentBitcoinAnchor;
