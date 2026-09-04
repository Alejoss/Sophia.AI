import React, { useEffect, useState } from 'react';
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
import {
  BCH_SUPPORT_DESCRIPTION,
  PAYMENT_SUPPORT_USER_ID,
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
  productLabel = 'producto',
  bchOrder = null,
  verifyError = null,
}) => {
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
    if (!cleanTxid || busy || isSelf) return;
    if (!isLikelyBchTxid(cleanTxid)) {
      setError('El ID de transacción debe tener 64 caracteres hexadecimales.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const threadRes = await fetchOrCreateThread(PAYMENT_SUPPORT_USER_ID);
      const thread = threadRes?.data;
      if (!thread?.id) {
        throw new Error('No se pudo abrir la conversación');
      }
      await sendMessage(
        thread.id,
        buildBchVerifyHelpMessage({
          title,
          priceUsd,
          productLabel,
          bchOrder,
          error: verifyError,
          txid: cleanTxid,
          note,
        }),
      );
      onClose?.();
      navigate(`/messages/thread/${PAYMENT_SUPPORT_USER_ID}`);
    } catch (err) {
      setError(formatApiError(err, 'No se pudo enviar el mensaje'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Ya pagué — avisar a soporte
        <IconButton
          aria-label="Cerrar"
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
          <Alert severity="info">{BCH_SUPPORT_DESCRIPTION}</Alert>
          {verifyError && <Alert severity="warning">{verifyError}</Alert>}
          {bchOrder?.address && (
            <Typography variant="body2" color="text.secondary">
              Orden {bchOrder.id != null ? `#${bchOrder.id} · ` : ''}
              {bchOrder.expected_amount_bch} BCH →{' '}
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
              Esta opción envía un mensaje a tu propia cuenta. Usa otra sesión para probar el flujo.
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="ID de transacción (TXID)"
            value={txid}
            onChange={(event) => setTxid(event.target.value)}
            placeholder="64 caracteres hexadecimales"
            fullWidth
            required
            disabled={busy || isSelf}
            helperText="Cópialo desde tu billetera o explorador BCH después de enviar el pago."
            inputProps={{ spellCheck: false, autoComplete: 'off' }}
          />
          <TextField
            label="Nota opcional"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            multiline
            minRows={2}
            fullWidth
            disabled={busy || isSelf}
            placeholder="Cualquier detalle útil (billetera usada, hora aproximada, etc.)"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexDirection: 'column', gap: 1, alignItems: 'stretch' }}>
        <Button
          variant="contained"
          fullWidth
          disabled={busy || isSelf || !normalizeBchTxid(txid)}
          onClick={handleSend}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {busy ? 'Enviando...' : 'Enviar TXID a soporte'}
        </Button>
        {onBackToOrder && (
          <Button onClick={onBackToOrder} fullWidth disabled={busy}>
            Volver a la orden BCH
          </Button>
        )}
        <Button onClick={onClose} fullWidth disabled={busy}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BchPaymentSupportModal;
