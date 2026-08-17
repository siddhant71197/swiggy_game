/**
 * ══════════════════════════════════════════════════════════════════════════
 *  HAZARDS — everything that can kill you that is not a barrel.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): THE SECOND PHYSICS. A lift is a surface
 * you stand on, land on, walk along and fall off; a scooter is a body that
 * bounces on girders; a tiffin is a body that falls. Every one of those is
 * something game/physics.ts already does, and every one of them is something a
 * hazard file will happily reimplement badly if you let it. So nothing here
 * integrates its own gravity, tests its own landing, or decides its own slope.
 * The lift in particular is not an entity at all — it is a GIRDER THAT MOVES,
 * rewritten into a scratch slot each step (see `Stage.liftBase`), which is why
 * the agent, the barrels and the level's own conveyor logic all handle it with
 * no code that knows lifts exist.
 *
 * THE FAILURE THIS FILE PREVENTS (2): THE PERFECT CHASER. A flame that always
 * turns toward the player is trivial to write, reads as intelligent for about
 * ten seconds, and then reveals that it has no counterplay: there is no
 * information the player can act on, because the answer is always "it comes for
 * you". `flameChaseChance` is capped below 1 in the level table for that reason
 * and this file never rounds it up — a flame that is right two times in three is
 * a flame the player can READ, and reading it is the whole game.
 *
 * THE FAILURE THIS FILE PREVENTS (3): THE UNLEARNABLE CADENCE. Barrels are
 * jittered because the player can walk away from them. Scooters and tiffins are
 * NOT, because you cannot walk under a scooter and you cannot outrun a lane.
 * A hazard with no escape must be a metronome, or the correct play is to stand
 * still and hope, which is not play.
 *
 * No DOM, no clock, no unseeded randomness. Every draw comes from the world's
 * seeded stream, so a replay puts every flame on the same ladder.
 */

import type { LiftDef, StageDef } from '../config/levels';
import { BELT, HAZARD, LIFT, PHYS } from '../config/tuning';
import { clamp, sign } from '../core/math';
import { makePool, type Pool } from '../core/pool';
import type { Rng } from '../core/rng';
import type { Body } from '../core/types';
import { airStep, beginStep, makeBody } from './physics';
import { girderAt, laddersNear, surfaceYAt, type Stage } from './stage';

// ─── Shapes ─────────────────────────────────────────────────────────────────

/**
 * A patrolling flame. `mode` is a single field for the same reason the agent's
 * is: `walking` and `climbing` as two booleans has a fourth state that nobody
 * tests and that eventually ships.
 */
export interface Flame {
  body: Body;
  dir: -1 | 1;
  mode: 'walk' | 'climb';
  /** Rail being climbed, else -1. */
  ladderId: number;
  /** -1 up, +1 down. Meaningless outside `climb`. */
  dirY: -1 | 1;
  /**
   * The last rail this flame decided about. Same latch as the barrel's, for the
   * same reason: a flame loitering on a ladder head would re-roll the chase
   * every frame and take every ladder in the level.
   */
  lastLadderId: number;
  live: boolean;
}

export interface Tiffin {
  body: Body;
  live: boolean;
}

export interface Scooter {
  body: Body;
  speed: number;
  live: boolean;
}

/** One dropper's countdown, plus the telegraph the renderer reads. */
export interface Dropper {
  x: number;
  y: number;
  intervalSec: number;
  timer: number;
  /** True while the lane is flashing. Presentation reads it; nothing else does. */
  warn: boolean;
}

export interface ScooterSource {
  x: number;
  y: number;
  dir: -1 | 1;
  speed: number;
  intervalSec: number;
  timer: number;
}

/** A car's authoritative state. The girder it writes is downstream of this. */
export interface LiftCar {
  def: LiftDef;
  /** Surface y at the car's centre. */
  y: number;
  /** This step's vertical movement, in units/sec. Read by the renderer. */
  dy: number;
  /** +1 descending, -1 rising. Sawtooth, so it turns around at both ends. */
  dirY: -1 | 1;
  segId: number;
}

