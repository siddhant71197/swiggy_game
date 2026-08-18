/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE ORDER — six items, and not one of them may read as a rakhi.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: A SECOND ROUND GOLD THING ON THE TOWER.
 * Rakhis are what unlock the door, and the rakhi counter is the one number the
 * player has to be able to trust. A dish that reads as a gold disc at 22 units
 * does not cost a little polish — it makes the counter untrustworthy, because
 * the player cannot tell what they just picked up and the HUD is the only
 * witness.
 *
 * The brand's palettes refuse to help an item impersonate a rakhi (see the
 * note on `colors.foods` in src/brand/types.ts — no gold, anywhere, and the
 * laddu is SAFFRON rather than marigold for precisely that reason). Colour
 * alone is not enough at speed, so the SILHOUETTES carry the read too. Six
 * shapes, sharing no skeleton with each other or with the medallion:
 *
 *   burger       a COMPACT ROUND stack under a domed sesame crown.
 *   pastry       a TALL slice with a FLAT top and a cherry — vertical.
 *   laddu        TWO granular balls, one in a pleated case — never one disc.
 *   pizza        ONE scalene WEDGE, red-dominant, thick crust at the wide end.
 *   sub          a LONG LOW split roll, 2.5:1, with a three-colour filling.
 *   sandwich     TWO PALE TRIANGLES standing side by side — white, not tan.
 *
 * The rakhi is one centred circle with two threads leaving it sideways. None of
 * the six shares that skeleton, and none of the six is round AND gold.
 *
 * ─── THE HARD PART: FOUR OF THE SIX ARE BREAD WITH A FILLING ───────────────
 *
 * Burger, pizza, sub and sandwich occupy one visual space — baked dough, a
 * filling stripe, warm tan, usually lettuce. This is the tightest set the file
 * has carried, and the separation is ENGINEERED rather than assumed. Each item
 * holds one half of a pair, and the four rules are:
 *
 *   ASPECT.  The burger is compact and ROUND (roughly 1.2:1). The sub is LONG
 *            and LOW at 2.5:1 or more. That ratio alone survives a blur, which
 *            matters because these two are the closest pair in the set: both
 *            are a tan roll with a filling in the middle of it.
 *   COLOUR.  The pizza is THE ONLY RED-DOMINANT ITEM. Its body is sauce, not
 *            dough, so at speed it is a red object among tan ones. Nothing else
 *            may take a red majority; the sub's tomato is a stripe.
 *   VALUE.   The sandwich refuses the tan band altogether — PALE WHITE sliced
 *            bread, no crust colour. Against three warm tans it is the light
 *            one, and that is doing as much work as its shape.
 *   COUNT.   Pizza is ONE wedge; the sandwich is TWO triangles. The two most
 *            triangular items in the file are told apart by how many there are
 *            before either outline resolves.
 *
 * ⚠ THE TRIANGLE TRAP, and it is the reason the pizza is drawn the way it is.
 * This file used to carry a samosa, and at 22 units it read as a HAZARD WARNING
 * SIGN — an actively wrong reading in a game that colour-codes hazards. The
 * failure was specific: an EQUILATERAL triangle, point up, with a centred
 * vertical seam — the ⚠ glyph, drawn in food colours. The pizza avoids all
 * three parts of that. It is scalene, its apex points LEFT rather than up, the
 * thick crust arc fattens one whole end, and the pepperoni breaks the interior
 * so no centred seam can form. The sandwich's triangles are point-up, but there
 * are two of them, they are different sizes, and they are white — a pair of
 * unequal pale triangles is not a sign.
 *
 * ─── THE THREE ITEMS THAT HAD TO EARN THEIR PLACE ──────────────────────────
 *
 * THE LADDU is the closest call in the file, and it is worth being explicit
 * about why it is allowed to exist. A motichoor laddu is a warm round object,
 * which is also an exact description of the collectible — so it is separated on
 * THREE channels at once rather than on colour, which on its own would never be
 * enough. Hue: saffron pushed red-ward, away from the reward palette's yellow
 * gold. Texture: motichoor is built from boondi pearls, and they are drawn, so
 * the ball is visibly GRANULAR where the medallion is a smooth ring with one
 * gem. Silhouette: it is never a lone circle — a second, smaller laddu breaks
 * the symmetry and a pleated paper case cuts the bottom off the main one. Its
 * keyline is also the heaviest in the set, because it is the only dish fighting
 * both the collectible and the Swiggy-orange girder it stands on.
 *
 * THE BURGER VERSUS THE SUB is the closest pair in the file now that the two
 * pastries are gone, and it is worth being explicit about how thin the margin
 * is. Both are baked dough closed around a filling; recoloured identically they
 * would still have to be separable, which is the test this file applies to
 * everything. Three separations, applied together:
 *
 *   PROPORTION. The burger is 1.2:1 and the sub is 2.5:1. This is the channel
 *   that survives motion, blur and a dropped backing-store scale, and it is why
 *   the sub is drawn to the full width of the cell and kept under ten units
 *   tall even though a fatter roll would be prettier.
 *   FILLING. The burger's filling is FOUR STACKED SLABS you can count — patty,
 *   cheese, lettuce — reading vertically. The sub's is a THREE-COLOUR STRIPE
 *   reading horizontally: green, red and a pink meat line side by side along
 *   its length. One is a stack, the other is a row.
 *   VALUE. The burger's bun is the palest tan in the set and the sub's roll is
 *   the deepest-baked, with the toasting pushed further by an ink wash.
 *
 * THE SANDWICH IS PALE BEFORE IT IS ANYTHING ELSE. It is the only item here
 * drawn in white bread with no crust colour at all, and the paleness is the
 * separator that works when the two triangles are eight pixels wide. Its
 * filling is a SINGLE green, deliberately, where the sub's is three colours —
 * so even the fillings of the two "cut open" items do not rhyme.
 *
 * The burger's bun is also kept clearly NOT SPHERICAL: the dome is nearly three
 * times wider than it is tall and it sits on a flat cut. The laddu owns the
 * round-warm-object lane here, and a bun drawn as a ball would be a second
 * entrant in the one lane this file most wants kept thin. What names the burger
 * is LAYERS WITH RAGGED EDGES — the lettuce frill sticks out past the bun and
 * dips unevenly, the cheese hangs a corner off the front. Both are irregular ON
 * PURPOSE, because at 22 units a stack of tidy discs is a macaron tower.
 *
 * ─── THE KEYLINE IS LOAD-BEARING ───────────────────────────────────────────
 *
 * Every dish is stroked in its palette's `outline`, exactly as the rakhi is and
 * for the same reason: the girders ARE Swiggy orange, and warm food on a warm
 * ground has no edge. A cream-and-pink pastry on an orange girder without a
 * keyline is a pale smudge; with one it is a slice of cake. This is not a style
 * choice and it is not optional per dish. It matters MORE for this set than it
 * did for the savoury one, because four of these six are pale — and the laddu,
 * which is not pale, is orange on orange, which is the same problem twice.
 *
 * ─── THE BAKE COUNT IS SIX ─────────────────────────────────────────────────
 *
 * One bake per dish and nothing else — no shine sweep, no rotation. The rakhi
 * quantises its highlight into 8 steps because it has a moving highlight; a
 * dish has none, so its only animation is the bob, which is a translate at blit
 * time and therefore free and continuous. Keeping it that way is what keeps a
 * tower carrying six food items off the frame budget.
 */

