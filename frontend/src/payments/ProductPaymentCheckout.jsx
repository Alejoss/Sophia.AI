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
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { getPaymentGatewayStatus } from '../api/paymentsApi';
import CryptoPaymentModal from '../events/CryptoPaymentModal';
import MoneroPaymentModal from './MoneroPaymentModal';
import BchPaymentSupportModal from './BchPaymentSupportModal';
import BchAddressQr from './BchAddressQr';
import BchOrderExpiryNotice from './BchOrderExpiryNotice';
import { isLikelyBchTxid, normalizeBchTxid } from './bchPaymentSupport';
import {
  getProductCatalogEntry,
  resolveAvailableMethods,
} from './productCatalog';

const formatApiError = (err, fallback) => {
  const msg = err?.error || err?.detail || err?.message;
  if (typeof msg === 'string') return msg;
  if (msg) return JSON.stringify(msg);
  return fallback;
};

/**
 * Unified checkout chooser for all paid products.
 *
 * Prefer `productKind` + `productFlags` so method availability comes from the
 * catalog + gateway. Explicit `offer*` props remain for tests / overrides.
 */
const ProductPaymentCheckout = ({
  open,
  onClose,
  title,
  priceUsd = 1,
  productKind,
  productFlags = {},
  productLabel: productLabelProp,
  chooserTitle: chooserTitleProp,
  paidSuccessMessage: paidSuccessMessageProp,
  offerNowpayments,
  offerBch,
  offerMonero,
  offerTokens = false,
  priceTokens = 100,
  tokenBalance = 0,
  payWithTokens,
  createBchPayment,
  verifyBchPayment,
  paymentTarget,
  nowpaymentsProps = {},
  onPaid,
}) => {
  const catalog = productKind ? getProductCatalogEntry(productKind) : null;
  const productLabel = productLabelProp || catalog?.productLabel || 'producto';
  const chooserTitle = chooserTitleProp || catalog?.chooserTitle || `Pagar ${productLabel}`;
  const paidSuccessMessage = paidSuccessMessageProp
    || catalog?.paidSuccessMessage
    || `¡Pago recibido! Ya puedes usar este ${productLabel}.`;
  const tokenPaidSuccessMessage = catalog?.tokenPaidSuccessMessage
    || paidSuccessMessage;

  const explicitOffers = offerNowpayments != null
    || offerBch != null
    || offerMonero != null
    || offerTokens
    || !productKind;

  const [methods, setMethods] = useState({
    nowpayments: Boolean(offerNowpayments),
    bch_direct: Boolean(offerBch),
    monero: offerMonero !== false,
    platform_tokens: Boolean(offerTokens),
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
  const [verifyTxid, setVerifyTxid] = useState('');
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [localTokenBalance, setLocalTokenBalance] = useState(tokenBalance);
  const [localPriceTokens, setLocalPriceTokens] = useState(priceTokens);

  useEffect(() => {
    setLocalTokenBalance(tokenBalance);
  }, [tokenBalance]);

  useEffect(() => {
    setLocalPriceTokens(priceTokens);
  }, [priceTokens]);

  useEffect(() => {
    if (!open) {
      setMethod(null);
      setBchOrder(null);
      setBchError(null);
      setSupportOpen(false);
      setPaid(false);
      setCopied('');
      setVerifyTxid('');
      setTokenBusy(false);
      setTokenError('');
      return undefined;
    }
    let cancelled = false;
    setLoadingMethods(true);
    getPaymentGatewayStatus()
      .then((data) => {
        if (cancelled) return;
        if (productKind && !explicitOffers) {
          const resolved = resolveAvailableMethods({
            kind: productKind,
            gatewayStatus: data,
            productFlags,
          });
          setMethods({
            nowpayments: resolved.nowpayments,
            bch_direct: resolved.bch_direct,
            monero: resolved.monero,
            platform_tokens: resolved.platform_tokens,
          });
          setBchNetwork(resolved.bch_network);
          return;
        }
        setMethods({
          nowpayments: (offerNowpayments !== false)
            && Boolean(data?.methods?.nowpayments ?? data?.enabled),
          bch_direct: Boolean(offerBch)
            && Boolean(data?.methods?.bch_direct ?? data?.bch_direct_enabled),
          monero: offerMonero !== false,
          platform_tokens: Boolean(offerTokens)
            && (data?.methods?.platform_tokens !== false),
        });
        setBchNetwork(data?.bch_network || null);
      })
      .catch(() => {
        if (cancelled) return;
        if (productKind && !explicitOffers) {
          const resolved = resolveAvailableMethods({
            kind: productKind,
            gatewayStatus: {},
            productFlags,
          });
          setMethods({
            nowpayments: false,
            bch_direct: false,
            monero: resolved.monero,
            platform_tokens: resolved.platform_tokens,
          });
          setBchNetwork(null);
          return;
        }
        setMethods({
          nowpayments: Boolean(offerNowpayments),
          bch_direct: Boolean(offerBch),
          monero: offerMonero !== false,
          platform_tokens: Boolean(offerTokens),
        });
        setBchNetwork(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingMethods(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    productKind,
    explicitOffers,
    offerNowpayments,
    offerBch,
    offerMonero,
    offerTokens,
    productFlags?.isForSale,
    productFlags?.bchDirectAvailable,
  ]);

  useEffect(() => {
    if (!open || loadingMethods || method !== null || paid || methods.monero) return;
    if (!methods.nowpayments && methods.bch_direct && !methods.platform_tokens) {
      startBch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional auto-start when only BCH
  }, [open, loadingMethods, methods, method, paid]);

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
      setBchError(formatApiError(err, 'No se pudo crear la orden BCH. Inténtalo de nuevo.'));
    } finally {
      setBchBusy(false);
    }
  };

  const verifyBch = async () => {
    if (!verifyBchPayment) return;
    const cleanTxid = normalizeBchTxid(verifyTxid);
    const txidForVerify = isLikelyBchTxid(cleanTxid) ? cleanTxid : undefined;
    if (verifyTxid.trim() && !txidForVerify) {
      setBchError('El TXID debe tener 64 caracteres hexadecimales.');
      return;
    }
    setBchBusy(true);
    setBchError(null);
    try {
      const data = await verifyBchPayment(txidForVerify);
      setBchOrder(data.payment || data);
      if (
        data.purchase?.is_paid
        || data.purchase?.payment_status === 'PAID'
        || data.payment?.status === 'paid'
        || data.status === 'paid'
      ) {
        setPaid(true);
        onPaid?.(data);
      }
    } catch (err) {
      setBchError(formatApiError(err, 'No se pudo verificar el pago. Inténtalo de nuevo.'));
    } finally {
      setBchBusy(false);
    }
  };

  const handlePayWithTokens = async () => {
    if (!payWithTokens || tokenBusy) return;
    setTokenBusy(true);
    setTokenError('');
    try {
      const result = await payWithTokens();
      if (result?.token_balance != null) {
        setLocalTokenBalance(Number(result.token_balance));
      }
      setPaid(true);
      onPaid?.(result);
    } catch (err) {
      setTokenError(formatApiError(err, 'No se pudo pagar con tokens. Inténtalo de nuevo.'));
    } finally {
      setTokenBusy(false);
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

  const canPayTokens = Number(localTokenBalance) >= Number(localPriceTokens);
  const showChooser = open && method === null && !paid;
  const showNowpayments = open && method === 'nowpayments';
  const showBch = open && method === 'bch' && !supportOpen;
  const showMonero = open && method === 'monero';
  const showTokens = open && method === 'tokens';
  const showSupport = open && method === 'bch' && supportOpen;
  const resolvedPaymentTarget = paymentTarget
    || (nowpaymentsProps.paymentTarget)
    || (nowpaymentsProps.tokenPurchaseId != null
      ? { kind: 'token_package', purchaseId: nowpaymentsProps.tokenPurchaseId }
      : null)
    || (nowpaymentsProps.anchorRequestId != null
      ? { kind: 'anchor', purchaseId: nowpaymentsProps.anchorRequestId }
      : null)
    || (nowpaymentsProps.pathPurchaseId != null
      ? { kind: 'path', purchaseId: nowpaymentsProps.pathPurchaseId }
      : null)
    || (nowpaymentsProps.registrationId != null
      ? { kind: 'event', purchaseId: nowpaymentsProps.registrationId }
      : null);

  const hasAnyMethod = methods.nowpayments
    || methods.bch_direct
    || methods.monero
    || methods.platform_tokens;

  const catalogAllowsNow = catalog
    ? catalog.methods.nowpayments !== false
    : offerNowpayments !== false;
  const catalogAllowsBch = catalog
    ? catalog.methods.bch !== false
    : Boolean(offerBch);
  const catalogAllowsTokens = catalog
    ? catalog.methods.platform_tokens !== false
    : Boolean(offerTokens);

  return (
    <>
      <Dialog open={showChooser} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          {chooserTitle}
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
              {catalogAllowsTokens && (
                <Button
                  variant="contained"
                  size="large"
                  disabled={!methods.platform_tokens || !canPayTokens}
                  onClick={() => setMethod('tokens')}
                >
                  Pagar con tokens ({localPriceTokens})
                  {' · '}
                  saldo {localTokenBalance}
                </Button>
              )}
              {catalogAllowsTokens && methods.platform_tokens && !canPayTokens && (
                <Typography variant="caption" color="text.secondary">
                  Necesitas {localPriceTokens} tokens (1 token = $0.01). Compra un paquete en Mis tokens.
                </Typography>
              )}
              {catalogAllowsNow && (
                <Button
                  variant={catalogAllowsTokens ? 'outlined' : 'contained'}
                  size="large"
                  disabled={!methods.nowpayments}
                  onClick={() => setMethod('nowpayments')}
                >
                  NOWPayments (varias criptos)
                </Button>
              )}
              {catalogAllowsBch && (
                <Button
                  variant="outlined"
                  size="large"
                  disabled={!methods.bch_direct}
                  onClick={startBch}
                >
                  Bitcoin Cash directo (BCH)
                  {bchNetwork && bchNetwork !== 'mainnet' ? ` · ${bchNetwork}` : ''}
                </Button>
              )}
              {methods.monero && (
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => setMethod('monero')}
                >
                  Pagar con Monero
                </Button>
              )}
              {!hasAnyMethod && (
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

      <Dialog open={showTokens} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          Pagar con tokens
          <IconButton
            aria-label="Cerrar"
            onClick={onClose}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {tokenError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {tokenError}
            </Alert>
          )}
          {paid ? (
            <Alert severity="success">
              {tokenPaidSuccessMessage}
            </Alert>
          ) : (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Se descontarán {localPriceTokens} tokens de tu saldo ({localTokenBalance}).
              </Typography>
              <Typography variant="body2">
                {productLabel} · ${Number(priceUsd || 0).toFixed(2)} USD
                {title ? ` · ${title}` : ''}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Button
            onClick={() => {
              setMethod(null);
              setTokenError('');
            }}
            disabled={tokenBusy}
          >
            Cambiar método
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={onClose}>Cerrar</Button>
            {!paid && (
              <Button
                variant="contained"
                onClick={handlePayWithTokens}
                disabled={tokenBusy || !canPayTokens}
                startIcon={tokenBusy ? <CircularProgress size={16} color="inherit" /> : null}
              >
                Confirmar pago
              </Button>
            )}
          </Stack>
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
        paymentTarget={resolvedPaymentTarget || nowpaymentsProps.paymentTarget}
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
                Si ya enviaste el pago, no te preocupes, primero vuelve a intentar
                clickeando en el botón &quot;Ya realicé el pago&quot; dentro de 5
                minutos, a veces la blockchain se demora en actualizarse. Si aún así
                no encontramos automáticamente tu transacción, envíanos el ID de la
                transacción y la revisaremos manualmente para desbloquear tu acceso.
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
              {paidSuccessMessage}
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
                Envía este monto a la dirección (usa el valor en sats si tu
                wallet redondea; toleramos hasta ~$0.20 de diferencia).
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
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ xs: 'center', sm: 'flex-start' }}
                  sx={{ mt: 0.5 }}
                >
                  <BchAddressQr address={bchOrder.address} />
                  <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
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
                </Stack>
              </Box>
              <BchOrderExpiryNotice bchOrder={bchOrder} />
              {bchError && (
                <TextField
                  label="ID de transacción (TXID) — solo si el auto-verify falló"
                  placeholder="Pega el TXID de 64 caracteres de tu wallet"
                  value={verifyTxid}
                  onChange={(e) => setVerifyTxid(e.target.value)}
                  fullWidth
                  size="small"
                  autoComplete="off"
                  helperText="Opcional: pégalo aquí para reintentar, o envíalo a soporte abajo."
                />
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
