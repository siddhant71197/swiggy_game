/**
 * ══════════════════════════════════════════════════════════════════════════
 *  AGENT — the state machine, so "can I do this right now" has one answer.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: the boolean soup. `grounded`, `climbing`,
 * `dead`, `delivering` as four independent flags is four flags with sixteen
 * combinations, of which five are legal — and the eleven illegal ones are not
 * unreachable, they are simply untested. The one that ships is `climbing &&
 * !grounded && dead`: the player dies on a ladder, the death animation plays,
 * and the respawned agent is still attached to a rail he is no longer near, so
 * he slides up the screen. One `state` field makes those eleven states
 * unspellable rather than merely unlikely.
 *
 * ─── VARIABLE JUMP HEIGHT IS DELIBERATELY NOT IMPLEMENTED ──────────────────
 *
 * The modern default is to hold the button for a higher jump, and it is wrong
 * for this game specifically. The entire skill of a barrel climber is timing a
 * jump against a KNOWN arc: the player learns exactly one parabola, and after
 * about ninety seconds they can read "will I clear that barrel" from the gap
 * alone, without thinking. Make the arc depend on how long a thumb stayed on
 * glass and that reading becomes unreliable — every mistimed jump is now
 * ambiguous between "I was early" and "I let go early", and the player cannot
 * tell which, so they cannot improve. Worse, on touch the release event is the
 * least reliable one in the pipeline; a browser stealing the gesture for a
 * scroll would silently shorten a jump.
 *
 * So jump is a PRESS EDGE, never a held state. `jump` arriving true on
 * consecutive frames is one jump, and the buffer below is what makes that feel
 * generous rather than strict.
 *
 * COYOTE TIME and the INPUT BUFFER are the same idea pointed in opposite
 * directions: the first forgives the player who is late, the second the player
 * who is early. On a touchscreen the input pipeline alone eats most of a frame,
 * so without them a correctly-timed jump is regularly a missed one — and the
 * player blames the game, correctly.
 *
 * No DOM, no clock, no unseeded randomness.
 */

import { AGENT, CLIMB, PHYS } from '../config/tuning';
import type { Body, Dir } from '../core/types';
import {
  airStep,
  airSteer,
  applyBelt,
  beginStep,
  climbMove,
  dismountGirder,
  findGrab,
  makeBody,
  snapToRail,
  walkSurface,
} from './physics';
import { surfaceYAt, type Stage } from './stage';

export type AgentState = 'run' | 'air' | 'climb' | 'hit' | 'deliver';

/**
 * What the input layer hands the sim. Four fields, no device vocabulary — the
 * same struct is produced by a d-pad, a keyboard and the headless bot, which is
 * the only reason the bot can play the real game rather than a stub of it.
 */
export interface Intent {
  dir: Dir;
  up: boolean;
  down: boolean;
  jump: boolean;
}

export interface Agent {
  body: Body;
  state: AgentState;

  /** Last non-zero facing. Cosmetic, but the sim owns it so replays match. */
  face: Dir;

  /** Seconds of coyote time remaining. */
  coyote: number;
  /** Seconds a buffered jump press stays live. */
  buffer: number;
  /** Previous frame's raw jump input — this is what makes jump an EDGE. */
  heldJump: boolean;

  /** Rail currently attached to, else -1. */
  ladderId: number;

  /** Death freeze / respawn timers, in seconds. */
  freeze: number;
  invuln: number;

  /**
   * Multiplier on PHYS.runSpeed. 1 is unboosted.
   *
   * A FIELD RATHER THAN A PARAMETER, deliberately. `stepAgent` already takes six
   * arguments and the seventh would be the one every future powerup adds another
   * of; more to the point, the boost is a property of the agent's current state —
   * exactly like `invuln` — and the world writes it once a step from
   * `turboActive`. Keeping it off the signature also means nothing that calls
   * `stepAgent` has to know the turbo exists.
   */
  speedMult: number;

  /** Barrels cleared since leaving the ground. Reset on touchdown. */
  airCleared: number;
  /** True for the whole airborne arc; scoring reads it, not `state`. */
  airborne: boolean;
}

export function makeAgent(x: number, y: number): Agent {
  return {
    // The hitbox is smaller than the sprite in BOTH axes — see AGENT.hitboxWFrac
    // in tuning. `w` is half-width and `h` is full height, per the Body contract.
    body: makeBody(x, y, (AGENT.drawW * AGENT.hitboxWFrac) / 2, AGENT.drawH * AGENT.hitboxHFrac),
    state: 'run',
    face: 1,
    coyote: 0,
    buffer: 0,
    heldJump: false,
    ladderId: -1,
    freeze: 0,
    invuln: 0,
    speedMult: 1,
    airCleared: 0,
    airborne: false,
  };
}

