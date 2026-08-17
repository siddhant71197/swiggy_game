/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE RAKHI — a gold medallion on a red thread, and nothing else.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: THE GOLD COIN. Drawn as a disc with a dot in
 * it, the collectible reads as a coin, a button, a power-up — anything with a
 * circular silhouette. The rakhi's identity is not in the disc, it is in the
 * TWO THREAD TAILS hanging below it: they break the circle, they are the thing
 * a rakhi has that a coin does not, and they are the reason this object is
 * legible as itself at 22 units. Delete them and the whole festival read goes
 * with them, and no amount of gold puts it back.
 *
 * ─── THE KEYLINE IS LOAD-BEARING, NOT A STYLE CHOICE ───────────────────────
 *
 * The gem is rakhi red and the stage structure is Swiggy orange. Those two
 * measure ΔE2000 ≈ 21, which is comfortably visible side by side and well under
 * the threshold at which two things are "obviously different at a glance" while
 * one is moving past the other. `rakhiOutline` is what separates them. It is
 * stroked around the disc AND under the beads for that reason.
 *
 * ─── THE SHINE IS BAKED, THE BOB IS NOT ────────────────────────────────────
 *
 * The bob is a translate — free, continuous, and it must be continuous or a row
 * of three rakhis pops. The shine sweep is a moving highlight over a fixed
 * drawing, so it is quantised into SHINE_STEPS bakes: a continuous sweep would
 * mean rebuilding twenty paths per rakhi per frame, and at 8 steps over a
 * 2.4-second cycle nobody can see the quantisation.
 */

import { COLORS, withAlpha } from '../../brand';
import { bake, blit } from '../prerender';

/** Medallion radius, in stage units. */
const R = 11;
/** Cell padding for the keyline, the outermost beads and the thread droop. */
const PAD = 6;
const BOX_W = (R + PAD) * 2;
/** Tall enough for the disc PLUS the longer thread tail and its end bead. Get
 *  this short by two units and the tail is silently clipped square, which reads
 *  as a rendering artefact rather than as a shorter thread. */
const BOX_H = R + PAD + 30;
/** Disc centre inside the cell. */
const CX = R + PAD;
const CY = R + PAD;

/** Distinct shine drawings. See the header for why this is quantised at all. */
const SHINE_STEPS = 8;
/** Seconds for the highlight to travel once around the medallion. */
const SHINE_SEC = 2.4;

/** Pearls around the rim. Eight reads as a ring; six reads as a flower. */
const BEADS = 8;

/**
 * Which shine drawing to show. Phase-offset per rakhi index so a row of three
 * reads as three objects rather than as one object drawn three times — the same
 * reason the bob is offset in the caller.
 */
export function rakhiShine(simTime: number, index: number): number {
  const t = simTime / SHINE_SEC + index * 0.31;
  const s = Math.floor((t - Math.floor(t)) * SHINE_STEPS) % SHINE_STEPS;
  return s < 0 ? s + SHINE_STEPS : s;
}

/** Draw a rakhi whose medallion centre is at (x, y) in stage units. */
export function drawRakhiArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  shine: number,
): void {
  const canvas = bake(`rakhi:${shine}`, BOX_W, BOX_H, BOX_W * px, BOX_H * px, (c) =>
    paint(c, shine),
  );
  blit(ctx, canvas, x - CX, y - CY, BOX_W, BOX_H);
}

function paint(ctx: CanvasRenderingContext2D, shine: number): void {
  ctx.save();
  ctx.translate(CX, CY);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  threads(ctx);
  beads(ctx);
  medallion(ctx, shine);

  ctx.restore();
}

/**
 * THE WRIST THREADS, AND WHERE THEY LEAVE THE DISC IS THE WHOLE POINT.
 *
 * Two tails hanging STRAIGHT DOWN from the bottom of the medallion — the
 * obvious drawing — produce a round head on two symmetric limbs with a bead on
 * the end of each, which at 22 units is a small person with white shoes. That
 * is not a subtle failure; it is the only thing anybody saw.
 *
 * A rakhi is a BAND that goes round a wrist, so the threads leave the medallion
 * SIDEWAYS, at the rim, and droop. Nothing exits the bottom of the silhouette,
 * so there are no legs to read, and the sideways exit is also anatomically what
 * the object is.
 *
 * Drawn FIRST so the medallion covers where they attach: a thread that visibly
 * starts at the rim reads as glued on, one that disappears under the disc reads
 * as tied through it.
 */
