import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../context/AuthContext';
import { fetchOrCreateThread, sendMessage } from '../api/messagesApi';
import { reportBchOrderTxid } from '../api/paymentsApi';
import {
  PAYMENT_SUPPORT_USER_ID,
  buildAnchorFulfillDeferredHelpMessage,
  buildBchVerifyHelpMessage,
  isLikelyBchTxid,
  normalizeBchTxid,
} from './bchPaymentSupport';

const formatApiError = (err, fallback) => {
  const msg = err?.error || err?.detail || err?.response?.data?.error || err?.message;
  if (typeof msg === 'string') return msg;
  if (msg) return JSON.stringify(msg);
  return fallback;
};

/**
 * Comfort path after BCH auto-verify fails: collect TXID and message support.
 */
const BchPaymentSupportModal = ({
  open,
  onClose,
  onBackToOrder,
  title,
  priceUsd,
  productLabel,
  bchOrder = null,
  verifyError = null,
  mode = 'verify_failed',
  reviewNote = '',
  requestId = null,
  paymentMethod = '',
}) => {
  const { t } = useTranslation('payments');
  const isFulfillDeferred = mode === 'fulfill_deferred';
  const navigate = useNavigate();
  const { authState } = useAuth();
  const currentUser = authState?.user;
  const isSelf = Number(currentUser?.id) === PAYMENT_SUPPORT_USER_ID;

  const [txid, setTxid] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
      setTxid('');
      setNote('');
    }
  }, [open]);

  const handleSend = async () => {
    const cleanTxid = normalizeBchTxid(txid);
    if (busy || isSelf) return;
    if (!isFulfillDeferred) {
      if (!cleanTxid) return;
      if (!isLikelyBchTxid(cleanTxid)) {
        setError(t('bchSupport.txidInvalid'));
        return;
      }
    } else if (cleanTxid && !isLikelyBchTxid(cleanTxid)) {
      setError(t('bchSupport.txidInvalid'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (bchOrder?.id != null && cleanTxid) {
        await reportBchOrderTxid(bchOrder.id, { txid: cleanTxid, note });
      }
      const threadRes = await fetchOrCreateThread(PAYMENT_SUPPORT_USER_ID);
      const thread = threadRes?.data;
      if (!thread?.id) {
        throw new Error(t('bchSupport.openThreadError'));
      }
      const message = isFulfillDeferred
        ? buildAnchorFulfillDeferredHelpMessage({
          title,
          priceUsd,
          productLabel: productLabel || t('genericProduct'),
          bchOrder,
          reviewNote,
          requestId,
          note,
          paymentMethod,
        })
        : buildBchVerifyHelpMessage({
          title,
          priceUsd,
          productLabel: productLabel || t('genericProduct'),
          bchOrder,
          error: verifyError,
          txid: cleanTxid,
          note,
        });
      await sendMessage(thread.id, message);
      onClose?.();
      navigate(`/messages/thread/${PAYMENT_SUPPORT_USER_ID}`);
    } catch (err) {
      setError(formatApiError(err, t('bchSupport.sendError')));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {isFulfillDeferred
          ? t('bchSupport.paidTitle')
          : t('bchSupport.verifyTitle')}
        <IconButton
          aria-label={t('close')}
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {title && (
            <Typography variant="body2" color="text.secondary">
              {title}
              {priceUsd != null ? ` · $${Number(priceUsd || 0).toFixed(2)} USD` : ''}
            </Typography>
          )}
          <Alert severity="info">
            {isFulfillDeferred
              ? t('bchSupport.deferredDescription')
              : t('bchSupport.description')}
          </Alert>
          {!isFulfillDeferred && verifyError && (
            <Alert severity="warning">{verifyError}</Alert>
          )}
          {isFulfillDeferred && reviewNote && (
            <Alert severity="warning">{reviewNote}</Alert>
          )}
          {bchOrder?.address && (
            <Typography variant="body2" color="text.secondary">
              {t('bchSupport.orderLine', {
                idPrefix: bchOrder.id != null ? `#${bchOrder.id} · ` : '',
                amount: bchOrder.expected_amount_bch,
              })}{' '}
              <Typography
                component="span"
                sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
              >
                {bchOrder.address}
              </Typography>
            </Typography>
          )}
          {isSelf && (
            <Alert severity="info">
              {t('bchSupport.self')}
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label={isFulfillDeferred
              ? t('bchSupport.txidOptional')
              : t('bchSupport.txidRequired')}
            value={txid}
            onChange={(event) => setTxid(event.target.value)}
            placeholder={t('bchSupport.txidPlaceholder')}
            fullWidth
            required={!isFulfillDeferred}
            disabled={busy || isSelf}
            helperText={isFulfillDeferred
              ? t('bchSupport.txidHelperOptional')
              : t('bchSupport.txidHelper')}
            inputProps={{ spellCheck: false, autoComplete: 'off' }}
          />
          <TextField
            label={t('bchSupport.note')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            multiline
            minRows={2}
            fullWidth
            disabled={busy || isSelf}
            placeholder={t('bchSupport.notePlaceholder')}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexDirection: 'column', gap: 1, alignItems: 'stretch' }}>
        <Button
          variant="contained"
          fullWidth
          disabled={busy || isSelf || (!isFulfillDeferred && !normalizeBchTxid(txid))}
          onClick={handleSend}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {busy
            ? t('sending')
            : (isFulfillDeferred ? t('contactSupport') : t('bchSupport.sendTxid'))}
        </Button>
        {onBackToOrder && (
          <Button onClick={onBackToOrder} fullWidth disabled={busy}>
            {t('bchSupport.backToOrder')}
          </Button>
        )}
        <Button onClick={onClose} fullWidth disabled={busy}>
          {t('close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BchPaymentSupportModal;
