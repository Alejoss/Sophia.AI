import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import {
  createRegistrationPayment,
  getPaymentStatus,
  listRegistrationPayments,
} from '../api/paymentsApi';

const STATUS_LABELS = {
  waiting: 'Esperando pago',
  confirming: 'Confirmando en la red',
  confirmed: 'Confirmado en la red',
  sending: 'Enviando a la wallet del comercio',
  partially_paid: 'Pago parcial',
  finished: 'Pago completado',
  failed: 'Pago fallido',
  refunded: 'Reembolsado',
  expired: 'Expirado',
};

const OPEN_PAYMENT_STATUSES = new Set([
  'waiting',
  'confirming',
  'confirmed',
  'sending',
  'partially_paid',
]);

const CURRENCY_LABELS = {
  bch: 'Bitcoin Cash (BCH)',
  xmr: 'Monero (XMR)',
};

const DEFAULT_CURRENCIES = ['bch', 'xmr'];

const formatApiError = (err, fallback) => {
  const msg = err?.error || err?.detail || err?.message;
  if (typeof msg === 'string') return msg;
  if (msg) return JSON.stringify(msg);
  return fallback;
};

const CryptoPaymentModal = ({
  open,
  onClose,
  registrationId,
  eventTitle,
  priceUsd,
  supportedCurrencies = DEFAULT_CURRENCIES,
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
  const [copied, setCopied] = useState(false);
  const [copiedExtra, setCopiedExtra] = useState(false);

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
      setCopied(false);
      setCopiedExtra(false);
      setResuming(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !registrationId) return undefined;

    let cancelled = false;
    const loadOpenPayment = async () => {
      try {
        setResuming(true);
        const payments = await listRegistrationPayments(registrationId);
        const openPayment = payments.find((p) => OPEN_PAYMENT_STATUSES.has(p.payment_status));
        if (cancelled || !openPayment) return;
        setPayCurrency(openPayment.pay_currency || currencies[0]);
        const data = await refreshPayment(openPayment.id);
        if (!cancelled) setPayment(data);
      } catch {
        // No open payment or list failed — user can create a new one
      } finally {
        if (!cancelled) setResuming(false);
      }
    };

    loadOpenPayment();
    return () => {
      cancelled = true;
    };
  }, [open, registrationId, refreshPayment, currencies]);

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
  const showPaymentStep = Boolean(payment);
  const busy = loading || resuming;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Pagar con criptomoneda</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {resuming && !payment && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Buscando un pago en curso...
          </Typography>
        )}
        {!showPaymentStep ? (
          <Stack spacing={1.2}>
            <Typography>
              Evento: <strong>{eventTitle}</strong> — ${priceUsd} USD
            </Typography>
            <Typography variant="body2">Elige la moneda con la que deseas pagar:</Typography>
            <RadioGroup
              name="payCurrency"
              value={payCurrency}
              onChange={(e) => setPayCurrency(e.target.value)}
            >
              {currencies.map((code) => (
                <FormControlLabel
                  key={code}
                  value={code}
                  control={<Radio />}
                  label={CURRENCY_LABELS[code] || code.toUpperCase()}
                />
              ))}
            </RadioGroup>
          </Stack>
        ) : (
          <Stack spacing={1.1}>
            <Typography variant="body2"><strong>Estado:</strong> {statusLabel}</Typography>
            <Typography variant="body2">
              <strong>Moneda:</strong> {payment.pay_currency_display}
            </Typography>
            <Typography variant="body2">
              <strong>Monto a enviar:</strong> {payment.pay_amount}{' '}
              {payment.pay_currency?.toUpperCase()}
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
              <strong>Dirección:</strong> {payment.pay_address}
            </Typography>
            <Button type="button" variant="outlined" onClick={() => copyText(payment.pay_address, setCopied)}>
              {copied ? 'Copiado' : 'Copiar dirección'}
            </Button>
            {payment.payin_extra_id && (
              <>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  <strong>Memo / Payment ID (obligatorio en XMR):</strong> {payment.payin_extra_id}
                </Typography>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => copyText(String(payment.payin_extra_id), setCopiedExtra)}
                >
                  {copiedExtra ? 'Copiado' : 'Copiar memo'}
                </Button>
              </>
            )}
            {payment.payment_status === 'partially_paid' && (
              <Alert severity="warning">
                El monto recibido es menor al requerido. Envía el resto a la misma dirección o crea un nuevo pago.
              </Alert>
            )}
            {payment.payment_status === 'expired' && (
              <Alert severity="warning">
                Este pago expiró (ventana de 24 h). Cierra y genera un nuevo pago.
              </Alert>
            )}
            {payment.payment_status === 'confirmed' && !payment.is_paid && (
              <Alert severity="info">
                Pago confirmado en la red. Esperando que NOWPayments finalice el proceso.
              </Alert>
            )}
            {payment.is_paid && (
              <Alert severity="success">Pago recibido. Gracias.</Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {!showPaymentStep ? (
          <>
            <Button type="button" onClick={onClose} disabled={busy}>
              Cerrar
            </Button>
            <Button
              type="button"
              variant="contained"
              onClick={handleCreatePayment}
              disabled={busy || !registrationId}
            >
              {busy ? 'Cargando...' : 'Continuar'}
            </Button>
          </>
        ) : (
          <Button type="button" onClick={onClose}>
            {payment.is_paid ? 'Cerrar' : 'Pagar después'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CryptoPaymentModal;
