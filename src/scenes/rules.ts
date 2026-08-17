/**
 * ══════════════════════════════════════════════════════════════════════════
 *  RULES — four panels, shown ONCE, and never again unasked.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): the tutorial that reappears every session.
 * A card the player has to dismiss every time they open the game is a card they
 * learn to dismiss WITHOUT READING — including the first time, because by then
 * the reflex is already trained. So it auto-opens exactly once, gated on
 * `save.seenRules`, and after that it is reachable only from the splash's HOW TO
 * PLAY, where the player asked for it.
 *
 * THE GATE IS NOT IN THIS FILE. `seenRules` is read and written by main.ts, which
 * owns the save; this scene fires `onSeen()` when it is dismissed and knows
 * nothing about why it was shown. A scene that decided its own visibility would
 * need the save, and a scene with the save is a scene that can corrupt it.
 *
 * THE FAILURE THIS FILE PREVENTS (2): THE TUTORIAL THAT TEACHES STALE ARTWORK.
 * Every pictogram below is drawn by the SAME function the play scene calls —
 * `drawAgentArt`, `drawBarrelArt`, `drawRakhiArt`, `drawMonkeyArt`,
 * `drawLadderArt`, `drawShutterArt`. Not one shape here is re-authored for the
 * tutorial. That is the whole point: a rules screen with its own simplified
 * drawings is a rules screen that goes wrong silently the first time the agent
 * gets a new bag, and the person who restyles the agent has no reason to open
 * this file. There is nothing here for them to forget.
 *
 * THE ONE THING IT TEACHES THAT A PLAYER CANNOT GUESS is panel 2: the top floor
 * is SHUT until every collectible is in hand. Nothing on the stage says so
 * before you have climbed to it and found a shutter, so the pictogram is the
 * shutter with its padlock and the collectibles below it, in that vertical
 * order — the picture is the sentence.
 *
 * ─── ON THE PICTOGRAM FOR PANEL 4 ──────────────────────────────────────────
 *
 * The powerup has no art module and the play scene does not render one yet, so
 * panel 4 shows its EFFECT — the agent airborne over a wild (red) hazard — using
 * the real hazard art, rather than a shaker invented here. Inventing one would
 * be precisely the stale artwork failure above, committed on purpose.
 *
 * The four panels come from COPY.rules, filled through `t()` from the brand's
 * vocabulary — so a re-skin changes "rakhi" to whatever the next brand collects
 * in four words rather than in four rewritten paragraphs.
 */

import type { PointerKind } from '../core/types';
import type { Ladder } from '../game/stage';
import { COLORS, withAlpha } from '../brand';
import { COPY, t, tSentence } from '../config/copy';
import { RADIUS, SPACE, TEXT, TRACK, WEIGHT, font } from '../config/theme';
import { columnRect, menuContentRect, rect, type Rect } from '../render/layout';
import {
  BUTTON_H,
  button,
  card,
  ctaRect,
  hitTest,
  iconDpad,
  iconJump,
  iconLock,
  label,
} from '../render/ui';
import { fillRound } from '../render/shapes';
import { drawMarkCentered, markHeight } from '../render/mark';
import { motionReduced } from '../render/fx';
import { clamp } from '../core/math';
import { drawAgentArt } from '../render/art/agent';
import { drawBarrelArt } from '../render/art/barrel';
import { drawMonkeyArt } from '../render/art/monkey';
import { drawRakhiArt } from '../render/art/rakhi';
import { drawLadderArt, drawShutterArt } from '../render/art/props';
import type { Viewport } from '../render/canvas';
import type { GameScene, SceneId } from './director';

export interface RulesCallbacks {
  /** Dismissed. main.ts sets save.seenRules and decides where to go next. */
  onSeen(): void;
}

// ─── The reveal, in named seconds ───────────────────────────────────────────
//
// Named rather than inlined because a stagger is four numbers that only make
// sense together: change RISE_SEC without changing STAGGER_SEC and the panels
// stop reading as a sequence and start reading as a stutter. They are also the
// numbers a reviewer asks about, and "0.07" three lines apart is not an answer.

/** Dead air before the first panel moves. Long enough for the wipe to clear. */
const REVEAL_LEAD_SEC = 0.08;
/** Between one panel starting and the next. Below ~0.05 the stagger vanishes. */
const REVEAL_STAGGER_SEC = 0.075;
/** How long one panel takes to arrive. */
const REVEAL_RISE_SEC = 0.28;
/** How far it travels, in reference units. Small: this is punctuation, not a
 *  transition — the screen is already here, the panels are just landing. */
