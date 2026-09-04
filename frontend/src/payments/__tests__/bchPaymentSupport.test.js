import { describe, it, expect } from 'vitest';
import { buildBchVerifyHelpMessage } from '../bchPaymentSupport';

describe('buildBchVerifyHelpMessage', () => {
  it('includes order amount, address, and verify error', () => {
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
    });
    expect(text).toContain('Ucronía Capítulo 33');
    expect(text).toContain('$40.00 USD');
    expect(text).toContain('Orden #12');
    expect(text).toContain('0.15859800 BCH');
    expect(text).toContain('bitcoincash:qptestaddress');
    expect(text).toContain('No se pudo consultar la blockchain de BCH.');
  });
});
