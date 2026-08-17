/**
 * ══════════════════════════════════════════════════════════════════════════
 *  WORLD — one step(), in one order, forever.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): THE SECOND step(). The moment level 5's
 * lifts get a `stepLiftLevel()` beside `stepGirderLevel()`, the two drift: a fix
 * to the swept landing goes into one, the coyote-time change goes into the
 * other, and the game has two physics that are almost the same — which is worse
 * than two that are obviously different, because the difference is invisible
 * until a player reports that jumps feel wrong "on the lift levels". There is
 * ONE step(). Archetypes differ by DATA — a `kind` string, a lift row, a belt
 * flag — never by code path. If a new archetype seems to need a branch here,
 * what it actually needs is a field in config/levels.ts.
 *
 * THE FAILURE THIS FILE PREVENTS (2): THE ORDER NOBODY WROTE DOWN. Sim order is
 * load-bearing and completely invisible in a diff. Collide before moving and a
 * barrel kills you from where it was last frame. Award pickups after the death
 * check and a player who grabs the last rakhi and is hit on the same step loses
 * the rakhi. Tick the clock before the clear check and a level cleared on the
 * final step reads as a time-out. So the order is written here, in one switchless
 * sequence, with each stage named:
 *
 *   input → agent → barrels → hazards → pickups → collisions → session
 *
 * Anything added to this game goes into one of those seven slots, and the slot
 * is an argument to have on purpose rather than an accident of where the cursor
 * happened to be.
 *
 * THE FAILURE THIS FILE PREVENTS (3): the renderer import. Nothing in this file
 * — or anywhere under game/ — touches the DOM, a clock, or unseeded randomness.
 * The sim EMITS records (core/events.ts) and never learns who listens, which is
 * the only reason tools/simulate.ts can play every level headlessly under bare
 * Node and measure difficulty before it ships.
 */

import { AGENT, BARREL, BELT, CLIMB, PHYS, RAKHI } from '../config/tuning';
import { emit } from '../core/events';
import { makeRng, seedFor, type Rng } from '../core/rng';
import {
  deliverAgent,
  hitAgent,
  makeAgent,
  respawnAgent,
  stepAgent,
  type Agent,
  type Intent,
} from './agent';
import {
  barrelHits,
  clearAllBarrels,
  clearBarrelsNear,
  markJumped,
  spawnBarrel,
  stepBarrels,
  type Barrels,
} from './barrel';
import { makeBarrels } from './barrel';
import {
  clearHazardsNear,
  makeHazards,
  pushPin,
  resolveHazardContacts,
  shakerActive,
  stepHazards,
  takeShaker,
  type Hazards,
} from './hazards';
import { levelParams, type LevelParams } from './level';
import { clearWindups, makeMonkey, stepMonkey, type Monkey } from './monkey';
import { buildStage, type Stage } from './stage';
import {
  awardEarlySweep,
  checkGate,
  clearLevel,
  loseLife,
  makeSession,
  scoreHop,
  scoreSmash,
  startRun,
  takeRakhi,
  tickClock,
  type Session,
} from './session';

/**
 * A conveyor carries at CLIMB.speed rather than at a number of its own.
 *
 * Deliberate reuse: a belt and a ladder are the same statement — "you are being
 * moved rather than moving" — and both must stay strictly under PHYS.runSpeed so
 * the player can always walk out of one. Giving the belt its own constant means
 * a later tune to runSpeed can cross it without anyone noticing, and a belt you
 * cannot escape is a level you cannot finish.
 */
const BELT_SPEED = CLIMB.speed;

export interface WorldOpts {
  /** Deaths already suffered on this level. Feeds the silent rubber band. */
  deaths?: number;
  /** Carry a previous level's books forward. Omit for a fresh run. */
  carry?: Session;
  /** Override the seed. Omit and the LEVEL NUMBER is the seed — see core/rng.ts. */
  seed?: number;
}

export interface World {
  stage: Stage;
  params: LevelParams;
  agent: Agent;
  barrels: Barrels;
  /** Belts, lifts, tiffins, flames, scooters, shakers and pins. See game/hazards.ts. */
  hazards: Hazards;
  /** The thrower. Owns the spawn cadence, the wind-up and level 10's shift. */
  monkey: Monkey;
  session: Session;
  rng: Rng;

