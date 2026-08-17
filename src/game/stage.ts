/**
 * ══════════════════════════════════════════════════════════════════════════
 *  STAGE — authored geometry becomes queryable geometry, exactly once.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): the per-frame linear scan. A ground query
 * is "what surface is under this x", and the obvious implementation walks all
 * ~40 girders for every one of up to 25 bodies, every step. That is a thousand
 * segment tests a frame to answer a question whose answer is two candidates. It
 * never shows up in review and it is the frame budget's largest single line on a
 * mid-range phone. Bucketing by x column is twelve lines and makes it free.
 *
 * THE FAILURE THIS FILE PREVENTS (2): the un-normalised segment. A girder
 * authored right-to-left has a negated slope, which reverses the barrel sweep on
 * that floor, which silently turns a designed level into a different one that
 * still looks correct in a screenshot. Normalising here — once, at load — means
 * no consumer downstream ever has to ask which end is which.
 *
 * ─── surfaceYAt RETURNS NaN, AND THAT IS THE POINT ─────────────────────────
 *
 * Off the end of a segment there is no surface, and this function says so with
 * NaN rather than with a clamp or a boolean out-param. Everything downstream
 * gets its edge handling for free:
 *
 *   walking:  the snap fails → the body is airborne. That IS walking off a ledge.
 *   landing:  the candidate is skipped. That IS falling past an open end.
 *   barrels:  the roll ends → the barrel falls. That IS the serpentine.
 *
 * A clamped version of this function would need an "am I at the edge?" test at
 * every one of those call sites, each written slightly differently, and the one
 * that gets it wrong produces a body that hovers off the end of a girder. NaN
 * propagates through comparisons as `false`, which is precisely the answer every
 * caller wants, so there is no edge case anywhere in the codebase.
 *
 * No DOM, no clock, no unseeded randomness — this module is imported by the
 * headless bot in tools/ under bare Node.
 */

import type { GirderDef, LadderDef, StageDef } from '../config/levels';
import { STAGE } from '../config/tuning';
import { clamp } from '../core/math';
import type { Girder } from '../core/types';

// ─── Runtime types ──────────────────────────────────────────────────────────

/**
 * A ladder rail, resolved.
 *
 * `hasGap` is a flat boolean beside two always-present numbers rather than an
 * optional object, because this is read inside the climb integration: an
 * optional field there is a hidden-class change between a broken ladder and a
 * whole one, and a branch on `undefined` instead of on a boolean. Same reason
 * core/pool.ts insists a factory assign every field.
 */
export interface Ladder {
  id: number;
  x: number;
  /** The SMALLER y. Screen space: up is less. */
  yTop: number;
  yBottom: number;

  /** A stretch of missing rungs. Meaningless unless `hasGap`. */
  hasGap: boolean;
  gapTop: number;
  gapBottom: number;

  /** The rakhi gate. See the single condition in game/physics.ts. */
  gated: boolean;
}

export interface Stage {
  w: number;
  h: number;

  girders: Girder[];
  ladders: Ladder[];

  /** Width of one column slab. `w / STAGE.buckets`. */
  bucketW: number;
  /** Girder ids overlapping each column slab. */
  girderBuckets: number[][];
  /** Ladder ids overlapping each column slab (widened by the grab tolerance). */
  ladderBuckets: number[][];

  /**
   * Index of the first LIFT SCRATCH GIRDER, or -1 when the level has no cars.
   *
   * ─── WHY A LIFT IS A GIRDER THAT MOVES ───────────────────────────────────
   *
   * A lift car is a surface you stand on, land on, walk along, ride and fall off
   * — which is the complete list of things a girder already is. Given its own
   * entity it would need its own landing test, its own walk, its own belt
   * interaction and its own barrel handling, and those four copies are exactly
   * the "two physics" that game/physics.ts exists to refuse: the swept-landing
   * fix lands in one of them and players report that jumps feel wrong on the
   * lift levels.
   *
   * So game/hazards.ts REWRITES one girder per car, in place, every step. The
   * ground code never learns lifts exist. The cost is one frame of lag between
   * the car's authoritative y and the surface bodies stand on — at 50 units/sec
   * that is 0.8 units, which is under a tenth of PHYS.maxSnap and invisible.
   *
   * These slots are appended AFTER the authored floors so `def.girders[i]` and
   * `stage.girders[i]` stay index-identical for every authored floor, which is
   * what lets tools/validate-levels.ts reason about the authored table.
   */
  liftBase: number;

  /** The row this stage was built from. Read-only to the sim. */
  def: StageDef;
}

/**
 * Returned when a query lands outside every bucket. A shared frozen empty array
 * rather than a fresh `[]`: a miss is common (a body falling past the edge of
 * the world) and one allocation per miss per frame is exactly the per-frame
 * garbage core/math.ts exists to refuse.
 */
const NONE: number[] = [];

// ─── Build ──────────────────────────────────────────────────────────────────