/** Put the agent back at the level's start, keeping nothing but his identity. */
export function respawnAgent(a: Agent, stage: Stage, x: number, y: number): void {
  const b = a.body;
  b.x = x;
  b.y = y;
  b.px = x;
  b.py = y;
  b.vx = 0;
  b.vy = 0;
  b.grounded = false;
  b.segId = -1;
  a.state = 'run';
  a.ladderId = -1;
  a.coyote = 0;
  a.buffer = 0;
  // Latched TRUE, not false — "assume the button is already down". A thumb
  // resting on the jump pad through the death freeze must not produce an edge
  // the instant control returns, which is the classic "I respawned and
  // immediately jumped into the thing that just killed me".
  a.heldJump = true;
  a.freeze = 0;
  a.invuln = AGENT.invulnSec;
  a.airCleared = 0;
  a.airborne = false;

  // Settle onto whatever girder the start point sits on, so frame one is a
  // grounded frame rather than a one-frame fall the player can see.
  const seg = dismountGirder(stage, x, y);
  if (seg >= 0) {
    b.segId = seg;
    b.grounded = true;
    const sy = surfaceYAt(stage.girders[seg]!, x);
    if (!Number.isNaN(sy)) b.y = sy;
  }
}

/** Enter the death state. The world owns what happens after the freeze. */
export function hitAgent(a: Agent): void {
  a.state = 'hit';
  a.ladderId = -1;
  a.freeze = AGENT.deathFreezeSec;
  a.body.vx = 0;
  a.body.vy = 0;
  a.airborne = false;
  a.airCleared = 0;
}

/** Lock the agent into the delivery beat. Input is ignored from here. */
export function deliverAgent(a: Agent): void {
  a.state = 'deliver';
  a.ladderId = -1;
  a.body.vx = 0;
}

export function stepAgent(
  stage: Stage,
  a: Agent,
  intent: Intent,
  beltSpeed: number,
  gateUnlocked: boolean,
  dt: number,
): void {
  const b = a.body;
  beginStep(b);

  if (a.invuln > 0) a.invuln -= dt;

  // ── The jump EDGE, computed once, before any state branches on it ─────────
  // Every branch below reads `pressed`, never `intent.jump`. A branch that read
  // the raw flag would re-fire on every frame the thumb stayed down.
  const pressed = intent.jump && !a.heldJump;
  a.heldJump = intent.jump;
  if (pressed) a.buffer = PHYS.bufferSec;
  else if (a.buffer > 0) a.buffer -= dt;

  switch (a.state) {
    case 'hit':
      a.freeze -= dt;
      return;

    case 'deliver':
      return;

    case 'climb':
      stepClimb(stage, a, intent, dt);
      return;

    case 'run':
      stepRun(stage, a, intent, beltSpeed, gateUnlocked, dt);
      return;

    case 'air':
      stepAir(stage, a, intent, dt);
      return;
  }
}

// ─── run ────────────────────────────────────────────────────────────────────

function stepRun(
  stage: Stage,
  a: Agent,
  intent: Intent,
  beltSpeed: number,
  gateUnlocked: boolean,
  dt: number,
): void {
  const b = a.body;
  if (intent.dir !== 0) a.face = intent.dir;

  // A grab is tested BEFORE movement, so pressing up while walking past a rail
  // grabs the rail rather than the far side of it.
  const grab = findGrab(stage, b, intent.up, intent.down, gateUnlocked);
  if (grab >= 0) {
    enterClimb(a, grab);
    return;
  }

  // Ground speed is set, not accelerated. DK-style instant response: a run-up
  // ramp would make the distance covered by a jump depend on how long the player
  // had been holding left, which is exactly the arc unpredictability the header
  // rejects for variable jump height.
  b.vx = intent.dir * PHYS.runSpeed * a.speedMult;

  // BELT FIRST, then the body's own movement. See applyBelt in physics.ts.
  applyBelt(stage, b, beltSpeed, dt);

  const stillGrounded = walkSurface(stage, b, dt);
  if (stillGrounded) a.coyote = PHYS.coyoteSec;
  else if (a.coyote > 0) a.coyote -= dt;

  if (a.buffer > 0 && a.coyote > 0) {
    launch(a);
    return;
  }

  if (!stillGrounded) {
    a.state = 'air';
    a.airborne = true;
    a.airCleared = 0;
  }
}

function launch(a: Agent): void {
  const b = a.body;
  b.vy = PHYS.jumpV;
  b.grounded = false;
  b.segId = -1;
  a.state = 'air';
  a.airborne = true;
  a.airCleared = 0;
  // Both timers are spent, not decayed. Leaving either alive lets one press
  // produce two jumps across a landing frame.
  a.buffer = 0;
  a.coyote = 0;
}

// ─── air ────────────────────────────────────────────────────────────────────

