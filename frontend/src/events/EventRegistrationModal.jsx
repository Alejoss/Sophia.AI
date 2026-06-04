import React from 'react';
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
            {isPaidEvent ? 'Inscripción y pago' : 'Confirmar inscripción'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Estás a punto de inscribirte en <strong>{event?.title}</strong>
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
              <Typography variant="body2" color="text.secondary">Anfitrión</Typography>
              <Typography variant="body2" fontWeight={600}>{event?.owner?.username}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Inicio</Typography>
              <Typography variant="body2" fontWeight={600}>{formatDate(event?.date_start)}</Typography>
            </Stack>
            <Divider />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">Precio</Typography>
              {isPaidEvent ? (
                <Typography variant="h6" color="primary.main" fontWeight={700}>
                  ${event.reference_price} USD
                </Typography>
              ) : (
                <Typography variant="body2" fontWeight={700} color="success.main">
                  Gratis
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
            Tras confirmar, podrás elegir con qué cripto pagar en la pasarela NOWPayments.
            Tu inscripción quedará pendiente hasta que se confirme el pago en la red.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onClose} disabled={loading} color="inherit">
          Volver
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          size="large"
        >
          {loading
            ? 'Procesando...'
            : isPaidEvent
              ? 'Inscribirme y pagar'
              : 'Confirmar inscripción'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EventRegistrationModal;
