/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE DELIVERY AGENT — the whole brand read, at 30×44.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: AN ORANGE MAN ON AN ORANGE TOWER.
 *
 * The girders ARE the brand colour (see the note on `girderFace` in the
 * derivation), and so is the rider's shirt, and so is his bag. Drawn as flat
 * fills with no keyline, the player's own avatar dissolves into the floor he is
 * standing on at exactly the size this game draws him. Every shape below is
 * therefore stroked in `agentOutline`, and the white reflective bands are not
 * decoration — they are the second separator, the one that survives when the
 * keyline is a single device pixel on a 0.6-quality backing store.
 *
 * ─── THE RECOGNITION CUE HIERARCHY, AND THE SILHOUETTE HONOURS IT ──────────
 *
 * 1. THE BIG BOXY ORANGE CUBE BACKPACK, worn high on the back, with a white
 *    S-Pin on it. This is the single most recognisable thing about a Swiggy
 *    rider — more than the shirt, far more than the face — so it gets the
 *    largest uninterrupted area in the drawing and it BREAKS THE SILHOUETTE:
 *    it sticks out behind the torso, which is what makes the figure read as
 *    "carrying something" from a shape alone.
 * 2. The orange full-sleeve shirt with white reflective bands.
 * 3. The dark open-face helmet with a small orange stripe.
 *
 * Anything that competes with (1) is wrong even if it is more anatomically
 * correct. The arms are deliberately simple for this reason.
 *
 * ─── THE PIN IS A PATH, NOT A BLIT ─────────────────────────────────────────
 *
 * `drawEmblem` is PLATED artwork — a knockout of it now throws — so the ~10-unit
 * pin on the bag is drawn here as a solid teardrop: a circle plus its two
 * TANGENT lines to a point below. The naive construction (a circle with a
 * triangle stuck under it) leaves two visible kinks where the triangle crosses
 * the arc, and at 10 units those kinks are the entire difference between a
 * location pin and a balloon. Same construction as `pinPath` in mark.ts; it is
 * repeated rather than exported because that one is the MARK's geometry and
 * this one is a costume detail, and coupling them would mean a brand tuning its
 * logo silently restyled its rider.
 *
 * ─── EVERY POSE IS BAKED ───────────────────────────────────────────────────
 *
 * Nine poses, one facing. The figure is ~40 paths; rebuilt per frame that is the
 * hot loop's largest single line, and there is exactly one agent on screen so a
 * bake is never evicted for being numerous. The mirror is a transform at blit
 * time, which halves the cache for free.
 */

import { COLORS } from '../../brand';
import { bake, blit } from '../prerender';
import { roundRect } from '../shapes';

// ─── The art box ────────────────────────────────────────────────────────────
//
// Wider than AGENT.drawW (30) because the BAG OVERHANGS the body, and taller
// than AGENT.drawH (44) because the helmet sits above the head and the shoes
// sit below the feet line. The sim's box is the hitbox's parent, not the
// picture's — conflating them is how a character ends up cropped at the ankles
// on the one pose that reaches furthest.

/** Reference units across the baked cell. */
const BOX_W = 48;
/** Reference units down the baked cell. */
const BOX_H = 54;
/** Where the sim's feet-centre lands inside the cell. */
const FOOT_X = 24;
const FOOT_Y = 47;

/** Body centre line. Half a unit off FOOT_X so the two legs straddle it evenly. */
const CX = 24;

export type AgentPose =
  | 'idle'
  | 'run0'
  | 'run1'
  | 'run2'
  | 'climb0'
  | 'climb1'
  | 'jump'
  | 'hit'
  | 'deliver';

/** The run cycle, in the order the phase counter walks them. */
const RUN_CYCLE: readonly AgentPose[] = ['run0', 'run1', 'run2', 'run1'];

/** Reference units of travel per run frame. Tuned so a full stride is ~4 steps. */
const STRIDE = 11;

/**
 * Pick the pose from what the SIM already knows.
 *
 * No animation state is stored anywhere: the run phase is a function of the
 * body's x, which means it is deterministic, survives a pause, never desyncs
 * from the interpolated position, and costs nothing to reset. A frame counter
 * would drift against the lerp and would have to be cleared on respawn.
 */
