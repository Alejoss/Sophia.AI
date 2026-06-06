/** Default list/card thumbnails when content has no custom thumbnail or OG image. */
export const DEFAULT_AUDIO_THUMBNAIL = '/images/audio_thumbnail_default.webp';
export const DEFAULT_VIDEO_THUMBNAIL = '/images/video_thumbnail_default.webp';

export function getDefaultMediaThumbnail(mediaType) {
  const mt = mediaType?.toUpperCase();
  if (mt === 'AUDIO') return DEFAULT_AUDIO_THUMBNAIL;
  if (mt === 'VIDEO') return DEFAULT_VIDEO_THUMBNAIL;
  return null;
}
