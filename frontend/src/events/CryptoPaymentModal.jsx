import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Link,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import {
  createRegistrationPayment,
  getPaymentStatus,
} from '../api/paymentsApi';

const STATUS_LABELS = {
  waiting: 'Esperando pago',
  confirming: 'Confirmando en la red',
  confirmed: 'Confirmado',
  sending: 'Enviando a tu wallet',
  partially_paid: 'Pago parcial',
  finished: 'Pago completado',
  failed: 'Pago fallido',
  refunded: 'Reembolsado',
  expired: 'Expirado',
};

const CryptoPaymentModal = ({
  open,
  onClose,
  registrationId,
  eventTitle,
  priceUsd,
  onPaymentComplete,
}) => {
  const [payCurrency, setPayCurrency] = useState('bch');
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

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
    }
  }, [open]);

  useEffect(() => {
    if (!open || !payment?.id || payment.is_paid) return undefined;
    const interval = setInterval(() => {
      refreshPayment(payment.id).catch(() => {});
    }, 12000);
    return () => clearInterval(interval);
  }, [open, payment?.id, payment?.is_paid, refreshPayment]);

  const handleCreatePayment = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await createRegistrationPayment(registrationId, payCurrency);
      setPayment(data);
    } catch (err) {
      const msg = err?.error || err?.detail || 'No se pudo crear el pago';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = async () => {
    if (!payment?.pay_address) return;
    try {
      await navigator.clipboard.writeText(payment.pay_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar la dirección');
    }
  };

  const statusLabel = STATUS_LABELS[payment?.payment_status] || payment?.payment_status;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Pagar con criptomoneda</DialogTitle>
      <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
          {!payment ? (
            <Stack spacing={1.2}>
              <Typography>Evento: <strong>{eventTitle}</strong> — ${priceUsd} USD</Typography>
              <Typography variant="body2">Elige la moneda con la que deseas pagar:</Typography>
              <RadioGroup
                name="payCurrency"
                value={payCurrency}
                onChange={(e) => setPayCurrency(e.target.value)}
              >
                <FormControlLabel value="bch" control={<Radio />} label="Bitcoin Cash (BCH)" />
                <FormControlLabel value="xmr" control={<Radio />} label="Monero (XMR)" />
              </RadioGroup>
            </Stack>
          ) : (
            <Stack spacing={1.1}>
              <Typography variant="body2"><strong>Estado:</strong> {statusLabel}</Typography>
              <Typography variant="body2"><strong>Moneda:</strong> {payment.pay_currency_display}</Typography>
              <Typography variant="body2"><strong>Monto a enviar:</strong> {payment.pay_amount} {payment.pay_currency?.toUpperCase()}</Typography>
              <Typography variant="body2"><strong>Dirección:</strong> {payment.pay_address}</Typography>
              <Button type="button" variant="outlined" onClick={copyAddress}>
                {copied ? 'Copiado' : 'Copiar dirección'}
              </Button>
              {payment.invoice_url && (
                <Link href={payment.invoice_url} target="_blank" rel="noopener noreferrer">
                  Abrir factura NOWPayments
                </Link>
              )}
              {payment.is_paid && (
                <Alert severity="success">Pago recibido. Gracias.</Alert>
              )}
            </Stack>
          )}
      </DialogContent>
      <DialogActions>
          {!payment ? (
            <>
              <Button type="button" onClick={onClose} disabled={loading}>
                Cerrar
              </Button>
              <Button type="button" variant="contained" onClick={handleCreatePayment} disabled={loading}>
                {loading ? 'Generando pago...' : 'Continuar'}
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
