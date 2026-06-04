import React from 'react';
import { Box, Typography } from '@mui/material';
import { getOwnerAcceptedCryptos } from './eventPaymentUtils';

const formatCryptoInline = (item) => {
  const { name, code } = item.crypto;
  return `${name} (${code})`;
};

const EventPaymentMethods = ({
  ownerAcceptedCryptos,
  compact = false,
  showTitle = true,
}) => {
  const accepted = getOwnerAcceptedCryptos(ownerAcceptedCryptos);

  if (accepted.length === 0) {
    return (
      <Box sx={{ mt: compact ? 1 : 1.5 }}>
        {showTitle && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Métodos de pago del anfitrión
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          El anfitrión aún no ha configurado criptomonedas en su perfil.
        </Typography>
      </Box>
    );
  }

  const cryptoListText = accepted.map(formatCryptoInline).join(', ');

  return (
    <Box sx={{ mt: compact ? 1 : 1.5 }}>
      {showTitle && (
        <Typography
          variant="body2"
          color="text.secondary"
          display="block"
          sx={{ mb: 1, lineHeight: 1.5, fontSize: compact ? '0.8rem' : '0.875rem' }}
        >
          Métodos de pago preferidos por el anfitrión:{' '}
          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {cryptoListText}
          </Box>
          .
        </Typography>
      )}
      <Typography
        variant="body2"
        color="text.secondary"
        display="block"
        sx={{ lineHeight: 1.5, fontSize: compact ? '0.8rem' : '0.875rem' }}
      >
        Si no tienes éstas no hay problema, la pasarela de pago cripto permite utilizar decenas de otras criptos;
        solamente se te cobrará un pequeño porcentaje extra (2%) por conversión.
      </Typography>
    </Box>
  );
};

export default EventPaymentMethods;
