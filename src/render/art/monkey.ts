/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE THROWER — a gorilla at the top of the tower.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: A HAZARD SOURCE THAT DOES NOT TELEGRAPH.
 *
 * The barrels come from up there, and a player who cannot see the throw coming
 * learns the spawn interval by dying to it. The four poses below are a
 * telegraph: idle → wind-up → throw is a readable ~0.5s beat before a barrel
 * appears, and the chest-beat after it is the punctuation that says the beat is
 * over and the next one has not started. None of this changes the sim; the pose
 * is derived from the spawn timer the sim already keeps.
 *
 * He is GORILLA-ish rather than monkey-ish on purpose: heavy shoulders, tiny
 * hips, long arms and a low head is a silhouette that reads as "throws heavy
 * things" from across the screen. A slender monkey with a tail reads as
 * decoration, and the player would learn to ignore him.
 *
 * Colours are the `monkey*` group throughout, and every mass takes a
 * `monkeyOutline` keyline for the same reason the agent does: the top girder is
 * orange and warm grey-brown against orange is a weak edge.
 */

import { COLORS } from '../../brand';
import { bake, blit } from '../prerender';
import { roundRect } from '../shapes';

const BOX_W = 76;
const BOX_H = 68;
/** Where the sim's anchor (the girder surface under him) lands in the cell. */
const FOOT_X = 38;
const FOOT_Y = 64;
const CX = 38;

export type MonkeyPose = 'idle' | 'wind' | 'throw' | 'beat';

/**
 * The pose, derived from the spawn countdown the sim already owns.
 *
 * `timer` is seconds until the next barrel; `sinceThrow` is seconds since the
 * last one left his hands. Both come straight off the world — there is no
 * animation clock here, which is what keeps the telegraph honest: if the sim
 * speeds up under the urgency threshold, the wind-up speeds up with it, for
 * free, because it is the same number.
 */
export function monkeyPose(timer: number, sinceThrow: number): MonkeyPose {
  if (sinceThrow < 0.22) return 'throw';
  if (sinceThrow < 0.75) return 'beat';
  if (timer < 0.45) return 'wind';
  return 'idle';
}

export function drawMonkeyArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  pose: MonkeyPose,
): void {
  const canvas = bake(`monkey:${pose}`, BOX_W, BOX_H, BOX_W * px, BOX_H * px, (c) => paint(c, pose));
  blit(ctx, canvas, x - FOOT_X, y - FOOT_Y, BOX_W, BOX_H);
}

// ─── Parts ──────────────────────────────────────────────────────────────────

const LINE = 1.8;

