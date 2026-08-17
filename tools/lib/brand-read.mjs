/**
 * ══════════════════════════════════════════════════════════════════════════
 *  BRAND-READ — reading a brand module without running it.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: a build tool that reports "brand defines no
 * `logo.square.rect.sx`" about a key the brand plainly defines. That message
 * sends someone hunting for a typo that does not exist, and the actual cause —
 * a parser that gave up on one line and dropped everything after it — is
 * invisible from the outside. So: NOTHING IS EVER SILENTLY DROPPED. A value
 * this reader cannot understand is still recorded, at its correct dotted path,
 * with `kind: 'computed'` and its raw source text. See `flatten()` below.
 *
 * ─── WHY STATIC, NOT EXECUTED ──────────────────────────────────────────────
 *
 * `brands/<slug>/brand.ts` is TypeScript, and its consumers (the Vite plugin's
 * `config` hook, the brand gate) run in plain Node before any transform
 * pipeline exists. Importing it would mean shelling out to a compiler or
 * betting on Node's type stripping. Reading it as text costs a couple hundred
 * lines and has no moving parts.
 *
 * The grammar this handles is the whole grammar a brand module is allowed to
 * use — one flat sequence of top-level declarations:
 *
 *     export const <name> = <value> satisfies <Type>;
 *     export const <name> = <value> as const;
 *     export const <name>: <Type> = <value>;
 *
 * `<value>` is a string / number / boolean / object literal / array literal,
 * nested freely, plus arithmetic over numeric literals — the real brand file
 * writes `aspect: 1143 / 333` and `sx: 452 / 1143` rather than pre-divided
 * decimals, because the measured pixel counts are the reviewable fact and the
 * quotient is not.
 *
 * Zero dependencies. Node built-ins only.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Comment stripping ──────────────────────────────────────────────────────

/**
 * Remove comments, replacing them with spaces so byte offsets are preserved.
 *
 * THIS IS A CHARACTER SCANNER AND NOT A REGEX, and that is not fastidiousness.
 * The real brand module contains:
 *
 *     href: 'https://www.swiggy.com',
 *
 * A `/\/\/.*$/` strip eats from the `//` in `https://` to the end of the line,
 * which deletes the closing quote and the comma. The parser then either throws
 * on a file that is perfectly valid, or — far worse, and this is the one that
 * actually shipped somewhere — silently reads the brand's URL as `https:`.
 * Nothing downstream can tell that apart from a brand that really is configured
 * that way. A scanner that knows whether it is inside a string cannot make that
 * mistake at all.
 *
 * Tracks: '…', "…", `…` including `${…}` substitutions (which contain code,
 * which may contain strings), backslash escapes, `//` and `/* … *\/`.
 */
export function stripComments(src) {
  const out = [];
  // Stack of contexts. 'code' | 'template'. Nested because `${ }` inside a
  // template returns to code, which may open another template.
  const stack = ['code'];
  let i = 0;

  const pad = (n) => {
    for (let k = 0; k < n; k += 1) out.push(' ');
  };

  while (i < src.length) {
    const ctx = stack[stack.length - 1];
    const c = src[i];

    if (ctx === 'template') {
      if (c === '\\') { out.push(c, src[i + 1] ?? ''); i += 2; continue; }
      if (c === '`') { out.push(c); stack.pop(); i += 1; continue; }
      if (c === '$' && src[i + 1] === '{') { out.push('$', '{'); stack.push('code'); i += 2; continue; }
      out.push(c); i += 1; continue;
    }

    // ctx === 'code'
    if (c === '/' && src[i + 1] === '/') {
      let j = i;
      while (j < src.length && src[j] !== '\n') j += 1;
      pad(j - i);
      i = j;
      continue;
    }

    if (c === '/' && src[i + 1] === '*') {
      // JS block comments do NOT nest: a `/*` sitting inside one is ordinary
      // comment text, and the comment ends at the first `*/`. Honouring that
      // is what keeps a doc comment that talks about comment syntax from
      // swallowing the declarations after it.
      let j = i + 2;
      while (j < src.length && !(src[j] === '*' && src[j + 1] === '/')) j += 1;
      j = Math.min(j + 2, src.length);
      for (let k = i; k < j; k += 1) out.push(src[k] === '\n' ? '\n' : ' ');
      i = j;
      continue;
    }

    if (c === "'" || c === '"') {
      const quote = c;
      out.push(c);
      i += 1;
      while (i < src.length) {
        if (src[i] === '\\') { out.push(src[i], src[i + 1] ?? ''); i += 2; continue; }
        out.push(src[i]);
        i += 1;
        if (src[i - 1] === quote) break;
      }
      continue;
    }

    if (c === '`') { out.push(c); stack.push('template'); i += 1; continue; }

    if (c === '}' && stack.length > 1) {
      // Closing a `${ … }`; the enclosing template resumes.
      out.push(c); stack.pop(); i += 1; continue;
    }

    out.push(c);
    i += 1;
  }

  return out.join('');
}

