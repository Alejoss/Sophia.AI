import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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

const BENEFITS = [
  {
    icon: SavingsIcon,
    title: 'Pagas menos en contenidos de pago',
    body: 'Cuando el gasto esté activo, los tokens descuentan caminos, consultas de temas, eventos y anclajes a Bitcoin.',
  },
  {
    icon: SchoolIcon,
    title: 'Caminos de conocimiento',
    body: 'Desbloquea caminos de pago sin volver a pasar por una pasarela cada vez.',
  },
  {
    icon: ForumIcon,
    title: 'Consultas de temas',
    body: 'Usa el saldo para las consultas de un tema cuando el autor las cobre.',
  },
  {
    icon: EventIcon,
    title: 'Eventos',
    body: 'Cubre inscripciones de pago con el mismo saldo de la plataforma.',
  },
  {
    icon: VerifiedIcon,
    title: 'Anclaje de transcripciones',
    body: 'Paga solicitudes de certificación en Bitcoin con tokens, con descuento.',
  },
];

const TokenBuyPage = () => {
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
        if (!cancelled) setError(formatApiError(err, 'No se pudieron cargar los paquetes.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

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
      setError(formatApiError(err, 'No se pudo iniciar la compra.'));
    } finally {
      setBusyPackageId(null);
    }
  };

  const handlePaid = async () => {
    setCheckout(null);
    try {
      await load();
    } catch (err) {
      setError(formatApiError(err, 'El pago se acreditó, pero no se pudo actualizar el saldo.'));
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
        Volver a mi saldo
      </Button>

      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800}>
          Comprar tokens
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 720 }}>
          Los tokens son créditos de Academia Blockchain. No viven en una blockchain
          y no se pueden retirar. Sirven para pagar por caminos del conocimiento en la plataforma con descuento, para 
          generar consultas de LLM sobre los contenidos de los temas de Academia Blockchain y para 
          enviar hashes de contenido a la blockchain de Bitcoin.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Saldo actual: <strong>{balance} {balance === 1 ? 'token' : 'tokens'}</strong>
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Para qué sirven
        </Typography>
        <List disablePadding>
          {BENEFITS.map((item) => {
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
        Elige un paquete
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Pagas con Bitcoin Cash o NOWPayments. Monero no está disponible aquí porque no puede acreditar el saldo al instante.
      </Typography>

      {packages.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No hay paquetes disponibles por ahora.
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
                      {isBest && <Chip size="small" color="primary" label="Mejor valor" />}
                    </Stack>
                    <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>
                      {pkg.token_amount}
                      <Typography component="span" variant="body1" color="text.secondary">
                        {' '}tokens
                      </Typography>
                    </Typography>
                    {Number(pkg.bonus_tokens || 0) > 0 && (
                      <Typography variant="body2" color="success.main" fontWeight={600}>
                        +{pkg.bonus_tokens} de recompensa →{' '}
                        {pkg.total_tokens ?? (pkg.token_amount + pkg.bonus_tokens)} en total
                      </Typography>
                    )}
                    <Typography variant="h6" color="primary" sx={{ mt: 1 }}>
                      ${Number(pkg.usd_price).toFixed(2)} USD
                    </Typography>
                    {perToken != null && (
                      <Typography variant="caption" color="text.secondary">
                        {Number(pkg.bonus_tokens || 0) > 0
                          ? `Pagas ${pkg.token_amount} × $0.01; recibes ${pkg.total_tokens ?? (pkg.token_amount + pkg.bonus_tokens)}`
                          : `$${perToken.toFixed(2)} por token`}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      disabled={busyPackageId === pkg.id}
                      onClick={() => handleBuy(pkg)}
                      aria-label={`Comprar ${packageTitle(pkg)}`}
                    >
                      {busyPackageId === pkg.id ? 'Preparando…' : 'Comprar'}
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
