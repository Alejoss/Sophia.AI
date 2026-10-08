import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

const STATUS_SEVERITY = {
  approved: 'success',
  cancelled: 'info',
  canceled: 'info',
  failed: 'error',
  expired: 'warning',
};

const STATUS_KEY = {
  approved: 'approved',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  failed: 'failed',
  expired: 'expired',
};

/**
 * Landing page after Payphone Botón de pago redirect (success / cancel / failure).
 */
const PayphoneResultPage = () => {
  const { t } = useTranslation('payments');
  const [params] = useSearchParams();
  const status = (params.get('status') || 'failed').toLowerCase();
  const message = params.get('message') || '';
  const nextPath = params.get('next') || '/';
  const copyKey = STATUS_KEY[status] || 'failed';
  const severity = STATUS_SEVERITY[status] || STATUS_SEVERITY.failed;

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
            {t(`payphone.${copyKey}Title`)}
          </Typography>
          <Alert severity={severity}>{t(`payphone.${copyKey}Body`)}</Alert>
          {message ? (
            <Typography variant="body2" color="text.secondary">
              {message}
            </Typography>
          ) : null}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button component={RouterLink} to={safeNext} variant="contained">
              {t('payphone.continue')}
            </Button>
            <Button component={RouterLink} to="/" variant="outlined">
              {t('payphone.home')}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
};

export default PayphoneResultPage;
