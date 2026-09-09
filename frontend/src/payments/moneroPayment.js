export const MONERO_CONTACT_USER_ID = 2;

export const MONERO_PAYMENT_DESCRIPTION =
  'Para pagar con Monero, envíame un mensaje y te compartiré mi dirección de billetera.';

export const buildMoneroPaymentMessage = ({
  title,
  productLabel = 'producto',
} = {}) => {
  const product = title || productLabel;
  return `Hola, quiero pagar con Monero «${product}», larga vida al criptoanarquismo!`;
};
