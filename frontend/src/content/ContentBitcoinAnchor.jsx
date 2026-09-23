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
import DownloadIcon from '@mui/icons-material/Download';
import contentApi from '../api/contentApi';
import { AuthContext } from '../context/AuthContext';
import AnchorCheckout from '../payments/adapters/AnchorCheckout';
import BchPaymentSupportModal from '../payments/BchPaymentSupportModal';
import { ANCHOR_PAYMENT_TITLE } from '../payments/productCatalog';
import { getBtcExplorerTxUrl } from '../utils/bitcoinExplorer';

const REQUEST_STATUS_LABELS = {
  pending_payment: 'Pago pendiente',
  paid_pending_review: 'Pago recibido — emitiendo anclaje',
  approved: 'Anclada',
  rejected: 'Rechazada',
};

async function sha256HexUtf8(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Bitcoin OP_RETURN CTA: pay $1 then auto-hash + broadcast (no admin gate).
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
  const [priceTokens, setPriceTokens] = useState(100);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [supportOpen, setSupportOpen] = useState(false);
  const [localHashMatch, setLocalHashMatch] = useState(null);

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
      if (data?.price_tokens != null) setPriceTokens(Number(data.price_tokens));
      if (data?.token_balance != null) setTokenBalance(Number(data.token_balance));
    } catch {
      setRequestInfo(null);
    }
  }, [contentId, isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    setInfo(undefined);
    setActionError(null);
    setLocalHashMatch(null);
    (async () => {
      await loadAnchor();
      if (!cancelled) await loadRequest();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAnchor, loadRequest]);

  useEffect(() => {
    const anchor = info?.anchor;
    const certified = anchor?.certified_plain_text;
    const expected = anchor?.text_hash;
    if (!certified || !expected) {
      setLocalHashMatch(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const digest = await sha256HexUtf8(certified);
        if (!cancelled) {
          setLocalHashMatch(digest === expected);
        }
      } catch {
        if (!cancelled) setLocalHashMatch(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [info?.anchor?.certified_plain_text, info?.anchor?.text_hash]);

  const handleStartAnchor = async () => {
    if (!contentId || requesting) return;
    setRequesting(true);
    setActionError(null);
    try {
      const created = await contentApi.createTranscriptAnchorRequest(contentId);
      setPayRequestId(created.id);
      setCheckoutOpen(true);
      await loadRequest();
    } catch (err) {
      setActionError(
        err?.response?.data?.error
        || err?.error
        || 'No se pudo iniciar el anclaje a Bitcoin.',
      );
    } finally {
      setRequesting(false);
    }
  };

  if (info === undefined) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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

  if (!hasTxid && !hasTranscript) {
    return null;
  }

  if (hasTxid) {
    const explorerUrl = getBtcExplorerTxUrl(anchor.btc_txid, anchor.btc_network);
    const isConfirmed = Boolean(anchor.is_btc_confirmed || anchor.status === 'anchored');
    const textHash = anchor.text_hash || info.current_text_hash || null;
    const certifiedText = (anchor.certified_plain_text || '').trim();
    const downloadUrl = anchor.id
      ? contentApi.getTranscriptAnchorCertifiedTextUrl(contentId, anchor.id)
      : null;
    const monoSx = {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      wordBreak: 'break-all',
      fontSize: '0.8rem',
      lineHeight: 1.4,
    };

    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
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
          {localHashMatch === true && (
            <Chip size="small" color="success" variant="outlined" label="Hash local OK" />
          )}
          {localHashMatch === false && (
            <Chip size="small" color="error" variant="outlined" label="Hash local no coincide" />
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
          <Typography variant="body2" sx={{ mb: certifiedText || downloadUrl ? 1 : 0 }}>
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

        {(certifiedText || downloadUrl) && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
              Texto exacto certificado (UTF-8 normalizado). Descárgalo y comprueba
              localmente que SHA-256 coincida con text_hash — incluso si la
              transcripción viva cambia después.
            </Typography>
            {downloadUrl && (
              <Button
                size="small"
                variant="outlined"
                href={downloadUrl}
                download
                startIcon={<DownloadIcon />}
                sx={{ mb: certifiedText ? 1 : 0 }}
              >
                Descargar texto certificado
              </Button>
            )}
            {certifiedText && (
              <Typography
                variant="body2"
                sx={{
                  ...monoSx,
                  maxHeight: 120,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1,
                }}
              >
                {certifiedText}
              </Typography>
            )}
            {!certifiedText && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Este anclaje no guardó el texto certificado; no se puede verificar
                de forma independiente solo con el digest.
              </Alert>
            )}
          </Box>
        )}

        {!isConfirmed && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            La transacción ya está en la red; la primera confirmación suele tardar
            unos 10 minutos o más. No hace falta pagar de nuevo.
          </Typography>
        )}
      </Paper>
    );
  }

  if (!isAuthenticated && !actionError) {
    return null;
  }

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2 }}>
        {actionError && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {actionError}
          </Alert>
        )}

        {reqStatus === 'paid_pending_review' && (
          <Alert severity={isMine ? 'warning' : 'info'} sx={{ mb: 1.5 }}>
            {isMine
              ? (
                <>
                  Pago confirmado. Si el anclaje se emitió bien, la confirmación en
                  Bitcoin suele tardar unos 10 minutos o más. Si pasa mucho más tiempo
                  sin aparecer el txid, no vuelvas a pagar — contacta soporte.
                  {req?.review_note ? (
                    <Box component="span" sx={{ display: 'block', mt: 1 }}>
                      Detalle: {req.review_note}
                    </Box>
                  ) : null}
                  <Box sx={{ mt: 1.5 }}>
                    <Button
                      size="small"
                      variant="contained"
                      color="inherit"
                      onClick={() => setSupportOpen(true)}
                    >
                      Contactar soporte
                    </Button>
                  </Box>
                </>
              )
              : 'Ya hay un anclaje en curso para este hash.'}
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
            El anclaje fue rechazado.
            {req.review_note ? ` Motivo: ${req.review_note}` : ''}
          </Alert>
        )}

        {isAuthenticated
          && (!req || reqStatus === 'rejected' || (reqStatus === 'pending_payment' && !isMine))
          && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              Ancla el hash SHA-256 de esta transcripción a Bitcoin por ${priceUsd} USD.
              Tras el pago (tokens, crypto o BCH) el anclaje se emite automáticamente;
              la confirmación en la red suele tardar unos 10 minutos o más.
            </Typography>
            <Button
              variant="contained"
              size="small"
              disabled={requesting || (reqStatus === 'pending_payment' && !isMine)}
              onClick={handleStartAnchor}
              startIcon={requesting ? <CircularProgress size={14} color="inherit" /> : null}
            >
              {requesting ? 'Preparando…' : `Anclar a Bitcoin ($${priceUsd})`}
            </Button>
          </Box>
        )}

        {!isAuthenticated && (
          <Typography variant="body2" color="text.secondary">
            Inicia sesión para anclar esta transcripción a Bitcoin.
          </Typography>
        )}
      </Paper>

      <AnchorCheckout
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        anchorRequestId={payRequestId}
        title={ANCHOR_PAYMENT_TITLE}
        priceUsd={priceUsd}
        priceTokens={priceTokens}
        tokenBalance={tokenBalance}
        onPaid={async (result) => {
          if (result?.token_balance != null) {
            setTokenBalance(Number(result.token_balance));
          }
          await loadRequest();
          await loadAnchor();
        }}
      />

      <BchPaymentSupportModal
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        title={contentTitle || `Contenido ${contentId}`}
        priceUsd={priceUsd}
        productLabel="anclaje a Bitcoin"
        mode="fulfill_deferred"
        reviewNote={req?.review_note || ''}
        requestId={req?.id ?? null}
      />
    </>
  );
};

export default ContentBitcoinAnchor;
