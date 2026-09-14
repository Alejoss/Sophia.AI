/**
 * Single source of truth for buyer checkout product kinds and method rules.
 *
 * Method rules:
 * - false / true: fixed
 * - 'gateway': allowed when payment gateway reports the rail enabled
 * - 'for_sale': allowed when productFlags.isForSale
 * - 'for_sale_and_gateway': for_sale AND gateway
 * - 'bch_flag_and_gateway': productFlags.bchDirectAvailable AND gateway
 * - 'gateway_tokens': gateway.methods.platform_tokens !== false (default on)
 */

export const PRODUCT_KINDS = Object.freeze({
  PATH: 'path',
  TOPIC: 'topic',
  EVENT: 'event',
  ANCHOR: 'anchor',
  TOKEN_PACKAGE: 'token_package',
});

/** Kinds that can create NOWPayments invoices (no topic). */
export const NOWPAYMENTS_KINDS = Object.freeze([
  PRODUCT_KINDS.PATH,
  PRODUCT_KINDS.EVENT,
  PRODUCT_KINDS.ANCHOR,
  PRODUCT_KINDS.TOKEN_PACKAGE,
]);

export const PRODUCT_CATALOG = Object.freeze({
  [PRODUCT_KINDS.PATH]: Object.freeze({
    kind: PRODUCT_KINDS.PATH,
    productLabel: 'camino',
    chooserTitle: 'Pagar camino',
    paidSuccessMessage: null,
    methods: Object.freeze({
      nowpayments: 'for_sale_and_gateway',
      bch: 'bch_flag_and_gateway',
      monero: 'for_sale',
      platform_tokens: false,
    }),
  }),
  [PRODUCT_KINDS.TOPIC]: Object.freeze({
    kind: PRODUCT_KINDS.TOPIC,
    productLabel: 'consultas del tema',
    chooserTitle: 'Pagar consultas del tema',
    paidSuccessMessage: null,
    methods: Object.freeze({
      nowpayments: false,
      bch: 'bch_flag_and_gateway',
      monero: 'for_sale',
      platform_tokens: false,
    }),
  }),
  [PRODUCT_KINDS.EVENT]: Object.freeze({
    kind: PRODUCT_KINDS.EVENT,
    productLabel: 'evento',
    chooserTitle: 'Pagar evento',
    paidSuccessMessage: null,
    methods: Object.freeze({
      nowpayments: 'gateway',
      bch: false,
      monero: true,
      platform_tokens: false,
    }),
  }),
  [PRODUCT_KINDS.ANCHOR]: Object.freeze({
    kind: PRODUCT_KINDS.ANCHOR,
    productLabel: 'anclaje a Bitcoin',
    chooserTitle: 'Elige cómo pagar',
    paidSuccessMessage: '¡Pago recibido! Anclando el hash a Bitcoin…',
    tokenPaidSuccessMessage: '¡Pago con tokens recibido! Anclando el hash a Bitcoin…',
    methods: Object.freeze({
      nowpayments: 'gateway',
      bch: 'gateway',
      monero: true,
      platform_tokens: 'gateway_tokens',
    }),
  }),
  [PRODUCT_KINDS.TOKEN_PACKAGE]: Object.freeze({
    kind: PRODUCT_KINDS.TOKEN_PACKAGE,
    productLabel: 'paquete de tokens',
    chooserTitle: 'Pagar paquete de tokens',
    paidSuccessMessage: null,
    methods: Object.freeze({
      nowpayments: 'gateway',
      bch: 'gateway',
      monero: false,
      platform_tokens: false,
    }),
  }),
});

export const getProductCatalogEntry = (kind) => {
  const entry = PRODUCT_CATALOG[kind];
  if (!entry) {
    throw new Error(`Unknown payment product kind: ${kind}`);
  }
  return entry;
};

const gatewayNowpayments = (gatewayStatus) => Boolean(
  gatewayStatus?.methods?.nowpayments ?? gatewayStatus?.enabled ?? gatewayStatus?.nowpayments,
);

const gatewayBch = (gatewayStatus) => Boolean(
  gatewayStatus?.methods?.bch_direct
    ?? gatewayStatus?.bch_direct_enabled
    ?? gatewayStatus?.bch_direct,
);

