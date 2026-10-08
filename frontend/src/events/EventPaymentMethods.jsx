import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('events');
  const accepted = getOwnerAcceptedCryptos(ownerAcceptedCryptos);

  if (accepted.length === 0) {
    return (
      <Box sx={{ mt: compact ? 1 : 1.5 }}>
        {showTitle && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            {t('paymentMethods.title')}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          {t('paymentMethods.none')}
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
          {t('paymentMethods.preferred')}{' '}
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
        {t('paymentMethods.conversion')}
      </Typography>
    </Box>
  );
};

export default EventPaymentMethods;
