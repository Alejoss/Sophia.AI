import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDateLocales } from '../hooks/useDateLocales';
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
  const { t } = useTranslation('payments');
  const { intl } = useDateLocales();
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
          {t('expiry.expired')}
        </Typography>
      );
    }
    return (
      <Typography variant="caption" color="text.secondary">
        {t('expiry.remaining', {
          countdown: formatRemainingCountdown(remaining),
          until: formatExpiryLocalTime(expiresAt, intl),
        })}
      </Typography>
    );
  }

  return (
    <Typography variant="caption" color="text.secondary">
      {t('expiry.fallback', { minutes: ttlMinutes })}
    </Typography>
  );
};

export default BchOrderExpiryNotice;
