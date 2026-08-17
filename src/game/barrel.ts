/**
 * ══════════════════════════════════════════════════════════════════════════
 *  BARREL — the hazard, with no per-floor logic in it anywhere.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): THE PER-FLOOR SPECIAL CASE. The tower's
 * signature behaviour is that barrels sweep right on one floor and left on the
 * next. The obvious implementation is a direction stored on the barrel and
 * flipped when it changes floors, which needs a floor index, which needs a
 * lookup, and which is wrong the first time two girders overlap. What is written
 * here instead is `sign(girder.slope)`: a barrel rolls downhill, always, and the
 * serpentine is a property of the LEVEL DATA rather than of the barrel. Editing
 * two numbers in config/levels.ts re-routes every barrel in the game.
 *
 * THE FAILURE THIS FILE PREVENTS (2): THE LADDER RE-ROLL. A barrel that reaches
 * a ladder head with almost no horizontal speed — near the top of a shallow
 * slope, or nudged by a belt — oscillates across it for many frames. Rolling the
 * descent chance per frame turns a 20% chance into a certainty within about
 * fifteen frames, and every barrel takes every ladder. `lastLadderId` makes the
 * roll happen AT MOST ONCE PER LADDER PER BARREL, which is what the designer
 * meant when they wrote 0.20 in the level row. Without it the level's tuning
 * number is decorative and the bug is invisible in code review because the line
 * that rolls the dice looks exactly right.
 *
 * ─── THE GRACE TAIL ────────────────────────────────────────────────────────
 *
 * The trailing 12% of a barrel does not kill. Implemented by pulling the hit
 * circle's BACK edge forward — the centre moves along the direction of travel
 * by half the tail and the radius shrinks by the same half, so the FRONT edge is
 * exactly where it looks. That asymmetry is the whole point: the barrel you are
 * running into is honest, and the barrel you have just cleared is forgiving.
 * Nobody will notice it; everybody will feel it.
 *
 * No DOM, no clock, no unseeded randomness — the descent draw comes from the
 * seeded stream, so a replay puts every barrel on the same ladder.
 */

import { BARREL } from '../config/tuning';
import { circleVsRect, sign } from '../core/math';
import { makePool, type Pool } from '../core/pool';
import type { Rng } from '../core/rng';
import type { Body } from '../core/types';
import { airStep, applyBelt, beginStep, makeBody } from './physics';
import { girderAt, laddersNear, surfaceYAt, type Stage } from './stage';

export type BarrelMode = 'roll' | 'fall' | 'descend';
export type BarrelKind = 'normal' | 'wild';

export interface Barrel {
  body: Body;
  mode: BarrelMode;
  kind: BarrelKind;
  /** Base speed for this barrel, before the wild multiplier. */
  speed: number;
  /** Rail being descended, else -1. */
  ladderId: number;
  /**
   * The last ladder head this barrel tested. See failure (2) — this single
   * field is the difference between a 20% chance and a 100% one.
   */
  lastLadderId: number;
  /** Already counted as jumped-over. One score per barrel, ever. */
  jumped: boolean;
  live: boolean;
}

export interface Barrels {
  pool: Pool<Barrel>;
  /** Running jump tally across the life — the scoring multiplier. */
  jumpCount: number;
}

export function makeBarrels(): Barrels {
  return {
    // Capacity is the POOL's physical size; the level row's `maxBarrels` clamps
    // below it. See core/pool.ts on why a full pool must drop a spawn rather
    // than grow — an unwinnable screen is a game-design failure, not a memory one.
    pool: makePool<Barrel>(BARREL.cap, newBarrel, resetBarrel),
    jumpCount: 0,
  };
}

function newBarrel(): Barrel {
  return {
    // Half-width from the hitbox fraction; full height is the diameter, so the
    // circle centre is `y - BARREL.r` under the feet-centre contract.
    body: makeBody(0, 0, BARREL.r * BARREL.hitboxFrac, BARREL.r * 2),
    mode: 'roll',
    kind: 'normal',
    speed: 0,
    ladderId: -1,
    lastLadderId: -1,
    jumped: false,
    live: false,
  };
}

/** OVERWRITES every field. Never rebuilds, never deletes — core/pool.ts rule 2. */
function resetBarrel(b: Barrel): void {
  const body = b.body;
  body.x = 0;
  body.y = 0;
  body.px = 0;
  body.py = 0;
  body.vx = 0;
  body.vy = 0;
  body.grounded = false;
  body.segId = -1;
  b.mode = 'roll';
  b.kind = 'normal';
  b.speed = 0;
  b.ladderId = -1;
  b.lastLadderId = -1;
  b.jumped = false;
  b.live = false;
}

