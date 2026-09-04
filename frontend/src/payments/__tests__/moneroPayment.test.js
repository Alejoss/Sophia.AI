import { describe, it, expect } from 'vitest';
import {
  MONERO_CONTACT_USER_ID,
  MONERO_PAYMENT_DESCRIPTION,
  buildMoneroPaymentMessage,
} from '../moneroPayment';

describe('moneroPayment helpers', () => {
  it('messages user 2 with the requested copy', () => {
    expect(MONERO_CONTACT_USER_ID).toBe(2);
    expect(MONERO_PAYMENT_DESCRIPTION).toBe(
      'Para pagar con Monero, envíame un mensaje y te compartiré mi dirección de billetera.',
    );
    expect(buildMoneroPaymentMessage({
      title: 'Ucronía Capítulo 33',
      productLabel: 'camino',
    })).toBe('Hola, quiero pagar con Monero «Ucronía Capítulo 33, larga vida al criptoanarquismo!»');
  });
});
