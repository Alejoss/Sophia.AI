import { MONERO_CONTACT_USER_ID } from './moneroPayment';

/** Same inbox as Monero checkout — platform operator (user id 2). */
export const PAYMENT_SUPPORT_USER_ID = MONERO_CONTACT_USER_ID;

export const BCH_SUPPORT_DESCRIPTION =
  'Si ya enviaste el pago BCH y la verificación automática falló, '
  + 'cuéntanos el ID de la transacción. Revisaremos el pago manualmente '
  + 'y te desbloquearemos el acceso.';

export const normalizeBchTxid = (value = '') =>
  String(value).trim().replace(/^0x/i, '').toLowerCase();

export const isLikelyBchTxid = (value = '') =>
  /^[0-9a-f]{64}$/i.test(normalizeBchTxid(value));

export const buildBchVerifyHelpMessage = ({
  title,
  priceUsd,
  productLabel = 'producto',
  bchOrder,
  error,
  txid,
  note,
} = {}) => {
  const price = Number(priceUsd ?? bchOrder?.usd_amount ?? 0).toFixed(2);
  const product = title ? `«${title}»` : productLabel;
  const amount = bchOrder?.expected_amount_bch
    ? `${bchOrder.expected_amount_bch} BCH (${bchOrder.expected_amount_sats} sats)`
    : 'monto de la orden';
  const address = bchOrder?.address || '(sin dirección)';
  const orderId = bchOrder?.id != null ? `Orden #${bchOrder.id}. ` : '';
  const cleanTxid = normalizeBchTxid(txid);
  const errLine = error
    ? `Error al verificar: ${error}`
    : 'No pude verificar el pago automáticamente.';
  const noteLine = note?.trim() ? ` Nota: ${note.trim()}` : '';
  return (
    `Hola, ya pagué con Bitcoin Cash por ${product} ($${price} USD) pero la verificación falló. `
    + `${orderId}`
    + `Envié ${amount} a ${address}. `
    + `TXID: ${cleanTxid || '(pendiente)'}. `
    + `${errLine}${noteLine} ¿Puedes confirmar el pago y desbloquear el acceso?`
  );
};
