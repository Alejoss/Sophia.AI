import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  createAnchorRequestBchPayment,
  getPaymentGatewayStatus,
  verifyAnchorRequestBchPayment,
} from '../api/paymentsApi';
import CryptoPaymentModal from '../events/CryptoPaymentModal';

const formatApiError = (err, fallback) => {
  const msg = err?.error || err?.detail || err?.message;
  if (typeof msg === 'string') return msg;
  if (msg) return JSON.stringify(msg);
  return fallback;
};

/**
 * Checkout chooser: NOWPayments (hosted) vs self-custody BCH direct.
 */
const AnchorPaymentCheckout = ({
  open,
  onClose,
  anchorRequestId,
  title,
  priceUsd = 1,
  onPaid,
}) => {
  const [methods, setMethods] = useState({ nowpayments: false, bch_direct: false });
  const [bchNetwork, setBchNetwork] = useState(null);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [method, setMethod] = useState(null); // 'nowpayments' | 'bch' | null
  const [bchOrder, setBchOrder] = useState(null);
  const [bchBusy, setBchBusy] = useState(false);
  const [bchError, setBchError] = useState(null);
  const [copied, setCopied] = useState('');
  const [paidReview, setPaidReview] = useState(false);

  useEffect(() => {
    if (!open) {
      setMethod(null);
      setBchOrder(null);
      setBchError(null);
      setPaidReview(false);
      setCopied('');
      return undefined;
    }
    let cancelled = false;
    setLoadingMethods(true);
    getPaymentGatewayStatus()
      .then((data) => {
        if (cancelled) return;
        setMethods({
          nowpayments: Boolean(data?.methods?.nowpayments ?? data?.enabled),
          bch_direct: Boolean(data?.methods?.bch_direct ?? data?.bch_direct_enabled),
        });
        setBchNetwork(data?.bch_network || null);
      })
      .catch(() => {
        if (!cancelled) setMethods({ nowpayments: true, bch_direct: false });
      })
      .finally(() => {
        if (!cancelled) setLoadingMethods(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const startBch = async () => {
    if (!anchorRequestId) return;
    setMethod('bch');
    setBchBusy(true);
    setBchError(null);
    try {
      const order = await createAnchorRequestBchPayment(anchorRequestId);
      setBchOrder(order);
    } catch (err) {
      setBchError(formatApiError(err, 'No se pudo crear la orden BCH'));
    } finally {
      setBchBusy(false);
    }
  };

  const verifyBch = async () => {
    if (!anchorRequestId) return;
    setBchBusy(true);
    setBchError(null);
    try {
      const data = await verifyAnchorRequestBchPayment(anchorRequestId);
      setBchOrder(data.payment);
      if (data.request?.status === 'paid_pending_review' || data.payment?.status === 'paid') {
        setPaidReview(true);
        onPaid?.(data);
      }
    } catch (err) {
      setBchError(formatApiError(err, 'No se pudo verificar el pago'));
    } finally {
      setBchBusy(false);
    }
  };

  const copyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      setBchError('No se pudo copiar al portapapeles');
    }
  };

  const showChooser = open && method === null && !paidReview;
  const showNowpayments = open && method === 'nowpayments';
  const showBch = open && method === 'bch';

  return (
    <>
      <Dialog open={showChooser} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          Anclaje a Bitcoin
          <IconButton
            aria-label="Cerrar"
            onClick={onClose}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {title}
          </Typography>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
            ${priceUsd} USD
          </Typography>
          {loadingMethods ? (
            <Stack alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Elige cómo pagar. Tras el pago, un administrador revisará el anclaje a Bitcoin.
                {bchNetwork && bchNetwork !== 'mainnet' && (
                  <>
                    {' '}
                    BCH directo usa la red de pruebas <strong>{bchNetwork}</strong>.
                  </>
                )}
              </Typography>
              <Button
                variant="contained"
                size="large"
                disabled={!methods.nowpayments}
                onClick={() => setMethod('nowpayments')}
              >
                NOWPayments (varias criptos)
              </Button>
              <Button
                variant="outlined"
                size="large"
                disabled={!methods.bch_direct}
                onClick={startBch}
              >
                Bitcoin Cash directo (BCH)
                {bchNetwork && bchNetwork !== 'mainnet' ? ` · ${bchNetwork}` : ''}
              </Button>
              {!methods.nowpayments && !methods.bch_direct && (
                <Alert severity="warning">
                  No hay métodos de pago configurados en el servidor.
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
        </DialogActions>
      </Dialog>

      <CryptoPaymentModal
        open={showNowpayments}
        onClose={onClose}
        onBackToMethods={() => setMethod(null)}
        anchorRequestId={anchorRequestId}
        title={title}
        priceUsd={priceUsd}
        productLabel="anclaje a Bitcoin"
        onPaymentComplete={(data) => {
          setPaidReview(true);
          onPaid?.(data);
        }}
      />

      <Dialog open={showBch} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          Pago con Bitcoin Cash
          {(bchOrder?.network || bchNetwork) && (bchOrder?.network || bchNetwork) !== 'mainnet'
            ? ` (${bchOrder?.network || bchNetwork})`
            : ''}
          <IconButton
            aria-label="Cerrar"
            onClick={onClose}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {bchError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {bchError}
            </Alert>
          )}
          {paidReview && (
            <Alert severity="success" sx={{ mb: 2 }}>
              ¡Pago recibido! Tu solicitud de anclaje a Bitcoin está en revisión.
            </Alert>
          )}
          {bchBusy && !bchOrder && (
            <Stack alignItems="center" spacing={1} sx={{ py: 3 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                Preparando orden BCH…
              </Typography>
            </Stack>
          )}
          {bchOrder && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Envía <strong>exactamente</strong> este monto a la dirección
                {(bchOrder.network || bchNetwork) && (bchOrder.network || bchNetwork) !== 'mainnet'
                  ? ` en ${bchOrder.network || bchNetwork}`
                  : ''}
                . La orden expira en unos minutos.
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Monto exacto
                </Typography>
                <Typography variant="h5" fontWeight={800}>
                  {bchOrder.expected_amount_bch} BCH
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({bchOrder.expected_amount_sats} sats) · ${bchOrder.usd_amount} USD
                </Typography>
              </Paper>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Dirección
                </Typography>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Typography
                    variant="body2"
                    sx={{ wordBreak: 'break-all', fontFamily: 'monospace', flex: 1 }}
                  >
                    {bchOrder.address}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label="Copiar dirección"
                    onClick={() => copyText(bchOrder.address, 'addr')}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Stack>
                {copied === 'addr' && (
                  <Typography variant="caption" color="success.main">
                    Copiado
                  </Typography>
                )}
              </Box>
              {bchOrder.seconds_remaining != null && bchOrder.status === 'pending' && (
                <Typography variant="caption" color="text.secondary">
                  Tiempo restante: {Math.floor(bchOrder.seconds_remaining / 60)}m{' '}
                  {bchOrder.seconds_remaining % 60}s
                </Typography>
              )}
              <Divider />
              <Typography variant="caption" color="text.secondary">
                Cuando hayas enviado el pago, pulsa verificar. No cierres esta ventana
                hasta confirmar.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexDirection: 'column', gap: 1 }}>
          {!paidReview && bchOrder?.status === 'pending' && (
            <Button
              variant="contained"
              fullWidth
              disabled={bchBusy}
              onClick={verifyBch}
              startIcon={bchBusy ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Ya realicé el pago
            </Button>
          )}
          {(paidReview || bchOrder?.status === 'expired') && (
            <Button
              variant="outlined"
              fullWidth
              disabled={bchBusy || paidReview}
              onClick={startBch}
            >
              Generar nueva orden BCH
            </Button>
          )}
          <Button onClick={onClose} fullWidth>
            {paidReview ? 'Listo' : 'Cerrar'}
          </Button>
          <Button
            size="small"
            onClick={() => {
              setMethod(null);
              setBchOrder(null);
              setBchError(null);
            }}
          >
            Volver a métodos de pago
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AnchorPaymentCheckout;
