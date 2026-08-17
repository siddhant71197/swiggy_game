/**
 * ══════════════════════════════════════════════════════════════════════════
 *  LEVEL SELECT — ten stops, and a lock that explains itself.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): THE TAP THAT DOES NOTHING. A locked tile
 * that simply ignores a press is indistinguishable from a broken button, and the
 * player's next move is to tap it harder. So a locked tile is drawn as a
 * DIFFERENT OBJECT — sunken, padlocked, its name greyed — and it is excluded
 * from the hit array entirely rather than being hit-tested and then discarded.
 * Nothing here can be pressed and refused.
 *
 * THE FAILURE THIS FILE PREVENTS (2): TEN IDENTICAL TILES. A grid of numbers
 * tells the player how far they have got and nothing about what is up there, so
 * "pick a stop" is a choice between ten indistinguishable things and the only
 * rational move is to tap the highest one. Each tile therefore carries its
 * ARCHETYPE — the shape of the level, not its number — drawn from `LEVELS[i].kind`,
 * which is the sim's own field. A tile cannot promise a kitchen and load a lift
 * shaft, because the promise is read from the table that builds the stage.
 *
 * The unlock rule is `index <= save.bestLevel + 1`, evaluated from a payload
 * handed in by main.ts. This scene does not read the save: it renders the numbers
 * it is given and calls back with an index. That is the whole reason it can be
 * exercised with a hand-written payload.
 */

import type { PointerKind } from '../core/types';
import type { Girder } from '../core/types';
import { COLORS, withAlpha } from '../brand';
import { COPY } from '../config/copy';
import { LEVELS } from '../config/levels';
import { RADIUS, SPACE, TEXT, TRACK, WEIGHT, font } from '../config/theme';
import { columnRect, menuContentRect, rect, type Rect } from '../render/layout';
import {
  BUTTON_H_SM,
  button,
  card,
  ctaRect,
  hitTest,
  iconLock,
  label,
} from '../render/ui';
import { fillRound, roundRect } from '../render/shapes';
import { drawMarkCentered, markHeight } from '../render/mark';
import { drawBeltChevrons, drawGirderArt } from '../render/art/props';
import { drawDoorwayArt } from '../render/art/customer';
import type { Viewport } from '../render/canvas';
import type { GameScene, SceneId } from './director';

/** Ten stops. The level table is another agent's file; the count is the game's. */
const LEVEL_COUNT = 10;
const COLUMNS = 2;

/**
 * Hit slop, deliberately SMALLER than ui.hitTest's default 12.
 *
 * The tiles are 16 units apart, so 12 units of slop per side would make every
 * pair of neighbours overlap across the whole gap — and `hitTest` resolves an
 * overlap by draw order, which here means the later tile always wins. On a grid
 * that is not forgiveness, it is a tap on tile 3 opening tile 4. The tiles are
 * already large enough not to need help.
 */
const TILE_SLOP = 4;

/** The archetype glyph's square well, in reference units. */
const GLYPH = 54;

/** `StageDef.kind`, narrowed. Read, never written — see the header. */
type Archetype = 'girders' | 'kitchen' | 'lifts' | 'delivery';

export interface LevelSelectPayload {
  /** Highest level index the player has cleared. 0 means only level 1 is open. */
  bestLevel: number;
  /** Best score per level, indexed by level number. Sparse by convention. */
  levelBest: readonly number[];
}

export interface LevelSelectCallbacks {
  onPick(level: number): void;
  onBack(): void;
}

export class LevelSelectScene implements GameScene {
  readonly id: SceneId = 'levelSelect';

  private bestLevel = 0;
  private levelBest: readonly number[] = [];

  /**
   * Tile rects, index 0..9 → level 1..10. Index LEVEL_COUNT is the BACK button,
   * which lives in the same array so one hitTest covers the whole screen.
   */
  private readonly regions: Rect[] = Array.from({ length: LEVEL_COUNT + 1 }, () => ({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  }));
  private pressed = -1;

  constructor(
    private readonly vp: Viewport,
    private readonly cb: LevelSelectCallbacks,
  ) {}

  enter(payload?: unknown): void {
    const p = payload as LevelSelectPayload | undefined;
    this.bestLevel = p?.bestLevel ?? 0;
    this.levelBest = p?.levelBest ?? [];
    this.pressed = -1;
  }

  exit(): void {
    this.pressed = -1;
  }

