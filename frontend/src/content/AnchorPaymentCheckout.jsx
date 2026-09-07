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
import MoneroPaymentModal from '../payments/MoneroPaymentModal';
import BchPaymentSupportModal from '../payments/BchPaymentSupportModal';

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
  const [bchError, setBchError] = useState('');
  const [copied, setCopied] = useState('');
  const [paidReview, setPaidReview] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setMethod(null);
      setBchOrder(null);
      setBchBusy(false);
      setBchError('');
      setCopied('');
      setPaidReview(false);
      setSupportOpen(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingMethods(true);
    getPaymentGatewayStatus()
      .then((data) => {
        if (cancelled) return;
        setMethods({
          nowpayments: Boolean(data?.nowpayments),
          bch_direct: Boolean(data?.bch_direct),
        });
        setBchNetwork(data?.bch_network || null);
      })
      .catch(() => {
        if (!cancelled) {
          setMethods({ nowpayments: false, bch_direct: false });
          setBchNetwork(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMethods(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || method !== 'bch' || !anchorRequestId || bchOrder || paidReview) return undefined;
    let cancelled = false;
    setBchBusy(true);
    setBchError('');
    createAnchorRequestBchPayment(anchorRequestId)
      .then((order) => {
        if (!cancelled) setBchOrder(order);
      })
      .catch((err) => {
        if (!cancelled) {
          setBchError(formatApiError(err, 'No se pudo crear la orden BCH.'));
        }
      })
      .finally(() => {
        if (!cancelled) setBchBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, method, anchorRequestId, bchOrder, paidReview]);

  const copyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(''), 1500);
    } catch {
      setCopied('');
    }
  };

  const handleVerify = async () => {
    if (!bchOrder?.id) return;
    setBchBusy(true);
    setBchError('');
    try {
      const result = await verifyAnchorRequestBchPayment(bchOrder.id);
      setBchOrder((prev) => (prev ? { ...prev, ...result } : result));
      if (result?.status === 'confirmed' || result?.paid) {
        setPaidReview(true);
        onPaid?.(result);
      } else {
        setBchError(
          'Aún no vemos el pago en la cadena. Si ya enviaste, espera unos segundos y vuelve a verificar.',
        );
      }
    } catch (err) {
      setBchError(formatApiError(err, 'No se pudo verificar el pago BCH.'));
    } finally {
      setBchBusy(false);
    }
  };

  const showChooser = open && !method;
  const showNowpayments = open && method === 'nowpayments';
  const showBch = open && method === 'bch';
  const showMonero = open && method === 'monero';
  const bothOff = !methods.nowpayments && !methods.bch_direct;

  return (
    <>
      <Dialog open={showChooser} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          Elegí cómo pagar
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
            Anclaje a Bitcoin · ${Number(priceUsd).toFixed(2)} USD
            {title ? ` · ${title}` : ''}
          </Typography>
          {loadingMethods ? (
            <Stack alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : bothOff ? (
            <Alert severity="warning">
              No hay métodos de pago crypto habilitados en este momento. Podés
              contactar soporte o intentar más tarde.
            </Alert>
          ) : (
            <Stack spacing={1.5}>
              {methods.nowpayments && (
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => setMethod('nowpayments')}
                  fullWidth
                >
                  Pagar con crypto (NOWPayments)
                </Button>
              )}
              {methods.bch_direct && (
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => setMethod('bch')}
                  fullWidth
                >
                  Bitcoin Cash (BCH)
                  {bchNetwork && bchNetwork !== 'mainnet' ? ` · ${bchNetwork}` : ''}
                </Button>
              )}
              <Divider sx={{ my: 0.5 }}>o</Divider>
              <Button
                variant="text"
                size="large"
                onClick={() => setMethod('monero')}
                fullWidth
              >
                Quiero pagar con Monero (XMR)
              </Button>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
        </DialogActions>
      </Dialog>

      <MoneroPaymentModal
        open={showMonero}
        onClose={onClose}
        onBackToMethods={() => setMethod(null)}
        title={title}
        priceUsd={priceUsd}
        productLabel="anclaje a Bitcoin"
      />

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
              <Typography variant="body2" component="div" sx={{ mb: paidReview ? 0 : 1 }}>
                {bchError}
              </Typography>
              {!paidReview && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Si ya enviaste el pago, mandanos el ID de la transacción (TXID).
                  Revisamos la cadena a mano y activamos tu compra.
                </Typography>
              )}
              {!paidReview && (
                <Button
                  size="small"
                  variant="contained"
                  color="inherit"
                  onClick={() => setSupportOpen(true)}
                >
                  Enviar TXID a soporte
                </Button>
              )}
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
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Button
            onClick={() => {
              setMethod(null);
              setBchOrder(null);
              setBchError('');
              setSupportOpen(false);
            }}
            disabled={bchBusy}
          >
            Cambiar método
          </Button>
          <Stack direction="row" spacing={1}>
            {!paidReview && bchOrder && (
              <Button
                variant="text"
                color="inherit"
                disabled={bchBusy}
                onClick={() => setSupportOpen(true)}
              >
                Ya pagué — enviar TXID
              </Button>
            )}
            <Button onClick={onClose}>Cerrar</Button>
            {!paidReview && (
              <Button
                variant="contained"
                onClick={handleVerify}
                disabled={bchBusy || !bchOrder}
                startIcon={bchBusy ? <CircularProgress size={16} color="inherit" /> : null}
              >
                Ya pagué — verificar
              </Button>
            )}
          </Stack>
        </DialogActions>
      </Dialog>

      <BchPaymentSupportModal
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        onBackToOrder={() => setSupportOpen(false)}
        productLabel="anclaje a Bitcoin"
        title={title}
        priceUsd={priceUsd}
        bchOrder={bchOrder}
        verifyError={bchError}
      />
    </>
  );
};

export default AnchorPaymentCheckout;