// ─── Value parsing ──────────────────────────────────────────────────────────

/** Arithmetic over numeric literals only — `1143 / 333`, `(2 + 1) * 4`. */
const ARITHMETIC_RE = /^[\d\s.+\-*/()eE]+$/;

/** Where a bare (non-string, non-object) value ends, at nesting depth 0. */
const VALUE_TERMINATORS = new Set([',', '}', ']', ';']);

function skipSpace(s, i) {
  while (i < s.length && /\s/.test(s[i])) i += 1;
  return i;
}

/** Reads one quoted string starting at `i`; returns its decoded value. */
function readString(s, i) {
  const quote = s[i];
  let out = '';
  let j = i + 1;
  while (j < s.length) {
    const c = s[j];
    if (c === '\\') {
      const n = s[j + 1];
      out += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n;
      j += 2;
      continue;
    }
    if (c === quote) return { value: out, end: j + 1 };
    out += c;
    j += 1;
  }
  return null; // unterminated — caller records it as computed
}

/**
 * Parse one value at `i`. Returns a node plus the index just past it, or null
 * if the text is not something this parser recognises — the caller then keeps
 * the raw text rather than discarding the path.
 *
 * Node shapes: {t:'lit', kind, value} | {t:'obj', entries} | {t:'arr', items}
 */
function parseValue(s, i) {
  i = skipSpace(s, i);
  const c = s[i];

  if (c === '{') return parseObject(s, i);
  if (c === '[') return parseArray(s, i);

  if (c === "'" || c === '"' || c === '`') {
    const first = readString(s, i);
    if (!first) return null;
    if (c === '`' && /\$\{/.test(s.slice(i, first.end))) {
      // A template with a substitution is code, not text. Recorded as computed
      // with its source rather than as the string `hi ${1 + 1}`, which would be
      // a plausible-looking wrong value — the worst kind.
      return { node: { t: 'lit', kind: 'computed', value: s.slice(i, first.end) }, end: first.end };
    }
    // `'a' + 'b'` — the brand's a11y string is split across source lines for
    // readability. Concatenation of literals is still a literal.
    let value = first.value;
    let end = first.end;
    for (;;) {
      const k = skipSpace(s, end);
      if (s[k] !== '+') break;
      const m = skipSpace(s, k + 1);
      if (s[m] !== "'" && s[m] !== '"' && s[m] !== '`') return null;
      const next = readString(s, m);
      if (!next) return null;
      value += next.value;
      end = next.end;
    }
    return { node: { t: 'lit', kind: 'string', value }, end };
  }

  // A bare expression: number, arithmetic, boolean, or something we cannot do.
  let j = i;
  let depth = 0;
  while (j < s.length) {
    const ch = s[j];
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0 && VALUE_TERMINATORS.has(ch)) break;
      depth -= 1;
    } else if (depth === 0 && VALUE_TERMINATORS.has(ch)) break;
    j += 1;
  }
  // A top-level scalar carries its assertion on the same run of text —
  // `export const gravity = 9.8 satisfies number;` — so shear it off before
  // deciding whether what remains is arithmetic.
  const raw = s.slice(i, j).replace(/\s+(?:satisfies\s+[\s\S]+|as\s+const)$/, '').trim();
  if (raw === '') return null;

  if (raw === 'true' || raw === 'false') {
    return { node: { t: 'lit', kind: 'boolean', value: raw === 'true' }, end: j };
  }
  if (ARITHMETIC_RE.test(raw)) {
    // Digits and operators only — nothing here can name a binding or call
    // anything, so evaluating it is arithmetic rather than running the module.
    try {
      // eslint-disable-next-line no-new-func
      const n = Function(`"use strict";return (${raw});`)();
      if (typeof n === 'number' && Number.isFinite(n)) {
        return { node: { t: 'lit', kind: 'number', value: n }, end: j };
      }
    } catch {
      // Falls through to computed, which is the point: unparseable is recorded.
    }
  }
  return { node: { t: 'lit', kind: 'computed', value: raw }, end: j };
}

