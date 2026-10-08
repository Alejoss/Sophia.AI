import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Paper, Stack, Typography } from '@mui/material';
import { getCurrencyLabel, normalizeCryptoCode } from './eventPaymentUtils';

const PayableCurrencyPicker = ({
  currencies,
  selectedCurrency,
  onSelect,
  ownerAcceptedCryptos = [],
}) => {
  const { t } = useTranslation('events');
  if (!currencies.length) {
    return (
      <Alert severity="info">
        {t('currencyPicker.unavailable')}
      </Alert>
    );
  }

  return (
    <Stack spacing={1}>
      <Typography variant="body2" color="text.secondary">
        {t('currencyPicker.select')}
      </Typography>
      {currencies.map((code) => {
        const selected = selectedCurrency === code;
        const ownerCrypto = (ownerAcceptedCryptos || []).find(
          (item) => normalizeCryptoCode(item.crypto?.code) === normalizeCryptoCode(code),
        );
        const label = ownerCrypto?.crypto?.name
          ? `${ownerCrypto.crypto.name} (${code.toUpperCase()})`
          : getCurrencyLabel(code);
        return (
          <Paper
            key={code}
            variant="outlined"
            onClick={() => onSelect(code)}
            sx={{
              p: 1.5,
              cursor: 'pointer',
              borderColor: selected ? 'primary.main' : 'divider',
              borderWidth: selected ? 2 : 1,
              bgcolor: selected ? 'action.selected' : 'background.paper',
            }}
          >
            <Typography fontWeight={selected ? 700 : 500}>{label}</Typography>
          </Paper>
        );
      })}
      <Alert severity="info" variant="outlined">
        {t('currencyPicker.afterConfirm')}
      </Alert>
    </Stack>
  );
};

export default PayableCurrencyPicker;
