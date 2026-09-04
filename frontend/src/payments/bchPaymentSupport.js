import { MONERO_CONTACT_USER_ID } from './moneroPayment';

/** Same inbox as Monero checkout — platform operator (user id 2). */
export const PAYMENT_SUPPORT_USER_ID = MONERO_CONTACT_USER_ID;

export const buildBchVerifyHelpMessage = ({
  title,
  priceUsd,
  productLabel = 'producto',
  bchOrder,
  error,
} = {}) => {
  const price = Number(priceUsd ?? bchOrder?.usd_amount ?? 0).toFixed(2);
  const product = title ? `«${title}»` : productLabel;
  const amount = bchOrder?.expected_amount_bch
    ? `${bchOrder.expected_amount_bch} BCH (${bchOrder.expected_amount_sats} sats)`
    : 'monto de la orden';
  const address = bchOrder?.address || '(sin dirección)';
  const orderId = bchOrder?.id != null ? `Orden #${bchOrder.id}. ` : '';
  const errLine = error ? `Error al verificar: ${error}` : 'No pude verificar el pago automáticamente.';
  return (
    `Hola, ya pagué con Bitcoin Cash por ${product} ($${price} USD) pero la verificación falló. `
    + `${orderId}`
    + `Envié ${amount} a ${address}. `
    + `${errLine} ¿Puedes confirmar el pago y desbloquear el acceso?`
  );
};