export interface Pickup {
  x: number;
  y: number;
  taken: boolean;
}

export interface Hazards {
  /**
   * Current conveyor direction as a MULTIPLIER on the authored belt sign, so a
   * level whose belts point in three different directions reverses all of them
   * together and none of them individually.
   */
  beltDir: -1 | 1;
  /** True during BELT.flipWarnSec before a reversal. The telegraph. */
  beltWarn: boolean;
  /** Authored belt sign per girder id, so the flip is never applied twice. */
  beltBase: (-1 | 0 | 1)[];

  lifts: LiftCar[];
  flames: Flame[];
  droppers: Dropper[];
  tiffins: Pool<Tiffin>;
  sources: ScooterSource[];
  scooters: Pool<Scooter>;

  shakers: Pickup[];
  /** Seconds of powerup left. Zero is "not held". */
  shakerLeft: number;
  /** True during the last HAZARD.shakerWarnSec. Presentation reads it. */
  shakerWarn: boolean;
  /** Hazards smashed under the CURRENT powerup — the escalating smash bonus. */
  smashChain: number;

  pins: Pickup[];
  pinsLeft: number;

  helmets: Pickup[];
  /**
   * A FLAG, NOT A TIMER, and that is the design rather than a shortcut.
   *
   * The shaker is a window: its value is "for the next six seconds nothing can
   * touch you", so it needs a clock and a telegraph. The helmet is a CHARGE: its
   * value is "the next hit is free", and it is spent by an event rather than by
   * time. Giving it a duration would make the player's question "how long have I
   * had this?" — unanswerable while dodging — instead of "do I have it?", which is
   * one glance at the HUD. So there is no clock here and no warn state, and the
   * absence of both is what keeps the two powerups distinguishable.
   */
  helmetOn: boolean;

  turbos: Pickup[];
  /** Seconds of boost left. Zero is "not held". Mirrors `shakerLeft` exactly. */
  turboLeft: number;
  /** True during the last HAZARD.turboWarnSec. Presentation reads it. */
  turboWarn: boolean;
}

// ─── Build ──────────────────────────────────────────────────────────────────

function newTiffin(): Tiffin {
  return { body: makeBody(0, 0, (HAZARD.tiffinDrawW * HAZARD.tiffinHitFrac) / 2, HAZARD.tiffinDrawH), live: false };
}
function resetTiffin(t: Tiffin): void {
  const b = t.body;
  b.x = 0;
  b.y = 0;
  b.px = 0;
  b.py = 0;
  b.vx = 0;
  b.vy = 0;
  b.grounded = false;
  b.segId = -1;
  t.live = false;
}

function newScooter(): Scooter {
  return {
    body: makeBody(0, 0, (HAZARD.scooterDrawW * HAZARD.scooterHitFrac) / 2, HAZARD.scooterDrawH),
    speed: 0,
    live: false,
  };
}
function resetScooter(s: Scooter): void {
  const b = s.body;
  b.x = 0;
  b.y = 0;
  b.px = 0;
  b.py = 0;
  b.vx = 0;
  b.vy = 0;
  b.grounded = false;
  b.segId = -1;
  s.speed = 0;
  s.live = false;
}

/**
 * `flameCountDelta` arrives already computed by game/level.ts and is NEVER
 * positive — the silent rubber band only ever removes a flame. A band that could
 * add one would be a difficulty increase applied to a player who is losing.
 */