export function agentPose(
  state: 'run' | 'air' | 'climb' | 'hit' | 'deliver',
  x: number,
  y: number,
  moving: boolean,
): AgentPose {
  switch (state) {
    case 'air':
      return 'jump';
    case 'hit':
      return 'hit';
    case 'deliver':
      return 'deliver';
    case 'climb':
      // Keyed on y, not x — a climber's hands alternate with HEIGHT gained.
      return Math.floor(Math.abs(y) / 9) % 2 === 0 ? 'climb0' : 'climb1';
    default:
      if (!moving) return 'idle';
      return RUN_CYCLE[Math.floor(Math.abs(x) / STRIDE) % RUN_CYCLE.length]!;
  }
}

// ─── Blit ───────────────────────────────────────────────────────────────────

/**
 * Draw the agent with his feet-centre at (x, y), in stage units.
 *
 * `px` is device pixels per reference unit — the bake has to be sized in device
 * pixels or it is magnified by the root transform and reads soft on every phone
 * with a dpr above 1, which is all of them.
 *
 * The climb pose ignores `face`: a body on a ladder is seen from behind, and
 * mirroring a back view produces a rider whose bag jumps sides while he climbs.
 */
export function drawAgentArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  pose: AgentPose,
  face: number,
): void {
  const canvas = bake(
    `agent:${pose}`,
    BOX_W,
    BOX_H,
    BOX_W * px,
    BOX_H * px,
    (c) => paint(c, pose),
  );

  const mirror = face < 0 && pose !== 'climb0' && pose !== 'climb1';
  ctx.save();
  ctx.translate(x, y);
  if (mirror) ctx.scale(-1, 1);
  blit(ctx, canvas, -FOOT_X, -FOOT_Y, BOX_W, BOX_H);
  ctx.restore();
}

// ─── The figure ─────────────────────────────────────────────────────────────

/** The keyline width. One value, so nothing in the figure reads heavier than the rest. */
const LINE = 1.6;

function strokeIt(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = COLORS.agentOutline;
  ctx.lineWidth = LINE;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Fill then keyline, in that order, on the path already built. */
function inked(ctx: CanvasRenderingContext2D, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fill();
  strokeIt(ctx);
}

/**
 * A limb: a capsule from (x0,y0) to (x1,y1).
 *
 * Capsules rather than rectangles because every joint in this figure is drawn
 * as an overlap, and two overlapping rounded ends read as a knee. Two
 * overlapping rectangle corners read as a break.
 */
function limb(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  fill: string,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const ang = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(ang);
  ctx.beginPath();
  roundRect(ctx, -w / 2, -w / 2, len + w, w, w / 2);
  inked(ctx, fill);
  ctx.restore();
}

/**
 * THE CUBE BAG. Cue #1, so it is drawn first (behind everything) and it is the
 * biggest single mass in the figure.
 *
 * `lean` shifts it back on the shoulders for the jump and climb poses — a bag
 * that stays welded to the torso through a jump reads as painted on.
 */
function bag(ctx: CanvasRenderingContext2D, bx: number, by: number, w: number, h: number): void {
  // Body.
  ctx.beginPath();
  roundRect(ctx, bx, by, w, h, 3.5);
  inked(ctx, COLORS.agentBag);

  // The lid: one shade step across the top third. Two steps would start to look
  // like rendering; one reads as a box with a flap, which is what it is.
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, bx, by, w, h, 3.5);
  ctx.clip();
  ctx.fillStyle = COLORS.agentBagShade;
  ctx.fillRect(bx, by + h * 0.62, w, h * 0.38);
  ctx.restore();

  // The seam between lid and body — `agentBagEdge` is the one token dark enough
  // to survive on top of the bag's own orange.
  ctx.beginPath();
  ctx.moveTo(bx + 0.8, by + h * 0.62);
  ctx.lineTo(bx + w - 0.8, by + h * 0.62);
  ctx.strokeStyle = COLORS.agentBagEdge;
  ctx.lineWidth = 1;
  ctx.stroke();

  // The S-Pin. Solid teardrop, tangent-constructed — see the header.
  pin(ctx, bx + w * 0.5, by + h * 0.34, w * 0.42);
}

/**
 * A solid teardrop pin centred horizontally on `cx`, head centred at `cy`.
 *
 *   cos α = r / d,  d = the tip's distance below the head's centre.
 *
 * The tangent point is where the tail leaves the circle, so the join has
 * continuous tangency at any head/tail proportion and there is no kink.
 */
