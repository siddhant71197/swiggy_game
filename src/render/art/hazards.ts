/**
 * ══════════════════════════════════════════════════════════════════════════
 *  HAZARD ART — the lifts, the flares, the lanes, the shaker and the pins.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): SEVEN ORANGE THINGS ON AN ORANGE TOWER.
 * The stage skin is `primary`, the agent's bag is `primary`, and the obvious
 * move for a hazard — "make it hot, make it orange" — produces a field where
 * the floor, the player and the thing that kills the player are the same
 * colour. So SILHOUETTE carries the read here and colour only confirms it:
 *
 *   lift     a roofed car on cables — the only thing with a roof.
 *   flame    a tall teardrop on a dark tandoor foot, with eyes.
 *   tiffin   a stack of flat tins with a bail handle — flat where a barrel is round.
 *   scooter  two wheels and a box — the only thing with wheels.
 *   shaker   a perforated dome on a pale canister — the only PALE object.
 *   pin      a location teardrop, tip down — the only thing pointing at the floor.
 *
 * The one deliberate exception is the flame, which IS pure orange, because it
 * is also the only pure-orange thing on the field that MOVES. Motion plus hue
 * is the pair that separates it from the girders; neither alone would.
 *
 * THE FAILURE THIS FILE PREVENTS (2): THE HAZARD THAT ARRIVES UNANNOUNCED. A
 * dropper's lane is painted from the first frame of the level and flashes for
 * `tiffinWarnSec` before it fires; a lift's shaft rails are drawn over its whole
 * travel; the belt's reversal telegraph is in props.ts beside the belt itself.
 * Every one of those is a promise that the hazard was visible BEFORE it was
 * lethal, and the paint is the only place that promise can be kept.
 *
 * THE FAILURE THIS FILE PREVENTS (3): A CLOCK IN AN ART FILE. Nothing here
 * reads `performance.now()`. Flicker, wobble and pulse are all functions of the
 * SIM's own numbers — the body's position, or the `simTime` the scene passes in
 * — so a paused world, the death freeze and the unlock hit-stop all hold still
 * exactly as they are supposed to.
 *
 * ─── ANCHORS MATCH THE SIM'S ─────────────────────────────────────────────────
 *
 * Everything that has a body is drawn at FEET-CENTRE, because that is what the
 * sim stores; the pickups are drawn at their own centre, because that is what
 * `grabbed()` measures against. Getting this wrong is a sprite that is right
 * until something touches it.
 */

import { COLORS, withAlpha } from '../../brand';
import { HAZARD } from '../../config/tuning';
import { bake, blit } from '../prerender';
import { roundRect } from '../shapes';

/** The keyline every actor on the field carries. See the agent's note. */
const LINE = 1.6;

function inked(ctx: CanvasRenderingContext2D, fill: string, w = LINE): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = COLORS.barrelOutline;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// ─── The service lift ───────────────────────────────────────────────────────

/** The car's slope, matching the deck the sim writes: 1 in 12. */
const LIFT_SLOPE = 1 / 12;
/** How far the cage stands above the deck. */
const CAGE_H = 30;
/** Depth of the deck slab below the walking surface. */
const DECK_H = 10;

/**
 * The shaft the car runs in. PER FRAME and unbaked — two rails and a pulley is
 * four fills, and there are at most two cars on a stage.
 *
 * Drawn because a platform with no visible track is a platform that appears to
 * teleport: the player has to be able to see how far up the car goes BEFORE
 * they commit to standing on it.
 */
