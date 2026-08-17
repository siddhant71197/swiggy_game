import type { SaveData } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  STORAGE — a save file that can never be the reason the game does not start.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS PREVENTS: the corrupt store that bricks the game. Every one
 * of these is real and none of them are hypothetical — Safari in private mode
 * makes `localStorage.getItem` THROW rather than return null; a quota-full
 * origin throws on write; a sandboxed iframe throws on the property access
 * itself, before any method is called; a tab killed mid-`setItem` leaves a
 * half-written value that parses to nonsense; and an older build's save has
 * fields this one does not expect.
 *
 * In every one of those cases the correct behaviour is identical: shrug, hand
 * back a COMPLETE valid default, and let the player play. There is no
 * user-visible failure mode here, because a lost best score is an annoyance and
 * a black screen on boot is a game that looks broken to whoever is reviewing it
 * — and private mode is exactly how a reviewer opens a link they were sent.
 *
 * So `loadGame` never returns a partial object. Every field is read through a
 * coercing helper that supplies a default for anything missing or of the wrong
 * type: a `highScore` of `"420"` from a hand-edited store must not reach the
 * results screen as a string and render as `420undefined`.
 *
 * ─── THE KEY IS PASSED IN, NOT IMPORTED ────────────────────────────────────
 * This file does not import src/brand/. The save key carries the brand slug (two
 * brands built from this template must never share a save slot on a device that
 * has played both), and src/main.ts passes SAVE_KEY down. That keeps core/ free
 * of any brand dependency, which is what lets tools/ construct a save for a
 * brand it has never heard of.
 *
 * ─── THE OTHER EXCEPTION TO THE core/ DOM BAN ──────────────────────────────
 * Nothing in src/core/ or src/game/ may reference `document`, `window`,
 * `navigator`, `performance`, `Date` or `Math.random` — a build gate greps for
 * exactly those. THIS FILE IS EXPLICITLY EXCLUDED FROM THAT GATE, for
 * `localStorage` only, and every access to it is guarded, so importing this
 * module under bare Node degrades to defaults rather than crashing at import
 * time. src/core/loop.ts is the only other exclusion.
 */

/**
 * Bump this and every existing save is discarded rather than migrated.
 *
 * Migration code for a file holding three numbers, two booleans and an array is
 * more lines than it can ever be worth, and each migration is a branch that runs
 * on approximately nobody's device and is therefore never tested. Losing a best
 * score at a version change is the cheaper mistake.
 */
const VERSION = 1;

/**
 * Cap on `levelBest`. A hand-edited or corrupt store claiming a 100,000-element
 * array must not become a 100,000-element allocation on the boot path.
 */
const MAX_LEVELS = 64;

export function defaults(): SaveData {
  return {
    version: VERSION,
    bestLevel: 0,
    highScore: 0,
    seenRules: false,
    muted: false,
    levelBest: [],
  };
}

/** Non-negative integer or the fallback. Rejects NaN, Infinity, strings, null. */
function int(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  const n = Math.round(v);
  return n < 0 ? fallback : n;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/**
 * Rebuilt element by element rather than cast. A stored array can be sparse, can
 * hold strings, and can be any length; every one of those reaches the results
 * screen as a rendered value, so each slot is coerced individually and holes
 * become 0 rather than `undefined`.
 */
function intArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const n = v.length < MAX_LEVELS ? v.length : MAX_LEVELS;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = int(v[i], 0);
  return out;
}

/** Returns a COMPLETE valid SaveData on any failure whatsoever. */
export function loadGame(key: string): SaveData {
  const base = defaults();

  let raw: string | null = null;
  try {
    // `typeof localStorage` is inside the try as well: in a sandboxed iframe the
    // property ACCESS throws, before any method call, so a bare typeof guard
    // outside the try is not enough.
    if (typeof localStorage === 'undefined') return base;
    raw = localStorage.getItem(key);
  } catch {
    // Private mode, disabled storage, sandboxed iframe. Nothing to recover.
    return base;
  }
  if (!raw) return base;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }
  if (typeof parsed !== 'object' || parsed === null) return base;

  const d = parsed as Record<string, unknown>;
  // Wrong version is treated exactly like corruption: fresh defaults, no
  // partial salvage. Salvaging "the fields that look fine" is how a save from a
  // build with different semantics survives into one where those numbers mean
  // something else.
  if (int(d['version'], -1) !== VERSION) return base;

  return {
    version: VERSION,
    bestLevel: int(d['bestLevel'], base.bestLevel),
    highScore: int(d['highScore'], base.highScore),
    seenRules: bool(d['seenRules'], base.seenRules),
    muted: bool(d['muted'], base.muted),
    levelBest: intArray(d['levelBest']),
  };
}

export function saveGame(key: string, data: SaveData): void {
  try {
    if (typeof localStorage === 'undefined') return;
    // `version` is written from the constant, never from the object handed in,
    // so a caller holding a SaveData it loaded from an older build cannot write
    // that stale version number back and resurrect the mismatch next boot.
    localStorage.setItem(key, JSON.stringify({ ...data, version: VERSION }));
  } catch {
    /* Persistence is a nicety. Failing to write is never worth interrupting a
       round, and there is nothing useful to tell the player about it. */
  }
}
