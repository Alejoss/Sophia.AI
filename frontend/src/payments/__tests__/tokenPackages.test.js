import { describe, expect, it } from 'vitest';
import { bestValuePackageId, packageTitle, packageTotalTokens, usdPerToken } from '../tokenPackages';

describe('tokenPackages', () => {
  it('hides a name that only repeats the amount', () => {
    expect(packageTitle({ name: '300 tokens', token_amount: 300 })).toBe('300 tokens');
    expect(packageTitle({ name: 'Starter', token_amount: 300 })).toBe('Starter');
  });

  it('picks the best effective rate when bonuses differ', () => {
    expect(
      bestValuePackageId([
        { id: 1, token_amount: 300, bonus_tokens: 0, usd_price: '3.00' },
        { id: 2, token_amount: 800, bonus_tokens: 50, total_tokens: 850, usd_price: '8.00' },
        { id: 3, token_amount: 1200, bonus_tokens: 200, total_tokens: 1400, usd_price: '12.00' },
      ]),
    ).toBe(3);
  });

  it('computes USD per credited token', () => {
    expect(packageTotalTokens({ token_amount: 800, bonus_tokens: 50 })).toBe(850);
    expect(usdPerToken({ token_amount: 800, bonus_tokens: 50, usd_price: '8.00' })).toBeCloseTo(8 / 850);
  });
});
