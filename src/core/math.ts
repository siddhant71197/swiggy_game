/**
 * ══════════════════════════════════════════════════════════════════════════
 *  MATH — the arithmetic the frame loop is allowed to run.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: the helper that returns a fresh object.
 * `{ x, y }` or `[x, y]` out of a per-frame utility is sixty allocations a
 * second per call site, and the symptom is never a leak — it is a minor GC every
 * few seconds landing as one dropped frame, which on this game means one missed
 * jump. Nothing in this file returns an object, an array, or a closure. Overlap
 * tests answer a boolean and callers read the entities they already hold.
 *
 * Everything here is pure and total: no unseeded randomness, no clock, no DOM.
 * That is what lets tools/ import the real engine and play every level headless
 * under bare Node, which is how difficulty gets measured before it ships rather
 * than after.
 */

/** One turn in radians. Named so `angle % TAU` never reads as a magic 6.283. */
export const TAU = Math.PI * 2;

// ─── Scalars ────────────────────────────────────────────────────────────────

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Move `cur` toward `target` by at most `maxDelta`, never overshooting.
 *
 * `maxDelta` is a DISTANCE, not a rate — the caller multiplies by dt. That is
 * the whole point: the tempting form is `cur += (target - cur) * 0.15`, which is
 * frame-rate dependent, so acceleration would settle faster on a 90Hz phone than
 * a 60Hz one and every feel-tuned constant in the game would mean something
 * different per device. Making the caller pass an already-dt-scaled step means
 * the dt is visible at the call site instead of hidden in here.
 *
 * Snapping exactly to `target` inside the deadband matters: an asymptotic
 * approach leaves a body with a residual 0.0001 velocity forever, and "grounded
 * and not moving" then never becomes true.
 */
export function approach(cur: number, target: number, maxDelta: number): number {
  const d = target - cur;
  if (d > maxDelta) return cur + maxDelta;
  if (d < -maxDelta) return cur - maxDelta;
  return target;
}

/**
 * -1, 0 or 1. Returns 0 for exactly zero AND for NaN.
 *
 * `Math.sign` returns NaN for NaN, and a NaN direction propagates into a
 * position, which propagates into a draw call, and the entity silently vanishes
 * with nothing in the console. Folding NaN to 0 makes that a stationary body — a
 * visible bug that someone reports — instead of an invisible one.
 */
export function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

// ─── Overlap ────────────────────────────────────────────────────────────────

/**
 * Axis-aligned rectangle overlap. Both rects are (left, top, width, height).
 *
 * TOP-LEFT, not feet-centre. This is a geometry primitive with no knowledge of
 * the Body contract, and callers convert once at the call site — `b.x - b.w`,
 * `b.y - b.h` — where the conversion is visible. A primitive that quietly
 * assumed the game's anchor convention would be unusable for the UI hit tests
 * and the camera cull, which is most of its uses.
 *
 * Touching edges do NOT count as overlap. Strict comparison is what lets a body
 * stand exactly on a girder's end without registering as inside the wall beyond
 * it, which would push it out by a pixel every step.
 */
export function aabb(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Circle against an axis-aligned rectangle, (left, top, width, height).
 *
 * Barrels are circles and everything they hit is a box, so this is the hot
 * hazard test. It is the closest-point method: clamp the centre into the rect,
 * compare the squared distance. Squared, never `Math.sqrt` — a square root per
 * barrel per step buys nothing, because the only question asked is "closer than
 * r", and that comparison survives squaring both sides intact.
 *
 * A centre INSIDE the rect clamps to itself, giving distance 0, which is
 * correctly an overlap. That degenerate case is the one a naive
 * edge-distance implementation gets wrong, and it is exactly what happens when a
 * barrel spawns on top of the agent.
 */
export function circleVsRect(
  cx: number, cy: number, r: number,
  rx: number, ry: number, rw: number, rh: number,
): boolean {
  const nx = cx < rx ? rx : cx > rx + rw ? rx + rw : cx;
  const ny = cy < ry ? ry : cy > ry + rh ? ry + rh : cy;
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
