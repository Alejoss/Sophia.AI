import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  buildSnapshotDownloadBasename,
  downloadSnapshotForHashVerification,
  sanitizeFilenamePart,
} from '../snapshotDownload';

describe('snapshotDownload', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sanitizes filename parts', () => {
    expect(sanitizeFilenamePart('La Real Historia!')).toBe('La-Real-Historia');
    expect(sanitizeFilenamePart('')).toBe('snapshot');
  });

  it('builds basename from path id and version', () => {
    expect(
      buildSnapshotDownloadBasename({
        knowledgePathId: 'sophia-acbc:knowledge-path:10',
        version: 1,
      }),
    ).toBe('sophia-acbc-knowledge-path-10-v1');
  });

  it('downloads canonical JCS and sha256 sidecar', () => {
    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node);
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        return { href: '', download: '', rel: '', click, remove };
      }
      return { tagName };
    });

    const basename = downloadSnapshotForHashVerification({
      canonical: '{"a":1}',
      digest: 'abc123',
      knowledgePathDbId: 10,
      version: 1,
    });

    expect(basename).toBe('kp-10-v1');
    expect(click).toHaveBeenCalledTimes(2);
    expect(appendChild).toHaveBeenCalledTimes(2);
    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(2);
  });

  it('throws when canonical is missing', () => {
    expect(() =>
      downloadSnapshotForHashVerification({ digest: 'abc', version: 1 }),
    ).toThrow(/canónicos/i);
  });
});