function pin(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number): void {
  const r = w / 2;
  // A tail 1.9 head-radii long: short enough that the pin still reads as round
  // at 10 units, long enough that it is not a circle.
  const d = r * 2.1;
  const alpha = Math.acos(Math.max(-1, Math.min(1, r / d)));
  const a1 = Math.PI / 2 - alpha;
  const a2 = Math.PI / 2 + alpha;

  ctx.beginPath();
  ctx.moveTo(cx, cy + d);
  ctx.lineTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
  // Anticlockwise, so the sweep goes over the TOP of the head rather than
  // cutting straight across the tail's mouth.
  ctx.arc(cx, cy, r, a1, a2, true);
  ctx.closePath();
  ctx.fillStyle = COLORS.agentBagEmblem;
  ctx.fill();
}

/**
 * THE SHOULDER STRAP. Drawn over the torso, after it.
 *
 * Without this the bag and the body are two adjacent rectangles that happen to
 * touch, and at small sizes the bag reads as a separate floating crate. One
 * dark diagonal from the bag's top corner across the chest turns two shapes
 * into one worn object, and it costs a single stroke.
 */
function strap(ctx: CanvasRenderingContext2D, tx: number, ty: number, w: number, h: number): void {
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, tx, ty, w, h, 4);
  ctx.clip();
  ctx.strokeStyle = COLORS.agentBagEdge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tx - 3, ty + 1);
  ctx.lineTo(tx + w + 2, ty + h * 0.75);
  ctx.stroke();
  ctx.restore();
}

/** Torso, with the chest reflective band. Cue #2. */
function torso(ctx: CanvasRenderingContext2D, tx: number, ty: number, w: number, h: number): void {
  ctx.beginPath();
  roundRect(ctx, tx, ty, w, h, 4);
  inked(ctx, COLORS.agentShirt);

  ctx.save();
  ctx.beginPath();
  roundRect(ctx, tx, ty, w, h, 4);
  ctx.clip();
  // Shade down the trailing side, so the figure has a light direction without
  // anything as expensive or as un-flat as a gradient.
  ctx.fillStyle = COLORS.agentShirtShade;
  ctx.fillRect(tx, ty + h - 4, w, 4);
  // THE BAND. Also the silhouette separator that keeps an orange agent legible
  // on an orange girder — see the note on `agentBand` in the derivation.
  ctx.fillStyle = COLORS.agentBand;
  ctx.fillRect(tx - 1, ty + h * 0.42, w + 2, 3);
  ctx.restore();
}

/** A forearm cuff band. The second half of cue #2 and the reason the arms read. */
function cuff(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.agentBand;
  ctx.fill();
  strokeIt(ctx);
}

/** Head, helmet, visor. Cue #3 — small on purpose; it must not out-shout the bag. */
function head(ctx: CanvasRenderingContext2D, hx: number, hy: number, tilt: number): void {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);

  // Jaw and cheek — the only skin in the figure, and it is deliberately a small
  // area. An open-face helmet shows a wedge, not a circle.
  ctx.beginPath();
  roundRect(ctx, -4.6, -3.2, 9.2, 9, 3.4);
  inked(ctx, COLORS.agentSkin);
  ctx.beginPath();
  roundRect(ctx, -4.6, 2.4, 9.2, 3.4, 1.6);
  ctx.fillStyle = COLORS.agentSkinShade;
  ctx.fill();

  // The shell: a dome with a short brim forward.
  ctx.beginPath();
  ctx.arc(0, -1, 6.4, Math.PI, Math.PI * 2);
  ctx.lineTo(6.4, 1.6);
  ctx.lineTo(-6.4, 1.6);
  ctx.closePath();
  inked(ctx, COLORS.agentHelmet);

  // The stripe. One unit of brand, and the only orange above the shoulders.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, -1, 6.4, Math.PI, Math.PI * 2);
  ctx.lineTo(6.4, 1.6);
  ctx.lineTo(-6.4, 1.6);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = COLORS.agentHelmetStripe;
  ctx.fillRect(-7, -3.4, 14, 1.8);
  ctx.restore();

  // The visor lip, forward only. Translucent paper — it catches light without
  // introducing a colour the palette does not have.
  ctx.beginPath();
  roundRect(ctx, 1.2, 0.2, 5.8, 2.4, 1.2);
  ctx.fillStyle = COLORS.agentVisor;
  ctx.fill();

  ctx.restore();
}