function threads(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = COLORS.rakhiThread;
  ctx.lineWidth = 2.4;

  // Unequal lengths and unequal droop. Mirrored tails read as a gift bow;
  // mismatched ones read as string that has been tied by somebody.
  ctx.beginPath();
  ctx.moveTo(-R * 0.6, 1);
  ctx.bezierCurveTo(-R - 3, 3, -R - 4, 12, -R - 1.5, 19);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(R * 0.6, 1);
  ctx.bezierCurveTo(R + 3.5, 2, R + 4.5, 8, R + 1, 13);
  ctx.stroke();

  // A pearl on the end of each tail, in the bead colour rather than a stark
  // white: these are the last two marks in the drawing and they must not become
  // the first two things the eye finds.
  ctx.fillStyle = COLORS.rakhiBead;
  ctx.beginPath();
  ctx.arc(-R - 1.5, 19, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(R + 1, 13, 1.7, 0, Math.PI * 2);
  ctx.fill();
}

/** The ring of pearls, sitting proud of the medallion's rim. */
function beads(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.rakhiBead;
  ctx.strokeStyle = COLORS.rakhiOutline;
  ctx.lineWidth = 1;
  for (let i = 0; i < BEADS; i++) {
    const a = (i / BEADS) * Math.PI * 2 - Math.PI / 2;
    const bx = Math.cos(a) * (R - 0.6);
    const by = Math.sin(a) * (R - 0.6);
    ctx.beginPath();
    ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function medallion(ctx: CanvasRenderingContext2D, shine: number): void {
  // The locate halo. Low alpha, drawn under the disc — it makes an uncollected
  // rakhi findable in a busy frame without adding a colour to the object.
  ctx.fillStyle = COLORS.rakhiGhost;
  ctx.beginPath();
  ctx.arc(0, 0, R + 1.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.rakhiDisc;
  ctx.beginPath();
  ctx.arc(0, 0, R - 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R - 1, 0, Math.PI * 2);
  ctx.clip();

  // One shade step across the bottom-right. Flat, as everything here is.
  ctx.fillStyle = COLORS.rakhiDiscShade;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0.15, Math.PI * 0.95);
  ctx.closePath();
  ctx.fill();

  // THE SHINE SWEEP. A short bright arc travelling the rim — the reason a
  // static gold disc looks like metal rather than like a mustard circle.
  //
  // The sweep radius has to clear the KEYLINE's band or the highlight is drawn
  // underneath it and the medallion reads as a black target ring with a red
  // bullseye — which is what the first version of this file actually did. The
  // gold ring between gem and rim is only ~3 units wide; every ring drawn into
  // it has to be allotted its own share of that.
  const a0 = (shine / SHINE_STEPS) * Math.PI * 2;
  ctx.strokeStyle = COLORS.rakhiDiscHi;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, R - 3.6, a0, a0 + 1.15);
  ctx.stroke();
  // The trailing half of the sweep, fainter, so the highlight has a direction.
  ctx.strokeStyle = withAlpha(COLORS.rakhiDiscHi, 0.45);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, R - 3.6, a0 + 1.15, a0 + 2.1);
  ctx.stroke();

  ctx.restore();

  // The rim keyline. See the header — this is what holds rakhi red off Swiggy
  // orange. It sits ON the rim, not inside it: drawn inboard it eats the gold.
  ctx.strokeStyle = COLORS.rakhiOutline;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(0, 0, R - 1.2, 0, Math.PI * 2);
  ctx.stroke();

  // The central gem, with its own tiny catchlight.
  ctx.fillStyle = COLORS.rakhiGem;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.rakhiOutline;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = COLORS.rakhiDiscHi;
  ctx.beginPath();
  ctx.arc(-1.4, -1.6, 1.2, 0, Math.PI * 2);
  ctx.fill();
}
