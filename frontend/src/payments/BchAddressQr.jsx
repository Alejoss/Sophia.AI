import React from 'react';
import { Box, Typography } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { bchAddressQrValue } from './bchAddressQr';

/**
 * Address-only BCH QR (no payment amount in the payload).
 */
const BchAddressQr = ({ address, size = 160 }) => {
  const value = bchAddressQrValue(address);
  if (!value) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          p: 1,
          bgcolor: 'common.white',
          borderRadius: 1,
          lineHeight: 0,
        }}
        data-testid="bch-address-qr"
        data-qr-value={value}
      >
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          marginSize={1}
          bgColor="#ffffff"
          fgColor="#000000"
          title="Código QR de la dirección Bitcoin Cash"
        />
      </Box>
      <Typography variant="caption" color="text.secondary" textAlign="center">
        Escanea la dirección (sin monto)
      </Typography>
    </Box>
  );
};

export default BchAddressQr;