export function makeHazards(stage: Stage, def: StageDef, flameCountDelta: number): Hazards {
  const beltBase: (-1 | 0 | 1)[] = [];
  for (const g of stage.girders) beltBase.push(g.belt);

  const lifts: LiftCar[] = [];
  const liftDefs = def.lifts ?? [];
  for (let i = 0; i < liftDefs.length; i++) {
    const lf = liftDefs[i]!;
    const span = lf.yBottom - lf.yTop;
    // Phase is authored 0..1 through the cycle so a bank of cars is staggered by
    // DATA. Resolved here, once, rather than by seeding a timer at a call site.
    const p = ((lf.phase % 1) + 1) % 1;
    lifts.push({
      def: lf,
      y: lf.yTop + span * (p < 0.5 ? p * 2 : 2 - p * 2),
      dy: 0,
      dirY: p < 0.5 ? 1 : -1,
      segId: stage.liftBase >= 0 ? stage.liftBase + i : -1,
    });
  }

  const flames: Flame[] = [];
  const flameDefs = def.flames ?? [];
  // Dropped from the END of the table, so the flame a level's author placed
  // first — which is the one the route is designed around — is the last to go.
  const keep = clamp(flameDefs.length + flameCountDelta, 0, HAZARD.flameCap);
  for (let i = 0; i < keep; i++) {
    const f = flameDefs[i]!;
    const body = makeBody(
      f.x,
      f.y,
      (HAZARD.flameDrawW * HAZARD.flameHitFrac) / 2,
      HAZARD.flameDrawH * HAZARD.flameHitFrac,
    );
    body.segId = girderAt(stage, f.x, f.y, 8);
    body.grounded = body.segId >= 0;
    flames.push({ body, dir: f.dir, mode: 'walk', ladderId: -1, dirY: 1, lastLadderId: -1, live: true });
  }

  const droppers: Dropper[] = [];
  for (const d of def.tiffins ?? []) {
    const p = ((d.phase % 1) + 1) % 1;
    droppers.push({ x: d.x, y: d.y, intervalSec: d.intervalSec, timer: d.intervalSec * (1 - p), warn: false });
  }

  const sources: ScooterSource[] = [];
  for (const s of def.scooters ?? []) {
    const p = ((s.phase % 1) + 1) % 1;
    sources.push({
      x: s.x,
      y: s.y,
      dir: s.dir,
      speed: s.speed,
      intervalSec: s.intervalSec,
      timer: s.intervalSec * (1 - p),
    });
  }

  const shakers: Pickup[] = [];
  const shakerDefs = def.shakers ?? [];
  // The COUNT is authoritative and the positions are a table it indexes into, so
  // a level can carry a spare placement without it going live by accident.
  for (let i = 0; i < Math.min(def.shakerCount, shakerDefs.length); i++) {
    shakers.push({ x: shakerDefs[i]!.x, y: shakerDefs[i]!.y, taken: false });
  }

  const pins: Pickup[] = [];
  for (const p of def.pins ?? []) pins.push({ x: p.x, y: p.y, taken: false });

  // Both riders' kit follows the shaker's rule: the COUNT is authoritative and
  // the positions are a table it indexes into, so a level can carry a spare
  // placement — a tuning pass in progress — without it going live by accident.
  const helmets: Pickup[] = [];
  const helmetDefs = def.helmets ?? [];
  for (let i = 0; i < Math.min(def.helmetCount, helmetDefs.length); i++) {
    helmets.push({ x: helmetDefs[i]!.x, y: helmetDefs[i]!.y, taken: false });
  }

  const turbos: Pickup[] = [];
  const turboDefs = def.turbos ?? [];
  for (let i = 0; i < Math.min(def.turboCount, turboDefs.length); i++) {
    turbos.push({ x: turboDefs[i]!.x, y: turboDefs[i]!.y, taken: false });
  }

  return {
    beltDir: 1,
    beltWarn: false,
    beltBase,
    lifts,
    flames,
    droppers,
    tiffins: makePool<Tiffin>(HAZARD.tiffinCap, newTiffin, resetTiffin),
    sources,
    scooters: makePool<Scooter>(HAZARD.scooterCap, newScooter, resetScooter),
    shakers,
    shakerLeft: 0,
    shakerWarn: false,
    smashChain: 0,
    pins,
    pinsLeft: pins.length,
    helmets,
    helmetOn: false,
    turbos,
    turboLeft: 0,
    turboWarn: false,
  };
}

