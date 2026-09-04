export const MONERO_CONTACT_USER_ID = 2;

export const MONERO_PAYMENT_DESCRIPTION =
  'Para pagar con Monero, envíame un mensaje y te compartiré mi dirección de billetera.';

export const buildMoneroPaymentMessage = ({
  title,
  priceUsd,
  productLabel = 'producto',
} = {}) => {
  const price = Number(priceUsd || 0).toFixed(2);
  const product = title ? `«${title}»` : productLabel;
  return `Hola, quiero pagar con Monero por ${product} ($${price} USD).`;
};
