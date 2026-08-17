/**
 * ══════════════════════════════════════════════════════════════════════════
 *  BRAND — the Vite plugin that makes a brand swappable.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURES THIS FILE PREVENTS, in the order they would happen:
 *
 *   1. A build that quietly picks a brand. Two brands in the tree and no
 *      instruction means the build does not know which identity to ship, and
 *      shipping the wrong one is not a bug anyone catches in review — it is a
 *      bug a customer catches. So it throws.
 *   2. The previous brand's favicon inside the new brand's bundle. Each brand
 *      owns its own `public/`; there is deliberately no shared one.
 *   3. A `%brand:…%` placeholder surviving into shipped HTML, where it renders
 *      as visible junk in a <title> or as an invalid colour the browser
 *      silently drops back to white.
 *
 * ─── ONE GAME, SEVERAL BRANDS, ONE BUILD EACH ──────────────────────────────
 *
 *     npm run build              -> the default brand
 *     BRAND=nike npm run build   -> the same game, Nike's identity
 *
 * Three jobs, and they are three because that is how many places a brand can
 * enter a Vite build:
 *
 *   1. `@brand` resolves to `brands/<slug>/brand.ts`. Everything under src/
 *      imports from `src/brand`, which re-exports `@brand`, so the whole source
 *      tree is brand-agnostic and swapping is an alias change.
 *   2. `publicDir` becomes `brands/<slug>/public`.
 *   3. index.html placeholders are substituted — see below.
 *
 * ─── WHY index.html NEEDS SUBSTITUTION AT ALL ──────────────────────────────
 *
 * The theme colour, the <title>, the favicon href and the boot splash all paint
 * BEFORE the module graph runs, so they cannot import the brand module. The
 * alternative to substitution is writing one brand's values into index.html by
 * hand, which is correct for exactly one brand and duplicated for every one
 * after it.
 *
 *     <meta name="theme-color" content="%brand:colors.primary%" />
 *     <title>%brand:identity.fullTitle%</title>
 *     <p>%brand:copy.bootLine%</p>
 *
 * Paths may index arrays: `%brand:colors.tints[4]%`.
 *
 * ─── THE VALUES ARE READ, NOT EXECUTED ─────────────────────────────────────
 *
 * `brand.ts` is TypeScript and this plugin runs in Node during config
 * resolution, before Vite has a transform pipeline to hand. tools/lib/
 * brand-read.mjs parses it as text. The cost is real and worth stating: a value
 * computed at runtime cannot appear in index.html, and the build says so rather
 * than emitting the literal source text. Identity strings and colours are
 * literals; this has not bitten in practice.
 *
 * Zero dependencies beyond tools/lib.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { listBrands, readBrand, resolvePath } from '../lib/brand-read.mjs';

/** `%brand:some.path%`, with optional array indices. */
const PLACEHOLDER_RE = /%brand:([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\s*\d+\s*\])*)%/g;

/** Which HTML characters must not survive into an attribute or a text node. */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/**
 * Substituted values land in attribute values, in text nodes, and inside
 * `<style>` — and the third of those must NOT be escaped.
 *
 * ─── THE BUG THIS SPLIT EXISTS TO PREVENT ──────────────────────────────────
 *
 * Escaping unconditionally is the obvious implementation and it is wrong.
 * `type.stack` is `"Poppins", "Gilroy", system-ui, …` — a perfectly ordinary
 * CSS font stack with the quotes CSS requires. Escape it into a `<style>` block
 * and PostCSS gets `font-family: &quot;Poppins&quot;` and fails the build with
 * "Unknown word Poppins", which points at the stylesheet rather than at the
 * substituter and reads as a Vite problem.
 *
 * `<style>` and `<script>` are RAW TEXT elements in the HTML spec: entities are
 * not decoded inside them, so escaping there does not protect anything, it only
 * corrupts the value. Markup context decides, so the scanner below tracks it.
 */
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);
}

