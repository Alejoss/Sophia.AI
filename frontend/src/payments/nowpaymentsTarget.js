import {
  createAnchorRequestPayment,
  createTranscriptGenerationPayment,
  createPathPurchasePayment,
  createCoursePurchasePayment,
  createRegistrationPayment,
  createTokenPurchasePayment,
  listAnchorRequestPayments,
  listTranscriptGenerationPayments,
  listPathPurchasePayments,
  listCoursePurchasePayments,
  listRegistrationPayments,
  listTokenPurchasePayments,
} from '../api/paymentsApi';
import {
  NOWPAYMENTS_HEADER_TITLES,
  NOWPAYMENTS_SUCCESS_MESSAGES,
  PRODUCT_KINDS,
  resolvePaymentTarget,
} from './productCatalog';

const NOWPAYMENTS_API_BY_KIND = {
  [PRODUCT_KINDS.TOKEN_PACKAGE]: {
    list: listTokenPurchasePayments,
    create: createTokenPurchasePayment,
  },
  [PRODUCT_KINDS.ANCHOR]: {
    list: listAnchorRequestPayments,
    create: createAnchorRequestPayment,
  },
  [PRODUCT_KINDS.TRANSCRIPT_GENERATION]: {
    list: listTranscriptGenerationPayments,
    create: createTranscriptGenerationPayment,
  },
  [PRODUCT_KINDS.PATH]: {
    list: listPathPurchasePayments,
    create: createPathPurchasePayment,
  },
  [PRODUCT_KINDS.EVENT]: {
    list: listRegistrationPayments,
    create: createRegistrationPayment,
  },
  [PRODUCT_KINDS.COURSE]: {
    list: listCoursePurchasePayments,
    create: createCoursePurchasePayment,
  },
};

/**
 * Resolve list/create API + copy for a NOWPayments checkout target.
 */
export const resolveNowpaymentsHandlers = (props) => {
  const target = resolvePaymentTarget(props);
  if (!target) {
    return {
      target: null,
      listPayments: null,
      createPayment: null,
      successMessage: NOWPAYMENTS_SUCCESS_MESSAGES[PRODUCT_KINDS.EVENT],
      headerTitle: null,
    };
  }
  const api = NOWPAYMENTS_API_BY_KIND[target.kind];
  if (!api) {
    throw new Error(`NOWPayments is not supported for kind: ${target.kind}`);
  }
  return {
    target,
    listPayments: api.list,
    createPayment: api.create,
    successMessage:
      NOWPAYMENTS_SUCCESS_MESSAGES[target.kind]
      || NOWPAYMENTS_SUCCESS_MESSAGES[PRODUCT_KINDS.EVENT],
    headerTitle: NOWPAYMENTS_HEADER_TITLES[target.kind] || null,
  };
};
