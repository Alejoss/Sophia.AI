import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AUDIO_THUMBNAIL,
  DEFAULT_VIDEO_THUMBNAIL,
  getDefaultMediaThumbnail,
} from '../defaultMediaThumbnails';

describe('defaultMediaThumbnails', () => {
  it('returns webp paths for audio and video', () => {
    expect(getDefaultMediaThumbnail('AUDIO')).toBe(DEFAULT_AUDIO_THUMBNAIL);
    expect(getDefaultMediaThumbnail('video')).toBe(DEFAULT_VIDEO_THUMBNAIL);
  });

  it('returns null for other media types', () => {
    expect(getDefaultMediaThumbnail('IMAGE')).toBeNull();
    expect(getDefaultMediaThumbnail('TEXT')).toBeNull();
    expect(getDefaultMediaThumbnail(undefined)).toBeNull();
  });
});
