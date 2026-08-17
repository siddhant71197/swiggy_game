/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE BRAND GATE — what makes "modular" a capability rather than a claim.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: a build that re-skins to 95%. The last 5% is
 * a hard-coded orange in one hover state, a brand name in one toast, a logo
 * blitted at the previous brand's aspect ratio — and every one of those is
 * invisible in a text diff and obvious in a screenshot, which is the worst
 * possible combination because screenshots are taken after the deadline.
 *
 * Every rule below exists because it is a mistake somebody actually makes while
 * being careful. Rules are reported ALL AT ONCE, never first-failure-only: a
 * gate you have to run eleven times to see eleven problems is a gate people
 * start bypassing.
 *
 * Usage:  node tools/gate.mjs [--list]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBrand, resolvePath, listBrands } from './lib/brand-read.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

// ─── Walking ────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const srcFiles = walk(join(ROOT, 'src')).filter((f) => extname(f) === '.ts');
const read = (f) => readFileSync(f, 'utf8');
const rel = (f) => relative(ROOT, f);

// ─── Reporting ──────────────────────────────────────────────────────────────

const failures = [];
const notes = [];
let checked = 0;

function fail(rule, message, where) {
  failures.push({ rule, message, where });
}
function rule(id, title, fn) {
  checked++;
  try {
    fn((m, w) => fail(id, m, w), (m) => notes.push(`${id} ${title}: ${m}`));
  } catch (err) {
    fail(id, `rule threw: ${err instanceof Error ? err.message : String(err)}`, '');
  }
}

/**
 * Lines a source-scanning rule should skip.
 *
 * Comments are skipped because this codebase EXPLAINS its colour decisions in
 * prose — "#FF5200 against #D42A2A measures ΔE ≈ 21" is documentation, and a
 * gate that forbids writing a hex in a comment is a gate that quietly deletes
 * the reasoning behind the palette. Strings are still scanned: a hex in a
 * string is a hex that reaches a canvas.
 */
function codeLines(src) {
  const out = [];
  let inBlock = false;
  src.split('\n').forEach((line, i) => {
    let l = line;
    if (inBlock) {
      const end = l.indexOf('*/');
      if (end === -1) return;
      l = l.slice(end + 2);
      inBlock = false;
    }
    for (;;) {
      const start = l.indexOf('/*');
      if (start === -1) break;
      const end = l.indexOf('*/', start + 2);
      if (end === -1) {
        l = l.slice(0, start);
        inBlock = true;
        break;
      }
      l = l.slice(0, start) + l.slice(end + 2);
    }
    const line2 = l.replace(/\/\/.*$/, '');
    if (line2.trim()) out.push([i + 1, line2]);
  });
  return out;
}

// ─── U1 · No colour literals under src/ ─────────────────────────────────────

