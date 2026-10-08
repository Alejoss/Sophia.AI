import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, '..');

/** Recursively list .jsx/.js under src (skip tests and node_modules). */
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
    if (/\.(jsx|js)$/.test(entry.name)) {
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
 * Find opening tags for native <form> and MUI component="form".
 * Tracks `{}` / quotes so `>` inside JSX expressions does not end the tag early.
 */
function findFormOpenings(source) {
  const code = stripComments(source);
  const openings = [];
  const startRe = /<(form)\b|<(Box|Paper|Stack|DialogContent|Card)\b/g;
  let startMatch;

  while ((startMatch = startRe.exec(code)) !== null) {
    const tag = startMatch[1] || startMatch[2];
    const startIdx = startMatch.index;
    let i = startMatch.index + startMatch[0].length;
    let braceDepth = 0;
    let quote = null;

    while (i < code.length) {
      const ch = code[i];
      if (quote) {
        if (ch === '\\') {
          i += 2;
          continue;
        }
        if (ch === quote) quote = null;
        i += 1;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        i += 1;
        continue;
      }
      if (ch === '{') {
        braceDepth += 1;
        i += 1;
        continue;
      }
      if (ch === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
        i += 1;
        continue;
      }
      if (ch === '>' && braceDepth === 0) {
        break;
      }
      i += 1;
    }

    const full = code.slice(startIdx, i + 1);
    const attrs = full.slice(startMatch[0].length, -1);
    const isNativeForm = tag === 'form';
    const isComponentForm = /\bcomponent\s*=\s*\{?\s*["']form["']\s*\}?/.test(attrs);
    if (!isNativeForm && !isComponentForm) {
      continue;
    }

    openings.push({
      attrs,
      snippet: full.replace(/\s+/g, ' ').slice(0, 160),
      index: startIdx,
    });
  }

  return openings;
}

describe('forms compliance audit', () => {
  it('requires noValidate on every <form> / component="form"', () => {
    const files = listSourceFiles();
    const missing = [];

    for (const file of files) {
      const relative = path.relative(SRC_ROOT, file);
      const source = fs.readFileSync(file, 'utf8');
      for (const opening of findFormOpenings(source)) {
        if (!/\bnoValidate\b/.test(opening.attrs)) {
          missing.push(`${relative}: ${opening.snippet}`);
        }
      }
    }

    expect(
      missing,
      missing.length
        ? `Forms missing noValidate:\n${missing.map((m) => `- ${m}`).join('\n')}`
        : undefined,
    ).toEqual([]);
  });

  it('requires onSubmit on every form opening', () => {
    const files = listSourceFiles();
    const missing = [];

    for (const file of files) {
      const relative = path.relative(SRC_ROOT, file);
      const source = fs.readFileSync(file, 'utf8');
      for (const opening of findFormOpenings(source)) {
        if (!/\bonSubmit\s*=/.test(opening.attrs)) {
          missing.push(`${relative}: ${opening.snippet}`);
        }
      }
    }

    expect(
      missing,
      missing.length
        ? `Forms missing onSubmit:\n${missing.map((m) => `- ${m}`).join('\n')}`
        : undefined,
    ).toEqual([]);
  });

  it('flags English Google SocialLogin copy regressions', () => {
    const socialLogin = fs.readFileSync(
      path.join(SRC_ROOT, 'components', 'SocialLogin.jsx'),
      'utf8',
    );
    const spanishMisc = fs.readFileSync(
      path.join(SRC_ROOT, 'locales', 'es', 'misc.json'),
      'utf8',
    );
    expect(socialLogin).not.toMatch(/Failed to login with Google/);
    expect(socialLogin).not.toMatch(/Failed to initialize Google login/);
    expect(spanishMisc).toMatch(/No se pudo iniciar sesión con Google/);
  });
});