export function drawLiftShaftArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  yTop: number,
  yBottom: number,
  w: number,
): void {
  const railX = w + 5;
  const top = yTop - CAGE_H - 12;

  ctx.fillStyle = withAlpha(COLORS.liftCable, 0.45);
  ctx.beginPath();
  roundRect(ctx, x - railX - 1.5, top, 3, yBottom - top + DECK_H, 1.5);
  ctx.fill();
  ctx.beginPath();
  roundRect(ctx, x + railX - 1.5, top, 3, yBottom - top + DECK_H, 1.5);
  ctx.fill();

  // The head block and its pulley — the thing the cable comes off.
  ctx.beginPath();
  roundRect(ctx, x - railX - 4, top - 7, railX * 2 + 8, 9, 3);
  inked(ctx, COLORS.liftCage);
  ctx.fillStyle = COLORS.liftTrim;
  ctx.beginPath();
  ctx.arc(x, top - 2.5, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * One car, at the surface height `y` its centre currently sits at.
 *
 * The cell is baked FLAT and blitted under a rotation of the deck's own slope,
 * so the picture is derived from the same 1/12 the sim writes into the scratch
 * girder rather than from a number typed here twice.
 */
export function drawLiftCarArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  yTop: number,
  px: number,
): void {
  // The cable, drawn in world space: it has to reach the head block, which is a
  // different distance away on every frame, so it cannot live in the cell.
  const ang = Math.atan2(LIFT_SLOPE, 1);
  ctx.save();
  ctx.strokeStyle = COLORS.liftCable;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, yTop - CAGE_H - 14);
  ctx.lineTo(x, y - CAGE_H);
  ctx.stroke();
  ctx.restore();

  const boxW = w * 2 + 14;
  const boxH = CAGE_H + DECK_H + 10;
  const canvas = bake(
    `lift:${Math.round(w)}`,
    boxW,
    boxH,
    boxW * px,
    boxH * px,
    (c) => paintLift(c, w, boxW, boxH),
  );

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  blit(ctx, canvas, -boxW / 2, -(CAGE_H + 6), boxW, boxH);
  ctx.restore();
}

function paintLift(
  ctx: CanvasRenderingContext2D,
  w: number,
  boxW: number,
  _boxH: number,
): void {
  // Cell origin is the top-left; the deck surface sits CAGE_H + 6 down.
  ctx.save();
  ctx.translate(boxW / 2, CAGE_H + 6);

  const half = w + 4;

  // The cage: two posts and a roof. The roof is the whole silhouette read — it
  // is the only overhead mass anywhere in the world layer.
  ctx.beginPath();
  roundRect(ctx, -half + 1, -CAGE_H, 4, CAGE_H, 2);
  inked(ctx, COLORS.liftCage, 1.2);
  ctx.beginPath();
  roundRect(ctx, half - 5, -CAGE_H, 4, CAGE_H, 2);
  inked(ctx, COLORS.liftCage, 1.2);

  // Cross-brace, so the space between the posts reads as a cage rather than as
  // a gap. Thin and in the trim colour: it must not compete with the deck.
  ctx.strokeStyle = withAlpha(COLORS.liftTrim, 0.75);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-half + 3, -CAGE_H + 4);
  ctx.lineTo(half - 3, -4);
  ctx.moveTo(half - 3, -CAGE_H + 4);
  ctx.lineTo(-half + 3, -4);
  ctx.stroke();

  ctx.beginPath();
  roundRect(ctx, -half - 2, -CAGE_H - 6, half * 2 + 4, 7, 3);
  inked(ctx, COLORS.liftCage);

  // The deck. A DROP SHADOW UNDER IT, flat, for the same reason the girder has
  // one: a surface you stand on must sit on top of the world rather than in it.
  ctx.fillStyle = withAlpha(COLORS.text, 0.14);
  ctx.beginPath();
  roundRect(ctx, -half - 1, DECK_H - 2, half * 2 + 2, 5, 2.5);
  ctx.fill();

  ctx.beginPath();
  roundRect(ctx, -half, 0, half * 2, DECK_H, 3);
  inked(ctx, COLORS.liftCage);

  // The lit tread — the amber strip is what the eye lands on when it is looking
  // for somewhere to put the agent's feet.
  ctx.fillStyle = COLORS.liftTrim;
  ctx.beginPath();
  roundRect(ctx, -half + 2, 1, half * 2 - 4, 3, 1.5);
  ctx.fill();

  ctx.restore();
}

// ─── The tandoor flare ──────────────────────────────────────────────────────

const FLAME_W = 32;
const FLAME_H = 42;
const FLAME_FX = FLAME_W / 2;
const FLAME_FY = 38;
/** Flicker drawings. Three is enough to read as fire and cheap to cache. */
const FLAME_PHASES = 3;

/**
 * Which flicker drawing this flame is showing.
 *
 * Keyed on the flame's own x as well as on sim time, so two flames on the same
 * deck never flicker in lockstep — which reads as one object drawn twice.
 */