// ─── Step ───────────────────────────────────────────────────────────────────

/**
 * One update for everything in this file.
 *
 * Called from the world's stage-4 slot, which is AFTER the agent and the barrels
 * have moved. That ordering costs the lift one frame of surface lag (see
 * `Stage.liftBase`) and buys the guarantee that no hazard ever moves a body that
 * has not yet taken its own step this frame — which is the bug where a rising
 * car and a jumping agent disagree about who owns the y.
 */
export function stepHazards(
  h: Hazards,
  stage: Stage,
  agent: Body,
  barrels: { pool: Pool<{ body: Body; live: boolean }> },
  rng: Rng,
  chaseChance: number,
  simTime: number,
  beltPeriodSec: number,
  dt: number,
): void {
  stepBelts(h, stage, simTime, beltPeriodSec);
  stepLifts(h, stage, agent, barrels, dt);
  stepFlames(h, stage, agent, rng, chaseChance, dt);
  stepDroppers(h, dt);
  stepTiffins(h, stage, dt);
  stepScooterSources(h, dt);
  stepScooters(h, stage, dt);
  stepShakerClock(h, dt);
  stepTurboClock(h, dt);
}

/**
 * THE REVERSAL AND ITS TELEGRAPH READ THE SAME NUMBER.
 *
 * `simTime` is the sim's own elapsed seconds — never a wall clock — so the flip
 * happens on the same step in a replay as in the run. Deriving the warning from
 * a second timer is how a game ships a belt that flips a quarter-second before
 * the arrow says it will, which is worse than no warning at all: the player
 * learns to distrust the telegraph and then ignores it.
 */
function stepBelts(h: Hazards, stage: Stage, simTime: number, period: number): void {
  if (period > 0) {
    const cycle = Math.floor(simTime / period);
    const phase = simTime - cycle * period;
    h.beltDir = cycle % 2 === 0 ? 1 : -1;
    h.beltWarn = phase > period - BELT.flipWarnSec;
  } else {
    h.beltDir = 1;
    h.beltWarn = false;
  }

  // Applied to the AUTHORED sign, never to the current one — compounding a flip
  // onto an already-flipped girder is a belt that reverses only on odd cycles,
  // and it is invisible until someone stands on it for twenty seconds.
  for (let i = 0; i < stage.girders.length; i++) {
    const base = h.beltBase[i] ?? 0;
    if (base === 0) continue;
    stage.girders[i]!.belt = (base * h.beltDir) as -1 | 0 | 1;
  }
}

/**
 * The sawtooth, and the one line that stops the car throwing you off.
 *
 * A body standing on a car is re-snapped to the car's new surface (LIFT.carryDy)
 * rather than left to re-land. Without it a rising car climbs past a body that
 * only re-lands when it falls, so the body spends alternate frames airborne, and
 * on a descending car it separates entirely and slides off the back — which
 * players describe, accurately, as the lift throwing them.
 */
function stepLifts(
  h: Hazards,
  stage: Stage,
  agent: Body,
  barrels: { pool: Pool<{ body: Body; live: boolean }> },
  dt: number,
): void {
  for (const car of h.lifts) {
    const prev = car.y;
    car.y += car.dirY * car.def.speed * dt;
    if (car.y >= car.def.yBottom) {
      car.y = car.def.yBottom;
      car.dirY = -1;
    } else if (car.y <= car.def.yTop) {
      car.y = car.def.yTop;
      car.dirY = 1;
    }
    car.dy = (car.y - prev) / dt;

    const g = stage.girders[car.segId];
    if (!g) continue;
    const drop = car.def.w / 12;
    g.y0 = car.y - drop;
    g.y1 = car.y + drop;

    if (!LIFT.carryDy) continue;
    carry(g.id, agent, stage);
    barrels.pool.forEach((b) => {
      if (b.live) carry(g.id, b.body, stage);
    });
  }
}

