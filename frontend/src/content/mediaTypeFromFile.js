/**
 * Maps a browser File to library media_type (IMAGE, VIDEO, AUDIO, TEXT) or null if unsupported.
 * Mirrors legacy UploadContentForm behavior.
 */
export function getMediaType(file) {
  if (!file || !file.type) return null;

  if (file.type.startsWith('image/')) return 'IMAGE';
  if (file.type.startsWith('video/')) return 'VIDEO';
  if (file.type.startsWith('audio/')) return 'AUDIO';
  if (
    file.type === 'application/pdf' ||
    file.type === 'application/msword' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'TEXT';
  }

  const extension = file.name.split('.').pop().toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const videoExts = ['mp4', 'webm', 'avi', 'mov'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a'];
  const textExts = ['txt', 'pdf', 'doc', 'docx', 'rtf'];

  if (imageExts.includes(extension)) return 'IMAGE';
  if (videoExts.includes(extension)) return 'VIDEO';
  if (audioExts.includes(extension)) return 'AUDIO';
  if (textExts.includes(extension)) return 'TEXT';

  return null;
}
