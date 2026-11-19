import { useEffect, useState } from 'react';
import pathFundingApi from '../api/pathFundingApi';

export const SATS_PER_BCH = 100_000_000;

export function formatUsdFromSats(sats, usdPerBch, language) {
  const rate = Number(usdPerBch);
  const amount = Number(sats);
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(amount) || amount < 0) return '';
  const usd = (amount / SATS_PER_BCH) * rate;
  if (!Number.isFinite(usd)) return '';
  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-ES', {
    style: 'currency',
    currency: 'USD',
  }).format(usd);
}

export function useBchUsdRate() {
  const [usdPerBch, setUsdPerBch] = useState(null);

  useEffect(() => {
    let active = true;
    pathFundingApi.getBchUsdRate()
      .then((rate) => {
        const value = Number(rate?.usd_per_bch);
        if (active && Number.isFinite(value) && value > 0) setUsdPerBch(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return usdPerBch;
}
