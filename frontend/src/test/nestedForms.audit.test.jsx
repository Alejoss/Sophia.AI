import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, '..');

/** Recursively list .jsx/.js/.tsx/.ts under src (skip tests and node_modules). */
function listSourceFiles(dir = SRC_ROOT, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'test') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listSourceFiles(full, out);
      continue;
    }
    if (/\.(jsx|tsx|js|ts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Lightweight JSX walk: push on <form or component="form", pop on </form> / </Box> etc.
 * Flags when <UploadContentForm or <ContentSuggestionPicker appears while formDepth > 0.
 *
 * Limitation: does not perfectly model every MUI closing tag pairing when component="form"
 * is on Box/Paper — we treat those as form opens and only pop on matching close tags of
 * the same element name when we saw component="form" on open.
 */
function findNestedUploadFormRisks(source, filePath) {
  const code = stripComments(source);
  const risks = [];

  // Only care about files that render upload-capable children.
  if (
    !/<UploadContentForm[\s/>]/.test(code)
    && !/<ContentSuggestionPicker[\s/>]/.test(code)
  ) {
    return risks;
  }

  // Stack of { tag, isForm }
  const stack = [];
  const tokenRe = /<\/?([A-Za-z][A-Za-z0-9.]*)\b[^>]*\/?>/g;
  let match;
  while ((match = tokenRe.exec(code)) !== null) {
    const full = match[0];
    const tag = match[1];
    const isClosing = full.startsWith('</');
    const selfClosing = full.endsWith('/>');

    if (isClosing) {
      // Pop until matching tag (tolerant of imperfect JSX)
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].tag === tag) {
          stack.splice(i);
          break;
        }
      }
      continue;
    }

    const isFormNative = tag === 'form';
    const isFormComponent = /\bcomponent\s*=\s*\{?\s*["']form["']\s*\}?/.test(full);
    const isForm = isFormNative || isFormComponent;

    if (!selfClosing) {
      stack.push({ tag, isForm });
    }

    const formDepth = stack.filter((frame) => frame.isForm).length;
    const isUploadChild = tag === 'UploadContentForm' || tag === 'ContentSuggestionPicker';
    if (isUploadChild && formDepth > 0) {
      risks.push({
        file: path.relative(SRC_ROOT, filePath),
        tag,
        formDepth,
        snippet: full.slice(0, 120),
      });
    }
  }

  return risks;
}

describe('nested HTML forms audit (UploadContentForm / ContentSuggestionPicker)', () => {
  it('does not render upload forms inside another <form>', () => {
    const files = listSourceFiles();
    const allRisks = [];

    for (const file of files) {
      // The leaf components themselves contain <form>; that is expected.
      if (
        file.endsWith(`${path.sep}UploadContentForm.jsx`)
        || file.endsWith(`${path.sep}FileSuggestionUploadDialog.jsx`)
      ) {
        continue;
      }
      const source = fs.readFileSync(file, 'utf8');
      allRisks.push(...findNestedUploadFormRisks(source, file));
    }

    expect(
      allRisks,
      allRisks.length
        ? `Nested form risks:\n${allRisks.map((r) => `- ${r.file}: <${r.tag}> inside form (depth ${r.formDepth})`).join('\n')}`
        : undefined,
    ).toEqual([]);
  });

  it('lists every UploadContentForm consumer (inventory smoke check)', () => {
    const files = listSourceFiles().filter((file) => {
      if (file.endsWith(`${path.sep}UploadContentForm.jsx`)) return false;
      const source = fs.readFileSync(file, 'utf8');
      return /from ['"].*UploadContentForm['"]/.test(source) || /<UploadContentForm[\s/>]/.test(source);
    });

    const relative = files.map((f) => path.relative(SRC_ROOT, f)).sort();

    // Keep inventory intentional: if a new consumer is added, update this list after
    // confirming it does not wrap UploadContentForm in a parent <form>.
    expect(relative).toEqual([
      'content/ContentSelector.jsx',
      'content/ContentSuggestionPicker.jsx',
      'content/LibraryUploadContent.jsx',
      'topics/ContentSuggestionModal.jsx',
      'topics/TopicAddContent.jsx',
      'topics/TopicContentManager.jsx',
      'topics/timeline/TopicTimelineEntryContentLinkForm.jsx',
    ]);
  });

  it('lists every ContentSuggestionPicker consumer (inventory smoke check)', () => {
    const files = listSourceFiles().filter((file) => {
      if (file.endsWith(`${path.sep}ContentSuggestionPicker.jsx`)) return false;
      const source = fs.readFileSync(file, 'utf8');
      // Only components that render the picker (not named helper imports).
      return /import\s+ContentSuggestionPicker\b/.test(source)
        || /<ContentSuggestionPicker[\s/>]/.test(source);
    });

    const relative = files.map((f) => path.relative(SRC_ROOT, f)).sort();

    expect(relative).toEqual([
      'topics/timeline/TopicTimelineEntryContentSuggestionForm.jsx',
      'topics/timeline/TopicTimelineEntrySuggestionForm.jsx',
    ]);
  });

  it('detects the historical nested-form anti-pattern in a fixture', () => {
    const fixture = `
      const Bad = () => (
        <Box component="form" onSubmit={onSubmit}>
          <UploadContentForm onContentUploaded={fn} />
        </Box>
      );
    `;
    const risks = findNestedUploadFormRisks(fixture, path.join(SRC_ROOT, 'fixture-bad.jsx'));
    expect(risks.length).toBeGreaterThan(0);
    expect(risks[0].tag).toBe('UploadContentForm');
  });
});
