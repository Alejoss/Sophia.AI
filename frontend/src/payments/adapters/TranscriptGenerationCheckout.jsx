import React, { useRef } from 'react';
import ProductPaymentCheckout from '../ProductPaymentCheckout';
import {
  createTranscriptGenerationBchPayment,
  payTranscriptGenerationWithTokens,
  verifyTranscriptGenerationBchPayment,
} from '../../api/paymentsApi';
import { PRODUCT_KINDS } from '../productCatalog';

/**
 * $1 checkout to generate a missing transcript (card, NOWPayments, BCH, tokens, Monero).
 */
const TranscriptGenerationCheckout = ({
  open,
  onClose,
  requestId,
  title,
  priceUsd = 1,
  priceTokens = 100,
  tokenBalance = 0,
  onPaid,
}) => {
  const lastRequestId = useRef(requestId);
  if (requestId != null) lastRequestId.current = requestId;
  const activeRequestId = requestId ?? lastRequestId.current;

  return (
    <ProductPaymentCheckout
      open={open}
      onClose={onClose}
      title={title}
      priceUsd={priceUsd}
      productKind={PRODUCT_KINDS.TRANSCRIPT_GENERATION}
      productFlags={{}}
      priceTokens={priceTokens}
      tokenBalance={tokenBalance}
      payWithTokens={
        activeRequestId != null
          ? () => payTranscriptGenerationWithTokens(activeRequestId)
          : undefined
      }
      createBchPayment={
        activeRequestId != null
          ? () => createTranscriptGenerationBchPayment(activeRequestId)
          : undefined
      }
      verifyBchPayment={
        activeRequestId != null
          ? (txid) => verifyTranscriptGenerationBchPayment(activeRequestId, txid)
          : undefined
      }
      paymentTarget={
        activeRequestId != null
          ? { kind: PRODUCT_KINDS.TRANSCRIPT_GENERATION, purchaseId: activeRequestId }
          : undefined
      }
      onPaid={onPaid}
    />
  );
};

export default TranscriptGenerationCheckout;
