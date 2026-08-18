/**
 * ══════════════════════════════════════════════════════════════════════════
 *  SPLASH — the first screen, and the one that navigates nothing.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: the scene that knows what comes next. This
 * screen has three exits and it does not know where any of them go. It calls
 * `cb.onPlay()`, and the entire flow of the game — including the rules card that
 * auto-opens on a first run — is declared in one block in main.ts. Adding a
 * screen is then an edit in main.ts and NOWHERE ELSE, which is the only version
 * of that change anybody can review.
 *
 * ─── ON THE TAP MODEL ──────────────────────────────────────────────────────
 *
 * A press marks a region; a release FIRES it only if the finger is still on the
 * same region. That is what lets a player slide off a button they did not mean
 * to hit — the standard behaviour of every native control, and its absence is
 * felt immediately even though nobody can name it.
 */

import type { PointerKind } from '../core/types';
import { COLORS, IDENTITY } from '../brand';
import { COPY } from '../config/copy';
import { RADIUS, SPACE, TEXT, TRACK } from '../config/theme';
import { columnRect, menuContentRect, rect, type Rect } from '../render/layout';
import { drawMarkCentered, markHeight } from '../render/mark';
import { BUTTON_H, BUTTON_H_SM, button, ctaRect, hitTest, label } from '../render/ui';
import { fillRound } from '../render/shapes';
import type { Viewport } from '../render/canvas';
import type { GameScene, SceneId } from './director';

export interface SplashCallbacks {
  onPlay(): void;
  onLevels(): void;
  onRules(): void;
}

/** Region ordinals. The array below is indexed by these; the two stay in step. */
const R_PLAY = 0;
const R_LEVELS = 1;
const R_RULES = 2;

export class SplashScene implements GameScene {
  readonly id: SceneId = 'splash';

  /** Allocated once and mutated in place — see the note in dpad.ts on rects. */
  private readonly regions: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];
  private pressed = -1;

  /** Best score, handed in on enter. The scene never reads the save file — that
   *  would be a second owner of a value main.ts already holds. */
  private best = 0;

  constructor(
    private readonly vp: Viewport,
    private readonly cb: SplashCallbacks,
  ) {}

  enter(payload?: unknown): void {
    const p = payload as { best?: number } | undefined;
    this.best = p?.best ?? 0;
    this.pressed = -1;
  }

  exit(): void {
    this.pressed = -1;
  }

  update(_dt: number, _simTime: number): void {}

  /**
   * Laid out inside render rather than in enter, and deliberately: the viewport
   * can change under us at any frame — an Android URL bar collapsing, a rotation,
   * a quality drop — and a layout computed once on entry would be stale with no
   * event to recompute it from.
   */
  private layout(): void {
    const content = menuContentRect(this.vp);
    const col = columnRect(this.vp, content.y, content.h);

    // Buttons are placed from the BOTTOM of the menu content box, which already
    // excludes the ad reserve. Placing from the top instead is how the last
    // button ends up under the banner on a short screen.
    const bottom = content.y + content.h - SPACE.xl;
    const rules = ctaRect(this.vp.fieldW, bottom - BUTTON_H_SM, col.w, BUTTON_H_SM);
    const levels = ctaRect(
      this.vp.fieldW,
      rules.y - SPACE.md - BUTTON_H_SM,
      col.w,
      BUTTON_H_SM,
    );
    const play = ctaRect(this.vp.fieldW, levels.y - SPACE.lg - BUTTON_H, col.w, BUTTON_H);

    copyRect(this.regions[R_PLAY]!, play);
    copyRect(this.regions[R_LEVELS]!, levels);
    copyRect(this.regions[R_RULES]!, rules);
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number, _simTime: number): void {
    this.layout();
    const content = menuContentRect(this.vp);
    const cx = this.vp.fieldW / 2;

    ctx.fillStyle = COLORS.appBg;
    ctx.fillRect(0, 0, this.vp.fieldW, this.vp.fieldH);

    // THE MARK, ON A PAPER PLATE — the same treatment index.html gives it on
    // the boot overlay, so boot and splash are visually continuous and the
    // handover between them is invisible.
    //
    // NOT a paper knockout, which is what this used to do. A knockout re-cuts
    // artwork by tinting its ALPHA, and the full lockup's alpha includes the
    // emblem's opaque plate — so knocking it out paints a featureless white
    // squircle where the emblem should be. Knockout is for the WORDMARK cut,
    // whose artwork is letterforms on transparency. Here the artwork is used
    // exactly as supplied, which is also what the brand's guidelines ask for.
    //
    // "As supplied" now includes the strapline, which is part of this file
    // rather than a separate cut assembled underneath. The game's own name goes
    // BELOW the whole block — see the note on the title.
    const markW = Math.min(360, this.vp.fieldW - SPACE.xxl * 2);
    const markH = markHeight(markW, 'mark');
    const markY = content.y + SPACE.xxl;
    const padX = SPACE.lg;
    const padY = SPACE.md;
    fillRound(
      ctx,
      rect(cx - markW / 2 - padX, markY - padY, markW + padX * 2, markH + padY * 2),
      COLORS.surface,
      RADIUS.card,
    );
    drawMarkCentered(ctx, cx, markY + markH / 2, markW);

    // The GAME's name, not the brand's — the mark above already says who this
    // is, and setting the brand name twice in one eyeline is the most common way
    // a branded game's splash ends up looking like an error page.
    // SPACE.xxl, not xl: `label` centres on its y, so the title's cap top sits
    // 16 units above this. The plate already extends SPACE.md below the
    // artwork, and the artwork now ends in the strapline rather than in the
    // wordmark's baseline — anything tighter and the title touches the plate.
    const titleY = markY + markHeight(markW, 'mark') + SPACE.xxl;
    label(ctx, IDENTITY.gameTitle, cx, titleY, {
      size: TEXT.head,
      align: 'center',
      color: COLORS.mastheadText,
      track: TRACK.label,
    });

    if (this.best > 0) {
      label(ctx, `${COPY.highScore}  ${this.best}`, cx, titleY + SPACE.xl, {
        size: TEXT.label,
        align: 'center',
        color: COLORS.mastheadText,
        track: TRACK.label,
      });
    }

    button(ctx, this.regions[R_PLAY]!, COPY.play, {
      variant: 'onBrand',
      pressed: this.pressed === R_PLAY,
    });
    button(ctx, this.regions[R_LEVELS]!, COPY.levels, {
      variant: 'outlineOnBrand',
      pressed: this.pressed === R_LEVELS,
      size: TEXT.body,
    });
    button(ctx, this.regions[R_RULES]!, COPY.howToPlay, {
      variant: 'ghostOnBrand',
      pressed: this.pressed === R_RULES,
      size: TEXT.body,
    });
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
    // Fires only if the release landed on the region the press claimed.
    if (hit === -1 || hit !== was) return;

    if (hit === R_PLAY) this.cb.onPlay();
    else if (hit === R_LEVELS) this.cb.onLevels();
    else if (hit === R_RULES) this.cb.onRules();
  }
}

/** In place, so the renderer is never handed a fresh rect object mid-frame. */
function copyRect(dst: Rect, src: Rect): void {
  dst.x = src.x;
  dst.y = src.y;
  dst.w = src.w;
  dst.h = src.h;
}
