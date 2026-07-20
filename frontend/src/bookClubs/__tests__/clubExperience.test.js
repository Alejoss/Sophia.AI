import { describe, it, expect } from 'vitest';
import {
  clubDescriptionNeedsExpand,
  shortTagline,
} from '../clubExperience';

describe('clubExperience description helpers', () => {
  it('truncates long descriptions for the hub preview', () => {
    const long = `${'a'.repeat(150)} final`;
    const preview = shortTagline(long);
    expect(preview.endsWith('…')).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(140);
    expect(clubDescriptionNeedsExpand(long)).toBe(true);
  });

  it('does not mark short descriptions as expandable', () => {
    expect(clubDescriptionNeedsExpand('Bienvenido al seminario.')).toBe(false);
    expect(shortTagline('Bienvenido al seminario.')).toBe('Bienvenido al seminario.');
  });
});
