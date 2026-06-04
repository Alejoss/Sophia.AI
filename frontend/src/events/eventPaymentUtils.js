export const normalizeCryptoCode = (code) => (code || '').toLowerCase().trim();

export const getOwnerAcceptedCryptos = (ownerAcceptedCryptos) =>
  (ownerAcceptedCryptos || []).filter((item) => !item.deleted && item.crypto);

export const DEFAULT_GATEWAY_CURRENCIES = ['bch', 'xmr'];

/** Currencies available at checkout via NOWPayments (student pays with these). */
export const getCheckoutCurrencyCodes = (gatewayCurrencies) => {
  const source = gatewayCurrencies?.length ? gatewayCurrencies : DEFAULT_GATEWAY_CURRENCIES;
  return [...new Set(source.map(normalizeCryptoCode).filter(Boolean))];
};

/** @deprecated Prefer getCheckoutCurrencyCodes for student checkout. Kept for host "Pago en línea" badges. */
export const getPayableCurrencyCodes = (
  ownerAcceptedCryptos,
  gatewayCurrencies,
  cryptoPaymentsEnabled,
) => {
  if (!cryptoPaymentsEnabled) return [];
  const accepted = getOwnerAcceptedCryptos(ownerAcceptedCryptos);
  const gatewaySet = new Set((gatewayCurrencies || []).map(normalizeCryptoCode));
  const codes = accepted
    .map((item) => normalizeCryptoCode(item.crypto.code))
    .filter((code) => gatewaySet.has(code));
  return [...new Set(codes)];
};

export const CURRENCY_LABELS = {
  bch: 'Bitcoin Cash',
  xmr: 'Monero',
  btc: 'Bitcoin',
  eth: 'Ethereum',
};

export const getCurrencyLabel = (code) => {
  const normalized = normalizeCryptoCode(code);
  return CURRENCY_LABELS[normalized] || (code || '').toUpperCase();
};
