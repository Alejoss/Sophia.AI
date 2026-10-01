import React, { useRef } from 'react';
import ProductPaymentCheckout from '../ProductPaymentCheckout';
import { PRODUCT_KINDS } from '../productCatalog';

/**
 * Fixed-price course checkout. Same rails as events: NOWPayments + Monero.
 * Direct BCH is intentionally off (no course BCH target); BCH is available
 * inside the NOWPayments hosted invoice among other cryptos.
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