  update(_dt: number, _simTime: number): void {}

  private unlocked(level: number): boolean {
    // Level 1 is always open. Everything else needs the one before it cleared.
    return level <= this.bestLevel + 1;
  }

  /**
   * The level's shape, from the sim's own table.
   *
   * Falls back rather than throwing: this screen is also the one a QA build
   * opens against a shortened level list, and a menu that crashes on a missing
   * row is a menu that hides the actual problem behind a blank screen.
   */
  private archetype(level: number): Archetype {
    return (LEVELS[level - 1]?.kind ?? 'girders') as Archetype;
  }

  private layout(): void {
    const content = menuContentRect(this.vp);
    const col = columnRect(this.vp, content.y, content.h);

    const backY = content.y + content.h - SPACE.lg - BUTTON_H_SM;
    copyRect(
      this.regions[LEVEL_COUNT]!,
      ctaRect(this.vp.fieldW, backY, col.w * 0.5, BUTTON_H_SM),
    );

    const gridTop = this.headerBottom();
    const gridBottom = backY - SPACE.lg;
    const rows = Math.ceil(LEVEL_COUNT / COLUMNS);
    const gap = SPACE.md;
    const tileW = (col.w - gap * (COLUMNS - 1)) / COLUMNS;
    const tileH = Math.max(88, (gridBottom - gridTop - gap * (rows - 1)) / rows);

    for (let i = 0; i < LEVEL_COUNT; i++) {
      const r = this.regions[i]!;
      r.x = col.x + (i % COLUMNS) * (tileW + gap);
      r.y = gridTop + Math.floor(i / COLUMNS) * (tileH + gap);
      r.w = tileW;
      r.h = tileH;
    }
  }

  /** Where the mark-plus-title header ends. One expression, used twice. */
  private headerBottom(): number {
    const content = menuContentRect(this.vp);
    const col = columnRect(this.vp, content.y, content.h);
    const markW = Math.min(150, col.w * 0.34);
    return content.y + SPACE.md + markHeight(markW, 'mark') + SPACE.lg + SPACE.lg + SPACE.md;
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number, _simTime: number): void {
    this.layout();
    const cx = this.vp.fieldW / 2;
    const content = menuContentRect(this.vp);
    const col = columnRect(this.vp, content.y, content.h);

    ctx.fillStyle = COLORS.surfaceTinted;
    ctx.fillRect(0, 0, this.vp.fieldW, this.vp.fieldH);

    // The mark, as supplied, on the paper ground. Never a knockout — the plated
    // cuts carry their own opaque plate and knocking one out paints a white
    // squircle where the emblem should be.
    const markW = Math.min(150, col.w * 0.34);
    const markH = markHeight(markW, 'mark');
    drawMarkCentered(ctx, cx, content.y + SPACE.md + markH / 2, markW);

    label(ctx, COPY.levelSelectTitle, cx, content.y + SPACE.md + markH + SPACE.lg, {
      size: TEXT.head,
      weight: WEIGHT.display,
      align: 'center',
      tone: 'primary',
      track: TRACK.display,
    });

    for (let i = 0; i < LEVEL_COUNT; i++) this.tile(ctx, i);

    button(ctx, this.regions[LEVEL_COUNT]!, COPY.quit, {
      variant: 'secondary',
      pressed: this.pressed === LEVEL_COUNT,
      size: TEXT.body,
    });
  }

