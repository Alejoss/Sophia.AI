import React, { useRef } from 'react';
import ProductPaymentCheckout from '../ProductPaymentCheckout';
import {
  createCoursePurchaseBchPayment,
  verifyCoursePurchaseBchPayment,
} from '../../api/paymentsApi';
import { PRODUCT_KINDS } from '../productCatalog';

/**
 * Fixed-price course checkout: NOWPayments, direct BCH, and Monero.
 */
const CourseCheckout = ({
  open,
  onClose,
  purchaseId,
  title,
  priceUsd,
  onPaid,
}) => {
  const lastPurchaseId = useRef(purchaseId);
  if (purchaseId != null) lastPurchaseId.current = purchaseId;
  const activePurchaseId = purchaseId ?? lastPurchaseId.current;

  return (
    <ProductPaymentCheckout
      open={open}
      onClose={onClose}
      title={title}
      priceUsd={priceUsd}
      productKind={PRODUCT_KINDS.COURSE}
      productFlags={{}}
      createBchPayment={
        activePurchaseId != null
          ? () => createCoursePurchaseBchPayment(activePurchaseId)
          : undefined
      }
      verifyBchPayment={
        activePurchaseId != null
          ? (txid) => verifyCoursePurchaseBchPayment(activePurchaseId, txid)
          : undefined
      }
      paymentTarget={
        activePurchaseId != null
          ? { kind: PRODUCT_KINDS.COURSE, purchaseId: activePurchaseId }
          : undefined
      }
      onPaid={onPaid}
    />
  );
};

export default CourseCheckout;