const REVEAL_RISE_UNITS = 22;

/** The control diagram's d-pad walks its keys, so the picture demonstrates. */
const DPAD_CYCLE_SEC = 0.9;
/** Order the diagram lights the pad in: right, up, left, then rest. Matches
 *  `PAD`'s ordinals (0 up, 1 down, 2 left, 3 right); -1 is nothing pressed. */
const DPAD_STEPS: readonly number[] = [3, 0, 2, 0, -1];

/** Pictogram tile width. Everything inside a panel is laid out from this. */
const TILE_W = 132;

export class RulesScene implements GameScene {
  readonly id: SceneId = 'rules';

  private readonly regions: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];
  private pressed = -1;

  /** Seconds since `enter`. The only clock in the scene, and it is not wall
   *  time — a reveal driven by `performance.now()` replays whenever the tab
   *  comes back from the background. */
  private elapsed = 0;

  /** Device pixels per reference unit, for the art bakes. Refreshed each frame
   *  because a quality drop or a rotation changes it with no event to hook. */
  private px = 1;

  constructor(
    private readonly vp: Viewport,
    private readonly cb: RulesCallbacks,
  ) {}

  enter(_payload?: unknown): void {
    this.pressed = -1;
    this.elapsed = 0;
  }

  exit(): void {
    this.pressed = -1;
  }

  update(dt: number, _simTime: number): void {
    this.elapsed += dt;
  }

  /**
   * 0..1 for panel `i`, eased. Returns 1 immediately under reduced motion: the
   * preference asks for no movement, not for a slower one, and a tutorial that
   * animates anyway is the single most common place that preference is ignored.
   */
  private reveal(i: number): number {
    if (motionReduced()) return 1;
    const start = REVEAL_LEAD_SEC + i * REVEAL_STAGGER_SEC;
    const tRaw = clamp((this.elapsed - start) / REVEAL_RISE_SEC, 0, 1);
    // Cubic ease-out. Everything arrives fast and settles, which is what makes
    // a stagger read as one gesture rather than as four separate events.
    return 1 - (1 - tRaw) ** 3;
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number, _simTime: number): void {
    this.px = this.vp.refToDevice(1);
    const content = menuContentRect(this.vp);
    const col = columnRect(this.vp, content.y, content.h);
    const cx = this.vp.fieldW / 2;

    ctx.fillStyle = COLORS.surfaceTinted;
    ctx.fillRect(0, 0, this.vp.fieldW, this.vp.fieldH);

    // THE MARK, ON THE TINTED PAPER GROUND — used exactly as supplied. This is
    // not the brand-orange ground the splash sits on, so it needs no plate; and
    // it is emphatically not a knockout, which would re-cut plated artwork by
    // its alpha and paint a white squircle where the emblem is.
    const markW = Math.min(176, col.w * 0.4);
    const markH = markHeight(markW, 'mark');
    const markY = content.y + SPACE.md;
    drawMarkCentered(ctx, cx, markY + markH / 2, markW);

    const titleY = markY + markH + SPACE.lg;
    label(ctx, COPY.rulesTitle, cx, titleY, {
      size: TEXT.head,
      weight: WEIGHT.display,
      align: 'center',
      tone: 'primary',
      track: TRACK.display,
    });

    // The CTA is placed FIRST, from the bottom, and the panels fill what is
    // left. Laying the panels out first and hoping the button fits is how a
    // fourth panel silently pushes GOT IT off a short screen — and a tutorial
    // with no exit is the worst screen in any game. `content` already excludes
    // the ad reserve, so nothing here can slide under the banner.
    const ctaY = content.y + content.h - SPACE.lg - BUTTON_H;
    const cta = ctaRect(this.vp.fieldW, ctaY, col.w, BUTTON_H);
    copyRect(this.regions[0]!, cta);

    // The controls strip, also from the bottom.
    const stripH = 96;
    const strip = rect(col.x, cta.y - SPACE.lg - stripH, col.w, stripH);

    const panelsTop = titleY + SPACE.lg + SPACE.sm;
    const panelsBottom = strip.y - SPACE.lg;
    const n = COPY.rules.length;
    const gap = SPACE.md;
    const panelH = Math.max(96, (panelsBottom - panelsTop - gap * (n - 1)) / n);

    for (let i = 0; i < n; i++) {
      const rule = COPY.rules[i];
      if (!rule) continue;
      const k = this.reveal(i);
      const r = rect(col.x, panelsTop + i * (panelH + gap) + (1 - k) * REVEAL_RISE_UNITS, col.w, panelH);

      ctx.save();
      ctx.globalAlpha = k;
      card(ctx, r, { tone: 'surface', elevated: true, radius: RADIUS.card });

      // The pictogram sits in a sunken well on the left, which does two things:
      // it separates game art from UI paper, and it gives every panel the same
      // optical left margin regardless of how wide its drawing happens to be.
      const tile = rect(r.x + SPACE.md, r.y + SPACE.md, TILE_W, r.h - SPACE.md * 2);
      fillRound(ctx, tile, COLORS.surfaceQuiet, RADIUS.chip);
      ctx.save();
      // Clipped, because the art functions draw at their natural game size and a
      // tall pictogram must crop rather than bleed across the panel's copy.
      ctx.beginPath();
      ctx.rect(tile.x, tile.y, tile.w, tile.h);
      ctx.clip();
      this.pictogram(ctx, i, tile);
      ctx.restore();

      // A numbered pip rather than a bullet: the panels are a SEQUENCE (climb,
      // then collect, then dodge, then spend), and a bullet says they are a set.
      const textX = tile.x + tile.w + SPACE.md;
      const textW = r.x + r.w - SPACE.md - textX;
      const pipR = 14;

      // MEASURED, THEN CENTRED. The bodies are two lines on a wide phone and
      // three on a narrow one, and a block pinned to the panel's top edge leaves
      // a visibly different amount of air under each panel once that happens.
      const body = wrapLines(ctx, tSentence(rule.body), textW, TEXT.label);
      const bodyLineH = TEXT.label * 1.45;
      const blockH = pipR * 2 + SPACE.md + body.length * bodyLineH;
      const pipCy = tile.y + Math.max(0, (tile.h - blockH) / 2) + pipR;
      ctx.fillStyle = COLORS.btnHero;
      ctx.beginPath();
      ctx.arc(textX + pipR, pipCy, pipR, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, String(i + 1), textX + pipR, pipCy + 1, {
        size: TEXT.label,
        weight: WEIGHT.display,
        align: 'center',
        color: COLORS.btnHeroText,
      });

      label(ctx, t(rule.title), textX + pipR * 2 + SPACE.sm, pipCy, {
        size: TEXT.sub,
        weight: WEIGHT.display,
        tone: 'primary',
      });
      let ly = pipCy + pipR + SPACE.md + bodyLineH / 2;
      for (const line of body) {
        label(ctx, line, textX, ly, { size: TEXT.label, tone: 'secondary' });
        ly += bodyLineH;
      }
      ctx.restore();
    }

    this.controlStrip(ctx, strip);

    button(ctx, this.regions[0]!, COPY.rulesStart, {
      variant: 'hero',
      pressed: this.pressed === 0,
    });
  }

  /**
   * THE CONTROL DIAGRAM. A d-pad and a jump button, drawn from the same tokens
   * the live controls are built from (see `iconDpad`), with the copy between
   * them. The pad walks its keys on a loop, so the picture makes the claim the
   * sentence makes.
   */
  private controlStrip(ctx: CanvasRenderingContext2D, r: Rect): void {
    card(ctx, r, { tone: 'quiet', radius: RADIUS.card });

    const padSize = Math.min(76, r.h - SPACE.md * 2);
    const padCx = r.x + SPACE.lg + padSize / 2;
    const cy = r.y + r.h / 2;
    const step = motionReduced()
      ? -1
      : (DPAD_STEPS[Math.floor(this.elapsed / DPAD_CYCLE_SEC) % DPAD_STEPS.length] ?? -1);
    iconDpad(ctx, padCx, cy, padSize, step);

    const jumpR = padSize * 0.42;
    const jumpCx = r.x + r.w - SPACE.lg - jumpR;
    iconJump(ctx, jumpCx, cy, jumpR);

    const textX = padCx + padSize / 2 + SPACE.md;
    const textW = jumpCx - jumpR - SPACE.md - textX;
    // Two lines of small copy, centred on the strip's own centreline: measured
    // first so the block is centred rather than top-aligned, which is the
    // difference between a caption and a stray sentence.
    const lines = wrapLines(ctx, COPY.rulesControls, textW, TEXT.micro);
    const lineH = TEXT.micro * 1.5;
    let ly = cy - ((lines.length - 1) * lineH) / 2;
    for (const line of lines) {
      label(ctx, line, textX, ly, { size: TEXT.micro, tone: 'secondary' });
      ly += lineH;
    }
  }

  /**
   * One pictogram, drawn with the game's own art at the game's own scale.
   *
   * No `ctx.scale` anywhere: the art functions size their bakes from `px`, so a
   * scaled context magnifies a bake that was rasterised for a different size and
   * every pictogram comes out soft. The tile is instead made big enough for the
   * drawing, and the drawing is placed inside it.
   */
  private pictogram(ctx: CanvasRenderingContext2D, i: number, tile: Rect): void {
    const cx = tile.x + tile.w / 2;
    const floor = tile.y + tile.h - SPACE.lg;
    const px = this.px;

    switch (i) {
      // 1 · CLIMB. A ladder the agent is on, seen from behind — the same back
      // view the player stares at longest during a real climb.
      case 0: {
        const l: Ladder = {
          id: 0,
          x: cx,
          yTop: tile.y + SPACE.sm,
          yBottom: floor,
          hasGap: false,
          gapTop: 0,
          gapBottom: 0,
          gated: false,
        };
        drawLadderArt(ctx, l);
        drawAgentArt(ctx, cx, floor - (tile.h - SPACE.md) * 0.28, px, 'climb0', 1);
        break;
      }

      // 2 · THE GATE, WHICH IS THE ONE RULE THE STAGE DOES NOT TELL YOU.
      // Shutter on top with its padlock, collectibles underneath. Read top to
      // bottom it says: that is closed, and these are why.
      case 1: {
        const shutW = 54;
        const shutH = 40;
        const shutTop = tile.y + SPACE.md;
        drawShutterArt(ctx, cx - shutW / 2, shutTop, shutW, shutH);
        iconLock(ctx, cx, shutTop + shutH / 2, 22, COLORS.shutterLockIcon);

        const rakhiY = tile.y + tile.h - 34;
        for (let k = 0; k < 3; k++) {
          drawRakhiArt(ctx, cx + (k - 1) * 32, rakhiY, px, k * 2);
        }
        break;
      }

      // 3 · THE HAZARD AND ITS SOURCE, in the vertical order the level puts
      // them in: the thrower up top, mid-throw, and the drum already on its way
      // down. The agent is deliberately ABSENT — he is in panels 1 and 4, and a
      // third figure in a 132-unit tile is three clipped silhouettes.
      case 2: {
        drawMonkeyArt(ctx, cx - 12, tile.y + 74, px, 'throw');
        drawBarrelArt(ctx, cx + 32, tile.y + 94, px, 0, false);
        break;
      }

      // 4 · THE POWERUP'S EFFECT. See the header: there is no shaker artwork, so
      // this is the wild drum and an airborne agent, which is what having one
      // looks like from the outside.
      default: {
        // A ground line FIRST, under both, so the jump reads as a jump rather
        // than as a figure floating. One fill, in the girder's own face colour.
        ctx.fillStyle = withAlpha(COLORS.girderFace, 0.55);
        ctx.fillRect(tile.x + SPACE.md, floor, tile.w - SPACE.md * 2, 3);
        drawBarrelArt(ctx, cx + 30, floor - 20, px, 2, true);
        drawAgentArt(ctx, cx - 22, floor - 28, px, 'jump', 1);
        break;
      }
    }
  }

  onPointer(kind: PointerKind, _id: number, x: number, y: number, _t: number): void {
    if (kind === 'down') {
      this.pressed = hitTest(this.regions, x, y);
      return;
    }
    if (kind === 'cancel') {
      this.pressed = -1;
      return;
    }
    if (kind !== 'up') return;
    const hit = hitTest(this.regions, x, y);
    const was = this.pressed;
    this.pressed = -1;
    if (hit === 0 && was === 0) this.cb.onSeen();
  }
}

/**
 * Greedy word wrap, measured against the live font, returning the lines.
 *
 * Local rather than a ui.ts widget on purpose: this is the only running-copy
 * block in the whole game — everything else is a label, a value or a CTA — and a
 * general text-flow engine in the renderer would be a large thing existing for
 * one call site.
 */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  size: number,
): string[] {
  ctx.save();
  ctx.font = font(size, WEIGHT.body);
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(test).width > maxW && line !== '') {
      out.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line !== '') out.push(line);
  ctx.restore();
  return out;
}

function copyRect(dst: Rect, src: Rect): void {
  dst.x = src.x;
  dst.y = src.y;
  dst.w = src.w;
  dst.h = src.h;
}
