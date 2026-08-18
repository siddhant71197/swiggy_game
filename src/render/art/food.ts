/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE ORDER — seven dishes, and not one of them may read as a rakhi.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: A SECOND ROUND GOLD THING ON THE TOWER.
 * Rakhis are what unlock the door, and the rakhi counter is the one number the
 * player has to be able to trust. A dish that reads as a gold disc at 22 units
 * does not cost a little polish — it makes the counter untrustworthy, because
 * the player cannot tell what they just picked up and the HUD is the only
 * witness. A tray of sweets makes this harder than a thali did: half of Indian
 * mithai is a small warm-coloured round object, which is also an exact
 * description of the collectible.
 *
 * The brand's palettes refuse to help a dessert impersonate a rakhi (see the
 * note on `colors.foods` in src/brand/types.ts — no gold, anywhere, and the
 * laddu is SAFFRON rather than marigold for precisely that reason). Colour
 * alone is not enough at speed, so the SILHOUETTES carry the read too. Seven
 * shapes, sharing no skeleton with each other or with the medallion:
 *
 *   gulab jamun  THREE small spheres in a shallow dish — no single circle.
 *   pastry       a TALL slice with a FLAT top and a cherry — vertical.
 *   laddu        TWO granular balls, one in a pleated case — never one disc.
 *   ice cream    a TUB, wider than tall, with a dome and a wafer leaning out.
 *   rasmalai     TWO low flat discs lying in a pool — wide and horizontal.
 *   choc pastry  a LONG LOW LOG, glazed and drizzled — horizontal, not upright.
 *   burger       a STACK of ragged slabs under a domed crown — layered, savoury.
 *
 * The rakhi is one centred circle with two threads leaving it sideways. None of
 * the seven shares that skeleton.
 *
 * ─── THE TWO DISHES THAT HAD TO EARN THEIR PLACE ───────────────────────────
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
 * THE TWO PASTRIES DIFFER BY SHAPE FIRST, colour second, and that ordering is
 * the rule rather than a nicety: nothing in this game is separable by colour
 * alone. Kind 1 is an UPRIGHT SLICE — flat top, cherry, vertical. Kind 5 is a
 * HORIZONTAL LOG — long, low, glazed. Recoloured to the same hue they would
 * still be two different objects, which is the test. The log is also kept
 * LIGHTER in value than the gulab jamun, which owns "the dark one" here; its
 * chocolate is a glaze stripe across the top, never the whole silhouette.
 *
 * ─── WHY THE SEVENTH IS A BURGER AND NOT A PIZZA SLICE ─────────────────────
 *
 * A pizza slice is a TRIANGLE, and the triangle is the one shape this file has
 * already been burned by — see the samosa, two paragraphs down. The burger's
 * dome-on-a-stack skeleton collides with nothing in the six above it.
 *
 * It is also the only savoury thing on a tray of sweets, which is an argument
 * FOR it — one of the most ordered objects on the platform — but it raises the
 * bar on the drawing: a burger that reads as "a stacked snack" has bought
 * nothing. What names it is LAYERS WITH RAGGED EDGES. The lettuce frill sticks
 * out past the bun and dips unevenly; the cheese hangs a corner off the front.
 * Both are irregular ON PURPOSE, because at 22 units a stack of tidy discs is a
 * macaron tower and the only thing that separates the two is the ragged edge.
 *
 * ITS NEAREST NEIGHBOUR IS THE CHOCOLATE PASTRY, and the two are separated on
 * three channels at once. The éclair is ONE smooth capsule with a glaze poured
 * over it; the burger is FOUR visibly separate slabs, and you can count them.
 * The éclair's ends are fully rounded, so its silhouette is a lozenge; the
 * burger's base is FLAT and its crown is a dome, so its silhouette has a
 * corner at each bottom edge and none at the top. And the burger carries green,
 * which the éclair — and the whole warm half of this set — does not.
 *
 * The bun is also kept clearly NOT SPHERICAL: the dome is nearly three times
 * wider than it is tall and it sits on a flat cut. The laddu and the gulab
 * jamun own the round-warm-object lane here, and a bun drawn as a ball would
 * be a third entrant in the one lane this file most wants kept thin.
 *
 * ─── WHY THE ICE CREAM IS A TUB AND NOT A CONE ─────────────────────────────
 *
 * Twice-learnt. A cone at this size is a thin triangle, and the triangle this
 * file used to carry (a samosa) read as a HAZARD WARNING SIGN — an actively
 * wrong reading in a game that colour-codes hazards. And a cone is "a tall
 * thing with a round thing on top", which is already taken: that is the
 * pastry. The tub is wide, flat-based, and shares its outline with nothing.
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
 * ─── THE BAKE COUNT IS SEVEN ───────────────────────────────────────────────
 *
 * One bake per dish and nothing else — no shine sweep, no rotation. The rakhi
 * quantises its highlight into 8 steps because it has a moving highlight; a
 * dish has none, so its only animation is the bob, which is a translate at blit
 * time and therefore free and continuous. Keeping it that way is what keeps a
 * tower carrying seven food items off the frame budget.
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

