/**
 * Tiny TypeScript highlighter for the live preview. The generated code is a
 * narrow, known grammar (imports, `await human.*`, `expect(...)`, strings,
 * comments), so a focused tokenizer beats pulling in a full highlighting lib.
 *
 * Returns an HTML string with token spans. All text — token and gap alike — is
 * HTML-escaped, so it's safe to inject even though captured values flow through.
 */

const KEYWORDS = new Set([
  'import',
  'from',
  'const',
  'let',
  'async',
  'await',
  'function',
  'return',
  'new',
  'process',
  'env',
  'true',
  'false',
  'null',
  'undefined',
  'for',
  'of',
  'if',
]);

const BUILTINS = new Set([
  'human',
  'expect',
  'page',
  'test',
  'sleep',
  'chromium',
  'createHuman',
  'browser',
  'console',
  'main',
]);

// Order matters: comment, string, dotted-property, identifier, number.
const TOKEN =
  /(\/\/[^\n]*)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|(\.[A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*)|(\d+(?:\.\d+)?)/g;

function esc(text: string): string {
  return text.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}

function span(cls: string, text: string): string {
  return `<span class="t-${cls}">${esc(text)}</span>`;
}

export function highlightTs(code: string): string {
  let out = '';
  let last = 0;
  TOKEN.lastIndex = 0;
  for (let m = TOKEN.exec(code); m !== null; m = TOKEN.exec(code)) {
    out += esc(code.slice(last, m.index));
    const [text, comment, str, prop, ident, num] = m;
    if (comment !== undefined) {
      out += span('comment', text);
    } else if (str !== undefined) {
      out += span('string', text);
    } else if (prop !== undefined) {
      out += `.${span('property', prop.slice(1))}`;
    } else if (ident !== undefined) {
      const cls = KEYWORDS.has(ident) ? 'keyword' : BUILTINS.has(ident) ? 'builtin' : 'ident';
      out += span(cls, ident);
    } else if (num !== undefined) {
      out += span('number', num);
    }
    last = TOKEN.lastIndex;
  }
  out += esc(code.slice(last));
  return out;
}