function carry(segId: number, b: Body, stage: Stage): void {
  if (!b.grounded || b.segId !== segId) return;
  const sy = surfaceYAt(stage.girders[segId]!, b.x);
  if (Number.isNaN(sy)) return;
  // Only within the board tolerance. A body further off than that is not riding
  // the car, it is falling past it, and snapping it would be a teleport.
  if (Math.abs(sy - b.y) > LIFT.boardY) return;
  b.y = sy;
}

// ─── Flames ─────────────────────────────────────────────────────────────────

function stepFlames(
  h: Hazards,
  stage: Stage,
  agent: Body,
  rng: Rng,
  chaseChance: number,
  dt: number,
): void {
  for (const f of h.flames) {
    if (!f.live) continue;
    beginStep(f.body);
    if (f.mode === 'climb') stepFlameClimb(f, stage, dt);
    else stepFlameWalk(f, stage, agent, rng, chaseChance, dt);
  }
}

function stepFlameWalk(
  f: Flame,
  stage: Stage,
  agent: Body,
  rng: Rng,
  chaseChance: number,
  dt: number,
): void {
  const b = f.body;
  let g = stage.girders[b.segId];
  if (!g) {
    // Re-acquire rather than fall. A flame is a level fixture; dropping one down
    // the tower because a car moved out from under it turns an authored hazard
    // into a random one.
    const seg = girderAt(stage, b.x, b.y, PHYS.maxSnap);
    if (seg < 0) return;
    b.segId = seg;
    b.grounded = true;
    g = stage.girders[seg]!;
  }

  const nx = b.x + f.dir * HAZARD.flameSpeed * dt;
  const sy = surfaceYAt(g, nx);
  // Off an open end, or into a wall — the same answer either way. A flame never
  // leaves its deck of its own accord; the ladders are the only way off.
  if (
    Number.isNaN(sy) ||
    (f.dir > 0 && g.solidRight && nx + b.w >= g.x1) ||
    (f.dir < 0 && g.solidLeft && nx - b.w <= g.x0)
  ) {
    f.dir = (f.dir === 1 ? -1 : 1) as -1 | 1;
    return;
  }

  b.x = nx;
  b.y = sy;

  maybeTakeLadder(f, stage, agent, rng, chaseChance);
}

/**
 * THE JUNCTION DECISION, AND THE PROBABILITY THAT IS NEVER 1.
 *
 * At a rail end the flame asks one question — is the player above me or below me
 * — and answers it correctly with probability `chaseChance`. The rest of the
 * time it walks on. That gap is the entire counterplay: the player who watches a
 * flame reach a ladder gets information, and information is what makes a hazard
 * a puzzle instead of a timer.
 */
function maybeTakeLadder(
  f: Flame,
  stage: Stage,
  agent: Body,
  rng: Rng,
  chaseChance: number,
): void {
  if (chaseChance <= 0) return;

  const b = f.body;
  const ids = laddersNear(stage, b.x);
  for (let i = 0; i < ids.length; i++) {
    const l = stage.ladders[ids[i]!]!;
    if (Math.abs(l.x - b.x) > HAZARD.flameLadderX) continue;
    // A gated rail is scenery to a flame, exactly as it is to a barrel: the
    // tower's hazards do not get to sit past a gate the player cannot open yet.
    if (l.gated) continue;
    // A broken rail is refused outright. A flame stalled at a missing rung is a
    // hazard that has stopped being a hazard and started being furniture.
    if (l.hasGap) continue;

    const atBottom = Math.abs(l.yBottom - b.y) <= CLIMB_END;
    const atTop = Math.abs(l.yTop - b.y) <= CLIMB_END;
    if (!atBottom && !atTop) continue;

    // Latched BEFORE the draw — see `lastLadderId`.
    if (f.lastLadderId === l.id) continue;
    f.lastLadderId = l.id;

    const wantUp = agent.y < b.y - CLIMB_END;
    const wantDown = agent.y > b.y + CLIMB_END;
    if (atBottom && !wantUp) return;
    if (atTop && !wantDown) return;
    if (!rng.chance(chaseChance)) return;

    f.mode = 'climb';
    f.ladderId = l.id;
    f.dirY = atBottom ? -1 : 1;
    b.x = l.x;
    b.grounded = false;
    b.segId = -1;
    return;
  }
}

