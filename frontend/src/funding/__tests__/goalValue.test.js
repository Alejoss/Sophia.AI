import { describe, expect, it } from 'vitest';
import { formatUsdFromSats } from '../goalValue';

describe('formatUsdFromSats', () => {
  it('shows the goal in dollars from the Bitcoin Cash price', () => {
    expect(formatUsdFromSats(12_000_000, 500, 'en')).toBe('$60.00');
    expect(formatUsdFromSats(12_000_000, '500', 'es')).toBe('60,00\u00a0US$');
  });

  it('leaves the amount off when the price or the goal is unusable', () => {
    expect(formatUsdFromSats(10000, 0, 'en')).toBe('');
    expect(formatUsdFromSats(-1, 500, 'en')).toBe('');
    expect(formatUsdFromSats(10000, 'nope', 'en')).toBe('');
  });
});
