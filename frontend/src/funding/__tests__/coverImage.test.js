import { describe, expect, it } from 'vitest';
import { coverObjectPosition } from '../coverImage';

describe('coverObjectPosition', () => {
  it('turns the cover focus into the same CSS position a knowledge path uses', () => {
    expect(coverObjectPosition(0.2, 0.8)).toBe('20.0% 80.0%');
    expect(coverObjectPosition(undefined, null)).toBe('50.0% 50.0%');
  });
});
