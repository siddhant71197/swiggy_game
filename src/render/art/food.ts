/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE ORDER — five dishes, and not one of them may read as a rakhi.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: A SECOND ROUND THING ON THE TOWER. Rakhis are
 * what unlock the door, and the rakhi counter is the one number the player has
 * to be able to trust. A dish that reads as a gold disc at 26 units does not
 * cost a little polish — it makes the counter untrustworthy, because the player
 * cannot tell what they just picked up and the HUD is the only witness.
 *
 * The brand's palettes already refuse to help a food item impersonate a rakhi
 * (see the note on `colors.foods` in src/brand/types.ts — greens, browns,
 * creams and a syrup-dark, deliberately not gold-forward). Colour alone is not
 * enough at speed, so the SILHOUETTES carry the read too, and every one of them
 * is built to be un-rakhi-like as its first job and appetising as its second:
 *
 *   biryani      WIDE and FLAT-BOTTOMED — a shallow bowl with a heaped mound.
 *   dosa         a wedge LYING DOWN, longer than it is tall.
 *   samosa       an UPRIGHT TRIANGLE, three corners, no curve anywhere.
 *   gulab jamun  THREE small spheres, so no single circle dominates.
 *   chai         an UPRIGHT CUP with a handle sticking out of one side.
 *
 * The rakhi is one centred circle with two threads leaving it sideways. None of
 * the five shares that skeleton, and none of them is symmetric about the
 * vertical in the way the medallion is except the samosa — which is a triangle,
 * the one silhouette a circle can never be confused with.
 *
 * ─── THE KEYLINE IS LOAD-BEARING ───────────────────────────────────────────
 *
 * Every dish is stroked in its palette's `outline`, exactly as the rakhi is and
 * for the same reason: the girders ARE Swiggy orange, and warm food on a warm
 * ground has no edge. A cream chai cup on an orange girder without a keyline is
 * a pale smudge; with one it is a cup. This is not a style choice and it is not
 * optional per dish.
 *
 * ─── THE BAKE COUNT IS FIVE ────────────────────────────────────────────────
 *
 * One bake per dish and nothing else — no shine sweep, no rotation. The rakhi
 * quantises its highlight into 8 steps because it has a moving highlight; a
 * dish has none, so its only animation is the bob, which is a translate at blit
 * time and therefore free and continuous. Keeping it that way is what keeps a
 * tower carrying six food items off the frame budget.
 */

import { FOOD_PALETTE, foodKind, COLORS, withAlpha } from '../../brand';
import { bake, blit } from '../prerender';
import { roundRect } from '../shapes';

// ─── The cell ───────────────────────────────────────────────────────────────

/** Half-extent of the dish itself, in stage units. Sized against RAKHI.pickupR. */
const R = 13;
/** Room for the keyline, the chai's handle and the biryani's outermost fleck. */
const PAD = 4;
const BOX_W = (R + PAD) * 2;
const BOX_H = (R + PAD) * 2;
/** Dish centre inside the cell. Every `paint` below draws around (0, 0). */
const CX = BOX_W / 2;
const CY = BOX_H / 2;

/** One keyline weight for all five, so the set reads as one set. */
const LINE = 1.5;

/** Seconds for one bob. Matches the rakhi's cadence — see `foodBob`. */
const BOB_SEC = 1.8;

// ─── Public ─────────────────────────────────────────────────────────────────

/**
 * The bob, as a -1…+1 phase, NOT as units.
 *
 * Same shape as `rakhiShine`: sim time plus a per-index offset, so a girder
 * carrying three dishes reads as three objects rather than as one object drawn
 * three times. It returns a normalised phase rather than an offset because the
 * amplitude belongs to the sim's tuning, not to the art — and a helper that
 * baked in its own amplitude would drift from the rakhi's the first time either
 * was tuned.
 */
export function foodBob(simTime: number, index: number): number {
  return Math.sin((simTime / BOB_SEC) * Math.PI * 2 + index * 1.7);
}