rule('U1', 'no colour literals in src/', (bad) => {
  const HEX = /#[0-9a-fA-F]{3,8}\b/;
  const FUNC = /\b(rgba?|hsla?)\s*\(/;
  // withAlpha() and mix() live in the derivation and BUILD these strings; they
  // are the reason no other file has to. Exempting their home is not a hole in
  // the rule, it is the rule having somewhere to point callers at. Hex literals
  // are still banned there — that is U5, which this exemption does not touch.
  const FUNC_EXEMPT = 'src/brand/theme.ts';
  for (const f of srcFiles) {
    const funcOk = rel(f) === FUNC_EXEMPT;
    for (const [n, line] of codeLines(read(f))) {
      if (HEX.test(line) || (FUNC.test(line) && !funcOk)) {
        bad(`colour literal — every colour must come from COLORS or withAlpha()`, `${rel(f)}:${n}`);
      }
    }
  }
});

// ─── U2 · The brand is imported in exactly one place ────────────────────────

rule('U2', 'single brand import site', (bad) => {
  const allowed = join(ROOT, 'src/brand/index.ts');
  for (const f of srcFiles) {
    if (f === allowed) continue;
    for (const [n, line] of codeLines(read(f))) {
      if (/from\s+['"]@brand['"]/.test(line) || /from\s+['"].*brands\//.test(line)) {
        bad(`imports the brand directly — go through src/brand/index.ts`, `${rel(f)}:${n}`);
      }
    }
  }
});

// ─── U3 · The sim stays headless ────────────────────────────────────────────

rule('U3', 'sim layer is headless', (bad) => {
  // loop.ts and storage.ts are the two declared exceptions: one owns rAF, the
  // other owns localStorage. Both say so in their headers.
  const EXEMPT = new Set(['src/core/loop.ts', 'src/core/storage.ts']);
  const BANNED = /\b(document|window|navigator|performance|localStorage|Math\.random)\b|\bnew Date\b/;
  for (const f of srcFiles) {
    const r = rel(f);
    if (!r.startsWith('src/game/') && !r.startsWith('src/core/')) continue;
    if (EXEMPT.has(r)) continue;
    for (const [n, line] of codeLines(read(f))) {
      if (BANNED.test(line)) {
        bad(
          `touches the platform — src/game and src/core must stay headless so tools/simulate.ts can run the real engine`,
          `${r}:${n}`,
        );
      }
    }
  }
});

// ─── U4 · Save keys are derived from the slug ───────────────────────────────

rule('U4', 'save key derived from slug', (bad) => {
  const src = read(join(ROOT, 'src/brand/index.ts'));
  if (!/SAVE_KEY\s*=\s*`\$\{[^}]*slug\}/.test(src)) {
    bad(
      'SAVE_KEY is not derived from identity.slug — two brands would share a save slot on a device that has played both',
      'src/brand/index.ts',
    );
  }
});

// ─── U5 · The derivation holds no colour of its own ─────────────────────────

rule('U5', 'theme.ts derives, never decides', (bad) => {
  const f = join(ROOT, 'src/brand/theme.ts');
  for (const [n, line] of codeLines(read(f))) {
    if (/#[0-9a-fA-F]{3,8}\b/.test(line)) {
      bad('a literal in the derivation survives every re-skin', `src/brand/theme.ts:${n}`);
    }
  }
});

// ─── U6 · Every brand satisfies the contract ────────────────────────────────

const REQUIRED = [
  'identity.name', 'identity.slug', 'identity.gameTitle', 'identity.fullTitle', 'identity.href',
  'colors.primary', 'colors.primaryHover', 'colors.primaryPressed', 'colors.secondary',
  'colors.paper', 'colors.ink', 'colors.surfaceDark', 'colors.primaryWash',
  'colors.positive', 'colors.negative', 'colors.caution', 'colors.wordmarkTint',
  'colors.collectible.body', 'colors.collectible.gem', 'colors.collectible.outline',
  'colors.characters.skin', 'colors.characters.fur',
  'colors.tints[0]', 'colors.tints[4]',
  'type.stack', 'type.weights.display', 'type.leading.display',
  'shape.card', 'shape.button', 'shape.squircle',
  'ad.headline', 'ad.cta',
  'vocab.collectible', 'vocab.collectiblePl', 'vocab.goal', 'vocab.hazard',
  'copy.bootLine', 'copy.a11y',
  'logo.mark.src', 'logo.mark.aspect', 'logo.favicon.src',
];

const brands = listBrands(ROOT);

rule('U6', 'brand contract complete', (bad) => {
  for (const slug of brands) {
    const b = readBrand(join(ROOT, 'brands', slug, 'brand.ts'));
    for (const path of REQUIRED) {
      const hit = resolvePath(b.values, path);
      if (!hit) bad(`brand "${slug}" is missing \`${path}\``, `brands/${slug}/brand.ts`);
      else if (hit.kind === 'computed') {
        bad(`brand "${slug}" has \`${path}\` as a computed value; the gate and the HTML substituter both need a literal`, `brands/${slug}/brand.ts`);
      }
    }
  }
});

