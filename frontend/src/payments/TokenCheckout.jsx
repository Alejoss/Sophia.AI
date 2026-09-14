import React, { useRef } from 'react';
import ProductPaymentCheckout from './ProductPaymentCheckout';
import {
  createTokenPurchaseBchPayment,
  verifyTokenPurchaseBchPayment,
} from '../api/paymentsApi';

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
      productLabel="paquete de tokens"
      offerNowpayments
      offerBch
      offerMonero={false}
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
      nowpaymentsProps={{ tokenPurchaseId: active?.purchaseId }}
      onPaid={onPaid}
    />
  );
};

export default TokenCheckout;
