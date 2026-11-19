import { describe, expect, it } from 'vitest';
import { isValidCashAddr } from '../cashaddr';

const MAINNET = 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a';

describe('isValidCashAddr', () => {
  it('accepts a checksummed Bitcoin Cash address with a network prefix', () => {
    expect(isValidCashAddr(MAINNET)).toBe(true);
    expect(isValidCashAddr(MAINNET.toUpperCase())).toBe(true);
  });

  it('rejects a missing prefix, a bad checksum, and another network', () => {
    expect(isValidCashAddr(MAINNET.split(':')[1])).toBe(false);
    expect(isValidCashAddr('bitcoincash:qqqq')).toBe(false);
    expect(isValidCashAddr('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(false);
  });
});
