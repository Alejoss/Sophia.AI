import { describe, it, expect } from 'vitest';
import {
  CARD_CONTACT_USER_ID,
  buildCardPaymentMessage,
} from '../cardPayment';
import { MONERO_CONTACT_USER_ID } from '../moneroPayment';

describe('cardPayment helpers', () => {
  it('messages the same operator inbox as Monero', () => {
    expect(CARD_CONTACT_USER_ID).toBe(MONERO_CONTACT_USER_ID);
    expect(CARD_CONTACT_USER_ID).toBe(2);
  });

  it('builds a credit-card payment message with product and price', () => {
    expect(buildCardPaymentMessage({
      title: 'La Real Historia de Bitcoin',
      productLabel: 'curso',
      priceUsd: 35,
    })).toBe(
      'Hola, quiero pagar con tarjeta de crédito «La Real Historia de Bitcoin» ($35.00 USD).',
    );
  });
});