/** Vertical slop for "standing at a rail's end". Matches CLIMB.dismountY's intent. */
const CLIMB_END = 8;

function stepFlameClimb(f: Flame, stage: Stage, dt: number): void {
  const b = f.body;
  const l = stage.ladders[f.ladderId];
  if (!l) {
    f.mode = 'walk';
    f.ladderId = -1;
    return;
  }

  b.y += f.dirY * HAZARD.flameClimbSpeed * dt;
  if (f.dirY < 0 && b.y <= l.yTop) b.y = l.yTop;
  else if (f.dirY > 0 && b.y >= l.yBottom) b.y = l.yBottom;
  else return;

  const seg = girderAt(stage, b.x, b.y, CLIMB_END);
  f.mode = 'walk';
  f.ladderId = -1;
  if (seg >= 0) {
    b.segId = seg;
    b.grounded = true;
    const sy = surfaceYAt(stage.girders[seg]!, b.x);
    if (!Number.isNaN(sy)) b.y = sy;
    // Cleared so the flame may take a DIFFERENT rail off this deck, but not
    // immediately re-take the one it just arrived on.
    f.lastLadderId = l.id;
  }
}

// ─── Tiffins ────────────────────────────────────────────────────────────────

function stepDroppers(h: Hazards, dt: number): void {
  for (const d of h.droppers) {
    d.timer -= dt;
    d.warn = d.timer <= HAZARD.tiffinWarnSec;
    if (d.timer > 0) continue;
    // NO JITTER, and the reset is the authored interval exactly. See the header.
    d.timer += d.intervalSec;
    d.warn = false;
    const t = h.tiffins.alloc();
    if (!t) continue;
    const b = t.body;
    b.x = d.x;
    b.y = d.y;
    b.px = d.x;
    b.py = d.y;
    b.vx = 0;
    b.vy = 0;
    b.grounded = false;
    b.segId = -1;
    t.live = true;
  }
}

/**
 * A tiffin falls THROUGH the tower, not onto it.
 *
 * Deliberate: the lane is the hazard. A tiffin that landed and rolled would be a
 * barrel with a different sprite, and the level would have taught the player
 * nothing new — while a lane that is lethal for one second in four is a timing
 * problem the ladders and the belts cannot express.
 */
function stepTiffins(h: Hazards, stage: Stage, dt: number): void {
  h.tiffins.forEach((t) => {
    if (!t.live) return;
    const b = t.body;
    beginStep(b);
    b.vy += HAZARD.tiffinGravity * dt;
    if (b.vy > PHYS.maxFallSpeed) b.vy = PHYS.maxFallSpeed;
    b.y += b.vy * dt;
    if (b.y > stage.h + HAZARD.tiffinDrawH) {
      t.live = false;
      h.tiffins.free(t);
    }
  });
}

// ─── Scooters ───────────────────────────────────────────────────────────────

function stepScooterSources(h: Hazards, dt: number): void {
  for (const s of h.sources) {
    s.timer -= dt;
    if (s.timer > 0) continue;
    s.timer += s.intervalSec;
    const sc = h.scooters.alloc();
    if (!sc) continue;
    const b = sc.body;
    b.x = s.x;
    b.y = s.y;
    b.px = s.x;
    b.py = s.y;
    b.vx = s.dir * s.speed;
    b.vy = HAZARD.scooterBounceV;
    b.grounded = false;
    b.segId = -1;
    sc.speed = s.speed;
    sc.live = true;
  }
}

/**
 * Bounces, never rolls, and keeps its horizontal speed through the bounce.
 *
 * A scooter is the hazard you cannot walk under: the arc has to be the same arc
 * every time or the player is guessing. `airStep` is the agent's own ballistic
 * integrator, so the scooter's arc and the player's jump are made of the same
 * gravity and can be compared by eye.
 */