/**
 * The one thing that IS unsafe in a raw-text element: a value that closes it.
 * Brand modules are authored, not user input, so this is a typo-catcher rather
 * than a security boundary — but a stray `</style>` in a brand string would
 * dump the rest of the stylesheet into the document as text, and the symptom
 * (half the page unstyled, no error anywhere) is miserable to trace back here.
 */
function assertRawTextSafe(value, path, tag) {
  if (new RegExp(`</\\s*${tag}`, 'i').test(String(value))) {
    throw new Error(
      `[brand] \`${path}\` contains a closing </${tag}> and is substituted inside a <${tag}> block`,
    );
  }
}

/**
 * Which brand this build is for.
 *
 * `BRAND=` beats package.json's `brand.default`, which beats "there is exactly
 * one brand on disk, so it cannot be ambiguous". If none of those decide it the
 * build stops with the list of slugs — GUESSING WHICH BRAND TO SHIP IS NOT A
 * THING A BUILD SYSTEM SHOULD DO QUIETLY. A wrong-but-plausible brand produces
 * a bundle that looks finished, passes every test, and is wrong in the one
 * dimension nobody re-checks.
 */
export function resolveBrand(root) {
  const available = listBrands(root);
  if (available.length === 0) {
    throw new Error('[brand] no brand modules found — expected at least one brands/<slug>/brand.ts');
  }

  const requested = process.env.BRAND ?? null;
  if (requested) {
    if (!available.includes(requested)) {
      throw new Error(`[brand] BRAND=${requested} names no brand — available: ${available.join(', ')}`);
    }
    return requested;
  }

  let fallback = null;
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      fallback = JSON.parse(readFileSync(pkgPath, 'utf8'))?.brand?.default ?? null;
    } catch {
      // A malformed package.json is not this plugin's error to report; npm and
      // Vite both say so far more clearly than a half-guess from here would.
    }
  }
  if (fallback) {
    if (!available.includes(fallback)) {
      throw new Error(
        `[brand] package.json names default brand "${fallback}", which does not exist — ` +
          `available: ${available.join(', ')}`,
      );
    }
    return fallback;
  }

  if (available.length === 1) return available[0];
  throw new Error(
    `[brand] several brands exist (${available.join(', ')}) and none is the default — ` +
      'set BRAND=<slug>, or add {"brand":{"default":"<slug>"}} to package.json',
  );
}

/**
 * Substitute every `%brand:path%` in `html`.
 *
 * EVERY FAILURE IS COLLECTED AND REPORTED AT ONCE, with its line number in
 * index.html. Throwing on the first one turns a re-skin into N build attempts,
 * each of which costs a full config resolve to learn one more missing key, and
 * that is the kind of loop people escape by deleting the placeholder rather
 * than by fixing the brand.
 *
 * A `computed` value fails just as hard as a missing one: index.html is
 * substituted before any code runs, so it can only take a literal, and
 * emitting the raw source text instead would put `1143 / 333` in an attribute.
 */