const gatewayPlatformTokens = (gatewayStatus) => (
  gatewayStatus?.methods?.platform_tokens !== false
);

const evalRule = (rule, { gatewayStatus, productFlags }) => {
  if (rule === false) return false;
  if (rule === true) return true;
  const isForSale = Boolean(productFlags?.isForSale);
  const bchFlag = Boolean(productFlags?.bchDirectAvailable);
  switch (rule) {
    case 'gateway':
      return true; // gated with rail-specific gateway check by caller
    case 'for_sale':
      return isForSale;
    case 'for_sale_and_gateway':
      return isForSale;
    case 'bch_flag_and_gateway':
      return bchFlag;
    case 'gateway_tokens':
      return gatewayPlatformTokens(gatewayStatus);
    default:
      return Boolean(rule);
  }
};

/**
 * Resolve which checkout methods to show for a product.
 */
export const resolveAvailableMethods = ({
  kind,
  gatewayStatus = {},
  productFlags = {},
} = {}) => {
  const catalog = getProductCatalogEntry(kind);
  const ctx = { gatewayStatus, productFlags };

  const nowRule = catalog.methods.nowpayments;
  const bchRule = catalog.methods.bch;
  const moneroRule = catalog.methods.monero;
  const tokensRule = catalog.methods.platform_tokens;

  const nowBase = evalRule(nowRule, ctx);
  const bchBase = evalRule(bchRule, ctx);
  const monero = evalRule(moneroRule, ctx);
  const tokensBase = evalRule(tokensRule, ctx);

  const needsGwNow = nowRule === 'gateway' || nowRule === 'for_sale_and_gateway';
  const needsGwBch = bchRule === 'gateway' || bchRule === 'bch_flag_and_gateway';

  return {
    nowpayments: nowBase && (!needsGwNow || gatewayNowpayments(gatewayStatus)),
    bch_direct: bchBase && (!needsGwBch || gatewayBch(gatewayStatus)),
    monero,
    platform_tokens: tokensBase,
    bch_network: gatewayStatus?.bch_network || null,
  };
};

/**
 * Normalize NOWPayments entitlement into a single paymentTarget.
 * Legacy ID props remain supported for shims.
 */
export const resolvePaymentTarget = ({
  paymentTarget,
  tokenPurchaseId,
  anchorRequestId,
  pathPurchaseId,
  registrationId,
} = {}) => {
  if (paymentTarget?.kind && paymentTarget?.purchaseId != null) {
    return {
      kind: paymentTarget.kind,
      purchaseId: paymentTarget.purchaseId,
    };
  }
  if (tokenPurchaseId != null) {
    return { kind: PRODUCT_KINDS.TOKEN_PACKAGE, purchaseId: tokenPurchaseId };
  }
  if (anchorRequestId != null) {
    return { kind: PRODUCT_KINDS.ANCHOR, purchaseId: anchorRequestId };
  }
  if (pathPurchaseId != null) {
    return { kind: PRODUCT_KINDS.PATH, purchaseId: pathPurchaseId };
  }
  if (registrationId != null) {
    return { kind: PRODUCT_KINDS.EVENT, purchaseId: registrationId };
  }
  return null;
};

export const NOWPAYMENTS_SUCCESS_MESSAGES = Object.freeze({
  [PRODUCT_KINDS.EVENT]: '¡Pago completado! Tu inscripción está confirmada.',
  [PRODUCT_KINDS.PATH]: '¡Pago completado! El camino ya está desbloqueado.',
  [PRODUCT_KINDS.ANCHOR]:
    '¡Pago completado! Tu solicitud de anclaje a Bitcoin está en revisión.',
  [PRODUCT_KINDS.TOKEN_PACKAGE]: '¡Pago completado! Los tokens ya están en tu perfil.',
});

export const NOWPAYMENTS_HEADER_TITLES = Object.freeze({
  [PRODUCT_KINDS.EVENT]: null, // falls back to `Pago del ${productLabel}`
  [PRODUCT_KINDS.PATH]: 'Pago del camino',
  [PRODUCT_KINDS.ANCHOR]: 'Anclaje a Bitcoin',
  [PRODUCT_KINDS.TOKEN_PACKAGE]: null,
});