/** Release one barrel. Returns it, or null when the pool or the level cap is full. */
export function spawnBarrel(
  bs: Barrels,
  stage: Stage,
  x: number,
  y: number,
  speed: number,
  kind: BarrelKind,
  maxLive: number,
): Barrel | null {
  if (bs.pool.activeCount >= maxLive) return null;
  const b = bs.pool.alloc();
  if (!b) return null;

  const body = b.body;
  body.x = x;
  body.y = y;
  body.px = x;
  body.py = y;
  body.vx = 0;
  body.vy = 0;
  b.kind = kind;
  b.speed = speed;
  b.ladderId = -1;
  b.lastLadderId = -1;
  b.jumped = false;
  b.live = true;

  const seg = girderAt(stage, x, y, BARREL.r);
  if (seg >= 0) {
    body.segId = seg;
    body.grounded = true;
    b.mode = 'roll';
  } else {
    body.segId = -1;
    body.grounded = false;
    b.mode = 'fall';
  }
  return b;
}

/** Effective travel speed, wild barrels included. */
function speedOf(b: Barrel): number {
  return b.kind === 'wild' ? b.speed * BARREL.wildSpeedMult : b.speed;
}

// ─── Step ───────────────────────────────────────────────────────────────────

export function stepBarrels(
  bs: Barrels,
  stage: Stage,
  rng: Rng,
  ladderChance: number,
  beltSpeed: number,
  dt: number,
): void {
  // Iterating backwards and freeing the CURRENT item is the one mutation
  // core/pool.ts's forEach guarantees is safe.
  bs.pool.forEach((b) => {
    if (!b.live) return;
    beginStep(b.body);

    switch (b.mode) {
      case 'roll':
        stepRoll(bs, b, stage, rng, ladderChance, beltSpeed, dt);
        break;
      case 'descend':
        stepDescend(b, stage, dt);
        break;
      case 'fall':
        stepFall(b, stage, dt);
        break;
    }

    // Anything that has left the world is retired here, in one place, rather
    // than at each of the three sites that could have put it there.
    if (b.live && (b.body.y > stage.h + BARREL.r * 4 || b.body.x < -BARREL.r * 4 || b.body.x > stage.w + BARREL.r * 4)) {
      retire(bs, b);
    }
  });
}

function retire(bs: Barrels, b: Barrel): void {
  b.live = false;
  bs.pool.free(b);
}

function stepRoll(
  bs: Barrels,
  b: Barrel,
  stage: Stage,
  rng: Rng,
  ladderChance: number,
  beltSpeed: number,
  dt: number,
): void {
  const body = b.body;
  const g = stage.girders[body.segId];
  if (!g) {
    b.mode = 'fall';
    body.grounded = false;
    return;
  }

  // DOWNHILL. ALWAYS. The serpentine lives in the level's slope signs, not here.
  const dir = sign(g.slope);
  body.vx = dir * speedOf(b);

  applyBelt(stage, body, beltSpeed, dt);

  const nx = body.x + body.vx * dt;

  // A barrel that has rolled into a SOLID end has nowhere downhill left to go
  // and would sit there forever, eating a slot in a capped pool. Retire it.
  // Stated as a general rule about girder ends rather than as "the ground
  // floor", so a level that walls any floor's downhill end gets a drain for
  // free instead of a soft-lock.
  if (body.vx > 0 && g.solidRight && nx + body.w >= g.x1) {
    retire(bs, b);
    return;
  }
  if (body.vx < 0 && g.solidLeft && nx - body.w <= g.x0) {
    retire(bs, b);
    return;
  }

  body.x = nx;

  const sy = surfaceYAt(g, body.x);
  if (Number.isNaN(sy)) {
    // Off an open end. This is the whole cascade down the tower and it is one
    // NaN — no "is this the last girder" test anywhere. See stage.ts.
    b.mode = 'fall';
    body.grounded = false;
    body.segId = -1;
    body.vy = 0;
    return;
  }
  body.y = sy;

  maybeDescend(b, stage, rng, ladderChance);
}

/**
 * The at-most-once-per-ladder descent roll.
 *
 * Wild barrels are excluded outright: they are the "no route reading will save
 * you" barrel, and giving them a ladder branch as well would make them
 * unreadable rather than merely dangerous.
 */
function maybeDescend(b: Barrel, stage: Stage, rng: Rng, chance: number): void {
  if (b.kind === 'wild') return;

  const body = b.body;
  const ids = laddersNear(stage, body.x);

  for (let i = 0; i < ids.length; i++) {
    const l = stage.ladders[ids[i]!]!;
    if (Math.abs(l.x - body.x) > BARREL.ladderX) continue;
    // Only from a ladder's HEAD: a barrel meets the foot of the rail above it
    // at the same x, and descending from there would send it back up the tower.
    if (Math.abs(l.yTop - body.y) > BARREL.r) continue;
    // A gated rail is scenery to a barrel — it does not carry the tower's
    // hazard past a gate the player has not opened yet.
    if (l.gated) continue;

    // ── THE ROLL HAPPENS ONCE ────────────────────────────────────────────
    // Latched BEFORE the draw, so a barrel oscillating across this ladder head
    // — which happens constantly on a shallow slope with a belt — cannot come
    // back and roll again next frame.
    if (b.lastLadderId === l.id) continue;
    b.lastLadderId = l.id;

    if (!rng.chance(chance)) return;

    b.mode = 'descend';
    b.ladderId = l.id;
    body.x = l.x;
    body.vx = 0;
    body.vy = 0;
    body.grounded = false;
    body.segId = -1;
    return;
  }
}