  private tile(ctx: CanvasRenderingContext2D, i: number): void {
    const level = i + 1;
    const r = this.regions[i]!;
    const open = this.unlocked(level);
    const best = this.levelBest[level] ?? 0;

    card(ctx, r, {
      tone: open ? 'surface' : 'quiet',
      elevated: open,
      selected: open && this.pressed === i,
    });

    const padX = SPACE.md;
    // The glyph well is placed from the tile's RIGHT edge and the type from its
    // left, so a tile that grows on a tablet grows in the gutter between them
    // rather than pulling the two apart at different rates.
    const glyphR = rect(r.x + r.w - padX - GLYPH, r.y + padX, GLYPH, GLYPH);

    // The number is the tile's identity, so it carries the display weight even
    // when locked — a locked stop is still a place on the route.
    label(ctx, String(level), r.x + padX, r.y + padX + TEXT.title / 2, {
      size: TEXT.title,
      weight: WEIGHT.display,
      color: open ? COLORS.text : COLORS.textTertiary,
      track: TRACK.display,
    });

    if (!open) {
      // A padlock IN the glyph well, not floating in a corner: the well is where
      // the eye already goes for "what is this level", and the honest answer for
      // a locked one is "you cannot know yet".
      fillRound(ctx, glyphR, COLORS.surfaceSunken, RADIUS.chip);
      iconLock(ctx, glyphR.x + GLYPH / 2, glyphR.y + GLYPH / 2, 26, COLORS.textTertiary);
      label(ctx, COPY.levelLocked, r.x + padX, r.y + r.h - padX - TEXT.label / 2, {
        size: TEXT.label,
        tone: 'tertiary',
        track: TRACK.label,
      });
      return;
    }

    fillRound(ctx, glyphR, COLORS.surfaceQuiet, RADIUS.chip);
    ctx.save();
    ctx.beginPath();
    ctx.rect(glyphR.x, glyphR.y, glyphR.w, glyphR.h);
    ctx.clip();
    archetypeGlyph(ctx, this.archetype(level), glyphR);
    ctx.restore();

    // The name gets the full tile width — it sits BELOW the number/glyph row, so
    // it is not competing with the well for horizontal space. Two lines at most;
    // the longest name in the table is four words.
    const nameTop = r.y + padX + GLYPH + SPACE.sm;
    const lines = wrapLines(
      ctx,
      COPY.levelNames[i] ?? '',
      r.w - padX * 2,
      TEXT.label,
      2,
    );
    let ly = nameTop + TEXT.label * 0.7;
    for (const line of lines) {
      label(ctx, line, r.x + padX, ly, {
        size: TEXT.label,
        weight: WEIGHT.mid,
        tone: 'primary',
      });
      ly += TEXT.label * 1.35;
    }

    // The best score, on a hairline-separated footer. An em dash rather than a
    // zero for "never played": a zero is a score, and a score of zero is a thing
    // that can be beaten, so it reads as a claim about a run that happened.
    const footY = r.y + r.h - padX - TEXT.label / 2;
    if (best > 0) {
      label(ctx, COPY.levelBest, r.x + padX, footY, {
        size: TEXT.micro,
        tone: 'tertiary',
        track: TRACK.label,
      });
      label(ctx, String(best), r.x + r.w - padX, footY, {
        size: TEXT.body,
        weight: WEIGHT.display,
        tone: 'primary',
        align: 'right',
      });
    } else {
      label(ctx, COPY.levelBest, r.x + padX, footY, {
        size: TEXT.micro,
        tone: 'tertiary',
        track: TRACK.label,
      });
      // The dash is DRAWN, not typed. An em dash in a string literal is copy —
      // it would belong in config/copy.ts, and adding a COPY key whose entire
      // content is one punctuation mark is how a copy file stops being read.
      ctx.fillStyle = COLORS.textTertiary;
      ctx.fillRect(r.x + r.w - padX - 16, footY - 1, 16, 2);
    }
  }

  onPointer(kind: PointerKind, _id: number, x: number, y: number, _t: number): void {
    if (kind === 'down') {
      const hit = hitTest(this.regions, x, y, TILE_SLOP);
      // A locked tile is never pressable — see the header. Rejecting at PRESS
      // rather than at release means the tile never even lights up, so the
      // player is not told "yes" and then "no".
      this.pressed = hit >= 0 && hit < LEVEL_COUNT && !this.unlocked(hit + 1) ? -1 : hit;
      return;
    }
    if (kind === 'cancel') {
      this.pressed = -1;
      return;
    }
    if (kind !== 'up') return;

    const hit = hitTest(this.regions, x, y, TILE_SLOP);
    const was = this.pressed;
    this.pressed = -1;
    if (hit === -1 || hit !== was) return;

    if (hit === LEVEL_COUNT) this.cb.onBack();
    else if (this.unlocked(hit + 1)) this.cb.onPick(hit + 1);
  }
}

/**
 * THE ARCHETYPE GLYPH — what the level is shaped like, in 54 units.
 *
 * `girders` and `kitchen` are drawn by the game's OWN prop functions, with real
 * `Girder` records: a sloped floor and a sloped floor with chevrons on it are
 * exactly what those two archetypes are, and re-drawing them here would be a
 * promise this file made up. `lifts` and `delivery` have no single prop that
 * stands for them, so they are composed — the lift from its own colour group,
 * the delivery from the real doorway the customer stands in.
 */