  /**
   * THE SAME ARRAY the monkey counts down, aliased — not a copy.
   *
   * The presentation layer infers the throw animation from these timers jumping
   * up (see play.ts), and a mirrored copy updated once a step would be right
   * almost always, which is the worst kind of right: the frame it is stale is
   * the frame a barrel is released, which is the only frame anybody looks at.
   * Re-aliased whenever the monkey is rebuilt.
   */
  spawnTimers: number[];
  /** The monkey holds his throw for this long after a respawn. */
  throwPause: number;

  /** Sim-wide freeze: the unlock beat, and the death hold. */
  hold: number;

  /** Elapsed sim seconds. The bot's clock; never a wall clock. */
  elapsed: number;
  /** No further stepping will change anything. */
  done: boolean;
}

export function createWorld(level: number, opts?: WorldOpts): World {
  const deaths = opts?.deaths ?? 0;
  const params = levelParams(level, deaths);
  const stage = buildStage(params.def);

  const session = opts?.carry
    ? makeSession(params, opts.carry.lives, opts.carry.score, opts.carry.streak)
    : startRun(params);

  const agent = makeAgent(params.def.agentStart.x, params.def.agentStart.y);
  const barrels = makeBarrels();

  const monkey = makeMonkey(params.def, params.intervalMult);

  const w: World = {
    stage,
    params,
    agent,
    barrels,
    hazards: makeHazards(stage, params.def, params.flameCountDelta),
    monkey,
    session,
    rng: makeRng(opts?.seed ?? seedFor(level)),
    spawnTimers: monkey.timers,
    throwPause: 0,
    hold: 0,
    elapsed: 0,
    done: false,
  };

  respawnAgent(agent, stage, params.def.agentStart.x, params.def.agentStart.y);
  // The opening invulnerability is the respawn's, not a level's. Cleared so the
  // first barrel is a real threat.
  agent.invuln = 0;
  return w;
}

// ─── The one step ───────────────────────────────────────────────────────────

export function step(w: World, intent: Intent, dt: number): void {
  if (w.done) return;
  w.elapsed += dt;

  // A HOLD stops the world but not the frame. The unlock beat and the death
  // freeze both need every entity to stop while the presentation layer keeps
  // animating, which is why this is a sim-side timer and not a paused loop.
  if (w.hold > 0) {
    w.hold -= dt;
    if (w.hold > 0) return;
  }

  // ── 1. input ───────────────────────────────────────────────────────────
  // The intent arrives already normalised; this stage exists as a named slot so
  // that anything which must see the raw intent has an obvious home.
  const gateOpen = w.session.gateOpen;

  // ── 2. agent ───────────────────────────────────────────────────────────
  stepAgent(w.stage, w.agent, intent, BELT_SPEED, gateOpen, dt);

  if (w.agent.state === 'hit') {
    stepDeath(w);
    return;
  }

  // ── 3. barrels ─────────────────────────────────────────────────────────
  stepThrows(w, dt);
  stepBarrels(w.barrels, w.stage, w.rng, w.params.barrelLadderChance, BELT_SPEED, dt);

  // ── 4. hazards ─────────────────────────────────────────────────────────
  // Belts, lift cars, flames, tiffins, scooters and the shaker clock, all in
  // game/hazards.ts and all AFTER the bodies that ride them have moved. The lift
  // pays one frame of surface lag for that ordering and it buys the guarantee
  // that nothing is ever moved by a hazard before it has taken its own step.
  const shakerBefore = w.hazards.shakerLeft;
  stepHazards(
    w.hazards,
    w.stage,
    w.agent.body,
    w.barrels,
    w.rng,
    w.params.def.flameChaseChance ?? 0,
    w.elapsed,
    w.params.beltPeriodSec,
    dt,
  );
  if (shakerBefore > 0 && w.hazards.shakerLeft <= 0) emit({ type: 'ShakerExpired' });

  // ── 5. pickups ─────────────────────────────────────────────────────────
  // BEFORE collisions, deliberately. A player who takes the last rakhi and is
  // hit on the same step keeps the rakhi — the two events did not race, we
  // decided which one wins, and it is the one that rewards the player.
  stepPickups(w);

  // ── 6. collisions ──────────────────────────────────────────────────────
  stepJumpScoring(w);
  if (stepBarrelCollisions(w)) return;
  if (stepHazardCollisions(w)) return;
  stepDelivery(w);

  // ── 7. session ─────────────────────────────────────────────────────────
  // The clock ticks LAST so a level cleared on the final step is a clear, not a
  // time-out. The order of those two is the difference between a great last
  // second and a bug report.
  if (tickClock(w.session, dt)) {
    emit({ type: 'TimeUp' });
    w.session.failed = true;
    w.done = true;
  }
}