function stepAir(stage: Stage, a: Agent, intent: Intent, dt: number): void {
  const b = a.body;
  if (intent.dir !== 0) a.face = intent.dir;

  // BOTH speed reads carry the multiplier, ground and air. Boosting only the
  // ground would change the jump's horizontal reach mid-arc — the player would
  // launch fast and drift slow — and the one thing this game's jump may never do
  // is have two different parabolas. See the header on variable jump height.
  airSteer(b, intent.dir * PHYS.runSpeed * a.speedMult, dt);

  if (a.coyote > 0) a.coyote -= dt;

  const seg = airStep(stage, b, PHYS.gravity, dt);
  if (seg < 0) {
    // Fell out of the world. Not reachable on layout A — the ground floor is
    // walled at both ends — but any level whose bottom floor is open needs the
    // fall to end somewhere, and a body accelerating forever is worse than a
    // death.
    //
    // THE HELMET DOES NOT SAVE YOU FROM THIS, AND MUST NOT.
    //
    // This is the one death in the game with no floor waiting underneath it. The
    // helmet's promise is "the next hit is free" — it absorbs a barrel, a flame, a
    // scooter, all of which leave the player standing somewhere. Absorb the void
    // instead and the player survives at y = 900 with no girder beneath them,
    // still falling, still out of bounds, and the only thing the helmet bought
    // them is a level they cannot lose and cannot finish. That is why this call
    // goes straight to `hitAgent` and never through world.ts's `agentStruck`,
    // which is the ONE place the helmet is allowed to intercept.
    if (b.y > stage.h + PHYS.maxSnap) hitAgent(a);
    return;
  }

  a.state = 'run';
  a.airborne = false;
  a.coyote = PHYS.coyoteSec;
  // A press made just before touchdown fires now — the buffer's entire purpose.
  if (a.buffer > 0) launch(a);
}

// ─── climb ──────────────────────────────────────────────────────────────────

function enterClimb(a: Agent, ladderId: number): void {
  const b = a.body;
  a.state = 'climb';
  a.ladderId = ladderId;
  b.vx = 0;
  b.vy = 0;
  b.grounded = false;
  b.segId = -1;
  a.airborne = false;
  a.airCleared = 0;
  // The buffer is dropped on attach. Otherwise a jump pressed a tenth of a
  // second before grabbing a ladder fires the moment the player steps off it.
  a.buffer = 0;
}

function stepClimb(stage: Stage, a: Agent, intent: Intent, dt: number): void {
  const b = a.body;
  const l = stage.ladders[a.ladderId];
  if (!l) {
    a.state = 'air';
    a.airborne = true;
    a.ladderId = -1;
    return;
  }

  // ── JUMP IS DISABLED WHILE CLIMBING, AND IT IS A RULE, NOT AN OVERSIGHT ──
  // Not implemented is the implementation: there is no jump branch in this
  // function. Allowing it produces ladder-hop cheese — grab, jump, re-grab
  // higher — which climbs faster than climbing, ignores the barrels entirely
  // and trivialises every level in the game with one input the player discovers
  // by accident in the first minute. The buffered press is discarded on attach
  // so it cannot leak out of the state either.

  const dirY = (intent.down ? 1 : 0) - (intent.up ? 1 : 0);

  snapToRail(b, l, dt);
  climbMove(b, l, dirY, dt);

  // Step off at the top. `mountY` on the way off matches the tolerance that let
  // the player on, so a rail that could be mounted can always be left.
  if (b.y <= l.yTop + 0.001) {
    const seg = dismountGirder(stage, b.x, l.yTop);
    if (seg >= 0) {
      land(a, stage, seg);
      return;
    }
  }

  if (b.y >= l.yBottom - 0.001) {
    const seg = dismountGirder(stage, b.x, l.yBottom);
    if (seg >= 0 && intent.down) {
      land(a, stage, seg);
      return;
    }
    // Pressing DOWN at the foot of a ladder whose bottom is in mid-air (a
    // broken rail authored that way) simply holds. Dropping the player would be
    // a fall they did not ask for.
  }
}

function land(a: Agent, stage: Stage, segId: number): void {
  const b = a.body;
  b.segId = segId;
  b.grounded = true;
  b.vy = 0;
  const sy = surfaceYAt(stage.girders[segId]!, b.x);
  if (!Number.isNaN(sy)) b.y = sy;
  a.state = 'run';
  a.ladderId = -1;
  a.coyote = PHYS.coyoteSec;
  a.airborne = false;
}

/** Whether a grab would be accepted right now. For the HUD hint, nothing else. */
export function canGrabHere(stage: Stage, a: Agent, gateUnlocked: boolean): boolean {
  return findGrab(stage, a.body, true, true, gateUnlocked) >= 0;
}

/** The climb tolerance, re-exported so callers do not import CLIMB for one field. */
export const GRAB_X = CLIMB.grabX;