function archetypeGlyph(ctx: CanvasRenderingContext2D, kind: Archetype, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;

  switch (kind) {
    case 'kitchen': {
      // One belt, chevrons and all, at the size a glyph can carry it. The phase
      // is fixed: a menu is not a place to start a second animation clock, and
      // a static chevron still says "this floor moves you".
      const g = girder(r.x + 6, cy + 10, r.x + r.w - 6, cy - 2, 1);
      drawGirderArt(ctx, g);
      drawBeltChevrons(ctx, g, 0.25);
      break;
    }

    case 'lifts': {
      // A cable and a car. Composed rather than borrowed: there is no lift art
      // module, and inventing a whole one for a 54-unit glyph would be a second
      // drawing of the lift that the stage renderer does not use.
      ctx.fillStyle = COLORS.liftCable;
      ctx.fillRect(cx - 1, r.y + 6, 2, r.h - 12);
      const carW = 30;
      const carH = 22;
      fillRound(ctx, rect(cx - carW / 2, cy - carH / 2, carW, carH), COLORS.liftCage, 3);
      ctx.strokeStyle = COLORS.liftTrim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      roundRect(ctx, cx - carW / 2, cy - carH / 2, carW, carH, 3);
      ctx.stroke();
      // Two rails, so the car reads as running in a shaft rather than hanging.
      ctx.fillStyle = withAlpha(COLORS.liftTrim, 0.5);
      ctx.fillRect(r.x + 8, r.y + 6, 2, r.h - 12);
      ctx.fillRect(r.x + r.w - 10, r.y + 6, 2, r.h - 12);
      break;
    }

    case 'delivery': {
      // The real doorway, from its own baseline — a door is a thing that stands
      // ON a floor, and floating it is the one way to make it stop reading as a
      // door. It is 58 units tall against a 54-unit well, so it is scaled to fit.
      //
      // Scaling is safe HERE and nowhere else in this file: `drawDoorwayArt`
      // draws paths straight into the context, so the transform is applied to
      // the geometry. The baked draws (agent, barrel, rakhi) rasterise against
      // `px` and a scaled context magnifies the bitmap instead — which is why
      // the rules screen places its art at natural size rather than scaling it.
      const k = 0.82;
      ctx.save();
      ctx.translate(cx, r.y + r.h - 3);
      ctx.scale(k, k);
      drawDoorwayArt(ctx, 0, 0);
      ctx.restore();
      break;
    }

    default: {
      // Three floors, alternating slope, each SHORTER than the well and offset
      // the other way — which is the actual grammar of the tower. Three full-
      // width bars would be a hamburger menu; a staircase is a climb.
      const inset = 7;
      const short = r.w * 0.68;
      drawGirderArt(ctx, girder(r.x + inset, r.y + 20, r.x + inset + short, r.y + 14, 0));
      drawGirderArt(
        ctx,
        girder(r.x + r.w - inset - short, cy + 10, r.x + r.w - inset, cy + 4, 0),
      );
      drawGirderArt(
        ctx,
        girder(r.x + inset, r.y + r.h - 8, r.x + inset + short, r.y + r.h - 14, 0),
      );
      break;
    }
  }
}

/** A throwaway `Girder` for a glyph. Only the fields `drawGirderArt` reads. */
function girder(x0: number, y0: number, x1: number, y1: number, belt: -1 | 0 | 1): Girder {
  return {
    id: -1,
    x0,
    y0,
    x1,
    y1,
    slope: (y1 - y0) / (x1 - x0),
    belt,
    solidLeft: true,
    solidRight: true,
  };
}

/**
 * Greedy wrap, capped at `maxLines`. The cap matters: a level name that grew a
 * word would otherwise push the score row off the bottom of its own tile, and a
 * grid is the layout where that is least visible in review.
 */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  size: number,
  maxLines: number,
): string[] {
  ctx.save();
  ctx.font = font(size, WEIGHT.mid);
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(test).width > maxW && line !== '') {
      out.push(line);
      if (out.length === maxLines) {
        ctx.restore();
        return out;
      }
      line = word;
    } else {
      line = test;
    }
  }
  if (line !== '' && out.length < maxLines) out.push(line);
  ctx.restore();
  return out;
}

function copyRect(dst: Rect, src: Rect): void {
  dst.x = src.x;
  dst.y = src.y;
  dst.w = src.w;
  dst.h = src.h;
}