import { FOOD_PALETTE, foodKind, COLORS, mix, withAlpha } from '../../brand';
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

/** One keyline weight for all six, so the set reads as one set. */
const LINE = 1.5;

/**
 * The laddu's keyline, and only the laddu's. It is the one dish whose body
 * colour is a near neighbour of the girder it stands on, so it is given ~35%
 * more edge than the rest — enough to hold the shape on an orange ground,
 * short of enough to make it read as a different set.
 */
const LINE_HEAVY = LINE * 1.35;

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
 * with six dishes cannot render a blank sprite under a brand that ships three.
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
 * The HUD needs a single mark meaning "the order", not six tiny dishes: at
 * HUD size a burger and a sub are both a small tan lozenge,
 * so six glyphs would carry no more information than one and would cost the
 * player a legend to read. The bag is also the one shape here that is not food —
 * which is what makes it read as a COUNTER rather than as one more dish.
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

  // EXPLICIT CASES, INCLUDING THE LAST ONE. This switch used to end in a
  // `default:` that drew the last dish, which meant a brand shipping one more
  // palette rendered silently as the last one — a wrong dish on the tower, with
  // nothing anywhere to say so. `foodKind` wraps the index into range, so the
  // default below is unreachable through the public entry point; if it is ever
  // reached, the drawing is genuinely missing and a loud failure is the honest
  // report. This is a bake-time callback, so it throws once, not per frame.
  switch (k) {
    case 0:
      burger(ctx, p);
      break;
    case 1:
      pastry(ctx, p);
      break;
    case 2:
      motichoorLaddu(ctx, p);
      break;
    case 3:
      pizza(ctx, p);
      break;
    case 4:
      subSandwich(ctx, p);
      break;
    case 5:
      sandwich(ctx, p);
      break;
    default:
      ctx.restore();
      throw new Error(`drawFoodArt: no drawing for dish kind ${k} — add one in food.ts`);
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
 * BURGER — a sesame crown, a lettuce frill, a cheese slice with a corner
 * hanging off it, a dark patty, and a flat base bun.
 *
 * FOUR TOKENS, FIVE PARTS, and the sharing is deliberate. `body` is the BUN and
 * both halves of it — one colour top and bottom is what makes them read as a
 * pair enclosing a filling, rather than as two unrelated slabs. `shade` is the
 * CHEESE, and at low alpha it is also the toasting on both buns, which is true
 * to the object: a bun's shading and a cheddar slice are the same family of
 * warm amber. `accent` is the LETTUCE. The PATTY is the one part with no token,
 * and it does not need one — mixed from the cheese most of the way to ink it
 * lands on a grilled brown, which is exactly the relationship the two have on a
 * real burger and one fewer literal in the brand.
 *
 * THE ORDER OF DRAWING IS THE ORDER OF THE STACK, bottom first, so every layer
 * overlaps the one below it and the whole thing has depth from overlap alone —
 * the same trick the gulab jamun's three spheres use, and just as free.
 *
 * THE RAGGED EDGES ARE THE DISH. See the header: tidy slabs are a macaron
 * tower. The frill's dips are deliberately UNEVEN in both depth and spacing —
 * an even scallop is a doily — and the cheese hangs ONE big corner and one
 * small one rather than a repeated fringe, for the same reason.
 */
function burger(ctx: CanvasRenderingContext2D, p: Palette): void {
  // The patty, mixed rather than declared — see the note above and the palette
  // comment in brands/swiggy/brand.ts.
  const patty = mix(p.shade, p.outline, 0.58);
  /** The toasting on both buns, and the only place `shade` is not the cheese. */
  const toast = withAlpha(p.shade, 0.3);

  // ── The base bun: FLAT-BOTTOMED, and that flat is half of the silhouette's
  // argument with the éclair, whose ends and belly are one continuous curve.
  const base = (): void => {
    ctx.beginPath();
    ctx.moveTo(-10.6, 5.4);
    ctx.lineTo(10.6, 5.4);
    ctx.lineTo(10.6, 8.2);
    ctx.quadraticCurveTo(10.6, 10, 8.6, 10);
    ctx.lineTo(-8.6, 10);
    ctx.quadraticCurveTo(-10.6, 10, -10.6, 8.2);
    ctx.closePath();
  };
  base();
  inked(ctx, p.body, p.outline);
  ctx.save();
  base();
  ctx.clip();
  ctx.fillStyle = toast;
  ctx.fillRect(-11, 7.8, 22, 3);
  ctx.restore();

  // ── The patty: the darkest value in the drawing, and the only layer whose
  // BOTTOM edge is bumpy — meat sits proud of the bun it rests on. Its top runs
  // up behind the cheese, so the one straight edge it has is never on show.
  ctx.beginPath();
  ctx.moveTo(-11.4, 2.4);
  ctx.quadraticCurveTo(-12, 6, -8.8, 6);
  ctx.quadraticCurveTo(-5.8, 7, -3, 6.1);
  ctx.quadraticCurveTo(0.2, 7.2, 3, 6);
  ctx.quadraticCurveTo(6.2, 6.9, 8.8, 6);
  ctx.quadraticCurveTo(12, 6, 11.4, 2.4);
  ctx.closePath();
  inked(ctx, patty, p.outline);

  // A grill sheen, so the darkest slab is not one flat mass at speed.
  ctx.strokeStyle = withAlpha(p.shade, 0.45);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-7.8, 4.2);
  ctx.lineTo(-1.4, 4.2);
  ctx.moveTo(2.4, 4.8);
  ctx.lineTo(7.4, 4.8);
  ctx.stroke();

  // ── The cheese: a slab with ONE big corner hanging over the patty and one
  // small one, off-centre. The corner is the mark that names this dish the way
  // the cherry names the slice — nothing else in the set has a piece of itself
  // hanging off the front.
  //
  // The slab runs up BEHIND the lettuce rather than butting against it. Two
  // ragged edges meeting is a seam that opens: at some scales the girder shows
  // through the join, and the two keylines it puts side by side thicken into a
  // black bar across the middle of the stack. Overlapping layers, cut only by
  // the layer in front, is how the whole stack is built.
  ctx.beginPath();
  ctx.moveTo(-11, -2.4);
  ctx.lineTo(11, -2.4);
  ctx.lineTo(11, 3);
  ctx.lineTo(8.2, 3);
  ctx.lineTo(6.1, 6.9);
  ctx.lineTo(4.1, 3);
  ctx.lineTo(-3.4, 3);
  ctx.lineTo(-4.9, 5.4);
  ctx.lineTo(-6.5, 3);
  ctx.lineTo(-11, 3);
  ctx.closePath();
  inked(ctx, p.shade, p.outline);

  // ── The lettuce: WIDER THAN EITHER BUN, so it breaks the stack's outline
  // sideways. A frill that stops at the bun's edge is another slab; one that
  // pokes out is a leaf. Its lower edge is uneven in BOTH depth and spacing —
  // an even scallop is a doily.
  ctx.beginPath();
  ctx.moveTo(-12.4, -3);
  ctx.lineTo(-12.4, -1.6);
  ctx.quadraticCurveTo(-11.6, 1, -9.4, 0);
  ctx.quadraticCurveTo(-7.6, 1.5, -5.4, 0.2);
  ctx.quadraticCurveTo(-2.9, 0.7, -1.6, -0.5);
  ctx.quadraticCurveTo(0.8, 1.7, 3.2, 0);
  ctx.quadraticCurveTo(5.4, 0.6, 7.2, 0.3);
  ctx.quadraticCurveTo(9.8, 1.5, 12.4, -1);
  ctx.lineTo(12.4, -3);
  ctx.closePath();
  inked(ctx, p.accent, p.outline);

  // One vein, hairline, following the frill. Anything heavier is a stripe.
  ctx.strokeStyle = withAlpha(p.outline, 0.28);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-10.6, -1.4);
  ctx.quadraticCurveTo(-4, 0.2, 2.4, -1.2);
  ctx.quadraticCurveTo(7.6, -1.9, 11, -1.7);
  ctx.stroke();

  // ── The crown: a DOME NEARLY THREE TIMES WIDER THAN IT IS TALL, sitting on a
  // straight cut. Not a ball — the laddu and the gulab jamun own that lane, and
  // a spherical bun would put a third warm round object into it.
  const crown = (): void => {
    ctx.beginPath();
    ctx.moveTo(-11.4, -1.9);
    ctx.bezierCurveTo(-11.9, -7.7, -7.2, -10.4, 0, -10.4);
    ctx.bezierCurveTo(7.2, -10.4, 11.9, -7.7, 11.4, -1.9);
    ctx.closePath();
  };
  crown();
  inked(ctx, p.body, p.outline);

  // Toasting under the crown's brow, so the dome is a solid rather than a decal.
  ctx.save();
  crown();
  ctx.clip();
  ctx.fillStyle = toast;
  ctx.fillRect(-12, -3.8, 24, 3);
  ctx.fillStyle = withAlpha(p.outline, 0.1);
  ctx.fillRect(6.2, -11, 6, 10);
  ctx.restore();

  // THE SESAME. Five seeds, scattered and each at its own angle — five, because
  // three reads as a face and a dozen reads as the laddu's boondi, which is the
  // one texture in this file that is spoken for. They are ELLIPSES, not dots,
  // for the same reason.
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = withAlpha(p.outline, 0.45);
  ctx.fillStyle = mix(p.body, p.shade, 0.5);
  for (const [sx, sy, rot] of [
    [-6.4, -5.2, -0.5],
    [-2.6, -7.4, 0.12],
    [1.8, -6.4, -0.22],
    [5.9, -4.6, 0.42],
    [-0.6, -4.2, 0.06],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(sx, sy, 1.5, 0.85, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * PASTRY — a tall slice with a FLAT top, cream layers and a cherry.
 *
 * THE FLAT TOP IS THE ANTI-RAKHI MOVE and it is also what keeps this dish out
 * of the ice cream's lane. A slice with a domed top is a scoop on a stand; a
 * slice with a flat frosting slab across it is architecture, and nothing else
 * in the set has a horizontal edge that high up.
 *
 * The layers run ACROSS the slice, not down it. Vertical stripes on a tall
 * shape read as a wrapper (a chocolate bar, a packet); horizontal ones read as
 * sponge and cream, which is the whole point of showing a cut face at all.
 *
 * The cherry is the accent and it is deliberately OFF-CENTRE and clear of the
 * outline of the slab. Dead centre on the top face is a gem in a setting, and
 * this file's one job is to never draw that.
 */
function pastry(ctx: CanvasRenderingContext2D, p: Palette): void {
  // The front face: an upright block, straight-sided. It went through a taper
  // first and that was wrong twice over — a symmetric taper at 22 units is a
  // paper drink cup with a lid, and a one-sided taper is a lighthouse. What
  // makes this a slice is not the outline, it is the TOP FACE below.
  const face = (): void => {
    ctx.beginPath();
    ctx.moveTo(-6.6, -6.2);
    ctx.lineTo(6.6, -6.2);
    ctx.lineTo(6.6, 8.6);
    ctx.quadraticCurveTo(6.6, 9.9, 5.3, 9.9);
    ctx.lineTo(-5.3, 9.9);
    ctx.quadraticCurveTo(-6.6, 9.9, -6.6, 8.6);
    ctx.closePath();
  };
  face();
  inked(ctx, p.body, p.outline);

  // The cream, in two bands ACROSS the sponge. Across, not down: vertical
  // stripes on a tall shape read as a wrapper, horizontal ones read as a cut
  // face, and the cut face is what says "slice" rather than "container".
  ctx.save();
  face();
  ctx.clip();
  ctx.fillStyle = p.shade;
  ctx.fillRect(-8, 3.4, 16, 2.4);
  // Hairlines where cream meets sponge, so the band still separates after the
  // keyline thins on a quality drop.
  ctx.strokeStyle = withAlpha(p.outline, 0.3);
  ctx.lineWidth = 0.7;
  for (const y of [3.4, 5.8]) {
    ctx.beginPath();
    ctx.moveTo(-8, y);
    ctx.lineTo(8, y);
    ctx.stroke();
  }
  // The far side, a touch darker, so the block has a light direction.
  ctx.fillStyle = withAlpha(p.outline, 0.12);
  ctx.fillRect(3.4, -7, 5, 18);
  ctx.restore();

  // THE FLAT TOP, drawn as a PARALLELOGRAM skewed back and right — a top face
  // seen from slightly above. This is the whole read: a flat lid on a straight
  // box is a cup, a flat face in perspective on a straight box is a solid
  // wedge of cake, and it costs four points to say so.
  ctx.beginPath();
  ctx.moveTo(-6.6, -6.2);
  ctx.lineTo(6.6, -6.2);
  ctx.lineTo(9.6, -10.2);
  ctx.lineTo(-3.6, -10.2);
  ctx.closePath();
  inked(ctx, p.shade, p.outline);

  // THE ICING, running over the front edge in three drips. This is what killed
  // the last wrong reading: a straight-sided block with a flat face on top and
  // horizontal stripes down it is a MILK CARTON, and the scalloped edge is the
  // one mark that no carton has and every frosted cake does.
  ctx.beginPath();
  ctx.moveTo(-6.6, -6.4);
  ctx.lineTo(6.6, -6.4);
  ctx.lineTo(6.6, -2.6);
  ctx.quadraticCurveTo(5.2, -0.4, 3.4, -2.4);
  ctx.quadraticCurveTo(1.6, -0.2, -0.2, -2.4);
  ctx.quadraticCurveTo(-2, -0.2, -3.8, -2.4);
  ctx.quadraticCurveTo(-5.2, -0.6, -6.6, -2.6);
  ctx.closePath();
  inked(ctx, p.shade, p.outline);

  // The cherry, sitting ON that top face and pushed to the back-left corner —
  // off the cell's centre line, because a red disc centred on a pale shape is
  // a gem in a setting and that is the one thing this file may not draw.
  ctx.strokeStyle = p.outline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-1.6, -11.6);
  ctx.quadraticCurveTo(0.4, -14.4, 2.4, -14.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-1.6, -11.6, 2.5, 0, Math.PI * 2);
  inked(ctx, p.accent, p.outline);
}

/**
 * MOTICHOOR LADDU — two granular saffron balls, the larger one in a pleated
 * paper case.
 *
 * THE HARDEST DISH IN THE FILE, and the header says why: a warm round sweet is
 * the collectible's own description. Three separations, applied together,
 * because any one of them alone fails at 22 units in motion.
 *
 * COUNT AND CASE. There is never a lone disc here. The second, smaller ball
 * sits up and to the LEFT, so the pair has no axis of symmetry the eye can
 * centre on, and the case cuts a straight zigzag line across the bottom of the
 * big one. The rakhi's skeleton is one centred circle with two threads leaving
 * it sideways; this is two off-centre circles standing in a cup, and the two
 * do not survive being confused.
 *
 * GRANULARITY. Motichoor is pressed from boondi, and the pearls are drawn
 * rather than implied. The medallion is smooth metal with a single gem and a
 * moving highlight; a ball with visible grain reads as FOOD before the player
 * has resolved its outline. This is the differentiator that still works at
 * speed, when the silhouette is a blur and only texture and value survive.
 *
 * THE CASE IS COOL AND PALE, and it is the only cold value in the drawing. The
 * girder underneath is Swiggy orange and the laddu is saffron, which is a real
 * collision — the case is what puts a hard light-on-dark edge under the dish so
 * it detaches from the tower, the same job the ice cream's tub does.
 */
function motichoorLaddu(ctx: CanvasRenderingContext2D, p: Palette): void {
  // The big laddu, sitting IN the case — drawn first, so the case cuts it.
  laddu(ctx, p, 2.6, -2.8, 7.6);

  // THE PLEATED CASE, in front of that ball and truncating its bottom third. A
  // ball resting behind a cup is still a whole circle; a ball with a straight
  // zigzag across it is not a medallion. The case is deliberately SHALLOW —
  // a deep one with a domed top is a cupcake, which is a different dessert and
  // one this set does not serve.
  ctx.beginPath();
  ctx.moveTo(-6.6, 2.6);
  const PLEATS = 5;
  for (let i = 0; i < PLEATS; i++) {
    ctx.lineTo(-6.6 + (18.4 * (i + 0.5)) / PLEATS, 0.4);
    ctx.lineTo(-6.6 + (18.4 * (i + 1)) / PLEATS, 2.6);
  }
  ctx.lineTo(9.4, 8.8);
  ctx.lineTo(-4.6, 8.8);
  ctx.closePath();
  inked(ctx, p.accent, p.outline);

  // Pleat creases down to the base. Hairlines: anything heavier at this size is
  // a set of stripes rather than folded paper.
  ctx.strokeStyle = withAlpha(p.outline, 0.28);
  ctx.lineWidth = 0.7;
  for (const [xt, xb] of [
    [-3.4, -2.2],
    [0.1, 0.6],
    [3.6, 3.4],
    [7.1, 6.2],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(xt, 2.2);
    ctx.lineTo(xb, 8.4);
    ctx.stroke();
  }

  // THE SECOND LADDU, loose, in FRONT and to the left, sitting low and clear of
  // the case. This is the mark that breaks the symmetry: one ball in a cup is a
  // cupcake and, worse, is still one centred round thing, which is the
  // collectible's skeleton. A big ball plus a small one at the base is an
  // asymmetric two-object group, and no rakhi in this game looks like that.
  laddu(ctx, p, -8.4, 3.2, 5.4);
}

/**
 * One boondi ball: a body disc, a stipple of pearls, and the set's heaviest
 * keyline. The pearls are laid on a golden-angle spiral rather than at random
 * because a bake must be deterministic — the same dish has to come out of the
 * oven identically after every resize and quality change.
 */
function laddu(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  lx: number,
  ly: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.arc(lx, ly, r, 0, Math.PI * 2);
  inked(ctx, p.body, p.outline);
  // The extra weight, straight back onto the same path — see LINE_HEAVY.
  ctx.lineWidth = LINE_HEAVY;
  ctx.stroke();
  ctx.lineWidth = LINE;

  ctx.save();
  ctx.beginPath();
  ctx.arc(lx, ly, r - 0.4, 0, Math.PI * 2);
  ctx.clip();

  // The shaded underside, so the ball is a sphere before the grain goes on.
  ctx.fillStyle = withAlpha(p.shade, 0.4);
  ctx.beginPath();
  ctx.arc(lx + r * 0.34, ly + r * 0.42, r * 0.86, 0, Math.PI * 2);
  ctx.fill();

  // THE BOONDI. Pearl-sized: about a seventh of the ball, which is coarse
  // enough to survive the backing-store scale dropping on a weak device. Each
  // gets a dark seat and every third a sugar catchlight, so the surface reads
  // as many small round things rather than as a texture swatch.
  const N = 17;
  for (let i = 0; i < N; i++) {
    const a = i * 2.39996;
    const rad = r * 0.82 * Math.sqrt((i + 0.6) / N);
    const px = lx + Math.cos(a) * rad;
    const py = ly + Math.sin(a) * rad;
    ctx.fillStyle = withAlpha(p.shade, 0.55);
    ctx.beginPath();
    ctx.arc(px, py, r * 0.155, 0, Math.PI * 2);
    ctx.fill();
    if (i % 3 === 0) {
      ctx.fillStyle = withAlpha(p.accent, 0.5);
      ctx.beginPath();
      ctx.arc(px - r * 0.05, py - r * 0.06, r * 0.075, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * PIZZA — ONE scalene wedge, red-dominant, with a thick crust arc at the wide
 * end and pepperoni breaking the middle of it.
 *
 * THE APEX POINTS LEFT, AND THAT IS THE WHOLE POINT. See the trap in the
 * header: the triangle this file was burned by was equilateral, point UP, with
 * a centred vertical seam — the ⚠ glyph in food colours. Every one of those
 * three properties is refused here. The two straight edges are of visibly
 * different length, the wide end is fattened by a crust arc so the shape is
 * lopsided, and four salami discs sit off the centre line so no vertical seam
 * can form. Turned upside down it is still a wedge of pizza and still not a
 * road sign.
 *
 * IT IS THE ONLY RED-DOMINANT ITEM IN THE SET, and that is its main separator
 * from the other three bread-and-filling items. `body` is therefore the SAUCE
 * rather than the dough: the biggest area in the drawing is red, so at 22 units
 * this is a red object standing among tan ones and the read is done before the
 * outline resolves. The sauce is a BRICK red, pushed browner and darker than
 * the rakhi's gem, because a bright crimson disc-sized patch on a girder is the
 * one thing the collectible owns.
 *
 * FOUR TOKENS, FIVE PARTS. `shade` is the CRUST and it does double duty as the
 * dough lip along the lower cut edge — those are the same material, so sharing
 * is honest rather than a compromise. `accent` is the melted cheese, a pale
 * cream and never a yellow. The PEPPERONI has no token: it is the sauce mixed
 * most of the way to ink, which is exactly the relationship the two have on a
 * real slice and one fewer literal in the brand.
 */
function pizza(ctx: CanvasRenderingContext2D, p: Palette): void {
  /** Salami: the sauce taken most of the way to ink — see the note above. */
  const pepperoni = mix(p.body, p.outline, 0.36);

  // The wedge: apex low and LEFT, wide end right, crust arc bulging out of it.
  const wedge = (): void => {
    ctx.beginPath();
    ctx.moveTo(-12.2, 2.6);
    ctx.lineTo(3.2, -10.4);
    ctx.quadraticCurveTo(11.8, -4.6, 10.2, 7.4);
    ctx.closePath();
  };
  wedge();
  inked(ctx, p.body, p.outline);

  // THE DOUGH LIP, along the LOWER cut edge only. One side, not both: a rim on
  // every edge is a bordered triangle, which is the sign this drawing is
  // avoiding, and a slice cut from a pizza only has crust at one end anyway.
  // Stroked inside a clip so it takes the wedge's own corners.
  ctx.save();
  wedge();
  ctx.clip();
  ctx.strokeStyle = p.shade;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-12.8, 2.5);
  ctx.lineTo(10.6, 7.6);
  ctx.stroke();
  ctx.restore();

  // THE CRUST, a thick arc across the wide end — the mark that names this the
  // way the cherry names the pastry slice, and the reason the shape is fat at
  // one end and pointed at the other rather than evenly tapered.
  ctx.beginPath();
  ctx.moveTo(3.2, -10.4);
  ctx.quadraticCurveTo(11.8, -4.6, 10.2, 7.4);
  ctx.lineTo(7.2, 5.4);
  ctx.quadraticCurveTo(8.4, -3.8, 1.8, -7.6);
  ctx.closePath();
  inked(ctx, p.shade, p.outline);

  // Melted cheese: three irregular pools, none of them centred. Ellipses at
  // their own angles, because three tidy circles would rhyme with the salami.
  ctx.fillStyle = p.accent;
  for (const [cx2, cy2, rx, ry, rot] of [
    [-6.9, -0.2, 2.5, 1.5, -0.3],
    [-1.8, -5.2, 2.1, 1.2, 0.42],
    [1.4, 3.4, 1.8, 1.1, -0.5],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(cx2, cy2, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  }

  // THE PEPPERONI. Four, scattered off the centre line and of two sizes — four
  // rather than three, because three evenly placed dots on a triangle is a
  // face, and off-centre because a single disc centred on a coloured field is a
  // gem in a setting and this file's one job is never to draw that.
  ctx.lineWidth = 0.7;
  for (const [dx, dy, r] of [
    [-6.6, 1.4, 1.5],
    [-1.2, -1.6, 1.9],
    [2.6, 1.9, 1.7],
    [0.6, -5.6, 1.4],
  ] as const) {
    ctx.beginPath();
    ctx.arc(dx, dy, r, 0, Math.PI * 2);
    ctx.fillStyle = pepperoni;
    ctx.fill();
    ctx.strokeStyle = withAlpha(p.outline, 0.5);
    ctx.stroke();
  }

  // The keyline last, back onto the wedge itself: the crust and the lip both
  // cross it, and an edge that is drawn over is an edge that is gone.
  wedge();
  ctx.strokeStyle = p.outline;
  ctx.lineWidth = LINE;
  ctx.stroke();
}

/**
 * SUB SANDWICH — a long split roll with a three-colour filling.
 *
 * NOT NAMED FOR ANYBODY'S CHAIN, and drawn as the generic object: a long roll
 * with a lid. The shape is public, the branding is not, and a competitor's
 * livery inside a Swiggy game would imply a partnership that does not exist.
 *
 * 2.5:1, AND THE RATIO IS THE ARGUMENT WITH THE BURGER. Those two are the
 * closest pair in the set — both are baked dough closed around a filling — and
 * proportion is the one channel that still separates them when the sprite is
 * blurred, bobbing, and sixteen pixels wide. So this is drawn to the full width
 * of the cell and held under ten units tall, even though a fatter roll would
 * look better in isolation. It is never allowed to become square.
 *
 * THE FILLING IS A ROW, NOT A STACK. The burger's layers read vertically and
 * you count them; this one's read horizontally, as a stripe of three colours
 * running the length of the roll — green, red and a pink meat line. That
 * difference in DIRECTION is the second half of the separation, and it is why
 * the lettuce is drawn as a long ragged ribbon rather than as one leaf.
 *
 * FOUR TOKENS, FIVE PARTS, and here is the sharing. `body` is the roll, both
 * halves; the baked colour on the OUTSIDE of both halves is an ink wash over it
 * rather than a token, which is what makes the crumb read pale and the crust
 * read deep from one colour. `shade` is the TOMATO. `accent` is the LETTUCE,
 * deliberately a deeper green than the burger's. The MEAT has no token: it is
 * the tomato mixed back toward the roll, which lands on a warm salmon — the
 * honest colour of sliced ham next to bread, and the closest this palette can
 * get to a rose without spending a fifth slot on it.
 */
function subSandwich(ctx: CanvasRenderingContext2D, p: Palette): void {
  /** Sliced meat: the tomato mixed back toward the roll — see the note above. */
  const meat = mix(p.shade, p.body, 0.55);
  /** The bake on the OUTSIDE of both halves. Ink, not a token. */
  const toast = withAlpha(p.outline, 0.15);

  // ── The bottom half: a long shallow trough, flat enough to sit on a girder.
  const bottom = (): void => {
    ctx.beginPath();
    roundRect(ctx, -12.4, 1.4, 24.8, 3.8, 1.9);
  };
  bottom();
  inked(ctx, p.body, p.outline);
  ctx.save();
  bottom();
  ctx.clip();
  ctx.fillStyle = toast;
  ctx.fillRect(-13, 3.4, 26, 2.4);
  ctx.restore();

  // ── The meat, laid in first and running the full length: a wavy band along
  // the BOTTOM of the gap, so the filling has a floor under the vegetables.
  ctx.beginPath();
  ctx.moveTo(-11.9, -0.4);
  ctx.lineTo(11.9, -0.4);
  ctx.quadraticCurveTo(9.4, 2.4, 6.6, 1.2);
  ctx.quadraticCurveTo(3.4, 2.6, 0.4, 1.3);
  ctx.quadraticCurveTo(-2.8, 2.5, -5.8, 1.2);
  ctx.quadraticCurveTo(-8.8, 2.4, -11.9, 1.1);
  ctx.closePath();
  inked(ctx, meat, p.outline);

  // ── THE VEGETABLES ALTERNATE ALONG THE LENGTH, and that is the whole reason
  // this filling is drawn the way it is. Three stacked bands would rhyme with
  // the burger, which is a stack you read vertically; a ROW of green clumps
  // with red discs sitting in the gaps between them is read left to right, and
  // that difference in direction is half of what separates the two items.
  //
  // The lettuce first: a ribbon with four lobes, pushed WIDER THAN THE ROLL at
  // both ends so green breaks the silhouette sideways.
  ctx.beginPath();
  ctx.moveTo(-13.2, -1.6);
  ctx.quadraticCurveTo(-11.6, -3.9, -9.2, -1.8);
  ctx.quadraticCurveTo(-6.6, -4.2, -3.6, -1.7);
  ctx.quadraticCurveTo(-0.6, -4.1, 2.4, -1.6);
  ctx.quadraticCurveTo(5.4, -4.2, 8.4, -1.8);
  ctx.quadraticCurveTo(10.8, -3.8, 12.9, -1.5);
  ctx.lineTo(12.9, 0.6);
  ctx.quadraticCurveTo(6.4, 1.6, 0, 0.7);
  ctx.quadraticCurveTo(-6.4, 1.5, -13.2, 0.4);
  ctx.closePath();
  inked(ctx, p.accent, p.outline);

  // The tomato: three whole slices standing IN the gaps between the lettuce
  // lobes, unevenly spaced. Red and green side by side along the length is the
  // mark that says "a row of ingredients" before any of them is resolvable.
  for (const [tx, ty] of [
    [-7.2, -0.7],
    [0.2, -0.9],
    [7.4, -0.6],
  ] as const) {
    ctx.beginPath();
    ctx.arc(tx, ty, 2.1, 0, Math.PI * 2);
    inked(ctx, p.shade, p.outline);
  }

  // ── The lid: a low arch, asymmetric at the two ends, sitting on a straight
  // cut. Straight underneath is what makes it a HALF of a roll rather than a
  // whole one — the split is the mark that names this item.
  const lid = (): void => {
    ctx.beginPath();
    ctx.moveTo(-12.4, -2.4);
    ctx.bezierCurveTo(-13.1, -5.6, -8.4, -6.8, 0, -6.6);
    ctx.bezierCurveTo(8.0, -6.4, 13.1, -5.4, 12.4, -2.4);
    ctx.closePath();
  };
  lid();
  inked(ctx, p.body, p.outline);
  ctx.save();
  lid();
  ctx.clip();
  ctx.fillStyle = toast;
  ctx.fillRect(-13, -7.2, 26, 3.4);
  ctx.restore();

  // Three bakery slashes across the lid, at a slant and unevenly spaced. This
  // is the detail that says "roll" rather than "plank" at speed.
  ctx.strokeStyle = withAlpha(p.outline, 0.32);
  ctx.lineWidth = 0.8;
  for (const sx of [-7.2, -0.6, 6.4]) {
    ctx.beginPath();
    ctx.moveTo(sx - 1.1, -3.4);
    ctx.lineTo(sx + 1.3, -5.7);
    ctx.stroke();
  }
}

/**
 * SANDWICH — two triangular halves standing side by side, pale, with the
 * diagonal cut on show.
 *
 * PALE BEFORE IT IS ANYTHING ELSE. This is the only bread in the set drawn with
 * NO CRUST COLOUR: white sliced bread, barely tinted, against three warm tans
 * and an orange girder. At the size this is actually seen, that value gap does
 * more than the outline does — you can blur this to a smudge and it is still
 * the light smudge.
 *
 * TWO, WHERE THE PIZZA IS ONE. Both items are triangular and that is a real
 * collision, so it is settled by COUNT before either outline resolves: one big
 * wedge with a fat curved end, or two small peaks with a valley between them.
 * The two halves are deliberately UNEQUAL — different heights, different
 * widths, apexes off their own base centres — because two matched triangles
 * side by side is a chevron, and matched anything is a symbol rather than a
 * lunch.
 *
 * FOUR TOKENS, FOUR PARTS, and one of them is doing something unusual. `body`
 * is the bread of the FRONT half. `shade` is a COOL grey-blue: it tints the
 * BACK half so the two separate without an outline between them having to do
 * all the work, and being cold is the point — a warm shadow would put the tan
 * straight back into an item whose whole argument is that it has none. `accent`
 * is the filling, and it is a SINGLE green where the sub's filling is three
 * colours, so the two cut-open items do not rhyme even in their insides.
 */
function sandwich(ctx: CanvasRenderingContext2D, p: Palette): void {
  /** The back half, cooled a little so the pair separates at any size. */
  const backBread = mix(p.body, p.shade, 0.34);

  /**
   * One half: a squat triangle with a THICK RAGGED FILLING BAND that runs right
   * THROUGH its cut edges and out the other side.
   *
   * THE BAND CROSSING THE SILHOUETTE IS THE CORRECTION THIS DISH NEEDED, and it
   * took four looks to find it. Upright, blunted, tilted, squat — through all of
   * those the pair still read as HILLS, because a pale peak with a green line
   * across it is a horizon, and a horizon is the first thing the eye reaches for
   * when the shape is eight pixels wide. Clipping the filling INSIDE the bread
   * was the mistake: a stripe that stops at the outline is a stripe painted on a
   * shape, and a landscape is exactly that. Letting the lettuce break out
   * through both cut edges interrupts the OUTLINE at the filling, which no hill
   * has and every sandwich does. It is the same move the burger's frill makes.
   *
   * The edges are also gently CONVEX and the apex is blunt — bread is soft, and
   * a perfectly straight edge with a sharp point is geology.
   */
  const half = (
    ax: number,
    ay: number,
    lx: number,
    rx: number,
    by: number,
    tilt: number,
    fill: string,
    fy: number,
  ): void => {
    ctx.save();
    ctx.translate((lx + rx) / 2, by);
    ctx.rotate(tilt);
    ctx.translate(-(lx + rx) / 2, -by);

    /** A point `t` of the way from the apex down one of the cut edges. */
    const edge = (ex: number, t: number): [number, number] => [
      ax + (ex - ax) * t,
      ay + (by - ay) * t,
    ];
    const [blx, bly] = edge(lx, 0.24);
    const [brx, bry] = edge(rx, 0.24);
    const tri = (): void => {
      ctx.beginPath();
      ctx.moveTo(lx, by);
      ctx.quadraticCurveTo((lx + blx) / 2 - 0.7, (by + bly) / 2, blx, bly);
      ctx.quadraticCurveTo(ax, ay, brx, bry);
      ctx.quadraticCurveTo((rx + brx) / 2 + 0.7, (by + bry) / 2, rx, by);
      ctx.closePath();
    };
    tri();
    inked(ctx, fill, p.outline);

    // THE FILLING. Its ends are found ON the cut edges and then pushed nearly
    // two units PAST them, so the green leaves the bread rather than stopping at
    // it. Top edge straight — that is the underside of the top slice, and it
    // has to look cut; bottom edge ragged, because a leaf does not.
    const t = (fy + 1.4 - ay) / (by - ay);
    const l = edge(lx, t)[0] - 1.9;
    const r = edge(rx, t)[0] + 1.9;
    const w = r - l;
    const at = (f: number, dy: number): [number, number] => [l + w * f, fy + dy];
    ctx.beginPath();
    ctx.moveTo(l, fy + 1.2);
    ctx.quadraticCurveTo(...at(0.12, -0.9), ...at(0.32, -0.3));
    ctx.quadraticCurveTo(...at(0.5, 0.2), ...at(0.7, -0.4));
    ctx.quadraticCurveTo(...at(0.88, -0.9), r, fy + 1.2);
    ctx.quadraticCurveTo(...at(0.82, 3.6), ...at(0.62, 2.8));
    ctx.quadraticCurveTo(...at(0.45, 3.9), ...at(0.3, 2.8));
    ctx.quadraticCurveTo(...at(0.14, 3.7), l, fy + 1.2);
    ctx.closePath();
    // A LIGHTER edge than the bread's, deliberately. At full keyline weight a
    // two-unit band is mostly its own outline — the green disappears inside the
    // ink and the half reads as a striped pyramid. Internal marks in this file
    // are hairlines for exactly this reason; only the silhouette gets the
    // full-weight keyline, because only the silhouette is fighting the girder.
    ctx.fillStyle = p.accent;
    ctx.fill();
    ctx.strokeStyle = withAlpha(p.outline, 0.55);
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // The bread's keyline last, so the two slices still have an edge where the
    // filling has not taken it — and so the band reads as sitting BETWEEN them.
    tri();
    ctx.strokeStyle = p.outline;
    ctx.lineWidth = LINE;
    ctx.stroke();
    ctx.restore();
  };

  // THE TWO HALVES ARE UNEQUAL, TIPPED SLIGHTLY THE OPPOSITE WAY FROM EACH
  // OTHER, AND THEY OVERLAP. Two matched triangles side by side is a chevron,
  // and matched anything is a symbol rather than a lunch; the overlap is what
  // gives the pair depth from nothing but draw order, as the burger's stack
  // does. Both are WIDER THAN THEY ARE TALL, which a mountain is not.
  half(-7.8, -3.4, -12.6, -1.8, 6.6, 0.12, backBread, 0.7);
  half(5.4, -5.8, -1.6, 12.2, 7.8, -0.16, p.body, 1.4);
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