function stepDescend(b: Barrel, stage: Stage, dt: number): void {
  const body = b.body;
  const l = stage.ladders[b.ladderId];
  if (!l) {
    b.mode = 'fall';
    return;
  }

  body.y += BARREL.descendSpeed * dt;

  // A broken rail drops the barrel at the gap. Falling out of a missing rung is
  // the same free-fall path as anything else, which is why it needs no code.
  if (l.hasGap && body.y > l.gapTop) {
    b.mode = 'fall';
    b.ladderId = -1;
    body.y = l.gapTop;
    body.vy = 0;
    return;
  }

  if (body.y < l.yBottom) return;

  body.y = l.yBottom;
  b.ladderId = -1;
  const seg = girderAt(stage, body.x, body.y, BARREL.r);
  if (seg >= 0) {
    body.segId = seg;
    body.grounded = true;
    b.mode = 'roll';
    // Cleared so the barrel is free to take a ladder on the floor below. The
    // latch is per-ladder-visit, not per-barrel-lifetime.
    b.lastLadderId = l.id;
  } else {
    b.mode = 'fall';
    body.vy = 0;
  }
}

function stepFall(b: Barrel, stage: Stage, dt: number): void {
  const body = b.body;
  const seg = airStep(stage, body, BARREL.gravity, dt);
  if (seg < 0) return;

  const g = stage.girders[seg]!;

  if (b.kind === 'wild') {
    // Wild barrels BOUNCE rather than settle. They stay in 'fall' for their
    // whole life, so they never test a ladder and never get steered by a belt —
    // a hazard the player cannot route around, only time.
    body.vy = BARREL.bounceV;
    body.grounded = false;
    body.segId = -1;
    body.vx = sign(g.slope) * speedOf(b);
    return;
  }

  b.mode = 'roll';
  // Landing on a new floor clears the latch, so the ladder on THIS floor is a
  // fresh draw. A barrel is only ever denied a re-roll on the ladder it is
  // currently sitting on top of.
  b.lastLadderId = -1;
}

// ─── Collision and scoring ──────────────────────────────────────────────────

/**
 * Does this barrel overlap the agent's (already shrunk) box right now?
 *
 * `circleVsRect` wants a top-left rect; the conversion from the feet-centre Body
 * contract happens HERE, visibly, at the call site — see core/math.ts on why the
 * primitive refuses to know about the anchor convention.
 */
export function barrelHits(b: Barrel, agent: Body): boolean {
  const body = b.body;
  const r = BARREL.r * BARREL.hitboxFrac;

  // The grace tail: pull the BACK edge in by `graceTail · r` and leave the front
  // where it looks. Half the tail moves the centre, half comes off the radius.
  const tail = (BARREL.r * BARREL.graceTail) / 2;
  const dir = sign(body.vx);
  const cx = body.x + dir * tail;
  const cy = body.y - BARREL.r;

  return circleVsRect(
    cx,
    cy,
    r - tail,
    agent.x - agent.w,
    agent.y - agent.h,
    agent.w * 2,
    agent.h,
  );
}

/**
 * Flag every barrel the agent is currently clearing. Returns how many were newly
 * flagged this step, which is what the hop bonus is counted from.
 *
 * `jumped` is a one-way latch per barrel: a player hanging at the apex over a
 * slow barrel must not accrue a point per frame, and a barrel that passes under
 * a second time on a later floor is not a second jump.
 */
export function markJumped(
  bs: Barrels,
  agent: Body,
  airborne: boolean,
  onJump: (x: number, y: number, count: number) => void,
): number {
  if (!airborne) return 0;
  let n = 0;
  bs.pool.forEach((b) => {
    if (!b.live || b.jumped) return;
    const body = b.body;
    // Horizontally overlapping AND the agent's FEET are above the barrel's
    // centre. Feet, not head: clearing a barrel means the bottom of you passed
    // over the top of it.
    if (Math.abs(body.x - agent.x) > BARREL.r + agent.w) return;
    if (agent.y > body.y - BARREL.r) return;
    b.jumped = true;
    bs.jumpCount++;
    n++;
    onJump(body.x, body.y, bs.jumpCount);
  });
  return n;
}

/** Remove every barrel within `radius` of a point. Used on respawn. */
export function clearBarrelsNear(bs: Barrels, x: number, y: number, radius: number): void {
  const r2 = radius * radius;
  bs.pool.forEach((b) => {
    if (!b.live) return;
    const dx = b.body.x - x;
    const dy = b.body.y - y;
    if (dx * dx + dy * dy <= r2) retire(bs, b);
  });
}

export function clearAllBarrels(bs: Barrels): void {
  bs.pool.forEach((b) => {
    b.live = false;
  });
  bs.pool.clear();
  bs.jumpCount = 0;
}