/**
 * Draw dish `kind` centred at (x, y) in stage units.
 *
 * `kind` is wrapped through `foodKind`, so a level authored against a brand
 * with five dishes cannot render a blank sprite under a brand that ships three.
 */
export function drawFoodArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  kind: number,
): void {
  const k = foodKind(kind);
  const canvas = bake(`food:${k}`, BOX_W, BOX_H, BOX_W * px, BOX_H * px, (c) => paint(c, k));
  blit(ctx, canvas, x - CX, y - CY, BOX_W, BOX_H);
}

/** Cell for the HUD glyph. Square, and drawn to fill it edge to edge. */
const ICON_BOX = 24;

/**
 * ONE GLYPH FOR THE WHOLE ORDER — a takeaway bag, at ~16–20 units.
 *
 * The HUD needs a single mark meaning "the order", not five tiny dishes: at
 * HUD size a biryani bowl and a gulab jamun dish are both a small dark lozenge,
 * so five glyphs would carry no more information than one and would cost the
 * player a legend to read. The bag is also the one shape here that is not food —
 * which is what makes it read as a COUNTER rather than as a sixth dish.
 */
export function drawFoodIconArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  size: number,
): void {
  const canvas = bake('foodIcon', ICON_BOX, ICON_BOX, size * px, size * px, paintIcon);
  blit(ctx, canvas, x - size / 2, y - size / 2, size, size);
}

// ─── Painting ───────────────────────────────────────────────────────────────

interface Palette {
  readonly body: string;
  readonly shade: string;
  readonly accent: string;
  readonly outline: string;
}

function paint(ctx: CanvasRenderingContext2D, k: number): void {
  const p = FOOD_PALETTE[k] as Palette | undefined;
  if (!p) return;

  ctx.save();
  ctx.translate(CX, CY);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = LINE;

  switch (k) {
    case 0:
      biryani(ctx, p);
      break;
    case 1:
      dosa(ctx, p);
      break;
    case 2:
      samosa(ctx, p);
      break;
    case 3:
      gulabJamun(ctx, p);
      break;
    default:
      chai(ctx, p);
      break;
  }

  ctx.restore();
}

/** Fill then stroke, in the dish's own two tokens. Every shape goes through it. */
function inked(ctx: CanvasRenderingContext2D, fill: string, outline: string): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = LINE;
  ctx.stroke();
}

/**
 * BIRYANI — a wide shallow bowl with rice heaped over the rim.
 *
 * The mound is drawn FIRST and the bowl over it, so the rice is visibly
 * contained rather than balanced on top: a mound drawn last has a hard flat
 * edge where it meets the rim, which reads as a lid.
 *
 * The bowl is deliberately WIDER THAN TALL and flat across the base. That is the
 * whole anti-rakhi move for this dish — a deep round bowl at 26 units is a
 * circle, and a circle is the one thing it may not be.
 */
