import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import {
  createRegistrationPayment,
  getPaymentStatus,
  listRegistrationPayments,
} from '../api/paymentsApi';
import EventPaymentMethods from './EventPaymentMethods';
import PayableCurrencyPicker from './PayableCurrencyPicker';

const STATUS_LABELS = {
  waiting: 'Esperando pago',
  confirming: 'Confirmando en la red',
  confirmed: 'Confirmado en la red',
  sending: 'Procesando',
  partially_paid: 'Pago parcial',
  finished: 'Pago completado',
  failed: 'Pago fallido',
  refunded: 'Reembolsado',
  expired: 'Expirado',
};

const STATUS_COLORS = {
  waiting: 'warning',
  confirming: 'info',
  confirmed: 'info',
  sending: 'info',
  partially_paid: 'warning',
  finished: 'success',
  failed: 'error',
  expired: 'default',
  refunded: 'default',
};

const OPEN_PAYMENT_STATUSES = new Set([
  'waiting',
  'confirming',
  'confirmed',
  'sending',
  'partially_paid',
]);

const DEFAULT_CURRENCIES = ['bch', 'xmr'];

const formatApiError = (err, fallback) => {
  const msg = err?.error || err?.detail || err?.message;
  if (typeof msg === 'string') return msg;
  if (msg) return JSON.stringify(msg);
  return fallback;
};

const CopyField = ({ label, value, onCopy, copied }) => (
  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default' }}>
    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
      {label}
    </Typography>
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="body2" sx={{ wordBreak: 'break-all', flex: 1, fontFamily: 'monospace' }}>
        {value}
      </Typography>
      <Tooltip title={copied ? 'Copiado' : 'Copiar'}>
        <IconButton size="small" onClick={onCopy} aria-label={`Copiar ${label}`}>
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  </Paper>
);

