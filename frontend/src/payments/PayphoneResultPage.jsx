import React, { useMemo } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

const STATUS_COPY = {
  approved: {
    severity: 'success',
    title: 'Pago aprobado',
    body: 'Payphone confirmó tu pago. Ya puedes usar el producto que compraste.',
  },
  cancelled: {
    severity: 'info',
    title: 'Pago cancelado',
    body: 'No se realizó ningún cobro. Puedes volver e intentar de nuevo cuando quieras.',
  },
  canceled: {
    severity: 'info',
    title: 'Pago cancelado',
    body: 'No se realizó ningún cobro. Puedes volver e intentar de nuevo cuando quieras.',
  },
  failed: {
    severity: 'error',
    title: 'No se pudo confirmar el pago',
    body: 'Si te cobraron, no vuelvas a pagar: contacta soporte con el comprobante.',
  },
  expired: {
    severity: 'warning',
    title: 'El formulario de pago expiró',
    body: 'Vuelve al producto e inicia un nuevo pago con tarjeta.',
  },
};

/**
 * Landing page after Payphone Botón de pago redirect (success / cancel / failure).
 */
const PayphoneResultPage = () => {
  const [params] = useSearchParams();
  const status = (params.get('status') || 'failed').toLowerCase();
  const message = params.get('message') || '';
  const nextPath = params.get('next') || '/';
  const copy = STATUS_COPY[status] || STATUS_COPY.failed;

  const safeNext = useMemo(() => {
    if (typeof nextPath !== 'string' || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
      return '/';
    }
    return nextPath;
  }, [nextPath]);

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={2}>
          <Typography variant="h4" component="h1">
            {copy.title}
          </Typography>
          <Alert severity={copy.severity}>{copy.body}</Alert>
          {message ? (
            <Typography variant="body2" color="text.secondary">
              {message}
            </Typography>
          ) : null}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button component={RouterLink} to={safeNext} variant="contained">
              Continuar
            </Button>
            <Button component={RouterLink} to="/" variant="outlined">
              Ir al inicio
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
};

export default PayphoneResultPage;