function biryani(ctx: CanvasRenderingContext2D, p: Palette): void {
  // The heap. THREE LOBES, not one dome: a single smooth dome over a bowl is a
  // lid, and a lidded bowl says "not yet served". Lobes say loose grains piled
  // up, which is what a plate of biryani looks like from across a room.
  ctx.beginPath();
  ctx.moveTo(-10, -1);
  ctx.quadraticCurveTo(-9.5, -6.5, -4.5, -6.8);
  ctx.quadraticCurveTo(-3.5, -11, 1, -10.2);
  ctx.quadraticCurveTo(5, -9.6, 5.5, -6.2);
  ctx.quadraticCurveTo(9.5, -5.6, 10, -1);
  ctx.closePath();
  inked(ctx, p.body, p.outline);

  // Grains, as three short strokes in the shade. Enough to say "rice"; more
  // than three at this size is a texture and reads as noise.
  ctx.strokeStyle = p.shade;
  ctx.lineWidth = 1.1;
  for (const [gx, gy] of [
    [-4.5, -3.5],
    [0.5, -6],
    [5, -3],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(gx - 1.4, gy + 0.8);
    ctx.lineTo(gx + 1.4, gy - 0.8);
    ctx.stroke();
  }

  // The coriander fleck — the single accent this dish gets. Sitting ON the
  // mound, off-centre: dead centre would make it a gem in a setting.
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.ellipse(2.2, -7.6, 2.4, 1.5, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.outline;
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // The bowl. A wide, shallow trough with a lip either side.
  ctx.beginPath();
  ctx.moveTo(-12.5, -1.5);
  ctx.lineTo(12.5, -1.5);
  ctx.lineTo(10.5, 1.2);
  ctx.bezierCurveTo(9.5, 8.5, -9.5, 8.5, -10.5, 1.2);
  ctx.closePath();
  inked(ctx, p.shade, p.outline);

  // The rim, in the lighter body colour, so the bowl has a top edge that is not
  // just the keyline. Drawn as a bar rather than a stroke — a stroked rim at 1
  // unit disappears on the first quality drop.
  ctx.beginPath();
  roundRect(ctx, -12.5, -2.6, 25, 2.6, 1.2);
  inked(ctx, p.body, p.outline);
}

/**
 * DOSA — a folded crepe lying down, longer than it is tall.
 *
 * The horizontal wedge is the point. Nothing else in the collectible set is
 * wide and low, and the rakhi is neither, so this silhouette is unique in the
 * frame before any colour is applied.
 *
 * The chutney is a small pale disc AT THE BASE and off to one side. It was
 * briefly drawn as a centred dot on the wedge, which turned the dosa into a
 * medallion with a highlight — i.e. into the exact thing this file exists to
 * avoid. On the ground line beside the dish it is a side dish.
 */
function dosa(ctx: CanvasRenderingContext2D, p: Palette): void {
  // The fold: a long shallow triangle with softened corners, tilted a little so
  // it does not read as a signpost.
  ctx.beginPath();
  ctx.moveTo(-13, 5.5);
  ctx.lineTo(-9, -4.5);
  ctx.quadraticCurveTo(-7.5, -7, -5, -6);
  ctx.lineTo(11.5, 2);
  ctx.quadraticCurveTo(13.5, 3, 12.5, 5.5);
  ctx.closePath();
  inked(ctx, p.body, p.outline);

  // The seam where the crepe is folded over — the one line that says this is
  // folded rather than a slab.
  ctx.strokeStyle = p.shade;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-8.5, 5.4);
  ctx.lineTo(-5.5, -4.6);
  ctx.stroke();

  // A crisped edge along the underside, so the wedge has a light direction.
  ctx.fillStyle = p.shade;
  ctx.beginPath();
  roundRect(ctx, -12, 3.4, 24, 2.2, 1.1);
  ctx.fill();

  // THE ROLLED END, at the thick end of the wedge. Without it the wedge is a
  // slice of something — pizza, cheese, cake. The visible roll is what says
  // "this is a sheet of batter wrapped around itself", which is what a dosa is.
  ctx.beginPath();
  ctx.ellipse(9.8, 1.4, 3.6, 4.2, 0.35, 0, Math.PI * 2);
  inked(ctx, p.body, p.outline);
  ctx.strokeStyle = p.shade;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(9.8, 1.4, 1.9, 0.6, 4.4);
  ctx.stroke();

  // Coconut chutney, on the ground beside it.
  ctx.beginPath();
  ctx.ellipse(-9.5, 8.5, 3.6, 2.2, 0, 0, Math.PI * 2);
  inked(ctx, p.accent, p.outline);
}

/**
 * SAMOSA — an upright triangle with a crimped seam down its near edge.
 *
 * THE FAILURE THIS SHAPE HAD FIRST: A WARNING SIGN. Drawn as an equilateral
 * triangle with a dark keyline and a straight seam down the middle, it was a
 * hazard triangle with an exclamation mark in it — which in THIS game is an
 * actively wrong reading, because `hazardCaution` exists and the tower uses it.
 *
 * Two changes fix it and both are load-bearing. The triangle is LEANED — apex
 * offset right of centre, base longer than the sides — so it is scalene rather
 * than a signboard. And the seam runs down the NEAR-LEFT EDGE as a crimp with
 * ticks on it, which is anatomically where a samosa's crimp is and is nothing
 * like a centred glyph.
 */
function samosa(ctx: CanvasRenderingContext2D, p: Palette): void {
  // The pastry. Apex up and off to the right, base wide and flat.
  ctx.beginPath();
  ctx.moveTo(3.5, -10.5);
  ctx.quadraticCurveTo(5.5, -10, 6, -8);
  ctx.lineTo(11, 6);
  ctx.quadraticCurveTo(12, 8.5, 9.5, 8.5);
  ctx.lineTo(-10, 8.5);
  ctx.quadraticCurveTo(-12.5, 8.5, -11.5, 6);
  ctx.lineTo(0.5, -8.5);
  ctx.quadraticCurveTo(1.8, -10.4, 3.5, -10.5);
  ctx.closePath();
  inked(ctx, p.body, p.outline);

  // THE CRIMP, down the near edge — the fold the pastry is sealed along, and
  // the detail that separates a samosa from a triangle. Set in from the left
  // side, parallel to it, with ticks across it.
  ctx.strokeStyle = p.shade;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(2.4, -8.4);
  ctx.lineTo(-8, 6.4);
  ctx.stroke();
  ctx.lineWidth = 0.9;
  for (let i = 1; i <= 4; i++) {
    const f = i / 5;
    const sx = 2.4 + (-8 - 2.4) * f;
    const sy = -8.4 + (6.4 + 8.4) * f;
    ctx.beginPath();
    ctx.moveTo(sx - 1.6, sy - 0.4);
    ctx.lineTo(sx + 1.6, sy + 0.4);
    ctx.stroke();
  }

  // The fried underside.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(3.5, -10.5);
  ctx.lineTo(11, 6);
  ctx.quadraticCurveTo(12, 8.5, 9.5, 8.5);
  ctx.lineTo(-10, 8.5);
  ctx.quadraticCurveTo(-12.5, 8.5, -11.5, 6);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = p.shade;
  ctx.fillRect(-13, 4.8, 26, 5);
  ctx.restore();

  // A pea of filling escaping the crimp at the base — the one accent, and the
  // only round thing in the drawing, which is why it is small and off in a
  // corner rather than anywhere near the middle.
  ctx.beginPath();
  ctx.arc(-6.5, 5.6, 2.1, 0, Math.PI * 2);
  inked(ctx, p.accent, p.outline);
}

/**
 * GULAB JAMUN — three syrup-dark spheres in a shallow dish.
 *
 * THREE, and that count is the anti-rakhi decision. One sphere in a dish is a
 * medallion in a setting; three of them are a portion, because no one of them
 * is the centre of the drawing. They are also the darkest thing in the food set
 * against the palest dish, so the group reads as a cluster at a glance rather
 * than as an object with a rim.
 */
function gulabJamun(ctx: CanvasRenderingContext2D, p: Palette): void {
  // The dish, in the sugar-cream accent: wide, shallow, flat-based.
  ctx.beginPath();
  ctx.moveTo(-12.5, 0.5);
  ctx.lineTo(12.5, 0.5);
  ctx.lineTo(10, 3);
  ctx.bezierCurveTo(9, 9, -9, 9, -10, 3);
  ctx.closePath();
  inked(ctx, p.accent, p.outline);

  // Syrup pooled in the bottom of the dish.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-12.5, 0.5);
  ctx.lineTo(12.5, 0.5);
  ctx.lineTo(10, 3);
  ctx.bezierCurveTo(9, 9, -9, 9, -10, 3);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = withAlpha(p.shade, 0.5);
  ctx.fillRect(-13, 3.4, 26, 6);
  ctx.restore();

  // The back sphere first, then the two in front, so the group has depth from
  // overlap alone — no gradients, nothing per-frame.
  ball(ctx, p, 0, -5.6, 4.6);
  ball(ctx, p, -5.4, -1.6, 5);
  ball(ctx, p, 5.4, -1.6, 5);
}

function ball(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  bx: number,
  by: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  inked(ctx, p.body, p.outline);
  // A sugar catchlight, up and left, in the same accent as the dish.
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(bx - r * 0.32, by - r * 0.36, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * CHAI — an upright cup with a terracotta band and a handle.
 *
 * The HANDLE is what does the work: it breaks the silhouette sideways, which is
 * the one thing a medallion's outline never does, and it is the reason this
 * reads as a cup rather than as a pale tub. It sticks out past the keyline into
 * the cell's padding, which is what PAD is for.
 */
function chai(ctx: CanvasRenderingContext2D, p: Palette): void {
  // The handle first, so the cup wall covers where it joins — a handle whose
  // ends stop visibly short of the wall reads as a detached loop.
  ctx.strokeStyle = p.body;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.arc(6.5, 0, 5.4, -1.15, 1.15);
  ctx.stroke();
  ctx.strokeStyle = p.outline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(6.5, 0, 5.4, -1.15, 1.15);
  ctx.stroke();

  // The cup: a tapered tumbler, wider at the lip than at the foot.
  ctx.beginPath();
  ctx.moveTo(-8, -7.5);
  ctx.lineTo(8, -7.5);
  ctx.lineTo(6, 8);
  ctx.quadraticCurveTo(5.6, 9.6, 4, 9.6);
  ctx.lineTo(-4, 9.6);
  ctx.quadraticCurveTo(-5.6, 9.6, -6, 8);
  ctx.closePath();
  inked(ctx, p.body, p.outline);

  // The terracotta band — the accent, and the thing that makes a cream cup a
  // chai cup rather than a paper one.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-8, -7.5);
  ctx.lineTo(8, -7.5);
  ctx.lineTo(6, 8);
  ctx.quadraticCurveTo(5.6, 9.6, 4, 9.6);
  ctx.lineTo(-4, 9.6);
  ctx.quadraticCurveTo(-5.6, 9.6, -6, 8);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = p.accent;
  ctx.fillRect(-9, -1.5, 18, 4.6);
  ctx.fillStyle = p.shade;
  ctx.fillRect(-9, 6.4, 18, 3.6);
  ctx.restore();

  // The tea's surface, sunk below the lip. A cup with no liquid in it is a pot.
  ctx.beginPath();
  ctx.ellipse(0, -7, 7.6, 2.3, 0, 0, Math.PI * 2);
  inked(ctx, p.shade, p.outline);
  ctx.fillStyle = withAlpha(p.accent, 0.55);
  ctx.beginPath();
  ctx.ellipse(-2, -7.4, 2.6, 1, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * THE HUD BAG. Neutral tokens, not a dish's palette: this is furniture in the
 * HUD card, and it has to sit with the tracker pips and the timer rather than
 * with the food on the tower.
 */
function paintIcon(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(ICON_BOX / 2, ICON_BOX / 2);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // The handle, above the bag's mouth.
  ctx.strokeStyle = COLORS.hudValue;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, -6.4, 3.6, Math.PI, Math.PI * 2);
  ctx.stroke();

  // The body: a slight taper outward at the base, which is what tells a paper
  // bag from a box at 16 units.
  ctx.beginPath();
  ctx.moveTo(-7, -6);
  ctx.lineTo(7, -6);
  ctx.lineTo(8.4, 9.5);
  ctx.lineTo(-8.4, 9.5);
  ctx.closePath();
  ctx.fillStyle = COLORS.hudValue;
  ctx.fill();

  // The fold across the top, knocked out of the body so the bag has a cuff.
  ctx.fillStyle = withAlpha(COLORS.hudCard, 0.9);
  ctx.fillRect(-7.4, -4, 14.8, 1.8);

  ctx.restore();
}