export function flamePhase(x: number, simTime: number): number {
  const p = Math.floor(simTime * 9 + x * 0.11) % FLAME_PHASES;
  return p < 0 ? p + FLAME_PHASES : p;
}

/** Draw a flame with its FEET-CENTRE at (x, y). */
export function drawFlameArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  phase: number,
  face: number,
): void {
  const canvas = bake(
    `flame:${phase}`,
    FLAME_W,
    FLAME_H,
    FLAME_W * px,
    FLAME_H * px,
    (c) => paintFlame(c, phase),
  );
  ctx.save();
  ctx.translate(x, y);
  if (face < 0) ctx.scale(-1, 1);
  blit(ctx, canvas, -FLAME_FX, -FLAME_FY, FLAME_W, FLAME_H);
  ctx.restore();
}

function paintFlame(ctx: CanvasRenderingContext2D, phase: number): void {
  ctx.save();
  ctx.translate(FLAME_FX, FLAME_FY);

  // The lean is the flicker: the plume tips one way, then the other, and the
  // silhouette disagrees with itself frame to frame. Same trick as the barrel's
  // roll phases and the same reason.
  const lean = (phase - 1) * 1.9;
  const tall = phase === 1 ? 2.5 : 0;
  const w = HAZARD.flameDrawW / 2;
  const h = HAZARD.flameDrawH;

  // The tandoor foot. DARK, and it is what stops the flame reading as a patch of
  // the girder it is standing on — the one hard value break in the drawing.
  ctx.beginPath();
  roundRect(ctx, -w - 2, -7, (w + 2) * 2, 7, 3);
  inked(ctx, COLORS.chuteBody);
  ctx.fillStyle = COLORS.chuteMouth;
  ctx.beginPath();
  roundRect(ctx, -w, -6, w * 2, 2.2, 1.1);
  ctx.fill();

  // The outer plume. It BULGES at a third of its height and pinches at the tip —
  // the first version ran straight from a full-width base to a point and read as
  // a tent, which on an orange tower is indistinguishable from a piece of
  // structure. The bulge is what makes it fire.
  ctx.beginPath();
  ctx.moveTo(-w * 0.78, -6);
  ctx.bezierCurveTo(-w * 1.15, -h * 0.34, -w * 0.85 + lean, -h * 0.72, lean * 1.5, -h - tall);
  ctx.bezierCurveTo(w * 0.85 + lean, -h * 0.72, w * 1.15, -h * 0.34, w * 0.78, -6);
  ctx.closePath();
  inked(ctx, COLORS.flameBody);

  // The amber heart, then the pale core. Two steps in, never a gradient.
  ctx.beginPath();
  ctx.moveTo(-w * 0.46, -6);
  ctx.bezierCurveTo(-w * 0.7, -h * 0.3, -w * 0.5 + lean, -h * 0.5, lean * 0.9, -h * 0.74 - tall);
  ctx.bezierCurveTo(w * 0.5 + lean, -h * 0.5, w * 0.7, -h * 0.3, w * 0.46, -6);
  ctx.closePath();
  ctx.fillStyle = COLORS.flameCore;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(lean * 0.4, -h * 0.28, w * 0.24, h * 0.17, 0, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.flameHot;
  ctx.fill();

  // TWO EYES. A flare with a face is an enemy; without one it is scenery, and
  // the player treats scenery as decoration until it kills them.
  ctx.fillStyle = COLORS.barrelOutline;
  ctx.beginPath();
  ctx.ellipse(-3.4, -h * 0.5, 1.7, 2.3, 0, 0, Math.PI * 2);
  ctx.ellipse(3.4, -h * 0.5, 1.7, 2.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── The falling tiffin ─────────────────────────────────────────────────────

const TIF_W = 32;
const TIF_H = 34;
const TIF_FX = TIF_W / 2;
const TIF_FY = 30;

/** Draw a tiffin stack with its FEET-CENTRE at (x, y). */
export function drawTiffinArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
): void {
  const canvas = bake('tiffin', TIF_W, TIF_H, TIF_W * px, TIF_H * px, paintTiffin);
  ctx.save();
  ctx.translate(x, y);
  // The wobble is a function of the fall distance, so it is deterministic, needs
  // no per-tiffin state, and stops dead when the world does.
  ctx.rotate(Math.sin(y * 0.05) * 0.16);
  blit(ctx, canvas, -TIF_FX, -TIF_FY, TIF_W, TIF_H);
  ctx.restore();
}

function paintTiffin(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(TIF_FX, TIF_FY);

  const w = HAZARD.tiffinDrawW / 2;

  // The bail handle, first and behind: a wire loop over the stack.
  ctx.strokeStyle = COLORS.liftTrim;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, -HAZARD.tiffinDrawH + 2, w * 0.62, Math.PI, 0);
  ctx.stroke();

  // TWO FLAT TINS, not one drum. Flat-and-stacked is the whole silhouette
  // difference from a barrel, which is round and rolls; these fall.
  for (let i = 0; i < 2; i++) {
    const top = -HAZARD.tiffinDrawH + 2 + i * 10.5;
    ctx.beginPath();
    roundRect(ctx, -w, top, w * 2, 10, 2.6);
    inked(ctx, COLORS.barrelBody);
    ctx.fillStyle = COLORS.barrelLid;
    ctx.beginPath();
    roundRect(ctx, -w + 1.4, top + 1.2, w * 2 - 2.8, 2.6, 1.3);
    ctx.fill();
  }

  // The side clamps, in amber, running the whole stack — the detail that says
  // "dabba" rather than "two boxes".
  ctx.fillStyle = COLORS.liftTrim;
  ctx.beginPath();
  roundRect(ctx, -w - 2, -HAZARD.tiffinDrawH + 3, 3, 19, 1.5);
  ctx.fill();
  ctx.beginPath();
  roundRect(ctx, w - 1, -HAZARD.tiffinDrawH + 3, 3, 19, 1.5);
  ctx.fill();

  ctx.restore();
}

// ─── The bouncing scooter ───────────────────────────────────────────────────

const SC_W = 42;
const SC_H = 38;
const SC_FX = SC_W / 2;
const SC_FY = 33;

/** Draw a scooter with its FEET-CENTRE at (x, y), facing `face`. */
export function drawScooterArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  face: number,
): void {
  const canvas = bake('scooter', SC_W, SC_H, SC_W * px, SC_H * px, paintScooter);
  ctx.save();
  ctx.translate(x, y);
  if (face < 0) ctx.scale(-1, 1);
  blit(ctx, canvas, -SC_FX, -SC_FY, SC_W, SC_H);
  ctx.restore();
}

