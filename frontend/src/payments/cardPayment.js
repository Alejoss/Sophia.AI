import i18n from '../i18n';
import { MONERO_CONTACT_USER_ID } from './moneroPayment';

/** Same operator inbox as Monero checkout. */
export const CARD_CONTACT_USER_ID = MONERO_CONTACT_USER_ID;

export const buildCardPaymentMessage = ({
  title,
  productLabel,
  priceUsd,
} = {}) => {
  const product = title || productLabel || i18n.t('payments:genericProduct');
  const price = Number(priceUsd || 0).toFixed(2);
  return i18n.t('payments:card.message', { product, price });
};
