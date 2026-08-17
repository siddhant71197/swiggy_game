/**
 * ══════════════════════════════════════════════════════════════════════════
 *  PROPS — the girders, the ladders, the shutter. The structure IS the brand.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): THE AXIS-ALIGNED GIRDER. The floors slope
 * roughly 1-in-12 and the physics walks the segment, so a girder drawn as a
 * rectangle puts the agent visibly off his own floor at both ends of every
 * storey. Every fill here is a PARALLELOGRAM built from the same two endpoints
 * the sim uses; the picture cannot disagree with the collision because it is
 * derived from it.
 *
 * THE FAILURE THIS FILE PREVENTS (2): THE CONVEYOR THAT ANIMATES OFF WALL TIME.
 * A belt driven by `performance.now()` is a belt that keeps moving through a
 * pause, through the death freeze, and through the unlock hit-stop — three
 * moments the whole point of which is that the world has stopped. `beltPhase`
 * is passed in from sim time. There is no clock in this file.
 *
 * ─── WHY THE GIRDER IS THREE SLABS AND NOT A GRADIENT ──────────────────────
 *
 * A lit top face, a body face and a dark under-edge is the entire modern-flat
 * vocabulary for "this is a solid object with a top you stand on". Three flat
 * fills say it at any size and cost three fills. A vertical gradient says it
 * only at large sizes, costs a gradient object per girder per bake, and at
 * phone size resolves to a flat fill of the average colour — i.e. to the thing
 * it was trying not to be, minus the top face.
 *
 * ─── EVERYTHING HERE DRAWS IN STAGE UNITS, UNBAKED ─────────────────────────
 *
 * These are called from inside `stageView`'s single level-sized bake, not per
 * frame — with the one exception of the belt chevrons and the shutter, which
 * move. Both say so at their own definitions.
 */

import { COLORS, withAlpha } from '../../brand';
import type { Girder } from '../../core/types';
import type { Ladder } from '../../game/stage';
import { roundRect } from '../shapes';

// ─── Girders ────────────────────────────────────────────────────────────────

/** Total depth of a girder below its walking surface. */
export const GIRDER_H = 12;
/** The lit top face. */
const TOP_H = 3.5;
/** The dark under-edge. */
const EDGE_H = 2.5;
/** Rivets this far apart along the web. */
const RIVET_GAP = 26;

/** A sloped parallelogram from (x0,y0+dy) to (x1,y1+dy), `h` deep. */
function slab(
  ctx: CanvasRenderingContext2D,
  g: Girder,
  dy: number,
  h: number,
  fill: string,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(g.x0, g.y0 + dy);
  ctx.lineTo(g.x1, g.y1 + dy);
  ctx.lineTo(g.x1, g.y1 + dy + h);
  ctx.lineTo(g.x0, g.y0 + dy + h);
  ctx.closePath();
  ctx.fill();
}

/**
 * The static body of one girder. Belts get their chevrons separately — see
 * `drawBeltChevrons`.
 */