function paintScooter(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(SC_FX, SC_FY);

  const w = HAZARD.scooterDrawW / 2;

  // A road smear under the wheels. `oilSlick` is the token for exactly this and
  // it doubles as the shadow that keeps the scooter off the backdrop.
  ctx.fillStyle = COLORS.oilSlick;
  ctx.beginPath();
  ctx.ellipse(0, -1, w, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // WHEELS FIRST. They are the read — nothing else in the world layer is round
  // and paired.
  for (const wx of [-w + 5, w - 5]) {
    ctx.beginPath();
    ctx.arc(wx, -5.5, 5.5, 0, Math.PI * 2);
    inked(ctx, COLORS.barrelOutline, 1.2);
    ctx.fillStyle = COLORS.liftCable;
    ctx.beginPath();
    ctx.arc(wx, -5.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Floorboard and leg shield, in slate. The scooter is NOT orange: the agent's
  // bag already owns that and the two would swap identities at speed.
  ctx.beginPath();
  ctx.moveTo(-w + 3, -9);
  ctx.lineTo(w - 8, -9);
  ctx.lineTo(w - 3, -20);
  ctx.lineTo(w - 9, -21);
  ctx.lineTo(w - 12, -13);
  ctx.lineTo(-w + 2, -13);
  ctx.closePath();
  inked(ctx, COLORS.liftCage);

  // Handlebar.
  ctx.strokeStyle = COLORS.barrelOutline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w - 6.5, -20);
  ctx.lineTo(w - 11, -24);
  ctx.stroke();

  // THE DELIVERY BOX, amber, over the back wheel — the Swiggy read, and the one
  // mass big enough to see at 30 units.
  ctx.beginPath();
  roundRect(ctx, -w + 1, -25, 15, 13, 2.6);
  inked(ctx, COLORS.liftTrim);
  ctx.fillStyle = COLORS.surface;
  ctx.beginPath();
  roundRect(ctx, -w + 4.5, -21.5, 8, 6, 1.6);
  ctx.fill();

  ctx.restore();
}

// ─── The tiffin dropper ─────────────────────────────────────────────────────

const LANE_W = HAZARD.tiffinDrawW + 8;

/**
 * THE PAINTED LANE, AND WHY IT IS ALWAYS ON.
 *
 * The lane is the telegraph. A tiffin falls straight through the tower at 1500
 * u/s² and cannot be dodged on sight; what makes it fair is that the column it
 * falls down is marked from the first frame of the level and flashes for
 * `HAZARD.tiffinWarnSec` before each release. Draw the flash only and the
 * player learns the lanes by dying in them once each.
 *
 * Drawn UNDER everything else in the world layer — it is floor marking, not an
 * object, and a lane painted over the girders would read as a wall.
 */
export function drawDropperLaneArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bottom: number,
  warnK: number,
): void {
  const left = x - LANE_W / 2;
  const h = bottom - y;
  if (h <= 0) return;

  ctx.save();

  // THE RESTING LANE. Quiet — it is on for the whole level and a lane that
  // shouted all the time would be a lane the player stopped seeing.
  ctx.fillStyle = withAlpha(COLORS.girderEdge, 0.08);
  ctx.fillRect(left, y, LANE_W, h);

  // Hazard stripes down both edges. Chevron-free on purpose: the belts already
  // own the chevron and two moving arrow patterns on one screen is a puzzle.
  ctx.fillStyle = withAlpha(COLORS.hazardCaution, 0.4);
  ctx.fillRect(left, y, 2.5, h);
  ctx.fillRect(left + LANE_W - 2.5, y, 2.5, h);

  // Rungs down the lane, so the column reads as a chute with depth rather than
  // as a flat translucent bar.
  ctx.fillStyle = withAlpha(COLORS.girderEdge, 0.13);
  for (let ly = y + 16; ly < bottom; ly += 26) {
    ctx.fillRect(left + 3, ly, LANE_W - 6, 3);
  }

  // THE ARMED LANE, drawn OVER the resting one rather than by scaling its
  // alphas. Measured on the device: ramping the resting fill made the warning
  // a slightly darker column — a change nobody notices while a barrel is on
  // screen. The armed state is a different colour (caution amber, not girder
  // shadow), a wider stripe and a filled ladder, so it is a state change rather
  // than an intensity change.
  if (warnK <= 0) {
    ctx.restore();
    return;
  }

  ctx.fillStyle = withAlpha(COLORS.hazardCaution, 0.34 * warnK);
  ctx.fillRect(left, y, LANE_W, h);
  ctx.fillStyle = withAlpha(COLORS.hazardCaution, warnK);
  ctx.fillRect(left - 1, y, 4, h);
  ctx.fillRect(left + LANE_W - 3, y, 4, h);
  ctx.fillStyle = withAlpha(COLORS.hazardCaution, 0.75 * warnK);
  for (let ly = y + 16; ly < bottom; ly += 26) {
    ctx.fillRect(left + 3, ly, LANE_W - 6, 3.5);
  }
  ctx.restore();
}

const CHUTE_W = 40;
const CHUTE_H = 22;

/** The hopper the tiffins come out of, at the top of the lane. */
export function drawDropperHeadArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  warn: boolean,
): void {
  const canvas = bake(
    `chute:${warn ? 'warn' : 'idle'}`,
    CHUTE_W,
    CHUTE_H,
    CHUTE_W * px,
    CHUTE_H * px,
    (c) => paintChute(c, warn),
  );
  blit(ctx, canvas, x - CHUTE_W / 2, y - CHUTE_H, CHUTE_W, CHUTE_H);
}

