import { describe, it, expect } from 'vitest';
import { getMediaType } from '../mediaTypeFromFile';

describe('getMediaType', () => {
  it('maps EPUB MIME type to TEXT', () => {
    const file = new File(['epub'], 'libro.epub', { type: 'application/epub+zip' });
    expect(getMediaType(file)).toBe('TEXT');
  });

  it('maps EPUB extension to TEXT when MIME type is empty', () => {
    const file = new File(['epub'], 'libro.epub', { type: '' });
    expect(getMediaType(file)).toBe('TEXT');
  });

  it('maps EPUB extension to TEXT when MIME type is octet-stream', () => {
    const file = new File(['epub'], 'Libro_Clasico.epub', { type: 'application/octet-stream' });
    expect(getMediaType(file)).toBe('TEXT');
  });

  it('still maps PDF to TEXT', () => {
    const file = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' });
    expect(getMediaType(file)).toBe('TEXT');
  });

  it('rejects unsupported extensions', () => {
    const file = new File(['zip'], 'archive.zip', { type: 'application/zip' });
    expect(getMediaType(file)).toBeNull();
  });
});