/** One leg plus its shoe. */
function leg(
  ctx: CanvasRenderingContext2D,
  hipX: number,
  hipY: number,
  kneeX: number,
  kneeY: number,
  footX: number,
  footY: number,
): void {
  limb(ctx, hipX, hipY, kneeX, kneeY, 6.4, COLORS.agentTrouser);
  limb(ctx, kneeX, kneeY, footX, footY, 5.6, COLORS.agentTrouserShade);

  // THE ANKLE CUFF, AND IT IS NOT DECORATION.
  //
  // `agentTrouser`, `agentTrouserShade`, `agentShoe` and `agentOutline` all
  // resolve to near-black on this brand, so the entire lower half of the figure
  // — two thighs, two shins, two shoes and every keyline between them — merges
  // into one dark blob and the agent loses his stance. Two units of `agentBand`
  // at each ankle is the only light in that region and it is what makes two legs
  // read as two. Riders' trousers have reflective ankle bands for the identical
  // reason, at night, which is why this is honest as well as necessary.
  ctx.beginPath();
  roundRect(ctx, footX - 3, footY - 4.4, 6, 2.2, 1);
  ctx.fillStyle = COLORS.agentBand;
  ctx.fill();

  ctx.beginPath();
  roundRect(ctx, footX - 3.6, footY - 1.6, 8.4, 3.8, 1.8);
  inked(ctx, COLORS.agentShoe);
}

// ─── The poses ──────────────────────────────────────────────────────────────
//
// Each pose is a complete drawing rather than a rig with parameters. A rig
// would be less code and would make every pose a compromise between the others;
// nine hand-placed poses is the reason the hit pose can throw the head back and
// the deliver pose can push the parcel past the silhouette.

function paint(ctx: CanvasRenderingContext2D, pose: AgentPose): void {
  ctx.lineCap = 'round';
  switch (pose) {
    case 'climb0':
      climbPose(ctx, 1);
      break;
    case 'climb1':
      climbPose(ctx, -1);
      break;
    case 'jump':
      jumpPose(ctx);
      break;
    case 'hit':
      hitPose(ctx);
      break;
    case 'deliver':
      deliverPose(ctx);
      break;
    case 'run0':
      runPose(ctx, 0);
      break;
    case 'run1':
      runPose(ctx, 1);
      break;
    case 'run2':
      runPose(ctx, 2);
      break;
    default:
      runPose(ctx, -1);
      break;
  }
}

/**
 * The side view. `swing` is −1 for the idle (feet together) and 0..2 for the
 * three run frames: contact, pass, contact-opposite.
 */
function runPose(ctx: CanvasRenderingContext2D, swing: number): void {
  // Vertical bob. The pass frame is the one where a runner is highest, which is
  // what turns three still drawings into a gait rather than a shuffle.
  const bob = swing === 1 ? -1.6 : 0;
  // The idle is NOT feet-together. Two legs on the same line resolve into a
  // single dark column at 30 units and the figure loses its stance; a 3-unit
  // stagger is the smallest thing that keeps two legs reading as two.
  const spread = swing < 0 ? 3 : swing === 1 ? 1.5 : 6;
  const lead = swing === 2 ? -1 : 1;

  const hipY = 32 + bob;
  const shoeY = 45;

  // BACK leg first, so the front leg overlaps it and the figure has depth.
  leg(ctx, CX - 2.2, hipY, CX - 2.2 - spread * lead * 0.5, hipY + 6, CX - spread * lead, shoeY);

  // Cue #1, behind the torso and riding high on the back.
  bag(ctx, CX - 21, 8 + bob, 16, 21);

  torso(ctx, CX - 7.5, 16 + bob, 15, 17);
  strap(ctx, CX - 7.5, 16 + bob, 15, 17);
  head(ctx, CX + 1.5, 10 + bob, 0);

  // The forward arm, swinging opposite the forward leg.
  const armX = CX + 5;
  const armY = 20 + bob;
  const handX = armX + 4 + spread * 0.4 * -lead;
  const handY = armY + 8;
  limb(ctx, armX, armY, handX, handY, 5.4, COLORS.agentShirt);
  cuff(ctx, handX, handY, 2.6);

  // FRONT leg last.
  leg(ctx, CX + 2.2, hipY, CX + 2.2 + spread * lead * 0.5, hipY + 6, CX + spread * lead, shoeY);
}

/**
 * The back view, on a ladder. `hand` alternates which arm is high.
 *
 * Seen from behind, so the BAG IS THE WHOLE FIGURE — which is exactly right:
 * the one moment the player stares at their avatar longest is a slow climb, and
 * that is the moment the brand's most recognisable object fills the sprite.
 */