const CryptoPaymentModal = ({
  open,
  onClose,
  registrationId,
  eventTitle,
  priceUsd,
  supportedCurrencies = DEFAULT_CURRENCIES,
  ownerAcceptedCryptos = [],
  gatewayCurrencies = [],
  cryptoPaymentsEnabled = true,
  initialPayCurrency,
  autoCreatePayment = false,
  onPaymentComplete,
}) => {
  const currencies = useMemo(
    () => (supportedCurrencies.length ? supportedCurrencies : DEFAULT_CURRENCIES),
    [supportedCurrencies],
  );
  const [payCurrency, setPayCurrency] = useState(currencies[0] || 'bch');
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedExtra, setCopiedExtra] = useState(false);

  const activeStep = payment?.is_paid ? 2 : payment ? 1 : 0;

  const refreshPayment = useCallback(async (paymentId) => {
    const data = await getPaymentStatus(paymentId);
    setPayment(data);
    if (data.is_paid) {
      onPaymentComplete?.(data);
    }
    return data;
  }, [onPaymentComplete]);

  useEffect(() => {
    if (!open) {
      setPayment(null);
      setError(null);
      setCopiedAddress(false);
      setCopiedExtra(false);
      setResuming(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !initialPayCurrency) return;
    if (currencies.includes(initialPayCurrency)) {
      setPayCurrency(initialPayCurrency);
    }
  }, [open, initialPayCurrency, currencies]);

  useEffect(() => {
    if (!open || !registrationId) return undefined;

    let cancelled = false;
    const initCheckout = async () => {
      const selectedCurrency = (
        initialPayCurrency && currencies.includes(initialPayCurrency)
          ? initialPayCurrency
          : currencies[0] || 'bch'
      );

      try {
        setResuming(true);
        const payments = await listRegistrationPayments(registrationId);
        if (cancelled) return;

        const openPayment = payments.find((p) => OPEN_PAYMENT_STATUSES.has(p.payment_status));
        if (openPayment) {
          setPayCurrency(openPayment.pay_currency || currencies[0]);
          const data = await refreshPayment(openPayment.id);
          if (!cancelled) setPayment(data);
          return;
        }

        if (autoCreatePayment && selectedCurrency) {
          setPayCurrency(selectedCurrency);
          setLoading(true);
          setError(null);
          const data = await createRegistrationPayment(registrationId, selectedCurrency);
          if (!cancelled) setPayment(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err, 'No se pudo crear el pago'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setResuming(false);
        }
      }
    };

    initCheckout();
    return () => {
      cancelled = true;
    };
  }, [open, registrationId, autoCreatePayment, initialPayCurrency, refreshPayment, currencies]);

  useEffect(() => {
    if (!open || !payment?.id || payment.is_paid) return undefined;
    const interval = setInterval(() => {
      refreshPayment(payment.id).catch(() => {});
    }, 12000);
    return () => clearInterval(interval);
  }, [open, payment?.id, payment?.is_paid, refreshPayment]);

  useEffect(() => {
    if (currencies.includes(payCurrency)) return;
    setPayCurrency(currencies[0] || 'bch');
  }, [currencies, payCurrency]);

  const handleCreatePayment = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await createRegistrationPayment(registrationId, payCurrency);
      setPayment(data);
    } catch (err) {
      setError(formatApiError(err, 'No se pudo crear el pago'));
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (text, setCopiedFlag) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFlag(true);
      setTimeout(() => setCopiedFlag(false), 2000);
    } catch {
      setError('No se pudo copiar al portapapeles');
    }
  };

  const statusLabel = STATUS_LABELS[payment?.payment_status] || payment?.payment_status;
  const statusColor = STATUS_COLORS[payment?.payment_status] || 'default';
  const showPaymentStep = Boolean(payment);
  const busy = loading || resuming;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box
        sx={{
          px: 3,
          py: 2.5,
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'primary.contrastText',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CurrencyBitcoinIcon />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Pago del evento
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {eventTitle}
            </Typography>
          </Box>
        </Stack>
        <Typography variant="h4" fontWeight={800} sx={{ mt: 2 }}>
          ${priceUsd} <Typography component="span" variant="body1">USD</Typography>
        </Typography>
      </Box>

      <DialogContent sx={{ pt: 2.5 }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
          <Step><StepLabel>Moneda</StepLabel></Step>
          <Step><StepLabel>Enviar</StepLabel></Step>
          <Step><StepLabel>Confirmado</StepLabel></Step>
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {resuming && !payment && (
          <Stack alignItems="center" spacing={1} sx={{ py: 2 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              {autoCreatePayment ? 'Generando dirección de pago...' : 'Buscando un pago en curso...'}
            </Typography>
          </Stack>
        )}

        {!showPaymentStep && !resuming && (
          <Stack spacing={2}>
            <EventPaymentMethods
              ownerAcceptedCryptos={ownerAcceptedCryptos}
              gatewayCurrencies={gatewayCurrencies.length ? gatewayCurrencies : supportedCurrencies}
              cryptoPaymentsEnabled={cryptoPaymentsEnabled}
              compact
            />
            <PayableCurrencyPicker
              currencies={currencies}
              selectedCurrency={payCurrency}
              onSelect={setPayCurrency}
              ownerAcceptedCryptos={ownerAcceptedCryptos}
            />
          </Stack>
        )}

        {showPaymentStep && (
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" color="text.secondary">
                Estado del pago
              </Typography>
              <Chip label={statusLabel} color={statusColor} size="small" />
            </Stack>

            {!payment.is_paid && payment.payment_status === 'waiting' && (
              <LinearProgress />
            )}

            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'action.hover' }}>
              <Typography variant="caption" color="text.secondary">
                Monto exacto a enviar
              </Typography>
              <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
                {payment.pay_amount}{' '}
                <Typography component="span" variant="body1">
                  {payment.pay_currency?.toUpperCase()}
                </Typography>
              </Typography>
            </Paper>

            <CopyField
              label="Dirección de pago"
              value={payment.pay_address}
              copied={copiedAddress}
              onCopy={() => copyText(payment.pay_address, setCopiedAddress)}
            />

            {payment.payin_extra_id && (
              <CopyField
                label="Memo / Payment ID (obligatorio en XMR)"
                value={String(payment.payin_extra_id)}
                copied={copiedExtra}
                onCopy={() => copyText(String(payment.payin_extra_id), setCopiedExtra)}
              />
            )}

            {payment.payment_status === 'partially_paid' && (
              <Alert severity="warning">
                El monto recibido es insuficiente. Envía el resto a la misma dirección.
              </Alert>
            )}
            {payment.payment_status === 'expired' && (
              <Alert severity="warning">
                Este pago expiró. Cierra y genera uno nuevo.
              </Alert>
            )}
            {payment.payment_status === 'confirmed' && !payment.is_paid && (
              <Alert severity="info">
                Pago detectado en la red. Esperando confirmación final...
              </Alert>
            )}
            {payment.is_paid && (
              <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
                ¡Pago completado! Tu inscripción está confirmada.
              </Alert>
            )}

            <Divider />
            <Typography variant="caption" color="text.secondary">
              El estado se actualiza automáticamente cada pocos segundos tras enviar la transacción.
            </Typography>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {!showPaymentStep ? (
          <>
            <Button onClick={onClose} disabled={busy} color="inherit">
              Cerrar
            </Button>
            <Button variant="contained" onClick={handleCreatePayment} disabled={busy || !registrationId || currencies.length === 0}>
              {busy ? 'Cargando...' : 'Generar dirección de pago'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose} variant={payment.is_paid ? 'contained' : 'outlined'} fullWidth>
            {payment.is_paid ? 'Listo' : 'Pagar más tarde'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CryptoPaymentModal;
