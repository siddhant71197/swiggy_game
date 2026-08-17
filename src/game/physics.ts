/**
 * ══════════════════════════════════════════════════════════════════════════
 *  PHYSICS — one body model, so the agent and the barrels cannot disagree.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): TUNNELLING BY LUCK. A barrel at terminal
 * velocity moves 15 units per 1/60s step, which is the entire thickness of the
 * girder it is supposed to land on. A landing test that asks "am I inside the
 * floor now?" answers no for the frame before and no for the frame after, and
 * the barrel falls through — sometimes. Whether it happens depends on where the
 * body's y happened to be when the fall started, which means it reproduces once
 * in twenty runs and never for the person trying to fix it. The swept test uses
 * `px,py` and asks whether the SEGMENT of travel crossed the surface, which has
 * no such dependency: at any speed, at any dt, either you crossed or you did not.
 *
 * THE FAILURE THIS FILE PREVENTS (2): TWO PHYSICS. Barrels and the agent both
 * land on sloped girders, both ride belts, both fall off open ends. Written
 * twice, they diverge — the barrel gets the landEps fix and the agent does not,
 * or the belt is applied before movement in one and after in the other, and a
 * player standing beside a barrel on a conveyor watches them move at different
 * speeds. One model, two callers.
 *
 * ─── THERE IS NO CEILING COLLISION. AT ALL. ────────────────────────────────
 *
 * Deliberate, and it is the original game's rule. You rise THROUGH girders: the
 * landing test skips entirely while `vy < 0`. Adding head collision buys exactly
 * one thing — a jump that stops short under an overhang — and costs a category
 * of bug that has no good answer: a body that jumps into the underside of a
 * sloped segment has to be pushed somewhere, and every choice (push down, push
 * along, zero the velocity) produces a different wrong result depending on which
 * way the floor above happens to tilt. The floors in this game are 78+ units
 * apart against a 65-unit apex, so a ceiling would never fire in normal play and
 * would only ever be hit by a body that is already somewhere it should not be.
 * If you are here because "the agent goes through the floor above" — that is the
 * design. Do not add it.
 *
 * No DOM, no clock, no unseeded randomness. tools/ runs this under bare Node.
 */

import { CLIMB, PHYS } from '../config/tuning';
import { approach } from '../core/math';
import type { Body } from '../core/types';
import {
  girderAt,
  girdersNear,
  laddersNear,
  surfaceYAt,
  type Ladder,
  type Stage,
} from './stage';

// ─── Bodies ─────────────────────────────────────────────────────────────────

/**
 * A body with every field assigned. See core/pool.ts rule 1 — a struct born
 * with a missing field gets a second hidden class the first time it is filled
 * in, and the pool's whole reason for existing evaporates.
 */
export function makeBody(x: number, y: number, halfW: number, fullH: number): Body {
  return { x, y, vx: 0, vy: 0, px: x, py: y, w: halfW, h: fullH, grounded: false, segId: -1 };
}

/**
 * Latch the previous position. MUST run before anything moves the body, and
 * exactly once per step — call it twice and the swept landing test compares a
 * position against itself and degenerates into the point test this file exists
 * to avoid.
 */
export function beginStep(b: Body): void {
  b.px = b.x;
  b.py = b.y;
}

export function applyGravity(b: Body, g: number, dt: number): void {
  b.vy += g * dt;
  // Terminal velocity is a READABILITY constraint before it is a physics one:
  // past this a falling body crosses most of the stage in a few frames and the
  // player cannot track where it went.
  if (b.vy > PHYS.maxFallSpeed) b.vy = PHYS.maxFallSpeed;
}

// ─── Ground ─────────────────────────────────────────────────────────────────

/**
 * The swept one-way landing test. Returns the girder id landed on, or -1.
 *
 * Two conditions, and both matter:
 *
 *   `vy < 0` → no test at all. This is the one-way part: you rise through
 *   girders. See the header on ceilings.
 *
 *   `py <= sy + landEps && y >= sy` → the PREVIOUS feet were at or above the
 *   surface and the CURRENT feet are at or below it, i.e. the travel crossed
 *   the line. `landEps` forgives a body that was already resting a hair inside
 *   the surface from the previous frame's snap.
 *
 * Among all crossed candidates the HIGHEST surface wins — that is the first one
 * the body would have met on the way down, and it is why two overlapping girders
 * do not fight over a falling body.
 */
