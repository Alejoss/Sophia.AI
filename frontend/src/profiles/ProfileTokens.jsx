import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import TollIcon from '@mui/icons-material/Toll';
import ProductPaymentCheckout from '../payments/ProductPaymentCheckout';
import {
  createTokenPurchase,
  createTokenPurchaseBchPayment,
  getTokenPackages,
  listTokenPurchases,
  verifyTokenPurchaseBchPayment,
} from '../api/paymentsApi';

const formatApiError = (err, fallback) => {
  const msg = err?.error || err?.detail || err?.message;
  if (typeof msg === 'string') return msg;
  if (msg) return JSON.stringify(msg);
  return fallback;
};

const statusLabel = (status) => {
  if (status === 'PAID') return 'Pagado';
  if (status === 'PENDING') return 'Pendiente';
  if (status === 'REFUNDED') return 'Reembolsado';
  return status;
};

const ProfileTokens = ({ tokenBalance = 0, onBalanceChange }) => {
  const [packages, setPackages] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busyPackageId, setBusyPackageId] = useState(null);
  const [checkout, setCheckout] = useState(null);

  const load = useCallback(async () => {
    const [packageRows, purchaseRows] = await Promise.all([
      getTokenPackages(),
      listTokenPurchases(),
    ]);
    setPackages(Array.isArray(packageRows) ? packageRows : []);
    setPurchases(Array.isArray(purchaseRows) ? purchaseRows : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(formatApiError(err, 'No se pudieron cargar los tokens.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const bestValueId = useMemo(() => {
    if (packages.length < 2) return null;
    const unitPrice = (pkg) => Number(pkg.usd_price) / Math.max(1, Number(pkg.token_amount));
    const best = packages.reduce((a, b) => (unitPrice(b) < unitPrice(a) ? b : a));
    const worst = packages.reduce((a, b) => (unitPrice(b) > unitPrice(a) ? b : a));
    // Flat $0.01/token catalog: no package is cheaper per token.
    if (unitPrice(best) >= unitPrice(worst) - 1e-9) return null;
    return best.id;
  }, [packages]);

  const openCheckout = (purchase, pkg) => {
    setCheckout({
      purchaseId: purchase.id,
      title: purchase.package_name || pkg?.name || `${purchase.token_amount} tokens`,
      priceUsd: Number(purchase.usd_price || pkg?.usd_price || 0),
      tokenAmount: purchase.token_amount,
    });
  };

  const handleBuy = async (pkg) => {
    const pending = purchases.find(
      (row) => row.package_id === pkg.id && row.payment_status === 'PENDING',
    );
    if (pending) {
      openCheckout(pending, pkg);
      return;
    }
    setBusyPackageId(pkg.id);
    setError(null);
    try {
      const purchase = await createTokenPurchase(pkg.id);
      setPurchases((prev) => [purchase, ...prev]);
      openCheckout(purchase, pkg);
    } catch (err) {
      setError(formatApiError(err, 'No se pudo iniciar la compra.'));
    } finally {
      setBusyPackageId(null);
    }
  };

  const handlePaid = async () => {
    setSuccess('Pago recibido. Los tokens ya están en tu saldo.');
    setCheckout(null);
    try {
      await load();
      await onBalanceChange?.();
    } catch (err) {
      setError(formatApiError(err, 'El pago se acreditó, pero no se pudo actualizar el saldo.'));
    }
  };

  const balance = Number(tokenBalance || 0);

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Box>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="overline" color="text.secondary">
          Tokens de la plataforma
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TollIcon color="primary" />
          <Typography variant="h3" fontWeight={800} lineHeight={1}>
            {balance}
          </Typography>
          <Typography variant="h6" color="text.secondary">
            {balance === 1 ? 'token' : 'tokens'}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
          Estos tokens existen solo en Academia Blockchain: no son una criptomoneda.
          1 token = $0.01 USD. Más adelante podrás usarlos para pagar contenidos con descuento.
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {balance === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Aún no tienes tokens. Elige un paquete y págalo con Bitcoin Cash o NOWPayments.
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Comprar tokens
      </Typography>
      {packages.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          No hay paquetes disponibles por ahora.
        </Typography>
      ) : (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {packages.map((pkg) => (
            <Grid item xs={12} sm={6} md={4} key={pkg.id}>
              <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="subtitle1" fontWeight={700}>
                      {pkg.name}
                    </Typography>
                    {pkg.id === bestValueId && packages.length > 1 && (
                      <Chip size="small" color="primary" label="Mejor valor" />
                    )}
                  </Stack>
                  <Typography variant="h4" fontWeight={800} sx={{ mt: 1 }}>
                    {pkg.token_amount}
                    <Typography component="span" variant="body1" color="text.secondary">
                      {' '}tokens
                    </Typography>
                  </Typography>
                  <Typography variant="h6" color="primary" sx={{ mt: 0.5 }}>
                    ${Number(pkg.usd_price).toFixed(2)} USD
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    $0.01 por token
                  </Typography>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    disabled={busyPackageId === pkg.id}
                    onClick={() => handleBuy(pkg)}
                  >
                    {busyPackageId === pkg.id ? 'Preparando…' : 'Comprar'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Compras recientes
      </Typography>
      {purchases.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Todavía no has comprado tokens.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {purchases.map((row) => (
            <Box
              key={row.id}
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: { xs: 'flex-start', sm: 'center' },
                flexDirection: { xs: 'column', sm: 'row' },
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  {row.package_name || `${row.token_amount} tokens`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {row.token_amount} tokens · ${Number(row.usd_price).toFixed(2)} USD
                </Typography>
              </Box>
              <Chip
                size="small"
                color={row.payment_status === 'PAID' ? 'success' : 'warning'}
                label={statusLabel(row.payment_status)}
              />
              {row.payment_status === 'PENDING' && (
                <Button size="small" variant="outlined" onClick={() => openCheckout(row)}>
                  Continuar pago
                </Button>
              )}
            </Box>
          ))}
        </Stack>
      )}

      <ProductPaymentCheckout
        open={Boolean(checkout)}
        onClose={() => setCheckout(null)}
        title={checkout?.title || 'Paquete de tokens'}
        priceUsd={checkout?.priceUsd || 0}
        productLabel="paquete de tokens"
        offerNowpayments
        offerBch
        offerMonero={false}
        createBchPayment={
          checkout
            ? () => createTokenPurchaseBchPayment(checkout.purchaseId)
            : undefined
        }
        verifyBchPayment={
          checkout
            ? (txid) => verifyTokenPurchaseBchPayment(checkout.purchaseId, txid)
            : undefined
        }
        nowpaymentsProps={{ tokenPurchaseId: checkout?.purchaseId }}
        onPaid={handlePaid}
      />
    </Box>
  );
};

export default ProfileTokens;
