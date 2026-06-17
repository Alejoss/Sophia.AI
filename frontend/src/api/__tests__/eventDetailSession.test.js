import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadEventDetailOnce,
  resetEventDetailSession,
} from '../eventDetailSession';

describe('eventDetailSession', () => {
  beforeEach(() => {
    resetEventDetailSession('2');
  });

  it('deduplicates parallel loads for the same event', async () => {
    const loader = vi.fn(
      () => new Promise((resolve) => {
        setTimeout(() => resolve({ id: 2 }), 10);
      }),
    );

    const [first, second] = await Promise.all([
      loadEventDetailOnce('2', loader),
      loadEventDetailOnce('2', loader),
    ]);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ id: 2 });
    expect(second).toEqual({ id: 2 });
  });

  it('returns cached session data without calling the loader again', async () => {
    const loader = vi.fn(async () => ({ id: 2 }));

    await loadEventDetailOnce('2', loader);
    const data = await loadEventDetailOnce('2', loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(data).toEqual({ id: 2 });
  });

  it('does not auto-retry after an error until the session is reset', async () => {
    const loader = vi.fn(async () => {
      throw new Error('network');
    });

    await expect(loadEventDetailOnce('2', loader)).rejects.toThrow('network');
    await expect(loadEventDetailOnce('2', loader)).rejects.toThrow('network');

    expect(loader).toHaveBeenCalledTimes(1);
  });
});