export function substitute(html, values, { slug, entry }) {
  const unresolved = [];

  // One pass over the document, tracking whether we are inside a raw-text
  // element. `<style>`/`<script>` do not decode entities, so a value escaped
  // into one is a value corrupted — see escapeHtml.
  const SCAN = /<\s*(style|script)\b[^>]*>|<\s*\/\s*(style|script)\s*>|%brand:([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\s*\d+\s*\])*)%/gi;

  let rawTag = null;
  let out = '';
  let last = 0;
  let m;

  while ((m = SCAN.exec(html)) !== null) {
    const [whole, open, close, path] = m;

    if (open) {
      // Nested opens are impossible in valid HTML; ignore one inside raw text
      // rather than mis-tracking depth on a `<script>` written in a string.
      if (!rawTag) rawTag = open.toLowerCase();
      continue;
    }
    if (close) {
      if (rawTag === close.toLowerCase()) rawTag = null;
      continue;
    }

    const line = html.slice(0, m.index).split('\n').length;
    const hit = resolvePath(values, path);

    let replacement;
    if (!hit) {
      unresolved.push({ path, line, why: `${entry} defines no \`${path}\`` });
      replacement = whole;
    } else if (hit.kind === 'computed') {
      unresolved.push({
        path,
        line,
        why:
          `\`${path}\` is computed (${hit.value}) — index.html is substituted before any ` +
          'code runs, so it can only take a literal',
      });
      replacement = whole;
    } else if (rawTag) {
      assertRawTextSafe(hit.value, path, rawTag);
      replacement = String(hit.value);
    } else {
      replacement = escapeHtml(hit.value);
    }

    out += html.slice(last, m.index) + replacement;
    last = m.index + whole.length;
  }
  out += html.slice(last);

  if (unresolved.length > 0) {
    const detail = unresolved
      .map((u) => `    index.html:${u.line}  %brand:${u.path}%  — ${u.why}`)
      .join('\n');
    throw new Error(
      `[brand] ${unresolved.length} placeholder(s) in index.html could not be resolved ` +
        `against brand "${slug}":\n${detail}\n` +
        '  Every value index.html paints before JS runs must exist in the brand module as a literal.',
    );
  }
  return out;
}

/** @returns {import('vite').Plugin} */
export default function brand() {
  let root = process.cwd();
  let slug = null;
  let entryAbs = null;
  let values = null;
  let isDev = false;

  const load = () => {
    entryAbs = join(root, 'brands', slug, 'brand.ts');
    values = readBrand(entryAbs).values;
  };

  return {
    name: 'brand',
    // 'pre' so the alias exists before any other plugin tries to resolve
    // `@brand`, and so `publicDir` is settled before the asset pipeline starts.
    enforce: 'pre',

    config(userConfig, env) {
      root = resolve(userConfig.root ?? process.cwd());
      isDev = env.command === 'serve';
      slug = resolveBrand(root);
      load();

      return {
        // THERE IS NO SHARED public/ DIRECTORY, and that is deliberate rather
        // than an omission. A shared one is how the previous brand's favicon
        // ships inside the new brand's bundle: it resolves, it renders, nothing
        // errors, and nobody notices until somebody bookmarks the page.
        publicDir: join(root, 'brands', slug, 'public'),
        resolve: {
          alias: {
            '@brand': join(root, 'brands', slug, 'brand.ts'),
          },
        },
        define: {
          // For source that wants to know — a debug overlay, a storage key
          // prefix. Not the mechanism for anything user-visible; that comes
          // from the module itself.
          __BRAND_SLUG__: JSON.stringify(slug),
        },
        // Switching brands retargets the alias, so the previous brand's
        // pre-bundled graph is stale. Cheap here: no runtime dependencies.
        optimizeDeps: isDev ? { force: true } : undefined,
      };
    },

    configResolved() {
      // eslint-disable-next-line no-console
      console.log(`[brand] ${slug}`);
    },

    /**
     * `order: 'pre'` so substitution happens before Vite injects its own script
     * and link tags. Those carry no placeholders, but running first keeps the
     * reported line numbers matching the file on disk — an error that points at
     * the wrong line is worse than one that points nowhere.
     */
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // Re-read on every transform in dev so editing brand.ts takes effect
        // without a restart; parsing a ~300-line module is microseconds. In
        // build the module cannot change under us, so the config-time read
        // stands and the file is opened exactly once.
        if (isDev) load();
        return substitute(html, values, { slug, entry: `brands/${slug}/brand.ts` });
      },
    },

    /**
     * Editing anything under brands/ reloads the page. Full reload rather than
     * HMR because a brand edit can change the favicon, the <title> and the
     * theme colour, none of which any module boundary owns.
     */
    configureServer(server) {
      const brandsDir = join(root, 'brands');
      server.watcher.add(brandsDir);
      const onChange = (file) => {
        if (file.startsWith(brandsDir)) server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}
