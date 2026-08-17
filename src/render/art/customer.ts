/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE CUSTOMER — the goal, standing in a lit doorway.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: A GOAL THAT LOOKS LIKE SCENERY.
 *
 * The top of the tower has a monkey on it, a shutter over it and a girder under
 * it. If the customer is one more brown shape up there, the player spends their
 * first run looking for the exit. So the customer is the only figure in the
 * game drawn in `customerBody` — a cool informative blue, the one hue the stage
 * palette does not otherwise contain — and she stands in a DOORWAY, which is a
 * shape the eye reads as "a place you go" without being told.
 *
 * The doorway is split out from the figure deliberately: the frame never moves,
 * so `drawDoorwayArt` is baked into the static stage layer, and only the person
 * is re-blitted per frame. Baking the two together would put a rectangle the
 * size of a door into the per-frame path budget for no reason.
 *
 * ─── THE BOUNCE IS A TRANSFORM ─────────────────────────────────────────────
 *
 * Delivery makes her hop. That is a translate applied by the caller, not a set
 * of bakes: a hop is continuous, and quantising it into four drawings would
 * make the one genuinely happy moment in the game look like a stutter.
 */

import { COLORS } from '../../brand';
import { bake, blit } from '../prerender';
import { roundRect } from '../shapes';

/** The doorway, in stage units, measured from the customer's feet point. */
const DOOR_W = 54;
const DOOR_H = 58;

const BOX_W = 44;
const BOX_H = 50;
const FOOT_X = 22;
const FOOT_Y = 47;
const CX = 22;

export type CustomerPose = 'wait' | 'happy';

/**
 * The doorway behind her. Drawn in world coordinates directly — it is part of
 * the static stage bake and therefore already inside a baked context.
 */
export function drawDoorwayArt(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const left = x - DOOR_W / 2;
  const top = y - DOOR_H;

  // The frame. A rounded arch, not a rectangle: a rectangle at this size is
  // indistinguishable from a girder end seen face-on.
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(left, top + 18);
  ctx.quadraticCurveTo(left, top, left + DOOR_W / 2, top);
  ctx.quadraticCurveTo(left + DOOR_W, top, left + DOOR_W, top + 18);
  ctx.lineTo(left + DOOR_W, y);
  ctx.closePath();
  ctx.fillStyle = COLORS.doorFrame;
  ctx.fill();

  // The opening, inset. Lighter than the frame so the frame reads as a frame.
  const i = 5;
  ctx.beginPath();
  ctx.moveTo(left + i, y);
  ctx.lineTo(left + i, top + 18);
  ctx.quadraticCurveTo(left + i, top + i, left + DOOR_W / 2, top + i);
  ctx.quadraticCurveTo(left + DOOR_W - i, top + i, left + DOOR_W - i, top + 18);
  ctx.lineTo(left + DOOR_W - i, y);
  ctx.closePath();
  ctx.fillStyle = COLORS.doorPanel;
  ctx.fill();

  // The threshold step. Two units of shadow that plant the door on the girder
  // instead of leaving it floating a hair above it.
  ctx.fillStyle = COLORS.doorFrame;
  ctx.fillRect(left - 3, y - 2, DOOR_W + 6, 3);
}

/** The person. Feet-centre at (x, y); apply the hop as a translate before calling. */
export function drawCustomerArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  pose: CustomerPose,
): void {
  const canvas = bake(`customer:${pose}`, BOX_W, BOX_H, BOX_W * px, BOX_H * px, (c) =>
    paint(c, pose),
  );
  blit(ctx, canvas, x - FOOT_X, y - FOOT_Y, BOX_W, BOX_H);
}

// ─── The figure ─────────────────────────────────────────────────────────────
//
// `COLORS.text` is the keyline here rather than one of the `*Outline` tokens.
// Those belong to the agent, the barrel, the rakhi and the monkey — objects the
// player collides with — and borrowing one of them would mean a brand tuning
// its hazard's edge silently restyled a bystander. All five resolve to the
// brand's ink today; the point is that they need not.

const LINE = 1.6;

function inked(ctx: CanvasRenderingContext2D, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = COLORS.text;
  ctx.lineWidth = LINE;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

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

function paint(ctx: CanvasRenderingContext2D, pose: CustomerPose): void {
  const happy = pose === 'happy';
  ctx.lineCap = 'round';

  // Legs.
  limb(ctx, CX - 3.5, 33, CX - 4.5, 44, 6, COLORS.text);
  limb(ctx, CX + 3.5, 33, CX + 4.5, 44, 6, COLORS.text);

  // The kurta. Flared, so the silhouette is not a second delivery rider.
  ctx.beginPath();
  ctx.moveTo(CX - 8, 16);
  ctx.lineTo(CX + 8, 16);
  ctx.lineTo(CX + 11, 36);
  ctx.lineTo(CX - 11, 36);
  ctx.closePath();
  inked(ctx, COLORS.customerBody);

  // Arms. Waiting: down and folded. Delivered: both up.
  if (happy) {
    limb(ctx, CX - 7, 19, CX - 14, 8, 5, COLORS.customerBody);
    limb(ctx, CX + 7, 19, CX + 14, 8, 5, COLORS.customerBody);
    ctx.beginPath();
    ctx.arc(CX - 15, 7, 2.6, 0, Math.PI * 2);
    inked(ctx, COLORS.customerSkin);
    ctx.beginPath();
    ctx.arc(CX + 15, 7, 2.6, 0, Math.PI * 2);
    inked(ctx, COLORS.customerSkin);
  } else {
    limb(ctx, CX - 7, 19, CX - 8, 30, 5, COLORS.customerBody);
    limb(ctx, CX + 7, 19, CX + 8, 30, 5, COLORS.customerBody);
    ctx.beginPath();
    ctx.arc(CX - 9, 31, 2.6, 0, Math.PI * 2);
    inked(ctx, COLORS.customerSkin);
    ctx.beginPath();
    ctx.arc(CX + 9, 31, 2.6, 0, Math.PI * 2);
    inked(ctx, COLORS.customerSkin);
  }

  // Hair BEHIND the head. A top-knot, centred: offset to one side it reads as a
  // horn growing out of her temple, which is what the first version drew.
  ctx.beginPath();
  ctx.arc(CX, 2.2, 3.4, 0, Math.PI * 2);
  inked(ctx, COLORS.customerHair);
  ctx.beginPath();
  ctx.ellipse(CX, 9.5, 8.4, 8.6, 0, 0, Math.PI * 2);
  inked(ctx, COLORS.customerHair);

  // Face.
  ctx.beginPath();
  ctx.ellipse(CX, 10, 6.2, 7, 0, 0, Math.PI * 2);
  inked(ctx, COLORS.customerSkin);

  // A fringe over the top of the face, so the face sits INSIDE the hair.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(CX, 10, 6.2, 7, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = COLORS.customerHair;
  ctx.fillRect(CX - 7, 3, 14, 4.2);
  ctx.restore();

  // Eyes and mouth. The mouth is the pose: a line waiting, an arc delivered.
  ctx.fillStyle = COLORS.text;
  ctx.beginPath();
  ctx.arc(CX - 2.4, 10, 1.1, 0, Math.PI * 2);
  ctx.arc(CX + 2.4, 10, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.text;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  if (happy) ctx.arc(CX, 12.4, 2.6, 0.2, Math.PI - 0.2);
  else {
    ctx.moveTo(CX - 2, 13.6);
    ctx.lineTo(CX + 2, 13.6);
  }
  ctx.stroke();
}
