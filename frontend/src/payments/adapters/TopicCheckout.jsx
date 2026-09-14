import React, { useRef } from 'react';
import ProductPaymentCheckout from '../ProductPaymentCheckout';
import {
  createTopicPurchaseBchPayment,
  verifyTopicPurchaseBchPayment,
} from '../../api/paymentsApi';
import { PRODUCT_KINDS } from '../productCatalog';

/**
 * Topic consultas checkout adapter (BCH + Monero; no NOWPayments).
 */
const TopicCheckout = ({
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
      productKind={PRODUCT_KINDS.TOPIC}
      productFlags={{
        isForSale: Boolean(isForSale),
        bchDirectAvailable: Boolean(bchDirectAvailable),
      }}
      createBchPayment={
        activePurchaseId != null
          ? () => createTopicPurchaseBchPayment(activePurchaseId)
          : undefined
      }
      verifyBchPayment={
        activePurchaseId != null
          ? (txid) => verifyTopicPurchaseBchPayment(activePurchaseId, txid)
          : undefined
      }
      onPaid={onPaid}
    />
  );
};

export default TopicCheckout;
