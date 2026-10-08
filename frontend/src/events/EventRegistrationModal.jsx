import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PaymentsIcon from '@mui/icons-material/Payments';
import EventPaymentMethods from './EventPaymentMethods';

const EventRegistrationModal = ({
  open,
  onClose,
  onConfirm,
  loading,
  event,
  formatDate,
  ownerAcceptedCryptos,
}) => {
  const { t } = useTranslation('events');
  const isPaidEvent = event?.reference_price > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent sx={{ pt: 3, pb: 1 }}>
        <Stack spacing={2.5} alignItems="center" sx={{ textAlign: 'center', mb: 1 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <EventAvailableIcon fontSize="large" />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {isPaidEvent ? t('registration.andPay') : t('registration.confirm')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <Trans
              t={t}
              i18nKey="registration.aboutTo"
              values={{ title: event?.title }}
              components={{ strong: <strong /> }}
            />
          </Typography>
        </Stack>

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            bgcolor: 'action.hover',
          }}
        >
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">{t('card.hostLabel')}</Typography>
              <Typography variant="body2" fontWeight={600}>{event?.owner?.username}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">{t('card.startLabel')}</Typography>
              <Typography variant="body2" fontWeight={600}>{formatDate(event?.date_start)}</Typography>
            </Stack>
            <Divider />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">{t('card.priceLabel')}</Typography>
              {isPaidEvent ? (
                <Typography variant="h6" color="primary.main" fontWeight={700}>
                  ${event.reference_price} USD
                </Typography>
              ) : (
                <Typography variant="body2" fontWeight={700} color="success.main">
                  {t('free')}
                </Typography>
              )}
            </Stack>
          </Stack>

          {isPaidEvent && (
            <EventPaymentMethods
              ownerAcceptedCryptos={ownerAcceptedCryptos}
              compact
            />
          )}
        </Box>

        {isPaidEvent && (
          <Alert severity="info" icon={<PaymentsIcon />} sx={{ mt: 2 }}>
            {t('registration.payHint')}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onClose} disabled={loading} color="inherit">
          {t('back')}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          size="large"
        >
          {loading
            ? t('processing')
            : isPaidEvent
              ? t('registration.registerAndPay')
              : t('registration.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EventRegistrationModal;
