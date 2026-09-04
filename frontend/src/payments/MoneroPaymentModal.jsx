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
  MONERO_CONTACT_USER_ID,
  MONERO_PAYMENT_DESCRIPTION,
  buildMoneroPaymentMessage,
} from './moneroPayment';

const formatApiError = (err, fallback) => {
  const msg = err?.error || err?.detail || err?.response?.data?.error || err?.message;
  if (typeof msg === 'string') return msg;
  if (msg) return JSON.stringify(msg);
  return fallback;
};

const MoneroPaymentModal = ({
  open,
  onClose,
  onBackToMethods,
  title,
  priceUsd,
  productLabel = 'producto',
}) => {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const currentUser = authState?.user;
  const isSelf = Number(currentUser?.id) === MONERO_CONTACT_USER_ID;

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
      return undefined;
    }
    setText(buildMoneroPaymentMessage({ title, priceUsd, productLabel }));
    return undefined;
  }, [open, title, priceUsd, productLabel]);

  const handleSend = async () => {
    const message = text.trim();
    if (!message || busy || isSelf) return;

    setBusy(true);
    setError(null);
    try {
      const threadRes = await fetchOrCreateThread(MONERO_CONTACT_USER_ID);
      const thread = threadRes?.data;
      if (!thread?.id) {
        throw new Error('No se pudo abrir la conversación');
      }
      await sendMessage(thread.id, message);
      onClose?.();
      navigate(`/messages/thread/${MONERO_CONTACT_USER_ID}`);
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
        Pagar con Monero
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
          <Typography variant="body1">
            {MONERO_PAYMENT_DESCRIPTION}
          </Typography>
          {isSelf && (
            <Alert severity="info">
              Esta opción envía un mensaje a tu propia cuenta. Usa otra sesión para probar el pago.
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Mensaje"
            value={text}
            onChange={(event) => setText(event.target.value)}
            multiline
            minRows={3}
            fullWidth
            disabled={busy || isSelf}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexDirection: 'column', gap: 1, alignItems: 'stretch' }}>
        <Button
          variant="contained"
          fullWidth
          disabled={busy || isSelf || !text.trim()}
          onClick={handleSend}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {busy ? 'Enviando...' : 'Enviar mensaje'}
        </Button>
        <Button onClick={onClose} fullWidth>
          Cerrar
        </Button>
        {onBackToMethods && (
          <Button size="small" onClick={onBackToMethods}>
            Volver a métodos de pago
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MoneroPaymentModal;
