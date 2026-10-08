import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import SavingsIcon from '@mui/icons-material/Savings';
import SchoolIcon from '@mui/icons-material/School';
import ForumIcon from '@mui/icons-material/Forum';
import EventIcon from '@mui/icons-material/Event';
import VerifiedIcon from '@mui/icons-material/Verified';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TokenCheckout from '../payments/TokenCheckout';
import {
  bestValuePackageId,
  checkoutFromPurchase,
  formatApiError,
  packageTitle,
  usdPerToken,
} from '../payments/tokenPackages';
import { createTokenPurchase, getTokenPackages, listTokenPurchases } from '../api/paymentsApi';
import { getUserProfile } from '../api/profilesApi';

const TokenBuyPage = () => {
  const { t } = useTranslation('profiles');
  const benefits = useMemo(
    () => [
      {
        icon: SavingsIcon,
        title: t('buy.payLessTitle'),
        body: t('buy.payLessBody'),
      },
      {
        icon: SchoolIcon,
        title: t('buy.pathsTitle'),
        body: t('buy.pathsBody'),
      },
      {
        icon: ForumIcon,
        title: t('buy.topicsTitle'),
        body: t('buy.topicsBody'),
      },
      {
        icon: EventIcon,
        title: t('buy.eventsTitle'),
        body: t('buy.eventsBody'),
      },
      {
        icon: VerifiedIcon,
        title: t('buy.anchorTitle'),
        body: t('buy.anchorBody'),
      },
    ],
    [t],
  );
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyPackageId, setBusyPackageId] = useState(null);
  const [checkout, setCheckout] = useState(null);

  const load = useCallback(async () => {
    const [packageRows, purchaseRows, profile] = await Promise.all([
      getTokenPackages(),
      listTokenPurchases(),
      getUserProfile(),
    ]);
    setPackages(Array.isArray(packageRows) ? packageRows : []);
    setPurchases(Array.isArray(purchaseRows) ? purchaseRows : []);
    setBalance(Number(profile?.token_balance || 0));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(formatApiError(err, t('buy.loadError')));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load, t]);

  const bestValueId = useMemo(() => bestValuePackageId(packages), [packages]);

  const openCheckout = (purchase, pkg) => {
    setCheckout(checkoutFromPurchase(purchase, pkg));
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
      setError(formatApiError(err, t('buy.startError')));
    } finally {
      setBusyPackageId(null);
    }
  };

  const handlePaid = async () => {
    setCheckout(null);
    try {
      await load();
    } catch (err) {
      setError(formatApiError(err, t('buy.balanceRefreshError')));
      return;
    }
    navigate('/profiles/my_profile?section=tokens');
  };

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Button
        component={RouterLink}
        to="/profiles/my_profile?section=tokens"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2, textTransform: 'none' }}
      >
        {t('buy.back')}
      </Button>

      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800}>
          {t('buy.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 720 }}>
          {t('buy.intro')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('buy.balance')} <strong>{balance} {t('tokenUnit', { count: balance })}</strong>
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t('buy.usesTitle')}
        </Typography>
        <List disablePadding>
          {benefits.map((item) => {
            const Icon = item.icon;
            return (
              <ListItem key={item.title} alignItems="flex-start" sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
                  <Icon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  secondary={item.body}
                  primaryTypographyProps={{ fontWeight: 600 }}
                />
              </ListItem>
            );
          })}
        </List>
      </Paper>

      <Typography variant="h6" sx={{ mb: 0.5 }}>
        {t('buy.choose')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('buy.payMethods')}
      </Typography>

      {packages.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('buy.none')}
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {packages.map((pkg) => {
            const perToken = usdPerToken(pkg);
            const isBest = pkg.id === bestValueId && packages.length > 1;
            return (
              <Grid item xs={12} sm={6} md={4} key={pkg.id}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderColor: isBest ? 'primary.main' : 'divider',
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack direction="row" justifyContent="flex-end" sx={{ minHeight: 28 }}>
                      {isBest && <Chip size="small" color="primary" label={t('buy.bestValue')} />}
                    </Stack>
                    <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>
                      {pkg.token_amount}
                      <Typography component="span" variant="body1" color="text.secondary">
                        {' '}{t('buy.tokensWord')}
                      </Typography>
                    </Typography>
                    {Number(pkg.bonus_tokens || 0) > 0 && (
                      <Typography variant="body2" color="success.main" fontWeight={600}>
                        {t('buy.reward', {
                          bonus: pkg.bonus_tokens,
                          total: pkg.total_tokens ?? (pkg.token_amount + pkg.bonus_tokens),
                        })}
                      </Typography>
                    )}
                    <Typography variant="h6" color="primary" sx={{ mt: 1 }}>
                      ${Number(pkg.usd_price).toFixed(2)} USD
                    </Typography>
                    {perToken != null && (
                      <Typography variant="caption" color="text.secondary">
                        {Number(pkg.bonus_tokens || 0) > 0
                          ? t('buy.payLine', {
                              amount: pkg.token_amount,
                              total: pkg.total_tokens ?? (pkg.token_amount + pkg.bonus_tokens),
                            })
                          : t('buy.perToken', { price: perToken.toFixed(2) })}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      disabled={busyPackageId === pkg.id}
                      onClick={() => handleBuy(pkg)}
                      aria-label={t('buy.buyAria', { title: packageTitle(pkg) })}
                    >
                      {busyPackageId === pkg.id ? t('buy.preparing') : t('buy.buy')}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <TokenCheckout
        checkout={checkout}
        onClose={() => setCheckout(null)}
        onPaid={handlePaid}
      />
    </Container>
  );
};

export default TokenBuyPage;