function parseObject(s, i) {
  const entries = [];
  let j = skipSpace(s, i + 1);
  while (j < s.length && s[j] !== '}') {
    let key;
    if (s[j] === "'" || s[j] === '"') {
      const k = readString(s, j);
      if (!k) return null;
      key = k.value;
      j = k.end;
    } else {
      const start = j;
      while (j < s.length && /[\w$]/.test(s[j])) j += 1;
      if (j === start) return null;
      key = s.slice(start, j);
    }
    j = skipSpace(s, j);
    if (s[j] !== ':') return null;
    const v = parseValue(s, j + 1);
    if (!v) return null;
    entries.push([key, v.node]);
    j = skipSpace(s, v.end);
    if (s[j] === ',') j = skipSpace(s, j + 1); // trailing comma lands on '}'
  }
  if (s[j] !== '}') return null;
  return { node: { t: 'obj', entries }, end: j + 1 };
}

function parseArray(s, i) {
  const items = [];
  let j = skipSpace(s, i + 1);
  while (j < s.length && s[j] !== ']') {
    const v = parseValue(s, j);
    if (!v) return null;
    items.push(v.node);
    j = skipSpace(s, v.end);
    if (s[j] === ',') j = skipSpace(s, j + 1);
  }
  if (s[j] !== ']') return null;
  return { node: { t: 'arr', items }, end: j + 1 };
}

// ─── Flattening ─────────────────────────────────────────────────────────────

/**
 * Walk a node into `values` as dotted paths.
 *
 * THE ONE INVARIANT OF THIS FILE: every leaf reachable in the source appears
 * here, including the ones we failed to understand. `kind: 'computed'` carries
 * the raw text so a caller can say "`logo.mark.aspect` is computed (foo())"
 * instead of "brand defines no `logo.mark.aspect`" — the difference between an
 * error that points at the line and an error that points at nothing.
 */
function flatten(values, prefix, node) {
  if (node.t === 'obj') {
    for (const [k, child] of node.entries) flatten(values, prefix ? `${prefix}.${k}` : k, child);
    return;
  }
  if (node.t === 'arr') {
    node.items.forEach((child, idx) => flatten(values, `${prefix}[${idx}]`, child));
    return;
  }
  values.set(prefix, { value: node.value, kind: node.kind });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** `export const name` / `export const name: Type` — the only shape allowed. */
const EXPORT_RE = /(^|\n)\s*export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]*)?=/g;

/**
 * Read one brand module statically.
 *
 * @param {string} filePath absolute path to `brands/<slug>/brand.ts`
 * @returns {{values: Map<string, {value: any, kind: 'string'|'number'|'boolean'|'computed'}>, raw: string}}
 */
export function readBrand(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  // `import type { … } from '…'` headers carry no values and their braces would
  // otherwise look like an object literal to a less careful scanner. Dropped
  // here rather than special-cased in the parser.
  const src = stripComments(raw).replace(/^\s*import\s+type\s+[\s\S]*?from\s*['"][^'"]*['"]\s*;?/gm, '');

  const values = new Map();
  EXPORT_RE.lastIndex = 0;
  let m;
  while ((m = EXPORT_RE.exec(src)) !== null) {
    const name = m[2];
    const parsed = parseValue(src, m.index + m[0].length);
    if (!parsed) {
      // Even a declaration we could not parse at all keeps its top-level path,
      // for the reason stated on `flatten()`.
      values.set(name, { value: '<unparseable>', kind: 'computed' });
      continue;
    }
    flatten(values, name, parsed.node);
    EXPORT_RE.lastIndex = Math.max(EXPORT_RE.lastIndex, parsed.end);
  }

  return { values, raw };
}

/**
 * Look up one dotted path. `colors.tints[4]`, `logo.square.rect.sx`.
 * Undefined means the brand genuinely does not define it — as distinct from
 * defining it as something non-literal, which comes back as `kind: 'computed'`.
 */
export function resolvePath(values, path) {
  return values.get(path);
}

/** Brand slugs on disk: directories under `brands/` holding a `brand.ts`. */
export function listBrands(rootDir) {
  const dir = join(rootDir, 'brands');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'brand.ts')))
    .map((e) => e.name)
    .sort();
}
