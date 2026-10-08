import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
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
import { cancelTokenPurchase, listTokenPurchases } from '../api/paymentsApi';

const statusChipColor = (status) => {
  if (status === 'PAID') return 'success';
  if (status === 'CANCELLED') return 'default';
  if (status === 'REFUNDED') return 'info';
  return 'warning';
};

const ProfileTokens = ({ tokenBalance = 0, onBalanceChange }) => {
  const { t } = useTranslation('profiles');
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

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
        if (!cancelled) setError(formatApiError(err, t('tokens.loadError')));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load, t]);

  const handlePaid = async () => {
    setSuccess(t('tokens.paid'));
    setCheckout(null);
    try {
      await load();
      await onBalanceChange?.();
    } catch (err) {
      setError(formatApiError(err, t('tokens.balanceRefreshError')));
    }
  };

  const handleCancel = async (purchase) => {
    setCancellingId(purchase.id);
    setError(null);
    try {
      const updated = await cancelTokenPurchase(purchase.id);
      setPurchases((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      if (checkout?.purchaseId === purchase.id) setCheckout(null);
      setSuccess(t('tokens.cancelled'));
    } catch (err) {
      setError(formatApiError(err, t('tokens.cancelError')));
    } finally {
      setCancellingId(null);
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
          {t('tokens.overline')}
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TollIcon color="primary" />
          <Typography variant="h3" fontWeight={800} lineHeight={1}>
            {balance}
          </Typography>
          <Typography variant="h6" color="text.secondary">
            {t('tokenUnit', { count: balance })}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
          {t('tokens.description')}
        </Typography>
        <Box>
          <Button
            component={RouterLink}
            to="/acbc-tokens"
            variant="contained"
            startIcon={<TollIcon />}
          >
            {t('tokens.buy')}
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
          <Trans
            t={t}
            i18nKey="tokens.empty"
            components={{
              buy: (
                <Button
                  component={RouterLink}
                  to="/acbc-tokens"
                  size="small"
                  sx={{ verticalAlign: 'baseline', textTransform: 'none', p: 0, minWidth: 0 }}
                />
              ),
            }}
          />
        </Alert>
      )}

      {pending.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('tokens.pending')}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {t('tokens.activity')}
      </Typography>
      {purchases.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('tokens.noPurchases')}
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
                  {row.package_name || t('tokens.packageFallback', { amount: row.token_amount })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('tokens.line', { amount: row.total_tokens ?? row.token_amount })}
                  {Number(row.bonus_tokens || 0) > 0
                    ? t('tokens.bonus', { bonus: row.bonus_tokens })
                    : ''}
                  {t('tokens.price', { price: Number(row.usd_price).toFixed(2) })}
                </Typography>
              </Box>
              <Chip
                size="small"
                color={statusChipColor(row.payment_status)}
                label={purchaseStatusLabel(row.payment_status)}
              />
              {row.payment_status === 'PENDING' && (
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setCheckout(checkoutFromPurchase(row))}
                  >
                    {t('tokens.continuePayment')}
                  </Button>
                  <Button
                    size="small"
                    color="inherit"
                    disabled={cancellingId === row.id}
                    onClick={() => handleCancel(row)}
                  >
                    {cancellingId === row.id ? t('tokens.cancelling') : t('tokens.cancelOrder')}
                  </Button>
                </Stack>
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
