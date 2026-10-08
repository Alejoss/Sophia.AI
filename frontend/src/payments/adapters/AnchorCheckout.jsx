import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ProductPaymentCheckout from '../ProductPaymentCheckout';
import {
  createAnchorRequestBchPayment,
  payAnchorRequestWithTokens,
  verifyAnchorRequestBchPayment,
} from '../../api/paymentsApi';
import { ANCHOR_PAYMENT_TITLE, PRODUCT_KINDS } from '../productCatalog';

/**
 * Transcript Bitcoin-anchor checkout adapter (tokens + NOW + BCH + Monero).
 */
const AnchorCheckout = ({
  open,
  onClose,
  anchorRequestId,
  title = ANCHOR_PAYMENT_TITLE,
  priceUsd = 1,
  priceTokens = 100,
  tokenBalance = 0,
  onPaid,
}) => {
  const { t } = useTranslation('payments');
  const lastRequestId = useRef(anchorRequestId);
  if (anchorRequestId != null) lastRequestId.current = anchorRequestId;
  const activeRequestId = anchorRequestId ?? lastRequestId.current;

  return (
    <ProductPaymentCheckout
      open={open}
      onClose={onClose}
      title={!title || title === ANCHOR_PAYMENT_TITLE ? t('catalog.anchor.defaultTitle') : title}
      priceUsd={priceUsd}
      productKind={PRODUCT_KINDS.ANCHOR}
      productFlags={{}}
      priceTokens={priceTokens}
      tokenBalance={tokenBalance}
      payWithTokens={
        activeRequestId != null
          ? () => payAnchorRequestWithTokens(activeRequestId)
          : undefined
      }
      createBchPayment={
        activeRequestId != null
          ? () => createAnchorRequestBchPayment(activeRequestId)
          : undefined
      }
      verifyBchPayment={
        activeRequestId != null
          ? (txid) => verifyAnchorRequestBchPayment(activeRequestId, txid)
          : undefined
      }
      paymentTarget={
        activeRequestId != null
          ? { kind: PRODUCT_KINDS.ANCHOR, purchaseId: activeRequestId }
          : undefined
      }
      onPaid={onPaid}
    />
  );
};

export default AnchorCheckout;
