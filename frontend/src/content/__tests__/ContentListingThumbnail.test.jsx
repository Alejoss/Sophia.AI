import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SequentialThumbnail,
  buildListingThumbnailSources,
  buildMediaPreviewThumbnailSources,
} from '../ContentListingThumbnail';

describe('ContentListingThumbnail', () => {
  it('falls back to the next source when an image fails to load', () => {
    render(
      <SequentialThumbnail
        sources={[
          { src: 'https://example.com/broken-og.jpg', alt: 'og' },
          { src: '/images/video_thumbnail_default.webp', alt: 'default' },
        ]}
        fallback={<span>icon fallback</span>}
      />,
    );

    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/broken-og.jpg',
    );

    fireEvent.error(screen.getByRole('img'));

    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      '/images/video_thumbnail_default.webp',
    );
  });

  it('builds listing sources ending with the default media thumbnail', () => {
    const sources = buildListingThumbnailSources({
      customThumbnailForDisplay: null,
      hasImageFile: false,
      fileDetails: { og_image: 'https://example.com/og.jpg' },
      favicon: null,
      mediaType: 'VIDEO',
      title: 'Test video',
      resolveMediaUrl: (value) => value,
    });

    expect(sources.map((source) => source.src)).toEqual([
      'https://example.com/og.jpg',
      '/images/video_thumbnail_default.webp',
    ]);
  });

  it('builds preview sources for detailed video cards', () => {
    const sources = buildMediaPreviewThumbnailSources({
      customThumbnailForDisplay: null,
      ogImage: 'https://example.com/og.jpg',
      mediaType: 'VIDEO',
    });

    expect(sources.map((source) => source.src)).toEqual([
      'https://example.com/og.jpg',
      '/images/video_thumbnail_default.webp',
    ]);
  });
});