// ─── Stages ─────────────────────────────────────────────────────────────────

function stepDeath(w: World): void {
  if (w.agent.freeze > 0) return;

  if (w.session.lives <= 0) {
    w.done = true;
    return;
  }

  const start = w.params.def.agentStart;
  // Despawn whatever is sitting on the spawn point. Respawning directly into the
  // barrel that just killed you is the single most rage-inducing thing a game of
  // this shape can do, and it is entirely preventable — see AGENT.respawnClearRadius.
  clearBarrelsNear(w.barrels, start.x, start.y, AGENT.respawnClearRadius);
  clearHazardsNear(w.hazards, start.x, start.y, AGENT.respawnClearRadius);
  respawnAgent(w.agent, w.stage, start.x, start.y);
  clearWindups(w.monkey);
  w.throwPause = AGENT.respawnThrowPauseSec;
  emit({ type: 'AgentRespawn' });
}

/**
 * The cadence, the wind-up and level 10's moving thrower all live in
 * game/monkey.ts. This is the seam: the monkey says "throw from here", the world
 * decides whether the level's cap has room, and a full pool is a DROP rather
 * than a retry — see core/pool.ts failure (1).
 */
function stepThrows(w: World, dt: number): void {
  if (w.throwPause > 0) {
    w.throwPause -= dt;
    return;
  }
  stepMonkey(
    w.monkey,
    w.params.def,
    w.rng,
    w.params.intervalMult,
    w.session.timeLeft,
    dt,
    (x, y, wild) => {
      spawnBarrel(
        w.barrels,
        w.stage,
        x,
        y,
        w.params.barrelSpeed,
        wild ? 'wild' : 'normal',
        Math.min(w.params.maxBarrels, BARREL.cap),
      );
    },
  );
}

function stepPickups(w: World): void {
  const rakhis = w.params.def.rakhis;
  const b = w.agent.body;
  // Body centre, not feet: a pickup is grabbed with your chest, and using the
  // feet would make a rakhi on the walking line collectible only while standing
  // exactly on it.
  const cx = b.x;
  const cy = b.y - b.h * 0.5;

  for (let i = 0; i < rakhis.length; i++) {
    if (w.session.rakhiTaken[i]) continue;
    const p = rakhis[i]!;
    const dx = p.x - cx;
    const dy = p.y - cy;
    if (dx * dx + dy * dy > RAKHI.pickupR * RAKHI.pickupR) continue;

    const chain = takeRakhi(w.session, i, w.agent.airborne);
    emit({ type: 'RakhiTaken', index: i, x: p.x, y: p.y, chain });

    if (checkGate(w.session)) {
      // The sweep finished in the lower half of the tower — the player planned a
      // route instead of stumbling into the last pickup on their way to the top.
      if (b.y > w.stage.h * 0.5) awardEarlySweep(w.session);
      emit({ type: 'GateOpened' });
      // The one moment in a level that stops time. Hit-stop first, then the
      // hold; both are sim-side so a replay pauses in the same place.
      w.hold = RAKHI.unlockHoldSec + RAKHI.unlockHitStopSec;
    }
  }

  const shaker = takeShaker(w.hazards, b, w.params.def.shakerSec);
  if (shaker >= 0) {
    const s = w.hazards.shakers[shaker]!;
    emit({ type: 'ShakerTaken', x: s.x, y: s.y });
  }

  const pin = pushPin(w.hazards, b);
  if (pin >= 0) {
    const p = w.hazards.pins[pin]!;
    emit({ type: 'PinPushed', index: pin, x: p.x, y: p.y });
  }
}

function stepJumpScoring(w: World): void {
  const n = markJumped(w.barrels, w.agent.body, w.agent.airborne, (x, y, count) => {
    emit({ type: 'BarrelJumped', x, y, count });
  });
  for (let i = 0; i < n; i++) {
    w.agent.airCleared++;
    scoreHop(w.session, w.agent.airCleared);
  }
}