function paintChute(ctx: CanvasRenderingContext2D, warn: boolean): void {
  ctx.save();
  ctx.translate(CHUTE_W / 2, CHUTE_H);

  // The hopper body, then the funnel mouth under it.
  ctx.beginPath();
  roundRect(ctx, -CHUTE_W / 2 + 2, -CHUTE_H + 1, CHUTE_W - 4, 12, 3);
  inked(ctx, COLORS.chuteBody);

  ctx.beginPath();
  ctx.moveTo(-CHUTE_W / 2 + 5, -CHUTE_H + 12);
  ctx.lineTo(CHUTE_W / 2 - 5, -CHUTE_H + 12);
  ctx.lineTo(LANE_W / 2 - 2, -1);
  ctx.lineTo(-LANE_W / 2 + 2, -1);
  ctx.closePath();
  inked(ctx, COLORS.chuteMouth);

  // The caution lip. Lit while the dropper is about to fire, so the head agrees
  // with the lane instead of being a second, quieter opinion.
  ctx.fillStyle = warn ? COLORS.hazardCaution : withAlpha(COLORS.hazardCaution, 0.5);
  ctx.beginPath();
  roundRect(ctx, -LANE_W / 2, -3.5, LANE_W, 3.5, 1.6);
  ctx.fill();

  ctx.restore();
}

