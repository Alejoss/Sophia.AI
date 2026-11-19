import { describe, expect, it } from 'vitest';
import { fundingFill } from '../progressBar';

describe('fundingFill', () => {
  it('keeps a small pledge visible without calling the goal full', () => {
    const fill = fundingFill(0, 10_000, 12_000_000);
    expect(fill.percent).toBe(0);
    expect(fill.confirmed).toBe(0);
    expect(fill.waiting).toBeGreaterThan(0);
    expect(fill.waiting).toBeLessThan(1);
  });

  it('fills the bar from confirmed satoshis and stops at the goal', () => {
    expect(fundingFill(6_000_000, 0, 12_000_000)).toMatchObject({
      confirmed: 50,
      waiting: 0,
      percent: 50,
    });
    expect(fundingFill(12_000_000, 10_000, 12_000_000)).toMatchObject({
      confirmed: 100,
      waiting: 0,
      percent: 100,
    });
  });

  it('leaves the bar empty when the goal is missing', () => {
    expect(fundingFill(1000, 1000, 0)).toEqual({ confirmed: 0, waiting: 0, percent: 0 });
  });
});