/** One keyline weight for all seven, so the set reads as one set. */
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
 * with seven dishes cannot render a blank sprite under a brand that ships three.
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
 * HUD size a biryani bowl and a gulab jamun dish are both a small dark lozenge,
 * so seven glyphs would carry no more information than one and would cost the
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
      gulabJamun(ctx, p);
      break;
    case 1:
      pastry(ctx, p);
      break;
    case 2:
      motichoorLaddu(ctx, p);
      break;
    case 3:
      iceCream(ctx, p);
      break;
    case 4:
      rasmalai(ctx, p);
      break;
    case 5:
      chocolatePastry(ctx, p);
      break;
    case 6:
      burger(ctx, p);
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
 * GULAB JAMUN — three syrup-dark spheres in a shallow dish.
 *
 * THREE, and that count is the anti-rakhi decision. One sphere in a dish is a
 * medallion in a setting; three of them are a portion, because no one of them
 * is the centre of the drawing. They are also the darkest thing in the dessert
 * set against the palest dish, so the group reads as a cluster at a glance
 * rather than as an object with a rim — and in a tray of six sweets that are
 * otherwise pale, being the dark one is half of this dish's identity.
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
 * ICE CREAM — a tub, a domed scoop and a wafer leaning out of it.
 *
 * A TUB, NOT A CONE, and the header says why twice over. The tub is WIDER THAN
 * TALL and flat-based, so its silhouette is a trapezoid — the one outline in
 * the set that is neither round, nor pointed, nor a slab.
 *
 * The tub is the set's only COOL colour. Four of these six desserts are warm
 * pale things on a warm orange tower, and giving one of them a blue-white
 * paper cup buys a separation that no amount of drawing does.
 *
 * The wafer is drawn BEFORE the scoop so it is planted in it rather than laid
 * on it, and it leans out sideways — which, like the chai handle it replaces,
 * breaks the silhouette in a direction a medallion never does.
 */
function iceCream(ctx: CanvasRenderingContext2D, p: Palette): void {
  // The tub: straight tapered walls, flat base, softened bottom corners.
  ctx.beginPath();
  ctx.moveTo(-9.4, -1.2);
  ctx.lineTo(9.4, -1.2);
  ctx.lineTo(7.4, 8.8);
  ctx.quadraticCurveTo(7.1, 10.4, 5.5, 10.4);
  ctx.lineTo(-5.5, 10.4);
  ctx.quadraticCurveTo(-7.1, 10.4, -7.4, 8.8);
  ctx.closePath();
  inked(ctx, p.shade, p.outline);

  // Two flutes down the cup — the detail that says "paper tub" rather than
  // "bucket". Hairlines, because at this size anything heavier is a stripe.
  ctx.strokeStyle = withAlpha(p.outline, 0.22);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-3.4, 0.4);
  ctx.lineTo(-2.6, 9.4);
  ctx.moveTo(3.4, 0.4);
  ctx.lineTo(2.6, 9.4);
  ctx.stroke();

  // The rolled rim, as a bar rather than a stroke — a 1-unit stroked rim is the
  // first thing to vanish when the device drops the backing-store scale.
  ctx.beginPath();
  roundRect(ctx, -10.4, -3.2, 20.8, 2.8, 1.3);
  inked(ctx, p.shade, p.outline);

  // The wafer, leaning out to the right.
  ctx.save();
  ctx.translate(6.2, -4.6);
  ctx.rotate(0.42);
  ctx.beginPath();
  roundRect(ctx, -1.7, -9.4, 3.4, 11, 1.3);
  inked(ctx, p.accent, p.outline);
  ctx.strokeStyle = withAlpha(p.outline, 0.35);
  ctx.lineWidth = 0.7;
  for (const y of [-6.6, -4.2, -1.8]) {
    ctx.beginPath();
    ctx.moveTo(-1.4, y);
    ctx.lineTo(1.4, y);
    ctx.stroke();
  }
  ctx.restore();

  // The scoop: a lobed dome, not a hemisphere. A clean half-circle sitting on a
  // rim is a dome on a plinth; the lobes are what make it a soft scoop.
  ctx.beginPath();
  ctx.moveTo(-8.6, -2.2);
  ctx.quadraticCurveTo(-8.8, -8.4, -4.2, -9.4);
  ctx.quadraticCurveTo(-2.6, -12.8, 1, -11.6);
  ctx.quadraticCurveTo(5.4, -10.6, 6.6, -6.4);
  ctx.quadraticCurveTo(8.2, -5, 8.6, -2.2);
  ctx.closePath();
  inked(ctx, p.body, p.outline);

  // One drip over the rim, on the far side from the wafer, so the scoop is
  // visibly softer than the cup it is sitting in.
  ctx.beginPath();
  roundRect(ctx, -7.2, -2.8, 3.4, 4.6, 1.7);
  inked(ctx, p.body, p.outline);
}

