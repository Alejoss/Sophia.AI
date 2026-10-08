import i18n from '../i18n';

export const MONERO_CONTACT_USER_ID = 2;

export const MONERO_PAYMENT_DESCRIPTION =
  'Para pagar con Monero, envíame un mensaje y te compartiré mi dirección de billetera.';

export const buildMoneroPaymentMessage = ({
  title,
  productLabel,
} = {}) => {
  const product = title || productLabel || i18n.t('payments:genericProduct');
  return i18n.t('payments:monero.message', { product });
};
