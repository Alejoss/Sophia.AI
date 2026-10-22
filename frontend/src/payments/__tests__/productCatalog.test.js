import { describe, it, expect } from 'vitest';
import {
  PRODUCT_KINDS,
  PRODUCT_CATALOG,
  ANCHOR_PAYMENT_TITLE,
  resolveAvailableMethods,
  resolvePaymentTarget,
} from '../productCatalog';

const gatewayAllOn = {
  enabled: true,
  methods: {
    nowpayments: true,
    payphone: true,
    bch_direct: true,
    platform_tokens: true,
  },
  bch_network: 'mainnet',
};

const gatewayAllOff = {
  enabled: false,
  methods: {
    nowpayments: false,
    payphone: false,
    bch_direct: false,
    platform_tokens: false,
  },
  bch_network: 'mainnet',
};

describe('productCatalog matrix', () => {
  it('defines the buyer product kinds', () => {
    expect(Object.keys(PRODUCT_CATALOG).sort()).toEqual([
      'anchor',
      'course',
      'event',
      'path',
      'token_package',
      'topic',
      'transcript_generation',
    ]);
  });

  it('anchor checkout title describes publishing the hash, not the content id', () => {
    expect(ANCHOR_PAYMENT_TITLE).toMatch(/hash SHA-256/i);
    expect(ANCHOR_PAYMENT_TITLE).toMatch(/Bitcoin/i);
    expect(ANCHOR_PAYMENT_TITLE).not.toMatch(/Contenido/i);
    expect(PRODUCT_CATALOG[PRODUCT_KINDS.ANCHOR].defaultTitle).toBe(ANCHOR_PAYMENT_TITLE);
  });

  it('path: NOW + card message + Monero when for sale; BCH when flag + gateway; Payphone off', () => {
    const methods = resolveAvailableMethods({
      kind: PRODUCT_KINDS.PATH,
      gatewayStatus: gatewayAllOn,
      productFlags: { isForSale: true, bchDirectAvailable: true },
    });
    expect(methods).toMatchObject({
      nowpayments: true,
      payphone: false,
      card: true,
      bch_direct: true,
      monero: true,
      platform_tokens: false,
    });
  });

  it('path: no NOW/card/Monero when not for sale', () => {
    const methods = resolveAvailableMethods({
      kind: PRODUCT_KINDS.PATH,
      gatewayStatus: gatewayAllOn,
      productFlags: { isForSale: false, bchDirectAvailable: true },
    });
    expect(methods.nowpayments).toBe(false);
    expect(methods.card).toBe(false);
    expect(methods.payphone).toBe(false);
    expect(methods.monero).toBe(false);
    expect(methods.bch_direct).toBe(true);
  });

  it('topic: card message when for sale; never NOWPayments or Payphone; BCH by flag', () => {
    const methods = resolveAvailableMethods({
      kind: PRODUCT_KINDS.TOPIC,
      gatewayStatus: gatewayAllOn,
      productFlags: { isForSale: true, bchDirectAvailable: true },
    });
    expect(methods).toMatchObject({
      nowpayments: false,
      payphone: false,
      card: true,
      bch_direct: true,
      monero: true,
      platform_tokens: false,
    });
  });

  it('topic: no BCH when product flag off even if gateway on', () => {
    const methods = resolveAvailableMethods({
      kind: PRODUCT_KINDS.TOPIC,
      gatewayStatus: gatewayAllOn,
      productFlags: { isForSale: true, bchDirectAvailable: false },
    });
    expect(methods.bch_direct).toBe(false);
    expect(methods.monero).toBe(true);
    expect(methods.card).toBe(true);
  });

  it('event: NOW + card + Monero; never BCH, tokens, or Payphone', () => {
    const methods = resolveAvailableMethods({
      kind: PRODUCT_KINDS.EVENT,
      gatewayStatus: gatewayAllOn,
      productFlags: {},
    });
    expect(methods).toMatchObject({
      nowpayments: true,
      payphone: false,
      card: true,
      bch_direct: false,
      monero: true,
      platform_tokens: false,
    });
  });

  it('course: NOW + card + BCH + Monero when gateway on; never tokens or Payphone', () => {
    const methods = resolveAvailableMethods({
      kind: PRODUCT_KINDS.COURSE,
      gatewayStatus: gatewayAllOn,
      productFlags: {},
    });
    expect(methods).toMatchObject({
      nowpayments: true,
      payphone: false,
      card: true,
      bch_direct: true,
      monero: true,
      platform_tokens: false,
    });
  });

  it('course: disables NOW/BCH when gateway reports them off; card and Monero stay', () => {
    const methods = resolveAvailableMethods({
      kind: PRODUCT_KINDS.COURSE,
      gatewayStatus: gatewayAllOff,
      productFlags: {},
    });
    expect(methods.nowpayments).toBe(false);
    expect(methods.payphone).toBe(false);
    expect(methods.bch_direct).toBe(false);
    expect(methods.card).toBe(true);
    expect(methods.monero).toBe(true);
  });

  it('anchor: tokens + NOW + card + BCH + Monero when gateway on; Payphone off', () => {
    const methods = resolveAvailableMethods({
      kind: PRODUCT_KINDS.ANCHOR,
      gatewayStatus: gatewayAllOn,
      productFlags: {},
    });
    expect(methods).toMatchObject({
      nowpayments: true,
      payphone: false,
      card: true,
      bch_direct: true,
      monero: true,
      platform_tokens: true,
    });
  });

  it('anchor: tokens stay available when crypto gateway is off', () => {
    const methods = resolveAvailableMethods({
      kind: PRODUCT_KINDS.ANCHOR,
      gatewayStatus: gatewayAllOff,
      productFlags: {},
    });
    expect(methods.nowpayments).toBe(false);
    expect(methods.payphone).toBe(false);
    expect(methods.bch_direct).toBe(false);
    expect(methods.platform_tokens).toBe(false);
    expect(methods.card).toBe(true);
    expect(methods.monero).toBe(true);
  });

  it('token_package: NOW + card + BCH; never Monero, Payphone, or platform tokens', () => {
    const methods = resolveAvailableMethods({
      kind: PRODUCT_KINDS.TOKEN_PACKAGE,
      gatewayStatus: gatewayAllOn,
      productFlags: {},
    });
    expect(methods).toMatchObject({
      nowpayments: true,
      payphone: false,
      card: true,
      bch_direct: true,
      monero: false,
      platform_tokens: false,
    });
  });

  it('disables NOW/BCH when gateway reports them off', () => {
    const methods = resolveAvailableMethods({
      kind: PRODUCT_KINDS.PATH,
      gatewayStatus: gatewayAllOff,
      productFlags: { isForSale: true, bchDirectAvailable: true },
    });
    expect(methods.nowpayments).toBe(false);
    expect(methods.payphone).toBe(false);
    expect(methods.bch_direct).toBe(false);
    expect(methods.card).toBe(true);
    expect(methods.monero).toBe(true);
  });
});

describe('resolvePaymentTarget', () => {
  it('prefers explicit paymentTarget', () => {
    expect(resolvePaymentTarget({
      paymentTarget: { kind: 'path', purchaseId: 9 },
      registrationId: 1,
    })).toEqual({ kind: 'path', purchaseId: 9 });
  });

  it('maps legacy ID props in priority order', () => {
    expect(resolvePaymentTarget({ tokenPurchaseId: 4 })).toEqual({
      kind: 'token_package',
      purchaseId: 4,
    });
    expect(resolvePaymentTarget({ anchorRequestId: 3 })).toEqual({
      kind: 'anchor',
      purchaseId: 3,
    });
    expect(resolvePaymentTarget({ pathPurchaseId: 2 })).toEqual({
      kind: 'path',
      purchaseId: 2,
    });
    expect(resolvePaymentTarget({ registrationId: 1 })).toEqual({
      kind: 'event',
      purchaseId: 1,
    });
  });

  it('returns null when nothing is provided', () => {
    expect(resolvePaymentTarget({})).toBeNull();
  });
});