// ─── The masala shaker ──────────────────────────────────────────────────────

const SHK_W = 32;
const SHK_H = 40;
/**
 * The canister is drawn against a 26-unit cell and scaled up into a 32-unit one.
 *
 * Measured on the device: at 1.0 the shaker was a 20-unit object among 30-unit
 * hazards and read as debris. The powerup has to be the thing you notice from
 * the floor below, so it is deliberately the largest pickup on the field.
 */
const SHK_SCALE = 1.22;

/**
 * THE POWERUP MUST NOT LOOK LIKE A HAZARD.
 *
 * It is the only PALE object on the field and the only one that carries the
 * rakhi's own gold — the two cues the player has already been taught mean
 * "pick this up". A slate shaker with an orange cap would be read as a barrel
 * variant and walked around, which is the worst possible outcome for the one
 * object in the game that makes you invincible.
 */
export function drawShakerArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  pulse: number,
): void {
  // The locate-halo, unbaked because it breathes. Same token as the rakhi's, so
  // the two reward objects announce themselves the same way.
  ctx.fillStyle = withAlpha(COLORS.rakhiDiscHi, 0.16 + pulse * 0.16);
  ctx.beginPath();
  ctx.arc(x, y, HAZARD.shakerR * (0.72 + pulse * 0.14), 0, Math.PI * 2);
  ctx.fill();

  const canvas = bake('shaker', SHK_W, SHK_H, SHK_W * px, SHK_H * px, paintShaker);
  blit(ctx, canvas, x - SHK_W / 2, y - SHK_H / 2, SHK_W, SHK_H);
}

/** The same canister, small, in the agent's fist. See play.ts's held draw. */
export function drawShakerHeldArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  face: number,
): void {
  const canvas = bake('shaker', SHK_W, SHK_H, SHK_W * px, SHK_H * px, paintShaker);
  ctx.save();
  ctx.translate(x, y);
  // Smaller than the pickup, and it has to be: on the device at pickup size the
  // canister covered the rider's helmet and visor — a powerup that erases the
  // player's own head is a worse read than no powerup art at all.
  ctx.scale(0.62, 0.62);
  // Tipped as if being shaken, and tipped AWAY from the body so it never covers
  // the agent's own silhouette.
  ctx.rotate(face >= 0 ? 0.5 : -0.5);
  blit(ctx, canvas, -SHK_W / 2, -SHK_H / 2, SHK_W, SHK_H);
  ctx.restore();
}

