/**
 * Infer display title and author from a file name (not full path).
 * - If the stem contains " — ", " – ", or " - " (first match in that order),
 *   author = left part, title = right part (trimmed).
 * - Otherwise title = full stem, author = "".
 */
export function inferTitleAuthorFromFileName(filename) {
  const base = String(filename || '').replace(/^.*[/\\]/, '');
  const lastDot = base.lastIndexOf('.');
  const stem = lastDot > 0 ? base.slice(0, lastDot) : base;
  const trimmedStem = stem.trim();
  if (!trimmedStem) {
    return { author: '', title: base || filename || '' };
  }

  const separators = [' — ', ' – ', ' - '];
  for (const sep of separators) {
    const idx = trimmedStem.indexOf(sep);
    if (idx !== -1) {
      const author = trimmedStem.slice(0, idx).trim();
      const title = trimmedStem.slice(idx + sep.length).trim();
      return {
        author,
        title: title || trimmedStem,
      };
    }
  }

  return { author: '', title: trimmedStem };
}

/**
 * When filename did not yield an author, fill from optional user default, then first path segment.
 * @param {string} relativePath - e.g. webkitRelativePath
 * @param {{ author: string, title: string }} inferred
 * @param {string} [defaultAuthorFromUser] - optional global default
 */
export function resolveAuthorWithFolderHint(relativePath, inferred, defaultAuthorFromUser = '') {
  if (inferred.author && inferred.author.trim()) {
    return { ...inferred };
  }
  const user = (defaultAuthorFromUser || '').trim();
  if (user) {
    return { author: user, title: inferred.title };
  }
  const rel = String(relativePath || '');
  const firstSeg = rel.includes('/') ? rel.split('/')[0].trim() : '';
  if (firstSeg) {
    return { author: firstSeg, title: inferred.title };
  }
  return { ...inferred };
}