export function landSwept(stage: Stage, b: Body): number {
  if (b.vy < 0) return -1;

  const ids = girdersNear(stage, b.x);
  let bestId = -1;
  let bestY = 0;

  for (let i = 0; i < ids.length; i++) {
    const g = stage.girders[ids[i]!]!;
    const sy = surfaceYAt(g, b.x);
    // NaN loses both comparisons, so an x off the end of this segment is simply
    // not a candidate. No range check, no edge case. See stage.ts.
    if (!(b.py <= sy + PHYS.landEps && b.y >= sy)) continue;
    if (bestId === -1 || sy < bestY) {
      bestId = g.id;
      bestY = sy;
    }
  }

  if (bestId === -1) return -1;

  b.y = bestY;
  b.vy = 0;
  b.grounded = true;
  b.segId = bestId;
  return bestId;
}

/**
 * CONVEYOR PUSH, applied to a grounded body BEFORE its own movement.
 *
 * Order is the whole content of this function. Belt-then-move means the belt
 * carries you and your own input is added on top, which is what a conveyor is.
 * Move-then-belt means the belt overrides the frame's input at the end of the
 * step, and a player running against the belt visibly stutters — they move, then
 * get shoved back, sixty times a second.
 */
export function applyBelt(stage: Stage, b: Body, speed: number, dt: number): void {
  if (!b.grounded) return;
  const g = stage.girders[b.segId];
  if (!g || g.belt === 0) return;
  b.x += g.belt * speed * dt;
}

/**
 * Stop a grounded body at a SOLID end. Open ends are not this function's
 * business — walking off one is handled by `walkSurface` returning the body to
 * the air, which is the same code path as any other fall.
 */
export function clampSolidEnds(stage: Stage, b: Body): void {
  const g = stage.girders[b.segId];
  if (!g) return;
  if (g.solidLeft && b.x - b.w < g.x0) {
    b.x = g.x0 + b.w;
    if (b.vx < 0) b.vx = 0;
  }
  if (g.solidRight && b.x + b.w > g.x1) {
    b.x = g.x1 - b.w;
    if (b.vx > 0) b.vx = 0;
  }
}

/**
 * SLOPE WALKING. Move horizontally at a CONSTANT speed, then re-snap the feet
 * to the surface. Returns true if still grounded.
 *
 * Constant HORIZONTAL speed, not constant speed along the surface. A body that
 * conserved arc length would visibly slow down going uphill and speed up going
 * downhill, on a 1-in-12 slope, which reads as the controls being sticky on
 * half the floors. The player is not moving along a hill; they are moving across
 * a screen, and the screen is what they are aiming with.
 *
 * The snap is abandoned in two cases, and they are the same case as far as the
 * caller is concerned — the body becomes airborne:
 *
 *   surfaceYAt returns NaN → walked off an open end. Free fall, with no
 *   "am I at the edge" test living anywhere in this codebase.
 *
 *   the step exceeds `maxSnap` → the surface moved further than a foot can
 *   reach in one frame, which means the body left this segment for a genuine
 *   discontinuity rather than a slope.
 */
export function walkSurface(stage: Stage, b: Body, dt: number): boolean {
  b.x += b.vx * dt;

  const g = stage.girders[b.segId];
  if (!g) {
    b.grounded = false;
    b.segId = -1;
    return false;
  }

  clampSolidEnds(stage, b);

  const sy = surfaceYAt(g, b.x);
  if (!(Math.abs(sy - b.y) <= PHYS.maxSnap)) {
    b.grounded = false;
    b.segId = -1;
    return false;
  }

  b.y = sy;
  return true;
}

/** Ballistic step: gravity, integrate, then the swept landing test. */
export function airStep(stage: Stage, b: Body, gravity: number, dt: number): number {
  applyGravity(b, gravity, dt);
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  return landSwept(stage, b);
}