/** Returns true if the agent died this step and the world should stop here. */
function stepBarrelCollisions(w: World): boolean {
  if (w.agent.invuln > 0) return false;

  const body = w.agent.body;
  // WITH THE SHAKER UP, THE SAME CONTACT IS A SMASH. One rule, applied to
  // barrels here and to every other hazard in game/hazards.ts, because "does
  // this kill me or does it die" must not have two different answers depending
  // on what touched you.
  const smashing = shakerActive(w.hazards);
  let hit = false;
  w.barrels.pool.forEach((b) => {
    if (hit || !b.live) return;
    if (!barrelHits(b, body)) return;
    if (!smashing) {
      hit = true;
      return;
    }
    w.hazards.smashChain++;
    emit({ type: 'BarrelSmashed', x: b.body.x, y: b.body.y });
    scoreSmash(w.session, w.hazards.smashChain);
    b.live = false;
    w.barrels.pool.free(b);
  });
  if (!hit) return false;

  emit({ type: 'AgentHit', x: body.x, y: body.y });
  hitAgent(w.agent);
  if (loseLife(w.session)) {
    // Out of lives. The freeze still plays — the run ends on a beat rather than
    // on a cut — and stepDeath closes the world once it expires.
    return true;
  }
  return true;
}

/** The non-barrel half of stage 6. Returns true if the agent died this step. */
function stepHazardCollisions(w: World): boolean {
  if (w.agent.invuln > 0) return false;

  const body = w.agent.body;
  const died = resolveHazardContacts(w.hazards, body, (x, y, chain) => {
    emit({ type: 'BarrelSmashed', x, y });
    scoreSmash(w.session, chain);
  });
  if (!died) return false;

  emit({ type: 'AgentHit', x: body.x, y: body.y });
  hitAgent(w.agent);
  loseLife(w.session);
  return true;
}

function stepDelivery(w: World): void {
  if (w.session.cleared || !w.session.gateOpen) return;
  // ORDER PINS ARE A SECOND OBJECTIVE, NOT A SECOND GATE. The gated ladder still
  // opens on the rakhi sweep alone — the player is never stopped halfway up by a
  // condition they cannot see — and the pins are checked at the door, where the
  // one thing still missing is legible and the walk back is short.
  if (w.hazards.pinsLeft > 0) return;

  const target = w.params.def.customerAt;
  const b = w.agent.body;
  const dx = target.x - b.x;
  const dy = target.y - (b.y - b.h * 0.5);
  // Reusing the pickup radius rather than inventing a delivery radius: the two
  // are the same promise to the player — "if it looks like you touched it, you
  // touched it" — and a second constant would eventually be tuned apart from the
  // first for no reason anyone could state.
  if (dx * dx + dy * dy > RAKHI.pickupR * RAKHI.pickupR) return;

  deliverAgent(w.agent);
  const perfect = w.session.deaths === 0 && w.session.rakhiCount === w.session.rakhiTotal;
  clearLevel(w.session, w.params, perfect);
  emit({ type: 'LevelCleared', timeLeft: w.session.timeLeft });
  w.done = true;
}

// ─── Housekeeping ───────────────────────────────────────────────────────────

/** Tear a world down between levels. Cheaper and safer than dropping it. */
export function resetWorld(w: World): void {
  clearAllBarrels(w.barrels);
  w.hazards = makeHazards(w.stage, w.params.def, w.params.flameCountDelta);
  w.monkey = makeMonkey(w.params.def, w.params.intervalMult);
  // Re-aliased, never copied. See `spawnTimers`.
  w.spawnTimers = w.monkey.timers;
  w.throwPause = 0;
  w.hold = 0;
  w.elapsed = 0;
  w.done = false;
}

/**
 * Belt direction for the presentation layer: +1, -1, or 0 while the telegraph is
 * running. READ FROM THE HAZARD STATE, never recomputed from `elapsed` — a
 * warning that can disagree with the event it warns about is worse than no
 * warning, and the only way to guarantee they agree is for both to be the same
 * field. BELT.flipWarnSec is the number game/hazards.ts sets it from.
 */
export function beltPhase(w: World): number {
  if (w.hazards.beltWarn) return 0;
  return w.hazards.beltDir;
}

/** The flip telegraph's own length, re-exported so the renderer holds no copy. */
export const BELT_WARN_SEC = BELT.flipWarnSec;

/** Terminal fall speed, re-exported for the debug overlay. Nothing else uses it. */
export const MAX_FALL = PHYS.maxFallSpeed;
