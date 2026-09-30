/**
 * Browser helpers to download knowledge-path snapshot artifacts for offline
 * hash verification (SHA-256 of RFC 8785 JCS bytes).
 */

export const sanitizeFilenamePart = (value, fallback = 'snapshot') => {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || fallback;
};

export const buildSnapshotDownloadBasename = ({
  knowledgePathId,
  knowledgePathDbId,
  version,
  label,
} = {}) => {
  const idPart = sanitizeFilenamePart(
    knowledgePathId || (knowledgePathDbId != null ? `kp-${knowledgePathDbId}` : 'kp'),
    'kp',
  );
  const versionPart =
    version != null && version !== ''
      ? `v${sanitizeFilenamePart(version, 'preview')}`
      : sanitizeFilenamePart(label || 'preview', 'preview');
  return `${idPart}-${versionPart}`;
};

export const downloadTextFile = (text, filename, mimeType = 'application/json;charset=utf-8') => {
  const blob = new Blob([text ?? ''], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

/**
 * Download the exact JCS canonical bytes used for the digest, plus a .sha256
 * sidecar with the expected hex digest when available.
 */
export const downloadSnapshotForHashVerification = ({
  canonical,
  digest,
  knowledgePathId,
  knowledgePathDbId,
  version,
  label,
} = {}) => {
  if (!canonical || !String(canonical).trim()) {
    throw new Error('No hay bytes canónicos JCS para descargar.');
  }
  const basename = buildSnapshotDownloadBasename({
    knowledgePathId,
    knowledgePathDbId,
    version,
    label,
  });
  downloadTextFile(canonical, `${basename}.jcs.json`, 'application/json;charset=utf-8');
  if (digest) {
    downloadTextFile(
      `${digest}  ${basename}.jcs.json\n`,
      `${basename}.sha256`,
      'text/plain;charset=utf-8',
    );
  }
  return basename;
};