function stepScooters(h: Hazards, stage: Stage, dt: number): void {
  h.scooters.forEach((sc) => {
    if (!sc.live) return;
    const b = sc.body;
    beginStep(b);
    const seg = airStep(stage, b, HAZARD.scooterGravity, dt);
    if (seg >= 0) {
      // Fixed impulse. Not a fraction of the impact speed — a restitution model
      // makes the bounce height depend on the drop, so the same scooter is a
      // different hazard on every floor.
      b.vy = HAZARD.scooterBounceV;
      b.grounded = false;
      b.segId = -1;
      // Direction survives the bounce; the slope does not steer it. A scooter
      // that obeyed the slope would be a barrel.
      b.vx = sign(b.vx) * sc.speed;
    }
    if (b.y > stage.h + HAZARD.scooterDrawH || b.x < -60 || b.x > stage.w + 60) {
      sc.live = false;
      h.scooters.free(sc);
    }
  });
}

// ─── The shaker ─────────────────────────────────────────────────────────────

function stepShakerClock(h: Hazards, dt: number): void {
  if (h.shakerLeft <= 0) return;
  h.shakerLeft -= dt;
  h.shakerWarn = h.shakerLeft <= HAZARD.shakerWarnSec;
  if (h.shakerLeft > 0) return;
  h.shakerLeft = 0;
  h.shakerWarn = false;
  h.smashChain = 0;
}

/** True on the step the powerup ran out on its own — the caller emits. */
export function shakerJustExpired(h: Hazards, before: number): boolean {
  return before > 0 && h.shakerLeft <= 0;
}

export function shakerActive(h: Hazards): boolean {
  return h.shakerLeft > 0;
}

// ─── The turbo ──────────────────────────────────────────────────────────────

/** The shaker's clock, to the letter. Two powerups, one countdown shape. */
function stepTurboClock(h: Hazards, dt: number): void {
  if (h.turboLeft <= 0) return;
  h.turboLeft -= dt;
  h.turboWarn = h.turboLeft <= HAZARD.turboWarnSec;
  if (h.turboLeft > 0) return;
  h.turboLeft = 0;
  h.turboWarn = false;
}

export function turboActive(h: Hazards): boolean {
  return h.turboLeft > 0;
}

// ─── Pickups ────────────────────────────────────────────────────────────────

function grabbed(px: number, py: number, r: number, agent: Body): boolean {
  const dx = px - agent.x;
  const dy = py - (agent.y - agent.h * 0.5);
  return dx * dx + dy * dy <= r * r;
}

/**
 * Returns the index taken, or -1 — ONE PER STEP, and every taker in this file
 * keeps that rule. Two overlapping pickups therefore produce two events on two
 * steps rather than one frame the presentation layer has to unpick, and the order
 * they are offered in is world.ts's stage-5 sequence rather than a hidden
 * precedence in here.
 */
export function takeShaker(h: Hazards, agent: Body, durationSec: number): number {
  for (let i = 0; i < h.shakers.length; i++) {
    const s = h.shakers[i]!;
    if (s.taken) continue;
    if (!grabbed(s.x, s.y, HAZARD.shakerR, agent)) continue;
    s.taken = true;
    // REFRESHED, not stacked. Two shakers picked up back to back give the player
    // one full duration rather than two — the powerup is a window, and a window
    // you can bank turns the finale into a hoarding puzzle.
    h.shakerLeft = durationSec;
    h.shakerWarn = false;
    h.smashChain = 0;
    return i;
  }
  return -1;
}

/**
 * Index of the helmet donned this step, or -1.
 *
 * A second helmet taken while one is already on is CONSUMED and does not stack,
 * for the shaker's reason pointed at a charge instead of a window: two banked hits
 * would let a player hoard the finale's safety net and spend it all on one floor,
 * and "how many helmets am I wearing" is a number the HUD would then have to
 * teach. One charge is a promise the player can hold in their head.
 */
