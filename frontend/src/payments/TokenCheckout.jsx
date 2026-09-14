import React, { useRef } from 'react';
import ProductPaymentCheckout from './ProductPaymentCheckout';
import {
  createTokenPurchaseBchPayment,
  verifyTokenPurchaseBchPayment,
} from '../api/paymentsApi';
import { PRODUCT_KINDS } from './productCatalog';

/**
 * Token-package checkout adapter.
 */
const TokenCheckout = ({ checkout, onClose, onPaid }) => {
  const lastCheckout = useRef(checkout);
  if (checkout) lastCheckout.current = checkout;
  const active = checkout || lastCheckout.current;

  return (
    <ProductPaymentCheckout
      open={Boolean(checkout)}
      onClose={onClose}
      title={active?.title || 'Paquete de tokens'}
      priceUsd={active?.priceUsd || 0}
      productKind={PRODUCT_KINDS.TOKEN_PACKAGE}
      productFlags={{}}
      createBchPayment={
        active
          ? () => createTokenPurchaseBchPayment(active.purchaseId)
          : undefined
      }
      verifyBchPayment={
        active
          ? (txid) => verifyTokenPurchaseBchPayment(active.purchaseId, txid)
          : undefined
      }
      paymentTarget={
        active?.purchaseId != null
          ? { kind: PRODUCT_KINDS.TOKEN_PACKAGE, purchaseId: active.purchaseId }
          : undefined
      }
      onPaid={onPaid}
    />
  );
};

export default TokenCheckout;