// ─── U7 · The menu's two arrays stay in step ─────────────────────────────────

rule('U7', 'food palette and names match', (bad) => {
  for (const slug of brands) {
    const b = readBrand(join(ROOT, 'brands', slug, 'brand.ts'));
    // Count by probing indices rather than reading the arrays, because the
    // reader flattens to dotted paths — `colors.foods[3].body`, not an array.
    let palette = 0;
    while (resolvePath(b.values, `colors.foods[${palette}].body`)) palette++;
    let names = 0;
    while (resolvePath(b.values, `vocab.foods[${names}]`)) names++;

    if (palette === 0) {
      bad(`brand "${slug}" declares no food palettes — colors.foods is required`, `brands/${slug}/brand.ts`);
      continue;
    }
    if (palette !== names) {
      bad(
        `brand "${slug}" has ${palette} food palette(s) but ${names} name(s) — a dish with no name ` +
          `renders as a blank line on the receipt, and a name with no palette renders as nothing at all`,
        `brands/${slug}/brand.ts`,
      );
    }
    // Every palette needs all four roles; a missing `outline` is the one that
    // matters, since it is what keeps warm food legible on an orange tower.
    for (let i = 0; i < palette; i++) {
      for (const role of ['body', 'shade', 'accent', 'outline']) {
        if (!resolvePath(b.values, `colors.foods[${i}].${role}`)) {
          bad(`brand "${slug}" food ${i} is missing \`${role}\``, `brands/${slug}/brand.ts`);
        }
      }
    }
  }
});

// ─── R15 · Declared aspect ratios match the real artwork ────────────────────

