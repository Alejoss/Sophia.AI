import React, { useRef } from 'react';
import ProductPaymentCheckout from '../ProductPaymentCheckout';
import {
  createRegistrationBchPayment,
  verifyRegistrationBchPayment,
} from '../../api/paymentsApi';
import { PRODUCT_KINDS } from '../productCatalog';

/**
 * Event registration checkout: card, NOWPayments, direct BCH, and Monero.
 */
const EventCheckout = ({
  open,
  onClose,
  registrationId,
  title,
  priceUsd,
  onPaid,
}) => {
  const lastRegistrationId = useRef(registrationId);
  if (registrationId != null) lastRegistrationId.current = registrationId;
  const activeRegistrationId = registrationId ?? lastRegistrationId.current;

  return (
    <ProductPaymentCheckout
      open={open}
      onClose={onClose}
      title={title}
      priceUsd={priceUsd}
      productKind={PRODUCT_KINDS.EVENT}
      productFlags={{}}
      createBchPayment={
        activeRegistrationId != null
          ? () => createRegistrationBchPayment(activeRegistrationId)
          : undefined
      }
      verifyBchPayment={
        activeRegistrationId != null
          ? (txid) => verifyRegistrationBchPayment(activeRegistrationId, txid)
          : undefined
      }
      paymentTarget={
        activeRegistrationId != null
          ? { kind: PRODUCT_KINDS.EVENT, purchaseId: activeRegistrationId }
          : undefined
      }
      onPaid={onPaid}
    />
  );
};

export default EventCheckout;