export function takeHelmet(h: Hazards, agent: Body): number {
  for (let i = 0; i < h.helmets.length; i++) {
    const p = h.helmets[i]!;
    if (p.taken) continue;
    if (!grabbed(p.x, p.y, HAZARD.helmetR, agent)) continue;
    p.taken = true;
    h.helmetOn = true;
    return i;
  }
  return -1;
}

/** Index of the turbo taken this step, or -1. REFRESHED, not stacked — see takeShaker. */
export function takeTurbo(h: Hazards, agent: Body, durationSec: number): number {
  for (let i = 0; i < h.turbos.length; i++) {
    const p = h.turbos[i]!;
    if (p.taken) continue;
    if (!grabbed(p.x, p.y, HAZARD.turboR, agent)) continue;
    p.taken = true;
    h.turboLeft = durationSec;
    h.turboWarn = false;
    return i;
  }
  return -1;
}

/** Index of the pin pushed this step, or -1. `pinsLeft` reaching 0 is the beat. */
export function pushPin(h: Hazards, agent: Body): number {
  for (let i = 0; i < h.pins.length; i++) {
    const p = h.pins[i]!;
    if (p.taken) continue;
    if (!grabbed(p.x, p.y, HAZARD.pinR, agent)) continue;
    p.taken = true;
    h.pinsLeft--;
    return i;
  }
  return -1;
}

// ─── Contact ────────────────────────────────────────────────────────────────

function hits(b: Body, agent: Body): boolean {
  return (
    b.x - b.w < agent.x + agent.w &&
    b.x + b.w > agent.x - agent.w &&
    b.y - b.h < agent.y &&
    b.y > agent.y - agent.h
  );
}

/**
 * Every non-barrel contact, resolved in one place.
 *
 * Returns true if the agent died. WITH THE SHAKER UP the same contact destroys
 * the hazard instead — which is why this is one function and not three: "does
 * this kill me or does it die" must be answered identically for a flame, a
 * tiffin and a scooter, or the powerup is a rule the player has to learn three
 * times.
 */
export function resolveHazardContacts(
  h: Hazards,
  agent: Body,
  onSmash: (x: number, y: number, chain: number) => void,
): boolean {
  const smashing = h.shakerLeft > 0;

  for (const f of h.flames) {
    if (!f.live || !hits(f.body, agent)) continue;
    if (!smashing) return true;
    f.live = false;
    h.smashChain++;
    onSmash(f.body.x, f.body.y, h.smashChain);
  }

  let killed = false;
  h.tiffins.forEach((t) => {
    if (killed || !t.live || !hits(t.body, agent)) return;
    if (!smashing) {
      killed = true;
      return;
    }
    t.live = false;
    h.smashChain++;
    onSmash(t.body.x, t.body.y, h.smashChain);
    h.tiffins.free(t);
  });
  if (killed) return true;

  h.scooters.forEach((sc) => {
    if (killed || !sc.live || !hits(sc.body, agent)) return;
    if (!smashing) {
      killed = true;
      return;
    }
    sc.live = false;
    h.smashChain++;
    onSmash(sc.body.x, sc.body.y, h.smashChain);
    h.scooters.free(sc);
  });
  return killed;
}

/**
 * Clear droppable hazards near a respawn point. The flames are deliberately NOT
 * moved: a flame is a fixture the player routes around, and teleporting one is
 * a bigger surprise than the one this function exists to prevent.
 */
export function clearHazardsNear(h: Hazards, x: number, y: number, radius: number): void {
  const r2 = radius * radius;
  const near = (b: Body): boolean => {
    const dx = b.x - x;
    const dy = b.y - y;
    return dx * dx + dy * dy <= r2;
  };
  h.tiffins.forEach((t) => {
    if (t.live && near(t.body)) {
      t.live = false;
      h.tiffins.free(t);
    }
  });
  h.scooters.forEach((sc) => {
    if (sc.live && near(sc.body)) {
      sc.live = false;
      h.scooters.free(sc);
    }
  });
}
