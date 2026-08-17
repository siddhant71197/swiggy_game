/**
 * ══════════════════════════════════════════════════════════════════════════
 *  STAGE VIEW — the whole static world, as one blit.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: PAINTING THE LEVEL SIXTY TIMES A SECOND.
 *
 * A stage is seven sloped girders (each: a shadow, three slabs and up to twenty
 * rivets), five or six ladders (each: two rails and forty rungs), and a
 * doorway. That is on the order of four hundred path operations, and NONE of it
 * changes between the first frame of a level and the last. Rebuilt per frame it
 * is the single largest line in the render budget and it buys nothing at all.
 *
 * Baked, it is ONE `drawImage`. The cost is paid once, at level start, where a
 * hitch is behind the "GO!" beat and invisible.
 *
 * ─── WHAT IS *NOT* IN THE BAKE, AND WHY EACH ──────────────────────────────
 *
 *   the agent, barrels, rakhis    they move.
 *   the monkey, the customer      they animate; their DOORWAY is baked.
 *   the shutter                   it rolls.
 *   conveyor chevrons             they scroll; the belt girder's BODY is baked
 *                                 and only the chevrons are drawn live.
 *
 * ─── THE KEY HAS TO CARRY THE LEVEL ────────────────────────────────────────
 *
 * `bake()` keys on kind + device size + dpr + quality. Two different levels are
 * the same size, so without the level number in the kind the second level of a
 * session would blit the first level's girders — geometry that does not match
 * the collision, which is the worst class of bug this codebase has, because it
 * looks like a physics failure and is a cache failure.
 *
 * ─── THE BACKDROP IS NOT BAKED ─────────────────────────────────────────────
 *
 * A two-stop wash and a pattern fill are two fills. Baking them would mean a
 * full-band backing store — the largest single allocation in the game — to save
 * less than the blit of that same store costs. The WATERMARK TILE is baked
 * (mark.ts does it) and repeated through a pattern, so the tiled emblem is one
 * fill regardless of how many cells are on screen.
 */

import { COLORS } from '../brand';
import { STAGE } from '../config/tuning';
import type { Stage } from '../game/stage';
import { drawDoorwayArt } from './art/customer';
import { drawGirderArt, drawLadderArt } from './art/props';
import type { Viewport } from './canvas';
import type { Rect } from './layout';
import { emblemWatermarkTile } from './mark';
import { bake, blit } from './prerender';
import { linearWash, vignette } from './shapes';

/** Reference units per watermark cell. Large enough that the tiling never reads
 *  as a texture and small enough that the apron is never empty. */
const WATERMARK_CELL = 120;

/**
 * The pattern is cached against the TILE CANVAS ITSELF, not against a size.
 *
 * `emblemWatermarkTile` returns the same canvas object for as long as its bake
 * is live, and a new one the moment dpr, quality or the cache budget say so.
 * Keying on identity means the pattern is rebuilt exactly when the tile is and
 * never otherwise — a size-keyed cache would miss an eviction and go on filling
 * with a canvas that has been collapsed to 0×0.
 */
let patternTile: HTMLCanvasElement | null = null;
let pattern: CanvasPattern | null = null;

/**
 * The backdrop: wash, tiled emblem watermark, vignette. Per frame, three fills.
 *
 * `band` is the stage band in REFERENCE units — this runs outside the stage
 * translate, because the wash covers the apron either side of the playfield and
 * the apron is not in stage space.
 */
export function drawStageBackdrop(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  band: Rect,
): void {
  linearWash(ctx, band.x, band.y, band.w, band.h, COLORS.stageSkyTop, COLORS.stageSkyBottom);

  const tile = emblemWatermarkTile(WATERMARK_CELL, Math.round(vp.refToDevice(WATERMARK_CELL)));
  if (tile !== patternTile) {
    patternTile = tile;
    pattern = tile.width > 0 ? ctx.createPattern(tile, 'repeat') : null;
  }
  if (pattern) {
    ctx.save();
    // The pattern's origin is the CONTEXT origin, so without this translate the
    // watermark grid would shift under the band whenever the band moves — i.e.
    // on every rotation and on every device with a different safe-area inset.
    ctx.translate(band.x, band.y);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, band.w, band.h);
    ctx.restore();
  }

  vignette(ctx, band, COLORS.stageVignette);
}

/**
 * The baked static world layer, in STAGE units.
 *
 * Returns a canvas the size of the whole stage; the caller blits it at the
 * stage origin, inside the same translate the entities are drawn in, so the
 * layer and the entities cannot drift apart.
 */
export function stageLayer(vp: Viewport, stage: Stage, level: number): HTMLCanvasElement {
  const w = STAGE.W;
  const h = STAGE.H;
  return bake(
    `stage:${level}`,
    w,
    h,
    vp.refToDevice(w),
    vp.refToDevice(h),
    (c) => paintStatic(c, stage),
  );
}

/** Blit the static layer. Call inside the stage translate. */
export function drawStageLayer(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  stage: Stage,
  level: number,
): void {
  blit(ctx, stageLayer(vp, stage, level), 0, 0, STAGE.W, STAGE.H);
}

function paintStatic(ctx: CanvasRenderingContext2D, stage: Stage): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // LADDERS UNDER GIRDERS. A ladder passes THROUGH the floor it connects, so its
  // rails must disappear behind the girder rather than crossing in front of it —
  // drawn on top, every rail ends in a visible stub sitting on the walking
  // surface, and the tower stops reading as built and starts reading as pasted.
  for (const l of stage.ladders) drawLadderArt(ctx, l);

  // THE LIFT SCRATCH SLOTS ARE NOT FLOORS AND MUST NOT BE BAKED.
  //
  // `stage.girders[i]` for `i >= stage.liftBase` is a CAR (see Stage.liftBase):
  // game/hazards.ts rewrites its endpoints every step so the ground code never
  // learns lifts exist. Baked here it would be painted once, at the bottom of
  // its travel, and then again — live, in the right place — by the hazard layer:
  // every car rendered twice, one of them a girder-coloured ghost sitting on a
  // surface nothing collides with. The cars are drawn in play.ts's world layer.
  const floors = stage.liftBase >= 0 ? stage.liftBase : stage.girders.length;
  for (let i = 0; i < floors; i++) drawGirderArt(ctx, stage.girders[i]!);

  // The doorway is static; the customer standing in it is not.
  const door = stage.def.customerAt;
  drawDoorwayArt(ctx, door.x, door.y);
}
