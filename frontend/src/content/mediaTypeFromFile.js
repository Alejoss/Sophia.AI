/**
 * Maps a browser File to library media_type (IMAGE, VIDEO, AUDIO, TEXT) or null if unsupported.
 * Used by UploadContentForm, LibraryFolderUpload, and any flow that suggests/uploads files.
 *
 * Keep TEXT extensions aligned with backend import_s3_content.EXTENSION_MAP['TEXT']
 * (pdf, txt, md, doc, docx, epub) plus common office/text variants (rtf, markdown).
 */
export function getMediaType(file) {
  if (!file) return null;

  const type = (file.type || '').toLowerCase();

  if (type.startsWith('image/')) return 'IMAGE';
  if (type.startsWith('video/')) return 'VIDEO';
  if (type.startsWith('audio/')) return 'AUDIO';
  if (
    type === 'application/pdf' ||
    type === 'application/msword' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type === 'application/epub+zip' ||
    type === 'text/plain' ||
    type === 'text/markdown' ||
    type === 'text/x-markdown' ||
    type === 'text/rtf' ||
    type === 'application/rtf'
  ) {
    return 'TEXT';
  }

  const extension = file.name.split('.').pop().toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const videoExts = ['mp4', 'webm', 'avi', 'mov'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a'];
  const textExts = ['txt', 'md', 'markdown', 'pdf', 'doc', 'docx', 'rtf', 'epub'];

  if (imageExts.includes(extension)) return 'IMAGE';
  if (videoExts.includes(extension)) return 'VIDEO';
  if (audioExts.includes(extension)) return 'AUDIO';
  if (textExts.includes(extension)) return 'TEXT';

  return null;
}