/**
 * RASMALAI — two flat discs lying in a shallow saffron pool.
 *
 * LOW AND WIDE, and FLAT. The discs are drawn as squashed ellipses seen from
 * above and slightly in front, so no circle in this drawing is ever round: the
 * one silhouette this dish must not have is the one it would get from drawing
 * the same discs face-on. They also overlap and sit BELOW the dish's rim line,
 * so the eye reads a portion in a bowl rather than two objects on a stand.
 *
 * It shares the shallow-bowl outline with the gulab jamun, and that is worth
 * saying out loud: the two are told apart by VALUE, not by shape. Gulab jamun
 * is the darkest thing in the set and rises above its rim as spheres; rasmalai
 * is the palest and stays flat inside its rim, in a saffron pool nothing else
 * here has. Change either of those and the pair collapses into one dish.
 */
function rasmalai(ctx: CanvasRenderingContext2D, p: Palette): void {
  const bowl = (): void => {
    ctx.beginPath();
    ctx.moveTo(-12.5, 0.6);
    ctx.lineTo(12.5, 0.6);
    ctx.lineTo(10.5, 3);
    ctx.bezierCurveTo(9.5, 9, -9.5, 9, -10.5, 3);
    ctx.closePath();
  };

  bowl();
  inked(ctx, p.body, p.outline);

  // The saffron, filling the bowl. Held to the inside of the clip so the rim
  // stays milk-white — a bowl filled edge to edge with warm colour is a disc.
  ctx.save();
  bowl();
  ctx.clip();
  // A BAND, not a fill. Saffron edge to edge turned the bowl's whole outline
  // saffron, and saffron on a Swiggy-orange girder is a keyline holding back a
  // colour that wants to merge with the tower. Held to a band under the rim,
  // the pool still reads as a pool and the SILHOUETTE stays milk-white, which
  // is the only value in this set that the girder cannot swallow.
  ctx.fillStyle = p.shade;
  ctx.fillRect(-13, 0.8, 26, 3.6);
  ctx.restore();

  // The rim, white, as a bar.
  ctx.beginPath();
  roundRect(ctx, -12.5, -0.8, 25, 2.6, 1.2);
  inked(ctx, p.body, p.outline);

  // The two discs, back one first. Wider than they are tall by nearly two to
  // one, which is what makes them read as soaked patties rather than as balls.
  disc(ctx, p, 5.2, -1.4, 6.2, 3.6);
  disc(ctx, p, -5, -2.8, 6.6, 3.9);

  // Pistachio, scattered across both. Three flecks: two reads as a pair of
  // eyes, four reads as texture.
  ctx.fillStyle = p.accent;
  for (const [fx, fy, rot] of [
    [-6.8, -4.2, -0.4],
    [-2.6, -2.6, 0.3],
    [4.8, -2.8, -0.2],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(fx, fy, 1.5, 1, rot, 0, Math.PI * 2);
    ctx.fill();
  }
}

function disc(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  dx: number,
  dy: number,
  rx: number,
  ry: number,
): void {
  ctx.beginPath();
  ctx.ellipse(dx, dy, rx, ry, 0, 0, Math.PI * 2);
  inked(ctx, p.body, p.outline);
  // Saffron soaking up the near edge of the disc, so it sits IN the pool.
  ctx.fillStyle = withAlpha(p.shade, 0.55);
  ctx.beginPath();
  ctx.ellipse(dx + rx * 0.1, dy + ry * 0.45, rx * 0.72, ry * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * CHOCOLATE PASTRY — an éclair: a long low log, split, filled, and glazed.
 *
 * HORIZONTAL, and that is the entire reason this dish is drawn the way it is.
 * The set already has a pastry, and it is a TALL upright slice. A second slice
 * in brown would be the same object in a different colour, which is the one
 * kind of variety this game does not accept: colour is never the sole channel
 * here, because at speed, on an orange ground, under a colour-blind player, it
 * is the channel that fails first. Upright wedge against horizontal log is a
 * difference you can read from the silhouette alone, with the palette off.
 *
 * THE SPLIT IS WHAT MAKES IT AN ÉCLAIR rather than a log of chocolate. Three
 * bands stacked — pastry, a cream line running the full length, pastry — and
 * the cream line is the mark that names the dish, the way the cherry names the
 * slice. It also does structural work: it cuts the shape in half lengthways so
 * the log never reads as one solid dark mass.
 *
 * KEPT LIGHTER THAN THE GULAB JAMUN, deliberately. That dish is the darkest
 * thing in the set and being the dark one is half its identity; a second dark
 * brown object would take it away from it. So the CHOUX is a warm tan and the
 * chocolate is confined to a glaze across the top, lifted further by a cream
 * drizzle over it. The two are also never the same shape — three spheres in a
 * dish against one long bar.
 */
function chocolatePastry(ctx: CanvasRenderingContext2D, p: Palette): void {
  // ONE LOG, drawn as a capsule with fully rounded ends. One shape, not three
  // stacked bars: an earlier version drew the split as a top slab, a cream
  // slab and a bottom slab, and three stacked bars with square-ish ends is a
  // SANDWICH. The filling has to be a line INSIDE a log, never a layer of it.
  const log = (): void => {
    ctx.beginPath();
    roundRect(ctx, -12.4, -6.2, 24.8, 12.6, 6.3);
  };
  log();
  inked(ctx, p.body, p.outline);

  // The underside, so the log is round rather than a flat plank.
  ctx.save();
  log();
  ctx.clip();
  ctx.fillStyle = withAlpha(p.shade, 0.16);
  ctx.fillRect(-13, 3.4, 26, 5);

  // THE GLAZE, poured over the top and stopping well short of the log's belly.
  // Clipped to the log, so it takes the capsule's own curve at both ends and
  // can never be a rectangle sitting on a rounded shape. Its lower edge runs
  // in shallow scallops — poured chocolate does not stop on a straight line,
  // and that ripple is what tells a glaze from a printed stripe at 22 units.
  ctx.beginPath();
  ctx.moveTo(-13, -7);
  ctx.lineTo(13, -7);
  ctx.lineTo(13, -2.2);
  ctx.quadraticCurveTo(9.6, -0.6, 6.5, -2.2);
  ctx.quadraticCurveTo(3.2, -0.6, 0, -2.2);
  ctx.quadraticCurveTo(-3.2, -0.6, -6.5, -2.2);
  ctx.quadraticCurveTo(-9.6, -0.6, -13, -2.2);
  ctx.closePath();
  ctx.fillStyle = p.shade;
  ctx.fill();
  ctx.restore();

  // The glaze's own edge, stroked over the top arc of the log so the chocolate
  // reads as a layer with a thickness rather than as a stain in the pastry.
  ctx.save();
  log();
  ctx.clip();
  ctx.strokeStyle = withAlpha(p.outline, 0.45);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-13, -2.2);
  ctx.quadraticCurveTo(-9.6, -0.6, -6.5, -2.2);
  ctx.quadraticCurveTo(-3.2, -0.6, 0, -2.2);
  ctx.quadraticCurveTo(3.2, -0.6, 6.5, -2.2);
  ctx.quadraticCurveTo(9.6, -0.6, 13, -2.2);
  ctx.stroke();
  ctx.restore();

  // THE CREAM, a line along the side and INSET from both ends — the mark that
  // names this dish the way the cherry names the slice, and the thing that
  // stops a long brown object reading as a solid bar of chocolate. Inset,
  // because a filling that runs out of the ends of the pastry is a layer.
  ctx.beginPath();
  roundRect(ctx, -8.8, 0.6, 17.6, 2.5, 1.25);
  inked(ctx, p.accent, withAlpha(p.outline, 0.45));

  // The drizzle: three cream lines piped across the glaze. The éclair's
  // signature, and what keeps the darkest area of this dish off one flat value.
  ctx.strokeStyle = withAlpha(p.accent, 0.9);
  ctx.lineWidth = 1.1;
  for (const dx of [-6.4, -0.6, 5.2]) {
    ctx.beginPath();
    ctx.moveTo(dx - 1.6, -5.4);
    ctx.lineTo(dx + 1.6, -3.4);
    ctx.stroke();
  }
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