export function drawGirderArt(ctx: CanvasRenderingContext2D, g: Girder): void {
  // The under-shadow, first and widest, so the floor sits ON the backdrop
  // rather than floating in it. Two flat fills, never a blur.
  slab(ctx, g, GIRDER_H - 1, EDGE_H + 3, withAlpha(COLORS.text, 0.1));

  slab(ctx, g, 0, GIRDER_H, COLORS.girderFace);
  slab(ctx, g, 0, TOP_H, COLORS.girderTop);
  slab(ctx, g, GIRDER_H - EDGE_H, EDGE_H, COLORS.girderEdge);

  // Rivets down the web, spaced along the SEGMENT rather than along x, so a
  // steep floor does not get visibly stretched rivet spacing.
  const dx = g.x1 - g.x0;
  const dy = g.y1 - g.y0;
  const len = Math.hypot(dx, dy);
  const n = Math.max(1, Math.floor(len / RIVET_GAP));
  ctx.fillStyle = COLORS.girderRivet;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const rx = g.x0 + dx * t;
    const ry = g.y0 + dy * t + TOP_H + (GIRDER_H - TOP_H - EDGE_H) / 2;
    ctx.beginPath();
    ctx.arc(rx, ry, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The moving chevrons on a conveyor floor. PER FRAME — this is the only thing
 * in the world layer that cannot be baked, and there are at most a couple of
 * belts on a stage.
 *
 * `phase` is a 0..1 wrap driven by SIM time. See failure (2) in the header.
 *
 * The chevrons point in `g.belt`'s direction and are clipped to the girder's
 * own parallelogram, so nothing ever spills onto the backdrop at the ends —
 * which is the bug you get from drawing them into an axis-aligned rect.
 */
export function drawBeltChevrons(
  ctx: CanvasRenderingContext2D,
  g: Girder,
  phase: number,
): void {
  if (g.belt === 0) return;

  const band = GIRDER_H - TOP_H - EDGE_H;
  const top = TOP_H;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g.x0, g.y0 + top);
  ctx.lineTo(g.x1, g.y1 + top);
  ctx.lineTo(g.x1, g.y1 + top + band);
  ctx.lineTo(g.x0, g.y0 + top + band);
  ctx.closePath();
  ctx.clip();

  // Work in the girder's own frame: translate to the left end and rotate by the
  // slope, so the chevrons ride the floor instead of cutting across it.
  const ang = Math.atan2(g.y1 - g.y0, g.x1 - g.x0);
  const len = Math.hypot(g.x1 - g.x0, g.y1 - g.y0);
  ctx.translate(g.x0, g.y0 + top);
  ctx.rotate(ang);

  const step = 18;
  // Fractional-first offset, so the pattern scrolls continuously rather than
  // jumping a whole step when the phase wraps.
  const off = ((phase % 1) + 1) % 1;
  const start = -step * 2 + off * step * g.belt;

  for (let x = start; x < len + step; x += step) {
    for (let k = 0; k < 2; k++) {
      const cx = x + k * (step / 2);
      ctx.fillStyle = k === 0 ? COLORS.girderBeltA : COLORS.girderBeltB;
      ctx.beginPath();
      // A chevron: two strokes meeting at a point that leads the travel.
      const tip = cx + g.belt * 5;
      ctx.moveTo(cx, 0.5);
      ctx.lineTo(tip, band / 2);
      ctx.lineTo(cx, band - 0.5);
      ctx.lineTo(cx - g.belt * 3.2, band - 0.5);
      ctx.lineTo(tip - g.belt * 3.2, band / 2);
      ctx.lineTo(cx - g.belt * 3.2, 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * THE REVERSAL TELEGRAPH. PER FRAME, and only during `hazards.beltWarn`.
 *
 * A belt that flips direction with no warning is not a hazard, it is a rule
 * change applied mid-stride — the player commits to a crossing under one set of
 * physics and finishes it under another. `beltPhase()` returns 0 for exactly
 * this window (see game/world.ts) and BELT_WARN_SEC is how long it lasts.
 *
 * The flash draws chevrons in the direction the belt is ABOUT TO GO, in the
 * caution colour, over the ones already scrolling. That is deliberately more
 * information than a plain blink: "this is changing" tells the player to get
 * off, "this is about to push you left" tells them which way to leave, and the
 * second one is a decision.
 *
 * `on` is the blink phase and `nextDir` the incoming direction — both computed
 * by the caller from SIM numbers, because this file has no clock.
 */
export function drawBeltFlipWarn(
  ctx: CanvasRenderingContext2D,
  g: Girder,
  nextDir: number,
  on: boolean,
): void {
  if (nextDir === 0) return;

  const band = GIRDER_H - TOP_H - EDGE_H;
  const top = TOP_H;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g.x0, g.y0);
  ctx.lineTo(g.x1, g.y1);
  ctx.lineTo(g.x1, g.y1 + GIRDER_H);
  ctx.lineTo(g.x0, g.y0 + GIRDER_H);
  ctx.closePath();
  ctx.clip();

  // A caution wash over the whole floor on the lit half of the blink. The wash
  // is what catches the eye from across the stage; the arrows are what it reads
  // once it has arrived.
  ctx.fillStyle = withAlpha(COLORS.ladderBrokenCap, on ? 0.72 : 0.26);
  ctx.fillRect(
    Math.min(g.x0, g.x1) - 2,
    Math.min(g.y0, g.y1) - 2,
    Math.abs(g.x1 - g.x0) + 4,
    Math.abs(g.y1 - g.y0) + GIRDER_H + 4,
  );

  const ang = Math.atan2(g.y1 - g.y0, g.x1 - g.x0);
  const len = Math.hypot(g.x1 - g.x0, g.y1 - g.y0);
  ctx.translate(g.x0, g.y0 + top);
  ctx.rotate(ang);

  // PAPER, not `girderBeltB`. The first version drew these arrowheads in the
  // belt's own dark orange and they vanished into the girder they were painted
  // on — a telegraph the player has to hunt for is not a telegraph. White is the
  // same separator the agent's reflective bands use, and for the same reason.
  ctx.fillStyle = on ? COLORS.surface : withAlpha(COLORS.surface, 0.5);
  const step = 34;
  for (let x = step / 2; x < len; x += step) {
    // A solid arrowhead pointing the NEW way. Wider and shorter than the
    // scrolling chevrons so it reads as a different statement rather than as
    // the same pattern in another colour.
    const tip = x + nextDir * 8;
    ctx.beginPath();
    ctx.moveTo(tip, band / 2);
    ctx.lineTo(x - nextDir * 4, 0.5);
    ctx.lineTo(x - nextDir * 4, band - 0.5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// ─── Ladders ────────────────────────────────────────────────────────────────

export const LADDER_HALF_W = 9;
const RUNG_GAP = 15;
const RUNG_H = 3;

/**
 * One ladder rail.
 *
 * The BREAK on a gapped ladder is drawn as torn rail ends capped in the caution
 * colour, not as a plain missing section. A ladder that simply stops has to be
 * discovered by climbing it; a ladder with two capped stumps says "this one
 * does not go through" from anywhere on the floor below, which is the whole
 * difference between a hazard and a trap.
 */
export function drawLadderArt(ctx: CanvasRenderingContext2D, l: Ladder): void {
  const left = l.x - LADDER_HALF_W;
  const w = LADDER_HALF_W * 2;
  const railW = 4;

  // A drop under EACH RAIL, not under the whole ladder.
  //
  // Filling the full width fills the gaps between the rungs too, and the ladder
  // stops being a ladder — it becomes a dark plank with light stripes on it,
  // which is a thing you climb in front of rather than through. The backdrop has
  // to show between the rungs or the tower has no depth.
  ctx.fillStyle = COLORS.ladderShadow;
  ctx.beginPath();
  roundRect(ctx, left + 2, l.yTop + 2, railW, l.yBottom - l.yTop, railW / 2);
  ctx.fill();
  ctx.beginPath();
  roundRect(ctx, left + w - railW + 2, l.yTop + 2, railW, l.yBottom - l.yTop, railW / 2);
  ctx.fill();

  // Rungs FIRST, rails over them: a rung that visibly passes behind the rail is
  // a rung that reads as fixed to it.
  ctx.fillStyle = COLORS.ladderRung;
  for (let y = l.yTop + RUNG_GAP; y < l.yBottom; y += RUNG_GAP) {
    if (l.hasGap && y > l.gapTop - RUNG_H && y < l.gapBottom) continue;
    ctx.beginPath();
    roundRect(ctx, left, y, w, RUNG_H, 1.4);
    ctx.fill();
  }

  ctx.fillStyle = COLORS.ladderRail;
  if (l.hasGap) {
    railSegment(ctx, left, l.yTop, railW, l.gapTop - l.yTop);
    railSegment(ctx, left + w - railW, l.yTop, railW, l.gapTop - l.yTop);
    railSegment(ctx, left, l.gapBottom, railW, l.yBottom - l.gapBottom);
    railSegment(ctx, left + w - railW, l.gapBottom, railW, l.yBottom - l.gapBottom);

    ctx.fillStyle = COLORS.ladderBrokenCap;
    ctx.beginPath();
    roundRect(ctx, left - 1, l.gapTop - 3.5, w + 2, 3.5, 1.6);
    ctx.fill();
    ctx.beginPath();
    roundRect(ctx, left - 1, l.gapBottom, w + 2, 3.5, 1.6);
    ctx.fill();
  } else {
    railSegment(ctx, left, l.yTop, railW, l.yBottom - l.yTop);
    railSegment(ctx, left + w - railW, l.yTop, railW, l.yBottom - l.yTop);
  }
}

function railSegment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (h <= 0) return;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, w / 2);
  ctx.fill();
}

// ─── The shutter ────────────────────────────────────────────────────────────

/**
 * The rolling shutter over the gated ladder's mouth. PER FRAME — it animates.
 *
 * Drawn as a real roller shutter: a box housing at the top, ribbed slats below
 * it, and a pull-rail along the bottom edge. The ribbing is what makes the roll
 * legible; a plain dark rectangle sliding upward reads as a wipe, not as a shop
 * opening.
 *
 * `openT` is 0 (down) to 1 (rolled away). The caller owns the clip and the
 * lock/count overlay — those carry copy, and copy does not live in an art file.
 */
export function drawShutterArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = COLORS.shutterClosed;
  ctx.beginPath();
  roundRect(ctx, x, top, w, h, 3);
  ctx.fill();

  // Slats. Two fills per slat — a light lip and the body — because a single
  // line per slat reads as hatching rather than as corrugation.
  for (let sy = top + 6; sy < top + h - 4; sy += 8) {
    ctx.fillStyle = COLORS.shutterSlat;
    ctx.fillRect(x + 2, sy, w - 4, 2.4);
    ctx.fillStyle = withAlpha(COLORS.shutterClosed, 0.5);
    ctx.fillRect(x + 2, sy + 2.4, w - 4, 1.2);
  }

  // The housing the shutter rolls into, and the pull-rail at the bottom.
  ctx.fillStyle = COLORS.shutterSlat;
  ctx.beginPath();
  roundRect(ctx, x - 3, top - 5, w + 6, 6, 3);
  ctx.fill();
  ctx.fillStyle = COLORS.shutterSlat;
  ctx.beginPath();
  roundRect(ctx, x + 1, top + h - 5, w - 2, 4, 2);
  ctx.fill();
}

/** The glow band left where the shutter was, once it is fully open. */
export function drawShutterOpenArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  w: number,
): void {
  ctx.fillStyle = withAlpha(COLORS.shutterOpenGlow, 0.5);
  ctx.beginPath();
  roundRect(ctx, x, top, w, 4, 2);
  ctx.fill();
  ctx.fillStyle = withAlpha(COLORS.shutterOpenGlow, 0.22);
  ctx.beginPath();
  roundRect(ctx, x - 2, top - 2, w + 4, 8, 4);
  ctx.fill();
}
