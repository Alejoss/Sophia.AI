import { useEffect, useMemo, useState } from 'react';
import { getDefaultMediaThumbnail } from './defaultMediaThumbnails';

/**
 * Try thumbnail URLs in order; advance to the next source when the current img fails to load.
 */
export function SequentialThumbnail({
  sources,
  fallback = null,
  loading = 'lazy',
  fetchPriority,
  imgStyle,
  onImageClick,
}) {
  const sourceKey = useMemo(
    () => sources.map((source) => source.src).join('|'),
    [sources],
  );
  const [failedIndex, setFailedIndex] = useState(0);

  useEffect(() => {
    setFailedIndex(0);
  }, [sourceKey]);

  const current = sources[failedIndex];
  if (!current) {
    return fallback;
  }

  const handleClick = current.onClick || onImageClick;

  return (
    <img
      src={current.src}
      alt={current.alt}
      loading={loading}
      fetchPriority={fetchPriority}
      style={{
        width: '100%',
        height: '100%',
        objectFit: current.objectFit || 'cover',
        ...(current.style || {}),
        ...(imgStyle || {}),
      }}
      onClick={handleClick}
      onError={() => setFailedIndex((index) => index + 1)}
    />
  );
}

export function buildListingThumbnailSources({
  customThumbnailForDisplay,
  hasImageFile,
  fileDetails,
  favicon,
  mediaType,
  title,
  resolveMediaUrl,
}) {
  const sources = [];

  if (customThumbnailForDisplay) {
    sources.push({
      src: customThumbnailForDisplay,
      alt: 'Content thumbnail',
    });
  }

  if (hasImageFile) {
    const imageSrc = resolveMediaUrl(fileDetails.url ?? fileDetails.file);
    if (imageSrc) {
      sources.push({
        src: imageSrc,
        alt: title || 'Content image',
        onClick: (event) => {
          event.stopPropagation();
          window.open(imageSrc, '_blank');
        },
      });
    }
  }

  if (fileDetails?.og_image) {
    sources.push({
      src: fileDetails.og_image,
      alt: 'Website preview',
    });
  }

  if (favicon) {
    sources.push({
      src: favicon,
      alt: 'Site favicon',
      objectFit: 'contain',
      style: { width: '32px', height: '32px' },
    });
  }

  const defaultMediaThumbnail = getDefaultMediaThumbnail(mediaType);
  if (defaultMediaThumbnail) {
    sources.push({
      src: defaultMediaThumbnail,
      alt: 'Content thumbnail',
    });
  }

  return sources;
}

export function buildMediaPreviewThumbnailSources({
  customThumbnailForDisplay,
  ogImage,
  mediaType,
}) {
  const sources = [];

  if (customThumbnailForDisplay) {
    sources.push({
      src: customThumbnailForDisplay,
      alt: 'Content thumbnail',
    });
  }

  if (ogImage) {
    sources.push({
      src: ogImage,
      alt: 'Content thumbnail',
    });
  }

  const defaultMediaThumbnail = getDefaultMediaThumbnail(mediaType);
  if (defaultMediaThumbnail) {
    sources.push({
      src: defaultMediaThumbnail,
      alt: 'Content thumbnail',
    });
  }

  return sources;
}