/** Real pixel size of a PNG or the viewBox of an SVG. Header read only. */
function imageSize(file) {
  const ext = extname(file).toLowerCase();
  const buf = readFileSync(file);
  if (ext === '.png') {
    if (buf.length < 24 || buf.readUInt32BE(12) !== 0x49484452) return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (ext === '.svg') {
    const s = buf.toString('utf8', 0, 2048);
    const vb = s.match(/viewBox\s*=\s*["']\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)/);
    if (vb) return { w: parseFloat(vb[1]), h: parseFloat(vb[2]) };
    const w = s.match(/\bwidth\s*=\s*["']([\d.]+)/);
    const h = s.match(/\bheight\s*=\s*["']([\d.]+)/);
    if (w && h) return { w: parseFloat(w[1]), h: parseFloat(h[1]) };
  }
  return null;
}

rule('R15', 'declared aspect matches the file', (bad, note) => {
  for (const slug of brands) {
    const b = readBrand(join(ROOT, 'brands', slug, 'brand.ts'));
    const pub = join(ROOT, 'brands', slug, 'public');

    const cuts = new Set();
    for (const key of b.values.keys()) {
      const m = key.match(/^(logo\.[A-Za-z]+)\.src$/);
      if (m) cuts.add(m[1]);
    }

    for (const cut of cuts) {
      const src = resolvePath(b.values, `${cut}.src`)?.value;
      const declared = resolvePath(b.values, `${cut}.aspect`)?.value;
      if (typeof src !== 'string' || typeof declared !== 'number') continue;

      const file = join(pub, src.replace(/^\.\//, ''));
      let size;
      try {
        size = imageSize(file);
      } catch {
        bad(`${cut}.src points at a missing file (${src})`, `brands/${slug}/brand.ts`);
        continue;
      }
      if (!size) {
        note(`${cut}: could not read a size from ${src}; skipped`);
        continue;
      }

      // An AssetRef with a `rect` declares the aspect OF THE CUT, so the
      // file's own ratio must be scaled by the sub-rectangle's before they are
      // comparable. Getting this backwards is exactly the silent 1%-wrong blit
      // this rule exists to catch.
      const sw = resolvePath(b.values, `${cut}.rect.sw`)?.value;
      const sh = resolvePath(b.values, `${cut}.rect.sh`)?.value;
      const actual =
        typeof sw === 'number' && typeof sh === 'number'
          ? (size.w * sw) / (size.h * sh)
          : size.w / size.h;

      const drift = Math.abs(actual - declared) / declared;
      if (drift > 0.02) {
        bad(
          `${cut}.aspect is ${declared.toFixed(4)} but the artwork is ${actual.toFixed(4)} ` +
            `(${(drift * 100).toFixed(1)}% off) — it would blit distorted`,
          `brands/${slug}/brand.ts`,
        );
      }
    }
  }
});

// ─── S1 · No blurred shadows on the canvas ──────────────────────────────────

rule('S1', 'no shadowBlur / filter in render', (bad) => {
  for (const f of srcFiles) {
    const r = rel(f);
    if (!r.startsWith('src/render/') && !r.startsWith('src/scenes/')) continue;
    for (const [n, line] of codeLines(read(f))) {
      if (/\.shadowBlur\b|\bctx\.filter\s*=/.test(line)) {
        bad(
          'shadowBlur/filter is the Android frame-budget cliff — build elevation from stacked fills (see softShadow)',
          `${r}:${n}`,
        );
      }
    }
  }
});

// ─── S3 · The mark is never given a treatment ───────────────────────────────

rule('S3', 'no gradient on the mark', (bad) => {
  const LOGO_TOKENS = /\b(markPlate|markPin|markWordmark|emblemFill)\b/;
  for (const f of srcFiles) {
    const lines = codeLines(read(f));
    for (let i = 0; i < lines.length; i++) {
      const [n, line] = lines[i];
      if (!/createLinearGradient|createRadialGradient/.test(line)) continue;
      // Gradient stops are set on the following few lines in every style we use.
      const window = lines.slice(i, i + 6).map(([, l]) => l).join('\n');
      if (LOGO_TOKENS.test(window)) {
        bad('a gradient built from a logo token — the mark takes no gradient, ever', `${rel(f)}:${n}`);
      }
    }
  }
});

// ─── S5 · The superseded brand colour never comes back ──────────────────────

rule('S5', 'no superseded brand colour', (bad) => {
  const LEGACY = /#FC8019\b/i;
  const files = [...srcFiles, ...walk(join(ROOT, 'brands')).filter((f) => /\.(ts|svg|css|html)$/.test(f)), join(ROOT, 'index.html')];
  for (const f of files) {
    let src;
    try {
      src = read(f);
    } catch {
      continue;
    }
    // CODE ONLY, and the first version of this rule got that wrong.
    //
    // Scanning comments too looks stricter and is actually worse: the only
    // prose that mentions this value is prose WARNING about it, so the rule
    // fired on the very documentation that stops the mistake, and the obvious
    // fix — deleting the warning — makes the codebase less safe. Someone who
    // reintroduces the legacy orange pastes it into code, and that is what is
    // checked.
    for (const [n, line] of codeLines(src)) {
      if (LEGACY.test(line)) {
        bad('#FC8019 is the PREVIOUS Swiggy identity; the current primary is #FF5200', `${rel(f)}:${n}`);
      }
    }
  }
});

// ─── Output ─────────────────────────────────────────────────────────────────

if (process.argv.includes('--list')) {
  console.log(brands.length ? brands.join('\n') : '(no brands found)');
  process.exit(0);
}

for (const n of notes) console.log(`  note  ${n}`);

if (failures.length === 0) {
  console.log(`[gate] ${checked} rules, ${brands.length} brand(s), ${srcFiles.length} files — clean`);
  process.exit(0);
}

const byRule = new Map();
for (const f of failures) {
  if (!byRule.has(f.rule)) byRule.set(f.rule, []);
  byRule.get(f.rule).push(f);
}
console.error(`\n[gate] ${failures.length} failure(s) across ${byRule.size} rule(s):\n`);
for (const [id, list] of byRule) {
  console.error(`  ${id}`);
  for (const f of list) console.error(`    ${f.where}\n      ${f.message}`);
  console.error('');
}
process.exit(1);
