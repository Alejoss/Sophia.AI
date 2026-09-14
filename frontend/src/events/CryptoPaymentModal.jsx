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
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PaymentsIcon from '@mui/icons-material/Payments';
import { getPaymentStatus } from '../api/paymentsApi';
import { resolveNowpaymentsHandlers } from '../payments/nowpaymentsTarget';
import { resolvePaymentTarget } from '../payments/productCatalog';

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

const MSG = {
  invoiceInfo:
    'En NOWPayments podrás elegir con qué criptomoneda pagar. '
    + 'La pasarela acepta decenas de criptos (con un pequeño cargo por conversión).',
  payAddress: 'Dirección de pago',
  expired: 'Este pago expiró. Cierra y vuelve a intentarlo.',
  confirming: 'Pago detectado en la red. Esperando confirmación final...',
  polling: 'El estado se actualiza automáticamente cuando completes el pago en NOWPayments.',
  initError: 'No se pudo iniciar el pago',
  copyError: 'No se pudo copiar al portapapeles',
  preparing: 'Preparando la pasarela de pago...',
};

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

/**
 * NOWPayments invoice UI.
 *
 * Prefer `paymentTarget={{ kind, purchaseId }}`. Legacy ID props remain as shims.
 */
const CryptoPaymentModal = ({
  open,
  onClose,
  paymentTarget,
  registrationId,
  pathPurchaseId,
  anchorRequestId,
  tokenPurchaseId,
  title,
  eventTitle,
  priceUsd,
  productLabel = 'evento',
  onPaymentComplete,
  onBackToMethods,
}) => {
  const [payment, setPayment] = useState(null);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedExtra, setCopiedExtra] = useState(false);
  const displayTitle = title || eventTitle;

  const resolvedTarget = resolvePaymentTarget({
    paymentTarget,
    tokenPurchaseId,
    anchorRequestId,
    pathPurchaseId,
    registrationId,
  });
  const entitlementId = resolvedTarget?.purchaseId;
  const targetKind = resolvedTarget?.kind;

  const handlers = useMemo(
    () => resolveNowpaymentsHandlers({
      paymentTarget: targetKind && entitlementId != null
        ? { kind: targetKind, purchaseId: entitlementId }
        : undefined,
    }),
    [targetKind, entitlementId],
  );

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
      setInitializing(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !entitlementId || !handlers.listPayments || !handlers.createPayment) {
      return undefined;
    }

    const listPayments = handlers.listPayments;
    const createPayment = handlers.createPayment;
    let cancelled = false;
    const initCheckout = async () => {
      try {
        setInitializing(true);
        setError(null);
        const payments = await listPayments(entitlementId);
        if (cancelled) return;

        const openPayment = payments.find((p) => OPEN_PAYMENT_STATUSES.has(p.payment_status));
        if (openPayment) {
          const data = await refreshPayment(openPayment.id);
          if (!cancelled) setPayment(data);
          return;
        }

        const data = await createPayment(entitlementId);
        if (!cancelled) setPayment(data);
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err, MSG.initError));
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    };

    initCheckout();
    return () => {
      cancelled = true;
    };
  }, [open, entitlementId, targetKind, refreshPayment, handlers.listPayments, handlers.createPayment]);

  useEffect(() => {
    if (!open || !payment?.id || payment.is_paid) return undefined;
    const interval = setInterval(() => {
      refreshPayment(payment.id).catch(() => {});
    }, 12000);
    return () => clearInterval(interval);
  }, [open, payment?.id, payment?.is_paid, refreshPayment]);

  const openInvoice = () => {
    if (!payment?.invoice_url) return;
    window.open(payment.invoice_url, '_blank', 'noopener,noreferrer');
  };

  const copyText = async (text, setCopiedFlag) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFlag(true);
      setTimeout(() => setCopiedFlag(false), 2000);
    } catch {
      setError(MSG.copyError);
    }
  };

  const statusLabel = STATUS_LABELS[payment?.payment_status] || payment?.payment_status;
  const statusColor = STATUS_COLORS[payment?.payment_status] || 'default';
  const busy = initializing;
  const hasInvoice = Boolean(payment?.invoice_url);
  const hasOnChainDetails = Boolean(payment?.pay_address);
  const headerTitle = handlers.headerTitle || `Pago del ${productLabel}`;
  const handleDismiss = () => {
    if (onBackToMethods && !payment?.is_paid) {
      onBackToMethods();
      return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleDismiss} maxWidth="sm" fullWidth>
      <Box
        sx={{
          px: 3,
          py: 2.5,
          position: 'relative',
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'primary.contrastText',
        }}
      >
        <IconButton
          onClick={handleDismiss}
          aria-label="Cerrar"
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: 'inherit',
            opacity: 0.85,
            '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.12)' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pr: 4 }}>
          <PaymentsIcon />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {headerTitle}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {displayTitle}
            </Typography>
          </Box>
        </Stack>
        <Typography variant="h4" fontWeight={800} sx={{ mt: 2 }}>
          ${priceUsd} <Typography component="span" variant="body1">USD</Typography>
        </Typography>
      </Box>

      <DialogContent sx={{ pt: 2.5 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {initializing && !payment && (
          <Stack alignItems="center" spacing={1} sx={{ py: 3 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              {MSG.preparing}
            </Typography>
          </Stack>
        )}

        {!initializing && payment && (
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

            {!payment.is_paid && hasInvoice && (
              <Alert severity="info" variant="outlined">
                {MSG.invoiceInfo}
              </Alert>
            )}

            {hasOnChainDetails && (
              <>
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
                  label={MSG.payAddress}
                  value={payment.pay_address}
                  copied={copiedAddress}
                  onCopy={() => copyText(payment.pay_address, setCopiedAddress)}
                />

                {payment.payin_extra_id && (
                  <CopyField
                    label="Memo / Payment ID"
                    value={String(payment.payin_extra_id)}
                    copied={copiedExtra}
                    onCopy={() => copyText(String(payment.payin_extra_id), setCopiedExtra)}
                  />
                )}
              </>
            )}

            {payment.payment_status === 'partially_paid' && (
              <Alert severity="warning">
                El monto recibido es insuficiente. Completa el pago en NOWPayments.
              </Alert>
            )}
            {payment.payment_status === 'expired' && (
              <Alert severity="warning">
                {MSG.expired}
              </Alert>
            )}
            {payment.payment_status === 'confirmed' && !payment.is_paid && (
              <Alert severity="info">
                {MSG.confirming}
              </Alert>
            )}
            {payment.is_paid && (
              <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
                {handlers.successMessage}
              </Alert>
            )}

            <Divider />
            <Typography variant="caption" color="text.secondary">
              {MSG.polling}
            </Typography>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, flexDirection: 'column', gap: 1 }}>
        {!payment?.is_paid && hasInvoice && (
          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<OpenInNewIcon />}
            onClick={openInvoice}
            disabled={busy}
          >
            Pagar en NOWPayments
          </Button>
        )}
        {payment?.is_paid && (
          <Button onClick={onClose} variant="contained" fullWidth>
            Listo
          </Button>
        )}
        {onBackToMethods && !payment?.is_paid && (
          <Button onClick={onBackToMethods} fullWidth>
            Elegir otro método
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CryptoPaymentModal;
