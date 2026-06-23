#!/usr/bin/env node
/**
 * AST-based removal of console.log, console.debug, and console.info.
 * Preserves console.error and console.warn.
 */
const fs = require('fs');
const path = require('path');
const frontendNodeModules = path.join(__dirname, '../frontend/node_modules');
const parser = require(path.join(frontendNodeModules, '@babel/parser'));
const traverse = require(path.join(frontendNodeModules, '@babel/traverse')).default;
let babelGenerate;
try {
  babelGenerate = require(path.join(frontendNodeModules, '@babel/generator')).default;
} catch {
  // @babel/generator optional
}

const METHODS = new Set(['log', 'debug', 'info']);

function isConsoleDebugCall(node) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'console' &&
    node.callee.property.type === 'Identifier' &&
    METHODS.has(node.callee.property.name)
  );
}

function removeFromSource(source, filePath) {
  const isTs = /\.tsx?$/.test(filePath);
  const isJsx = /\.(jsx|tsx)$/.test(filePath);

  const ast = parser.parse(source, {
    sourceType: 'module',
    plugins: [
      'jsx',
      ...(isTs ? ['typescript'] : []),
      'classProperties',
      'dynamicImport',
      'importMeta',
      'topLevelAwait',
    ],
  });

  traverse(ast, {
    ExpressionStatement(path) {
      if (isConsoleDebugCall(path.node.expression)) {
        path.remove();
      }
    },
    JSXExpressionContainer(path) {
      const expr = path.node.expression;
      if (expr.type === 'CallExpression' && isConsoleDebugCall(expr)) {
        path.remove();
      }
    },
  });

  // Remove if-blocks that became empty after console.log removal
  traverse(ast, {
    IfStatement(path) {
      const consequent = path.node.consequent;
      if (
        consequent.type === 'BlockStatement' &&
        consequent.body.length === 0
      ) {
        if (path.node.alternate) {
          path.replaceWith(path.node.alternate);
        } else {
          path.remove();
        }
      }
    },
  });

  // Use babel generator if available, otherwise manual slice approach
  if (babelGenerate) {
    const output = babelGenerate(ast, {
      retainLines: true,
      compact: false,
      jsescOption: { minimal: true },
    });
    return cleanupOutput(output.code);
  }

  throw new Error('@babel/generator is required');
}

function cleanupOutput(source) {
  let result = source;

  result = result.replace(/^\s*\/\/\s*Debug logging\s*\n/gm, '');
  result = result.replace(/^\s*\/\/\s*Added to track render cycles\s*\n/gm, '');
  result = result.replace(/^\s*\/\/\s*Track render count to detect potential infinite loops\s*\n/gm, '');
  result = result.replace(/^let renderCount = 0;\n\n?/m, '');
  result = result.replace(/^\s*renderCount\+\+;\n/gm, '');
  result = result.replace(/^\s*\/\/ Reset renderCount on path\/node change\s*\n\s*renderCount = 1;\n/gm, '');
  result = result.replace(
    /^\s*\/\/ Log environment variables to verify they're accessible\s*\n/gm,
    ''
  );

  result = result.replace(/\n{4,}/g, '\n\n\n');

  return result;
}

function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let changed = 0;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      changed += processDirectory(fullPath);
    } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
      const original = fs.readFileSync(fullPath, 'utf8');
      if (!/console\.(log|debug|info)/.test(original)) continue;

      try {
        const cleaned = removeFromSource(original, fullPath);
        if (cleaned !== original) {
          fs.writeFileSync(fullPath, cleaned);
          console.log(`Cleaned: ${fullPath}`);
          changed++;
        }
      } catch (err) {
        console.error(`Failed: ${fullPath}: ${err.message}`);
      }
    }
  }

  return changed;
}

const targetDir = process.argv[2] || path.join(__dirname, '../frontend/src');
const count = processDirectory(targetDir);
console.log(`\nDone. Modified ${count} file(s).`);