/** Horizontal steering while airborne. See the note on the constant used. */
export function airSteer(b: Body, targetVx: number, dt: number): void {
  // Air authority is expressed as a FRACTION OF GRAVITY rather than as its own
  // number. There is exactly one other acceleration in this game; deriving from
  // it means a heavier-feeling retune of gravity carries the air feel with it,
  // instead of leaving a stale air-accel constant that nobody remembers exists.
  b.vx = approach(b.vx, targetVx, PHYS.gravity * PHYS.airControl * dt);
}

// ─── Ladders ────────────────────────────────────────────────────────────────

/**
 * THE RAKHI GATE LIVES HERE AND NOWHERE ELSE.
 *
 * A gated ladder refuses the attach until the sweep is done. That is the entire
 * mechanism: one condition, in one function, on the one path that can put a body
 * onto a rail. The renderer draws a locked ladder because it reads `gated`; it
 * does NOT re-derive whether the climb is allowed, and neither does the HUD, the
 * bot, or the scene. IF THE GATE IS EVER WRONG — open when it should be shut, or
 * shut after the last rakhi — THERE IS EXACTLY ONE PLACE TO LOOK, AND IT IS THIS
 * LINE. Duplicating the check anywhere else is how a game ships with a gate that
 * looks locked and is not.
 *
 * Returns a ladder id, or -1.
 */
export function findGrab(
  stage: Stage,
  b: Body,
  wantUp: boolean,
  wantDown: boolean,
  gateUnlocked: boolean,
): number {
  if (!wantUp && !wantDown) return -1;

  const ids = laddersNear(stage, b.x);
  let best = -1;
  let bestDx: number = CLIMB.grabX;

  for (let i = 0; i < ids.length; i++) {
    const l = stage.ladders[ids[i]!]!;

    // ── THE GATE. One condition. One place. ──────────────────────────────
    if (l.gated && !gateUnlocked) continue;

    const dx = Math.abs(l.x - b.x);
    if (dx > bestDx) continue;

    // UP grabs a rail that continues above the feet. DOWN grabs a rail whose
    // TOP is the floor being stood on — the two are separate tests because
    // standing at a ladder's top and standing at its bottom are the same x and
    // must not both accept the same press.
    const canUp = wantUp && b.y > l.yTop + CLIMB.mountY && b.y <= l.yBottom + CLIMB.mountY;
    const canDown = wantDown && Math.abs(b.y - l.yTop) <= CLIMB.mountY && l.yBottom > b.y;
    if (!canUp && !canDown) continue;

    bestDx = dx;
    best = l.id;
  }

  return best;
}

/** The auto-snap onto the rail, as a distance for this step. */
export function snapToRail(b: Body, l: Ladder, dt: number): void {
  // Rate is "the full grab tolerance in snapSec", so the snap always takes the
  // same time regardless of how far off-centre the grab was — a snap whose
  // duration varied with the error reads as the game hesitating.
  b.x = approach(b.x, l.x, (CLIMB.grabX / CLIMB.snapSec) * dt);
}

/**
 * Move along a rail. `dirY` is -1 up, +1 down, 0 hold.
 *
 * A BROKEN LADDER'S GAP IS A WALL APPROACHED FROM EITHER SIDE, and the clamp is
 * written against the body's position BEFORE the move rather than against which
 * direction it is travelling. Using direction would let a body that is somehow
 * already inside the gap — a spawn, a level edit, a rounding wobble — climb out
 * through the wrong end and then be stuck on the far side of it.
 */
export function climbMove(b: Body, l: Ladder, dirY: number, dt: number): void {
  const from = b.y;
  let y = from + dirY * CLIMB.speed * dt;

  if (l.hasGap) {
    if (from >= l.gapBottom && y < l.gapBottom) y = l.gapBottom;
    else if (from <= l.gapTop && y > l.gapTop) y = l.gapTop;
  }

  if (y < l.yTop) y = l.yTop;
  if (y > l.yBottom) y = l.yBottom;

  b.y = y;
  b.vx = 0;
  b.vy = 0;
}

/**
 * The girder to step off onto at a rail end, or -1.
 *
 * `dismountY` is deliberately tighter than `mountY`: a generous MOUNT rescues a
 * player who missed; a generous DISMOUNT drops them onto a floor they were not
 * aiming at.
 */
export function dismountGirder(stage: Stage, x: number, y: number): number {
  return girderAt(stage, x, y, CLIMB.dismountY);
}
