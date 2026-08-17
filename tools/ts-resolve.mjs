/**
 * ══════════════════════════════════════════════════════════════════════════
 *  TS-RESOLVE — the loader hook that lets bare Node import the real engine.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: a SECOND COPY OF THE GAME, living in tools/.
 *
 * src/ is written the way a bundler wants it — extensionless relative imports
 * (`'./stage'`, `'../config/tuning'`). Node's ESM resolver does not do that; it
 * wants a real file path. Without a resolver hook, `node tools/simulate.ts`
 * cannot load src/game/world.ts, and the only way to have a headless bot at all
 * is to reimplement the physics inside tools/ — at which point the bot measures
 * the difficulty of a game nobody ships, every fix has to be made twice, and the
 * first time somebody forgets, the numbers in the difficulty report become
 * confidently wrong. Twenty lines here instead of a parallel engine forever.
 *
 * It does exactly two things and must never grow a third:
 *
 *   1. Append `.ts` to an extensionless relative specifier, falling back to
 *      `/index.ts` for a directory import.
 *   2. Nothing else. No transform, no aliasing beyond `@brand` (which the
 *      bundler rewrites at build time and which the sim never imports anyway —
 *      it is mapped only so an accidental import fails loudly with a real path
 *      rather than with an opaque resolver error).
 *
 * Type stripping itself is Node's, via --experimental-strip-types. This hook
 * only answers "which file", never "what does it mean".
 */

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@brand') {
    return nextResolve(pathToFileURL(resolvePath(ROOT, 'brands/swiggy/brand.ts')).href, context);
  }

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : ROOT;
    const base = resolvePath(dirname(parentPath), specifier);

    // Only fill in a MISSING extension. A specifier that already names a file is
    // left completely alone, so this hook can never shadow a real path.
    if (!/\.[cm]?[jt]s$/.test(base)) {
      for (const candidate of [`${base}.ts`, `${base}/index.ts`, `${base}.js`]) {
        if (existsSync(candidate)) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }
  }

  return nextResolve(specifier, context);
}
