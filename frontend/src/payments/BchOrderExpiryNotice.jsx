import React, { useEffect, useState } from 'react';
import { Typography } from '@mui/material';
import {
  formatExpiryLocalTime,
  formatRemainingCountdown,
  secondsUntilExpiry,
} from './bchOrderExpiry';

/**
 * Live countdown for a pending BCH order.
 * Falls back to a static validity message if ``expires_at`` is missing.
 */
const BchOrderExpiryNotice = ({ bchOrder, ttlMinutes = 30 }) => {
  const expiresAt = bchOrder?.expires_at;
  const pending = bchOrder?.status === 'pending';
  const [remaining, setRemaining] = useState(() => secondsUntilExpiry(expiresAt));

  useEffect(() => {
    if (!pending || !expiresAt) {
      setRemaining(null);
      return undefined;
    }
    const tick = () => setRemaining(secondsUntilExpiry(expiresAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, pending]);

  if (!bchOrder || !pending) return null;

  if (expiresAt && remaining != null) {
    if (remaining <= 0) {
      return (
        <Typography variant="caption" color="warning.main">
          Esta orden expiró. Genera una nueva para obtener un monto actualizado.
        </Typography>
      );
    }
    return (
      <Typography variant="caption" color="text.secondary">
        Tiempo restante: {formatRemainingCountdown(remaining)}
        {' · '}
        válida hasta {formatExpiryLocalTime(expiresAt)}
      </Typography>
    );
  }

  return (
    <Typography variant="caption" color="text.secondary">
      Tienes {ttlMinutes} minutos para realizar el pago con el monto exacto de esta orden.
    </Typography>
  );
};

export default BchOrderExpiryNotice;