function paintShaker(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(SHK_W / 2, SHK_H / 2);
  ctx.scale(SHK_SCALE, SHK_SCALE);

  // The canister — pale, with the shoulder taper that makes it a shaker and not
  // a tin.
  ctx.beginPath();
  ctx.moveTo(-7, -3);
  ctx.quadraticCurveTo(-8, 10, -6.5, 13);
  ctx.lineTo(6.5, 13);
  ctx.quadraticCurveTo(8, 10, 7, -3);
  ctx.closePath();
  ctx.fillStyle = COLORS.surface;
  ctx.fill();
  ctx.strokeStyle = COLORS.rakhiOutline;
  ctx.lineWidth = LINE;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Two masala bands. Amber over paper: warm, edible, and nothing like slate.
  ctx.fillStyle = COLORS.liftTrim;
  ctx.beginPath();
  roundRect(ctx, -7.2, 1.5, 14.4, 4, 1.4);
  ctx.fill();
  ctx.fillStyle = withAlpha(COLORS.liftTrim, 0.55);
  ctx.beginPath();
  roundRect(ctx, -6.8, 7.5, 13.6, 2.6, 1.2);
  ctx.fill();

  // The perforated dome cap, in the rakhi's gold.
  ctx.beginPath();
  ctx.moveTo(-7.6, -3);
  ctx.quadraticCurveTo(-7.2, -13.5, 0, -14);
  ctx.quadraticCurveTo(7.2, -13.5, 7.6, -3);
  ctx.closePath();
  ctx.fillStyle = COLORS.rakhiDisc;
  ctx.fill();
  ctx.strokeStyle = COLORS.rakhiOutline;
  ctx.lineWidth = LINE;
  ctx.stroke();

  ctx.fillStyle = COLORS.rakhiOutline;
  for (const [hx, hy] of [
    [-3.2, -8.4],
    [0, -10.2],
    [3.2, -8.4],
    [-1.7, -5.6],
    [1.7, -5.6],
  ] as const) {
    ctx.beginPath();
    ctx.arc(hx, hy, 0.95, 0, Math.PI * 2);
    ctx.fill();
  }

  // A spark off the cap — three strokes, the universal "this one is good".
  ctx.strokeStyle = COLORS.shutterOpenGlow;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(9, -13);
  ctx.lineTo(12, -15.5);
  ctx.moveTo(9.5, -9.5);
  ctx.lineTo(13, -9.5);
  ctx.moveTo(-9.5, -12);
  ctx.lineTo(-12.5, -14.5);
  ctx.stroke();

  ctx.restore();
}

// ─── The order pins ─────────────────────────────────────────────────────────

const PIN_W = 24;
const PIN_H = 30;

/** An order pin, at its CENTRE. `taken` is the pushed state. */
export function drawPinArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  taken: boolean,
): void {
  const canvas = bake(
    `pin:${taken ? 'done' : 'idle'}`,
    PIN_W,
    PIN_H,
    PIN_W * px,
    PIN_H * px,
    (c) => paintPin(c, taken),
  );
  blit(ctx, canvas, x - PIN_W / 2, y - PIN_H / 2, PIN_W, PIN_H);
}

function paintPin(ctx: CanvasRenderingContext2D, taken: boolean): void {
  ctx.save();
  ctx.translate(PIN_W / 2, PIN_H / 2);

  // A pushed pin sits lower and flatter — the state has to be legible from the
  // silhouette, because a player checking "have I got them all" is scanning the
  // whole tower, not reading colours one at a time.
  const drop = taken ? 4 : 0;
  const r = taken ? 5.6 : 7;

  ctx.fillStyle = withAlpha(COLORS.text, 0.14);
  ctx.beginPath();
  ctx.ellipse(0, 12, r * 0.9, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // The teardrop: a disc plus its two TANGENTS to the tip below it. Same
  // construction as the agent's bag pin — a circle with a triangle stuck under
  // it leaves two visible kinks at this size.
  const cy = -4 + drop;
  const tipY = 11 + drop;
  const d = tipY - cy;
  // acos, not asin: the tangent point is where CP ⟂ PT, so the angle at the
  // centre between "straight down" and the tangent is arccos(r/d). asin here
  // puts the join in the wrong place and the pin grows two kinks.
  const a = Math.acos(Math.min(1, r / d));
  ctx.beginPath();
  ctx.arc(0, cy, r, Math.PI / 2 + a, Math.PI / 2 - a, false);
  ctx.lineTo(0, tipY);
  ctx.closePath();
  inked(ctx, taken ? COLORS.pinPushed : COLORS.pinIdle);

  if (taken) {
    // A tick, not a dot: "done" is a different statement from "here".
    ctx.strokeStyle = COLORS.surface;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2.8, cy);
    ctx.lineTo(-0.8, cy + 2.2);
    ctx.lineTo(3, cy - 2.4);
    ctx.stroke();
  } else {
    ctx.fillStyle = COLORS.surface;
    ctx.beginPath();
    ctx.arc(0, cy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
