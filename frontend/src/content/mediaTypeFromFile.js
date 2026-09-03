/**
 * Maps a browser File to library media_type (IMAGE, VIDEO, AUDIO, TEXT) or null if unsupported.
 * Mirrors legacy UploadContentForm behavior.
 */
export function getMediaType(file) {
  if (!file) return null;

  const type = file.type || '';

  if (type.startsWith('image/')) return 'IMAGE';
  if (type.startsWith('video/')) return 'VIDEO';
  if (type.startsWith('audio/')) return 'AUDIO';
  if (
    type === 'application/pdf' ||
    type === 'application/msword' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type === 'application/epub+zip'
  ) {
    return 'TEXT';
  }

  const extension = file.name.split('.').pop().toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const videoExts = ['mp4', 'webm', 'avi', 'mov'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a'];
  const textExts = ['txt', 'pdf', 'doc', 'docx', 'rtf', 'epub'];

  if (imageExts.includes(extension)) return 'IMAGE';
  if (videoExts.includes(extension)) return 'VIDEO';
  if (audioExts.includes(extension)) return 'AUDIO';
  if (textExts.includes(extension)) return 'TEXT';

  return null;
}
