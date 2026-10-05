import React, { useRef } from 'react';
import ProductPaymentCheckout from '../ProductPaymentCheckout';
import { PRODUCT_KINDS } from '../productCatalog';

/**
 * Event registration checkout adapter (NOWPayments + Monero; no BCH).
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
