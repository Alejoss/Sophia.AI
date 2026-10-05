import { describe, it, expect } from 'vitest';
import {
  buildBchVerifyHelpMessage,
  buildAnchorFulfillDeferredHelpMessage,
  ANCHOR_FULFILL_DEFERRED_DESCRIPTION,
  isLikelyBchTxid,
  normalizeBchTxid,
} from '../bchPaymentSupport';

describe('normalizeBchTxid / isLikelyBchTxid', () => {
  it('strips 0x and lowercases', () => {
    expect(normalizeBchTxid('  0xAABBCC  ')).toBe('aabbcc');
  });

  it('accepts a 64-char hex txid', () => {
    const txid = `${'ab'.repeat(32)}`;
    expect(isLikelyBchTxid(txid)).toBe(true);
    expect(isLikelyBchTxid(`0x${txid.toUpperCase()}`)).toBe(true);
  });

  it('rejects short or non-hex values', () => {
    expect(isLikelyBchTxid('abc')).toBe(false);
    expect(isLikelyBchTxid(`${'zz'.repeat(32)}`)).toBe(false);
  });
});

describe('buildBchVerifyHelpMessage', () => {
  it('includes order amount, address, TXID, and verify error', () => {
    const txid = 'a'.repeat(64);
    const text = buildBchVerifyHelpMessage({
      title: 'Ucronía Capítulo 33',
      priceUsd: 40,
      productLabel: 'camino',
      bchOrder: {
        id: 12,
        expected_amount_bch: '0.15859800',
        expected_amount_sats: 15859800,
        address: 'bitcoincash:qptestaddress',
      },
      error: 'No se pudo consultar la blockchain de BCH.',
      txid,
      note: 'Pagué desde Electron Cash',
    });
    expect(text).toContain('Ucronía Capítulo 33');
    expect(text).toContain('$40.00 USD');
    expect(text).toContain('Orden #12');
    expect(text).toContain('0.15859800 BCH');
    expect(text).toContain('bitcoincash:qptestaddress');
    expect(text).toContain(`TXID: ${txid}`);
    expect(text).toContain('No se pudo consultar la blockchain de BCH.');
    expect(text).toContain('Pagué desde Electron Cash');
  });
});

describe('anchor fulfill deferred support copy', () => {
  it('builds a message that asks support to finish anchoring without re-paying', () => {
    const message = buildAnchorFulfillDeferredHelpMessage({
      title: 'Transcripción demo',
      priceUsd: 1,
      requestId: 2,
      reviewNote: 'Insufficient funds for fee',
      paymentMethod: 'bch',
      bchOrder: { id: 12, usd_amount: 1 },
    });
    expect(message).toMatch(/pago.*confirmado/i);
    expect(message).toMatch(/no.*volver a pagar|No quiero volver a pagar/i);
    expect(message).toContain('Solicitud de anclaje #2');
    expect(message).toContain('Insufficient funds for fee');
    expect(ANCHOR_FULFILL_DEFERRED_DESCRIPTION).toMatch(/No vuelvas a pagar/i);
  });
});

