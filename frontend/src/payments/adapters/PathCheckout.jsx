import React, { useRef } from 'react';
import ProductPaymentCheckout from '../ProductPaymentCheckout';
import {
  createPathPurchaseBchPayment,
  verifyPathPurchaseBchPayment,
} from '../../api/paymentsApi';
import { PRODUCT_KINDS } from '../productCatalog';

/**
 * Knowledge-path checkout adapter.
 */
const PathCheckout = ({
  open,
  onClose,
  purchaseId,
  title,
  priceUsd,
  isForSale = false,
  bchDirectAvailable = false,
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
      productKind={PRODUCT_KINDS.PATH}
      productFlags={{
        isForSale: Boolean(isForSale),
        bchDirectAvailable: Boolean(bchDirectAvailable),
      }}
      createBchPayment={
        activePurchaseId != null
          ? () => createPathPurchaseBchPayment(activePurchaseId)
          : undefined
      }
      verifyBchPayment={
        activePurchaseId != null
          ? (txid) => verifyPathPurchaseBchPayment(activePurchaseId, txid)
          : undefined
      }
      paymentTarget={
        activePurchaseId != null
          ? { kind: PRODUCT_KINDS.PATH, purchaseId: activePurchaseId }
          : undefined
      }
      onPaid={onPaid}
    />
  );
};

export default PathCheckout;
