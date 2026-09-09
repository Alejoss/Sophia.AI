import { describe, it, expect } from 'vitest';
import {
  buildBchVerifyHelpMessage,
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
