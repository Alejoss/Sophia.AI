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
import { getPaymentGatewayStatus } from '../api/paymentsApi';
import CryptoPaymentModal from '../events/CryptoPaymentModal';
import MoneroPaymentModal from './MoneroPaymentModal';
import BchPaymentSupportModal from './BchPaymentSupportModal';

const formatApiError = (err, fallback) => {
  const msg = err?.error || err?.detail || err?.message;
  if (typeof msg === 'string') return msg;
  if (msg) return JSON.stringify(msg);
  return fallback;
};

/**
 * Checkout chooser: NOWPayments, self-custody BCH, or Monero via message.
 */
const ProductPaymentCheckout = ({
  open,
  onClose,
  title,
  priceUsd = 1,
  productLabel = 'producto',
  offerNowpayments = true,
  offerBch = false,
  offerMonero = true,
  createBchPayment,
  verifyBchPayment,
  nowpaymentsProps = {},
  onPaid,
}) => {
  const [methods, setMethods] = useState({
    nowpayments: offerNowpayments,
    bch_direct: offerBch,
  });
  const [bchNetwork, setBchNetwork] = useState(null);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [method, setMethod] = useState(null);
  const [bchOrder, setBchOrder] = useState(null);
  const [bchBusy, setBchBusy] = useState(false);
  const [bchError, setBchError] = useState(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!open) {
      setMethod(null);
      setBchOrder(null);
      setBchError(null);
      setSupportOpen(false);
      setPaid(false);
      setCopied('');
      return undefined;
    }
    let cancelled = false;
    setLoadingMethods(true);
    getPaymentGatewayStatus()
      .then((data) => {
        if (cancelled) return;
        setMethods({
          nowpayments: offerNowpayments && Boolean(data?.methods?.nowpayments ?? data?.enabled),
          bch_direct: offerBch && Boolean(data?.methods?.bch_direct ?? data?.bch_direct_enabled),
        });
        setBchNetwork(data?.bch_network || null);
      })
      .catch(() => {
        if (!cancelled) {
          setMethods({ nowpayments: offerNowpayments, bch_direct: offerBch });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMethods(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, offerNowpayments, offerBch]);

  useEffect(() => {
    if (!open || loadingMethods || method !== null || paid || offerMonero) return;
    if (!methods.nowpayments && methods.bch_direct) {
      startBch();
    }
  }, [open, loadingMethods, methods, method, paid, offerMonero]);

  const startBch = async () => {
    if (!createBchPayment) return;
    setMethod('bch');
    setSupportOpen(false);
    setBchBusy(true);
    setBchError(null);
    try {
      const order = await createBchPayment();
      setBchOrder(order);
    } catch (err) {
      setBchError(formatApiError(err, 'No se pudo crear la orden BCH'));
    } finally {
      setBchBusy(false);
    }
  };

  const verifyBch = async () => {
    if (!verifyBchPayment) return;
    setBchBusy(true);
    setBchError(null);
    try {
      const data = await verifyBchPayment();
      setBchOrder(data.payment);
      if (
        data.purchase?.is_paid
        || data.purchase?.payment_status === 'PAID'
        || data.payment?.status === 'paid'
      ) {
        setPaid(true);
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

  const showChooser = open && method === null && !paid;
  const showNowpayments = open && method === 'nowpayments';
  const showBch = open && method === 'bch' && !supportOpen;
  const showMonero = open && method === 'monero';
  const showSupport = open && method === 'bch' && supportOpen;

  return (
    <>
      <Dialog open={showChooser} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          Pagar {productLabel}
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
            ${Number(priceUsd || 0).toFixed(2)} USD
          </Typography>
          {loadingMethods ? (
            <Stack alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              {bchNetwork && bchNetwork !== 'mainnet' && methods.bch_direct && (
                <Typography variant="body2" color="text.secondary">
                  BCH directo usa la red de pruebas <strong>{bchNetwork}</strong>.
                </Typography>
              )}
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
              {offerMonero && (
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => setMethod('monero')}
                >
                  Pagar con Monero
                </Button>
              )}
              {!methods.nowpayments && !methods.bch_direct && !offerMonero && (
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

      <MoneroPaymentModal
        open={showMonero}
        onClose={onClose}
        onBackToMethods={() => setMethod(null)}
        title={title}
        priceUsd={priceUsd}
        productLabel={productLabel}
      />

      <CryptoPaymentModal
        open={showNowpayments}
        onClose={onClose}
        onBackToMethods={() => setMethod(null)}
        title={title}
        priceUsd={priceUsd}
        productLabel={productLabel}
        onPaymentComplete={(data) => {
          setPaid(true);
          onPaid?.(data);
        }}
        {...nowpaymentsProps}
      />

      <BchPaymentSupportModal
        open={showSupport}
        onClose={() => setSupportOpen(false)}
        onBackToOrder={() => setSupportOpen(false)}
        title={title}
        priceUsd={priceUsd}
        productLabel={productLabel}
        bchOrder={bchOrder}
        verifyError={bchError}
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
              <Typography variant="body2" sx={{ mt: 1 }}>
                Si ya enviaste el pago, no te preocupes: envíanos el ID de la
                transacción y lo revisamos manualmente para desbloquear tu acceso.
              </Typography>
              {!paid && (
                <Box sx={{ mt: 1.5 }}>
                  <Button
                    size="small"
                    variant="contained"
                    color="inherit"
                    onClick={() => setSupportOpen(true)}
                  >
                    Enviar TXID a soporte
                  </Button>
                </Box>
              )}
            </Alert>
          )}
          {paid && (
            <Alert severity="success" sx={{ mb: 2 }}>
              ¡Pago recibido! Ya puedes usar este {productLabel}.
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
                Envía <strong>exactamente</strong> este monto a la dirección.
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
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexDirection: 'column', gap: 1 }}>
          {!paid && bchOrder?.status === 'pending' && (
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
          {!paid && Boolean(bchOrder || bchError) && (
            <Button
              variant="outlined"
              fullWidth
              disabled={bchBusy}
              onClick={() => setSupportOpen(true)}
            >
              Ya pagué — enviar TXID a soporte
            </Button>
          )}
          {(paid || bchOrder?.status === 'expired') && (
            <Button
              variant="outlined"
              fullWidth
              disabled={bchBusy || paid}
              onClick={startBch}
            >
              Generar nueva orden BCH
            </Button>
          )}
          <Button onClick={onClose} fullWidth>
            {paid ? 'Listo' : 'Cerrar'}
          </Button>
          {!paid && (
            <Button
              size="small"
              onClick={() => {
                setMethod(null);
                setBchOrder(null);
                setBchError(null);
                setSupportOpen(false);
              }}
            >
              Volver a métodos de pago
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProductPaymentCheckout;