export function buildStage(def: StageDef): Stage {
  const girders: Girder[] = [];
  for (let i = 0; i < def.girders.length; i++) {
    girders.push(normaliseGirder(def.girders[i]!, i));
  }

  // ── The lift scratch slots. See `liftBase` on why these are girders. ──────
  // Born at the BOTTOM of their travel and given the tower's own 1/12 slope, so
  // a barrel that lands on a car rolls off it instead of parking there forever —
  // a flat car is a pool slot leaked for the rest of the level.
  const liftDefs = def.lifts ?? [];
  const liftBase = liftDefs.length > 0 ? girders.length : -1;
  for (const lf of liftDefs) {
    const half = lf.w;
    const drop = half / 12;
    girders.push({
      id: girders.length,
      x0: lf.x - half,
      y0: lf.yBottom - drop,
      x1: lf.x + half,
      y1: lf.yBottom + drop,
      slope: 1 / 12,
      belt: 0,
      solidLeft: false,
      solidRight: false,
    });
  }

  const ladders: Ladder[] = [];
  for (let i = 0; i < def.ladders.length; i++) {
    ladders.push(normaliseLadder(def.ladders[i]!, i));
  }

  const n = STAGE.buckets;
  const bucketW = STAGE.W / n;

  const girderBuckets: number[][] = new Array(n);
  const ladderBuckets: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    girderBuckets[i] = [];
    ladderBuckets[i] = [];
  }

  for (const g of girders) {
    const lo = bucketIndex(g.x0, bucketW, n);
    const hi = bucketIndex(g.x1, bucketW, n);
    for (let i = lo; i <= hi; i++) girderBuckets[i]!.push(g.id);
  }

  for (const l of ladders) {
    // Widened by the grab tolerance so a body standing just outside a ladder's
    // slab still finds it. Without the widening, a grab fails only for players
    // approaching from one specific side — the worst kind of bug, because it
    // reproduces for one tester and not the other.
    const lo = bucketIndex(l.x - grabPad(), bucketW, n);
    const hi = bucketIndex(l.x + grabPad(), bucketW, n);
    for (let i = lo; i <= hi; i++) ladderBuckets[i]!.push(l.id);
  }

  return {
    w: STAGE.W,
    h: STAGE.H,
    girders,
    ladders,
    bucketW,
    girderBuckets,
    ladderBuckets,
    liftBase,
    def,
  };
}

/**
 * Imported lazily-by-value rather than at module scope purely to keep this file
 * from depending on CLIMB for one number; the bucket pad only has to be at
 * least the grab tolerance, and being generous costs one extra candidate.
 */
function grabPad(): number {
  return STAGE.W / STAGE.buckets;
}

function normaliseGirder(d: GirderDef, id: number): Girder {
  // x1 > x0 ALWAYS. Swapping the ENDS swaps the wall flags with them, which is
  // the half of the normalisation that is easy to forget: a floor authored
  // right-to-left with a wall on its left would otherwise come out walled on
  // the right, and the level would play mirrored on that floor only.
  const flip = d.x1 < d.x0;
  const x0 = flip ? d.x1 : d.x0;
  const y0 = flip ? d.y1 : d.y0;
  const x1 = flip ? d.x0 : d.x1;
  const y1 = flip ? d.y0 : d.y1;
  const wallL = flip ? d.wallR : d.wallL;
  const wallR = flip ? d.wallL : d.wallR;

  const dx = x1 - x0;
  return {
    id,
    x0,
    y0,
    x1,
    y1,
    // Guarded against a zero-width girder: a NaN slope would poison every body
    // that ever stood on it, and the resulting entity vanishes with no error.
    slope: dx !== 0 ? (y1 - y0) / dx : 0,
    belt: d.belt ?? 0,
    solidLeft: wallL === true,
    solidRight: wallR === true,
  };
}

function normaliseLadder(d: LadderDef, id: number): Ladder {
  const yTop = Math.min(d.yTop, d.yBottom);
  const yBottom = Math.max(d.yTop, d.yBottom);
  const gap = d.gap;
  return {
    id,
    x: d.x,
    yTop,
    yBottom,
    hasGap: gap !== undefined,
    gapTop: gap ? Math.min(gap.top, gap.bottom) : 0,
    gapBottom: gap ? Math.max(gap.top, gap.bottom) : 0,
    gated: d.gated === true,
  };
}

function bucketIndex(x: number, bucketW: number, n: number): number {
  return clamp(Math.floor(x / bucketW), 0, n - 1);
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * The surface height of `g` at `x`, or NaN when x is off the segment.
 *
 * One multiply-add. See the header for why the NaN is load-bearing and must not
 * be "fixed" into a clamp.
 */
export function surfaceYAt(g: Girder, x: number): number {
  if (x < g.x0 || x > g.x1) return NaN;
  return g.y0 + g.slope * (x - g.x0);
}

/** Girder ids that could possibly be under `x`. Allocates nothing. */
export function girdersNear(stage: Stage, x: number): readonly number[] {
  const i = Math.floor(x / stage.bucketW);
  if (i < 0 || i >= stage.girderBuckets.length) return NONE;
  return stage.girderBuckets[i] ?? NONE;
}

/** Ladder ids near `x`, already padded by the grab tolerance. */
export function laddersNear(stage: Stage, x: number): readonly number[] {
  const i = Math.floor(x / stage.bucketW);
  if (i < 0 || i >= stage.ladderBuckets.length) return NONE;
  return stage.ladderBuckets[i] ?? NONE;
}

/**
 * The girder whose surface at `x` sits within `tol` of `y`, or -1.
 *
 * Used for mounting and dismounting ladders and for putting a descended barrel
 * back on a floor. Picks the CLOSEST match rather than the first, because two
 * girders can legally overlap in x and picking the first would hand a body to
 * whichever one happened to be authored earlier.
 */
export function girderAt(stage: Stage, x: number, y: number, tol: number): number {
  const ids = girdersNear(stage, x);
  let best = -1;
  let bestD = tol;
  for (let i = 0; i < ids.length; i++) {
    const g = stage.girders[ids[i]!]!;
    const sy = surfaceYAt(g, x);
    // NaN fails this comparison, which is exactly the "not on this segment"
    // answer — no separate range check.
    const d = Math.abs(sy - y);
    if (d <= bestD) {
      bestD = d;
      best = g.id;
    }
  }
  return best;
}