function climbPose(ctx: CanvasRenderingContext2D, hand: number): void {
  const legLift = 3 * hand;

  leg(ctx, CX - 4, 33, CX - 5, 39 - Math.max(0, legLift), CX - 5, 45 - Math.max(0, legLift));
  leg(ctx, CX + 4, 33, CX + 5, 39 - Math.max(0, -legLift), CX + 5, 45 - Math.max(0, -legLift));

  // Torso first, bag over it: from behind the bag is IN FRONT of the shirt.
  torso(ctx, CX - 9, 15, 18, 19);

  // Arms reaching up the rails, one higher than the other.
  const lY = 14 - 4 * hand;
  const rY = 14 + 4 * hand;
  limb(ctx, CX - 7, 20, CX - 11, lY, 5.4, COLORS.agentShirt);
  cuff(ctx, CX - 11, lY, 2.6);
  limb(ctx, CX + 7, 20, CX + 11, rY, 5.4, COLORS.agentShirt);
  cuff(ctx, CX + 11, rY, 2.6);

  bag(ctx, CX - 9.5, 13, 19, 22);

  // The back of the helmet. No face, no visor — this is the rear of the shell.
  ctx.beginPath();
  ctx.arc(CX, 10, 7, Math.PI, Math.PI * 2);
  ctx.lineTo(7 + CX, 12.4);
  ctx.lineTo(CX - 7, 12.4);
  ctx.closePath();
  inked(ctx, COLORS.agentHelmet);
  ctx.fillStyle = COLORS.agentHelmetStripe;
  ctx.fillRect(CX - 2, 3.4, 4, 9);
}

/** Airborne: knees tucked, trailing arm out. Reads as "committed", not "falling". */
function jumpPose(ctx: CanvasRenderingContext2D): void {
  leg(ctx, CX - 2.5, 30, CX - 8, 33, CX - 9.5, 39);
  bag(ctx, CX - 21, 6, 16, 21);
  torso(ctx, CX - 7.5, 14, 15, 17);
  strap(ctx, CX - 7.5, 14, 15, 17);
  head(ctx, CX + 2, 8, 0.12);
  limb(ctx, CX + 5, 18, CX + 12, 14, 5.4, COLORS.agentShirt);
  cuff(ctx, CX + 12, 14, 2.6);
  leg(ctx, CX + 2.5, 30, CX + 7, 32, CX + 8, 38);
}

/**
 * Hit. The whole figure is rotated, not just the head.
 *
 * A death pose that only changes the face is invisible at this size; a rotated
 * silhouette is legible in peripheral vision, which is where the player's
 * attention actually is at the moment they get hit.
 */
function hitPose(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(CX, 40);
  ctx.rotate(-0.34);
  ctx.translate(-CX, -40);

  leg(ctx, CX - 2.5, 32, CX - 7, 37, CX - 11, 42);
  bag(ctx, CX - 21, 9, 16, 21);
  torso(ctx, CX - 7.5, 17, 15, 17);
  strap(ctx, CX - 7.5, 17, 15, 17);
  head(ctx, CX + 2, 11, -0.2);
  // Both arms thrown up.
  limb(ctx, CX + 5, 20, CX + 11, 11, 5.4, COLORS.agentShirt);
  cuff(ctx, CX + 11, 11, 2.6);
  limb(ctx, CX - 5, 20, CX - 10, 12, 5.4, COLORS.agentShirt);
  cuff(ctx, CX - 10, 12, 2.6);
  leg(ctx, CX + 2.5, 32, CX + 8, 35, CX + 12, 39);

  ctx.restore();
}

/** Handing the order over: parcel forward, weight on the front foot. */
function deliverPose(ctx: CanvasRenderingContext2D): void {
  leg(ctx, CX - 2.5, 32, CX - 4, 38, CX - 5, 45);
  bag(ctx, CX - 21, 8, 16, 21);
  torso(ctx, CX - 7.5, 16, 15, 17);
  strap(ctx, CX - 7.5, 16, 15, 17);
  head(ctx, CX + 2, 10, 0.08);

  // The parcel. `agentBand` (paper) so it reads as a box and not as more bag —
  // two orange cubes in one 30-unit figure would cancel each other out.
  ctx.beginPath();
  roundRect(ctx, CX + 11, 17, 9, 9, 1.6);
  inked(ctx, COLORS.agentBand);
  ctx.beginPath();
  ctx.moveTo(CX + 15.5, 17);
  ctx.lineTo(CX + 15.5, 26);
  ctx.strokeStyle = COLORS.agentShirt;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  limb(ctx, CX + 5, 20, CX + 12, 22, 5.4, COLORS.agentShirt);
  cuff(ctx, CX + 12, 22, 2.6);
  leg(ctx, CX + 2.5, 32, CX + 5, 38, CX + 6, 45);
}