function inked(ctx: CanvasRenderingContext2D, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = COLORS.monkeyOutline;
  ctx.lineWidth = LINE;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** A capsule limb. Same construction as the agent's, same reason: joints. */
function limb(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  fill: string,
): void {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
  ctx.beginPath();
  roundRect(ctx, -w / 2, -w / 2, len + w, w, w / 2);
  inked(ctx, fill);
  ctx.restore();
}

/** Fist. Big, because the whole point of him is what is in it. */
function fist(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.arc(x, y, 5.6, 0, Math.PI * 2);
  inked(ctx, COLORS.monkeyFurDark);
}

/**
 * Head: low brow, wide muzzle, small deep-set eyes.
 *
 * The BROW is the expression. Eyes on a 20-unit head are two dots and carry
 * almost nothing; a heavy angled brow above them carries all of it, which is
 * why `monkeyBrow` is a token in the first place.
 */
function head(ctx: CanvasRenderingContext2D, hx: number, hy: number, brow: number): void {
  ctx.save();
  ctx.translate(hx, hy);

  // Cranium.
  ctx.beginPath();
  roundRect(ctx, -11, -11, 22, 20, 9);
  inked(ctx, COLORS.monkeyFur);

  // The crest ridge — the one line that separates a gorilla from a bear.
  ctx.beginPath();
  ctx.moveTo(-3.5, -11.5);
  ctx.quadraticCurveTo(0, -15, 3.5, -11.5);
  ctx.closePath();
  inked(ctx, COLORS.monkeyFurDark);

  // Muzzle.
  ctx.beginPath();
  ctx.ellipse(0, 3.4, 8.4, 6.2, 0, 0, Math.PI * 2);
  inked(ctx, COLORS.monkeyMuzzle);

  // Nostrils and mouth, cut into the muzzle.
  ctx.fillStyle = COLORS.monkeyFurDark;
  ctx.beginPath();
  ctx.ellipse(-2.4, 1.6, 1.1, 0.8, 0, 0, Math.PI * 2);
  ctx.ellipse(2.4, 1.6, 1.1, 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.monkeyFurDark;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-3.6, 5.2);
  ctx.quadraticCurveTo(0, 5.2 + brow * 2.2, 3.6, 5.2);
  ctx.stroke();

  // Ears, tucked at the widest point of the cranium rather than above it —
  // higher and they line up with the brow and the whole head reads as a hat.
  ctx.beginPath();
  ctx.arc(-10.5, 0.5, 3, 0, Math.PI * 2);
  inked(ctx, COLORS.monkeyFurDark);
  ctx.beginPath();
  ctx.arc(10.5, 0.5, 3, 0, Math.PI * 2);
  inked(ctx, COLORS.monkeyFurDark);

  // Eyes, then the brow OVER them. Order matters: the brow overlapping the eye
  // is what makes it read as deep-set rather than as a hat.
  ctx.fillStyle = COLORS.monkeyEye;
  ctx.beginPath();
  ctx.arc(-4, -3.2, 1.9, 0, Math.PI * 2);
  ctx.arc(4, -3.2, 1.9, 0, Math.PI * 2);
  ctx.fill();

  // The brow ridge is INSIDE the cranium's silhouette. Run it to the full
  // half-width and it overhangs the skull at both ends, and a dark bar wider
  // than the head it sits on is a hat brim, not a brow — which is exactly what
  // the first version looked like.
  ctx.fillStyle = COLORS.monkeyBrow;
  ctx.beginPath();
  roundRect(ctx, -7.6, -6.6 - brow * 0.6, 15.2, 4 + brow * 0.8, 1.8);
  ctx.fill();

  ctx.restore();
}

/** Shoulders, chest and the two short legs. Shared by every pose. */
function trunk(ctx: CanvasRenderingContext2D, lift: number): void {
  // Legs — squat, splayed, drawn first so the trunk overlaps them.
  limb(ctx, CX - 7, 44, CX - 13, 58, 11, COLORS.monkeyFurDark);
  limb(ctx, CX + 7, 44, CX + 13, 58, 11, COLORS.monkeyFurDark);
  ctx.beginPath();
  roundRect(ctx, CX - 20, 55, 15, 7, 3.5);
  inked(ctx, COLORS.monkeyFurDark);
  ctx.beginPath();
  roundRect(ctx, CX + 5, 55, 15, 7, 3.5);
  inked(ctx, COLORS.monkeyFurDark);

  // The barrel chest. Wide at the shoulders, narrow at the hips.
  ctx.beginPath();
  ctx.moveTo(CX - 19, 24 - lift);
  ctx.quadraticCurveTo(CX - 22, 40 - lift, CX - 11, 48);
  ctx.lineTo(CX + 11, 48);
  ctx.quadraticCurveTo(CX + 22, 40 - lift, CX + 19, 24 - lift);
  ctx.quadraticCurveTo(CX, 17 - lift, CX - 19, 24 - lift);
  ctx.closePath();
  inked(ctx, COLORS.monkeyFur);

  // The pale chest patch. The target for the beat pose, and the reason the beat
  // pose is legible at all.
  ctx.beginPath();
  ctx.ellipse(CX, 36 - lift * 0.5, 9, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.monkeyMuzzle;
  ctx.fill();
}

function paint(ctx: CanvasRenderingContext2D, pose: MonkeyPose): void {
  ctx.lineCap = 'round';
  switch (pose) {
    case 'wind':
      // Both arms drawn back over the head, body coiled low.
      trunk(ctx, 1);
      limb(ctx, CX - 15, 27, CX - 22, 8, 10, COLORS.monkeyFur);
      fist(ctx, CX - 23, 7);
      // The cocked arm crosses ABOVE the head, so the head has to be drawn last
      // or the arm covers the face — and a wind-up you cannot see the face of is
      // a wind-up that does not telegraph, which is the only reason it exists.
      limb(ctx, CX + 15, 27, CX + 6, 6, 10, COLORS.monkeyFur);
      fist(ctx, CX + 5, 5);
      head(ctx, CX, 17, 1.6);
      break;

    case 'throw':
      // Arms snapped forward and DOWN — the release, aimed at the floor he
      // rolls barrels onto.
      trunk(ctx, -2);
      limb(ctx, CX - 15, 26, CX - 27, 40, 10, COLORS.monkeyFur);
      fist(ctx, CX - 28, 42);
      head(ctx, CX, 12, 2.2);
      limb(ctx, CX + 15, 26, CX + 27, 40, 10, COLORS.monkeyFur);
      fist(ctx, CX + 28, 42);
      break;

    case 'beat':
      // Fists on the chest patch. The punctuation.
      trunk(ctx, 0);
      limb(ctx, CX - 16, 28, CX - 5, 36, 10, COLORS.monkeyFur);
      head(ctx, CX, 15, 1.2);
      limb(ctx, CX + 16, 28, CX + 5, 33, 10, COLORS.monkeyFur);
      fist(ctx, CX - 5, 37);
      fist(ctx, CX + 5, 33);
      break;

    default:
      // Idle: knuckles down, weight forward. The classic gorilla rest.
      trunk(ctx, 0);
      limb(ctx, CX - 16, 28, CX - 21, 50, 10, COLORS.monkeyFur);
      fist(ctx, CX - 22, 52);
      head(ctx, CX, 15, 0.6);
      limb(ctx, CX + 16, 28, CX + 21, 50, 10, COLORS.monkeyFur);
      fist(ctx, CX + 22, 52);
      break;
  }
}
