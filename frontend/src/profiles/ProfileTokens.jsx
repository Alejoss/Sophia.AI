import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import TollIcon from '@mui/icons-material/Toll';
import TokenCheckout from '../payments/TokenCheckout';
import {
  checkoutFromPurchase,
  formatApiError,
  purchaseStatusLabel,
} from '../payments/tokenPackages';
import { listTokenPurchases } from '../api/paymentsApi';

const ProfileTokens = ({ tokenBalance = 0, onBalanceChange }) => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [checkout, setCheckout] = useState(null);

  const load = useCallback(async () => {
    const purchaseRows = await listTokenPurchases();
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
  const pending = purchases.filter((row) => row.payment_status === 'PENDING');

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
          Créditos internos de Academia Blockchain. No son una criptomoneda.
          1 token = $0.01 USD. Sirven para pagar por caminos del conocimiento, 
          eventos, consultas en la plataforma y para anclar transcripciones a Bitcoin.
        </Typography>
        <Box>
          <Button
            component={RouterLink}
            to="/acbc-tokens"
            variant="contained"
            startIcon={<TollIcon />}
          >
            Comprar tokens
          </Button>
        </Box>
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

      {balance === 0 && pending.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Aún no tienes tokens.{' '}
          <Button
            component={RouterLink}
            to="/acbc-tokens"
            size="small"
            sx={{ verticalAlign: 'baseline', textTransform: 'none', p: 0, minWidth: 0 }}
          >
            Elige un paquete
          </Button>
          {' '}para empezar.
        </Alert>
      )}

      {pending.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Tienes un pago pendiente. Puedes continuarlo aquí o desde la página de compra.
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Actividad
      </Typography>
      {purchases.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Todavía no has comprado tokens. Aquí verás tus compras y el uso que le has dado a tus tokens.
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
                  {(row.total_tokens ?? row.token_amount)} tokens
                  {Number(row.bonus_tokens || 0) > 0 ? ` (incl. +${row.bonus_tokens} bonus)` : ''}
                  {' · '}${Number(row.usd_price).toFixed(2)} USD
                </Typography>
              </Box>
              <Chip
                size="small"
                color={row.payment_status === 'PAID' ? 'success' : 'warning'}
                label={purchaseStatusLabel(row.payment_status)}
              />
              {row.payment_status === 'PENDING' && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setCheckout(checkoutFromPurchase(row))}
                >
                  Continuar pago
                </Button>
              )}
            </Box>
          ))}
        </Stack>
      )}

      <TokenCheckout
        checkout={checkout}
        onClose={() => setCheckout(null)}
        onPaid={handlePaid}
      />
    </Box>
  );
};

export default ProfileTokens;
