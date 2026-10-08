import i18n from '../i18n';
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
  productLabel,
  bchOrder,
  error,
  txid,
  note,
} = {}) => {
  const price = Number(priceUsd ?? bchOrder?.usd_amount ?? 0).toFixed(2);
  const product = title ? `«${title}»` : (productLabel || i18n.t('payments:genericProduct'));
  const amount = bchOrder?.expected_amount_bch
    ? `${bchOrder.expected_amount_bch} BCH (${bchOrder.expected_amount_sats} sats)`
    : i18n.t('payments:bchSupport.orderAmount');
  const address = bchOrder?.address || i18n.t('payments:bchSupport.noAddress');
  const orderId = bchOrder?.id != null
    ? i18n.t('payments:bchSupport.orderRef', { id: bchOrder.id })
    : '';
  const cleanTxid = normalizeBchTxid(txid);
  const errLine = error
    ? i18n.t('payments:bchSupport.verifyErrorLine', { error })
    : i18n.t('payments:bchSupport.autoVerifyFailed');
  const noteLine = note?.trim()
    ? i18n.t('payments:bchSupport.noteLine', { note: note.trim() })
    : '';
  return i18n.t('payments:bchSupport.verifyMessage', {
    product,
    price,
    orderId,
    amount,
    address,
    txid: cleanTxid || i18n.t('payments:bchSupport.pendingTxid'),
    errLine,
    noteLine,
  });
};

export const ANCHOR_FULFILL_DEFERRED_DESCRIPTION =
  'Tu pago se confirmó, pero el anclaje a Bitcoin no se emitió automáticamente. '
  + 'No vuelvas a pagar. Contáctanos y lo completamos manualmente.';

export const buildAnchorFulfillDeferredHelpMessage = ({
  title,
  priceUsd,
  productLabel,
  bchOrder,
  reviewNote,
  requestId,
  note,
  paymentMethod,
} = {}) => {
  const price = Number(priceUsd ?? bchOrder?.usd_amount ?? 0).toFixed(2);
  const product = title ? `«${title}»` : (productLabel || i18n.t('payments:catalog.anchor.productLabel'));
  const orderId = bchOrder?.id != null
    ? i18n.t('payments:bchSupport.anchorOrderRef', { id: bchOrder.id })
    : '';
  const reqId = requestId != null
    ? i18n.t('payments:bchSupport.anchorRequestRef', { id: requestId })
    : '';
  const method = paymentMethod
    ? i18n.t('payments:bchSupport.methodLine', { method: paymentMethod })
    : '';
  const review = reviewNote?.trim()
    ? i18n.t('payments:bchSupport.reviewLine', { note: reviewNote.trim() })
    : '';
  const noteLine = note?.trim()
    ? i18n.t('payments:bchSupport.noteLine', { note: note.trim() })
    : '';
  const txid = bchOrder?.payment_txid || bchOrder?.txid || '';
  const txLine = txid
    ? i18n.t('payments:bchSupport.txLine', { txid: normalizeBchTxid(txid) })
    : '';
  return i18n.t('payments:bchSupport.anchorMessage', {
    product,
    price,
    reqId,
    orderId,
    method,
    txLine,
    review,
    noteLine,
  });
};

