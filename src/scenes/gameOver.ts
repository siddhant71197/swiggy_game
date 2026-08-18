/**
 * ══════════════════════════════════════════════════════════════════════════
 *  GAME OVER — the score, the share, and the one screen that has a job.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): THE BRAND CTA AS AN AFTERTHOUGHT. This
 * game exists inside an ad unit. The end-of-run screen is the ONLY moment the
 * player is not busy, is looking at the screen, and has just been given a
 * number they care about — and it is therefore the only moment the brand link
 * has any chance at all. So it is the LARGEST TAPPABLE THING HERE, half again
 * the height of a standard CTA and more than twice the area of RETRY, it is
 * placed where the thumb already is, and it is laid out FIRST so everything
 * else fits around it. Making it a small link under the fold is how a branded
 * game ships with a click-through of zero and everybody concludes the format
 * does not work.
 *
 * THE FAILURE THIS FILE PREVENTS (2): THE SHARE BUTTON THAT DOES NOTHING ON
 * DESKTOP. `navigator.share` is absent on desktop Chrome and Firefox and throws
 * in a cross-origin iframe without a transient user activation — which is
 * exactly where this game lives. A share button that silently no-ops is worse
 * than no share button, so there is a clipboard fallback, and the button
 * de-emphasises afterwards. Both paths are wrapped: an AbortError from the user
 * dismissing the OS sheet is not an error and must not reach the console as one.
 *
 * THE FAILURE THIS FILE PREVENTS (3): the CTA that eats the run. `window.open`
 * with `noopener` and a new tab, for the same reason the ad banner uses
 * `target="_blank"` — a tap here must never navigate the game away.
 *
 * THE FAILURE THIS FILE PREVENTS (4): the screen that ends on a telling-off.
 * The largest type is the SCORE, not the word "over". A player who just lost is
 * being shown what they achieved and one button that lets them go again; the
 * loss itself gets one line of the brand's own voice and no more.
 */

import type { PointerKind } from '../core/types';
import { BRAND_COPY, COLORS, IDENTITY, VOCAB, withAlpha } from '../brand';
import { COPY } from '../config/copy';
import { RADIUS, SPACE, TEXT, TRACK, WEIGHT } from '../config/theme';
import { columnRect, menuContentRect, rect, type Rect } from '../render/layout';
import {
  BUTTON_H,
  BUTTON_H_SM,
  button,
  card,
  ctaRect,
  divider,
  hitTest,
  label,
} from '../render/ui';
import { fillRound } from '../render/shapes';
import { openBrandCta } from '../ui/cta';
import { drawEmblem, drawMarkCentered, markHeight } from '../render/mark';
import type { Viewport } from '../render/canvas';
import { track } from '../ui/analytics';
import type { GameScene, SceneId } from './director';

export interface GameOverPayload {
  score: number;
  best: number;
  level: number;
}

export interface GameOverCallbacks {
  onRetry(level: number): void;
  onHome(): void;
}

/**
 * Hit slop for this screen, smaller than ui.hitTest's default 12: the three
 * small buttons sit 8 units apart, and 12 units per side would overlap them
 * completely, at which point a tap between RETRY and SHARE is resolved by draw
 * order rather than by where the thumb landed. The CTA is enormous and needs no
 * help; the row needs correctness more than it needs forgiveness.
 */
const ROW_SLOP = 4;

/** How much taller the brand CTA is than a standard hero button. See failure 1. */
const CTA_SCALE = 1.45;

/** The emblem's size inside the CTA. Well above nothing, well below the type. */
const CTA_EMBLEM = 42;

const R_CTA = 0;
const R_RETRY = 1;
const R_SHARE = 2;
const R_HOME = 3;

export class GameOverScene implements GameScene {
  readonly id: SceneId = 'gameOver';

  private score = 0;
  private best = 0;
  private level = 1;
  /** Set after a share, so the button can stop shouting once it has been used. */
  private shared = false;

  private readonly regions: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];
  private pressed = -1;

  constructor(
    private readonly vp: Viewport,
    private readonly cb: GameOverCallbacks,
  ) {}

  enter(payload?: unknown): void {
    const p = payload as GameOverPayload | undefined;
    this.score = p?.score ?? 0;
    this.best = p?.best ?? 0;
    this.level = p?.level ?? 1;
    this.shared = false;
    this.pressed = -1;
  }

  exit(): void {
    this.pressed = -1;
  }

  update(_dt: number, _simTime: number): void {}

  /** Where the URL caption sits. Also the bottom of everything else. */
  private captionY(): number {
    const content = menuContentRect(this.vp);
    return content.y + content.h - SPACE.md - TEXT.micro / 2;
  }

  private layout(): void {
    const content = menuContentRect(this.vp);
    const col = columnRect(this.vp, content.y, content.h);

    /**
     * THE CTA IS SIZED FIRST AND FROM THE BOTTOM. Everything else fits around
     * it — which is the layout expressing the priority, rather than a comment
     * claiming one.
     */
    const ctaH = Math.round(BUTTON_H * CTA_SCALE);
    const ctaY = this.captionY() - TEXT.micro / 2 - SPACE.sm - ctaH;
    copyRect(this.regions[R_CTA]!, ctaRect(this.vp.fieldW, ctaY, col.w, ctaH));

    const rowY = ctaY - SPACE.lg - BUTTON_H_SM;
    const gap = SPACE.sm;
    const thirdW = (col.w - gap * 2) / 3;
    for (let i = 0; i < 3; i++) {
      const r = this.regions[R_RETRY + i]!;
      r.x = col.x + i * (thirdW + gap);
      r.y = rowY;
      r.w = thirdW;
      r.h = BUTTON_H_SM;
    }
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number, _simTime: number): void {
    this.layout();
    const content = menuContentRect(this.vp);
    const col = columnRect(this.vp, content.y, content.h);
    const cx = this.vp.fieldW / 2;

    ctx.fillStyle = COLORS.surfaceTinted;
    ctx.fillRect(0, 0, this.vp.fieldW, this.vp.fieldH);

    // The mark, as supplied, on the paper ground. Never a knockout: the plated
    // cuts carry their own opaque plate, and re-cutting one by its alpha paints
    // a featureless white squircle where the emblem should be.
    const markW = Math.min(150, col.w * 0.34);
    const markH = markHeight(markW, 'mark');
    const markY = content.y + SPACE.sm;
    drawMarkCentered(ctx, cx, markY + markH / 2, markW);

    const titleY = markY + markH + SPACE.lg;
    label(ctx, COPY.gameOverTitle, cx, titleY, {
      size: TEXT.title,
      weight: WEIGHT.display,
      align: 'center',
      tone: 'primary',
      track: TRACK.display,
    });
    label(ctx, BRAND_COPY.loseLine, cx, titleY + SPACE.xl, {
      size: TEXT.body,
      align: 'center',
      tone: 'secondary',
    });

    // The score card is CENTRED in what is left, between the header and the
    // prompt. Pinned to the header it leaves the hole immediately above the
    // CTA, which is the one gap on this screen it is impossible not to see.
    const bandTop = titleY + SPACE.xl + SPACE.xl;
    const bandBottom = this.regions[R_RETRY]!.y - SPACE.lg;
    const panelH = Math.min(220, Math.max(150, bandBottom - bandTop - SPACE.xxl));
    // The card AND the prompt under it are centred as one group. Centring the
    // card alone strands the prompt against the buttons, which reads as two
    // unrelated blocks rather than as a question about the score above it.
    const groupH = panelH + SPACE.xl + TEXT.body;
    // Biased DOWN the band rather than centred in it: on a tall handset the
    // band is much larger than the group, and a block floating in the middle of
    // a screen whose whole bottom third is controls reads as unfinished. 0.62
    // puts the card nearer the thumb without letting it crowd the prompt.
    const panel = rect(
      col.x,
      bandTop + Math.max(0, (bandBottom - bandTop - groupH) * 0.62),
      col.w,
      panelH,
    );
    const promptY = panel.y + panelH + SPACE.xl;
    card(ctx, panel, { tone: 'surface', elevated: true });

    // THE SCORE IS THE BIGGEST TYPE ON THE SCREEN — see failure (4). Centred and
    // on its own, with its label above it: a value in a label/value row is a
    // line item, and this is the thing the player came back for.
    label(ctx, COPY.hudScore, cx, panel.y + SPACE.lg + TEXT.label / 2, {
      size: TEXT.label,
      align: 'center',
      tone: 'secondary',
      track: TRACK.label,
    });
    label(ctx, String(this.score), cx, panel.y + SPACE.lg + TEXT.label + SPACE.md + TEXT.hero / 2, {
      size: TEXT.hero,
      weight: WEIGHT.display,
      align: 'center',
      tone: 'primary',
      track: TRACK.display,
    });

    const ruleY = panel.y + panel.h - SPACE.xxl;
    divider(ctx, panel.x + SPACE.xl, ruleY, panel.w - SPACE.xl * 2);
    const bestCy = ruleY + (panel.y + panel.h - ruleY) / 2;
    label(ctx, COPY.highScore, panel.x + SPACE.xl, bestCy, {
      size: TEXT.label,
      tone: 'secondary',
      track: TRACK.label,
    });
    label(ctx, String(this.best), panel.x + panel.w - SPACE.xl, bestCy, {
      size: TEXT.sub,
      weight: WEIGHT.display,
      align: 'right',
      tone: 'primary',
    });

    label(ctx, COPY.retryPrompt, cx, promptY, {
      size: TEXT.body,
      align: 'center',
      tone: 'secondary',
      track: TRACK.body,
    });

    // ── The brand CTA ───────────────────────────────────────────────────────
    //
    // The brand's own words, not a generic "Visit sponsor": a CTA that reads
    // like an ad slot is read as an ad slot and skipped.
    const cta = this.regions[R_CTA]!;
    button(ctx, cta, VOCAB.ctaShort, {
      variant: 'hero',
      pressed: this.pressed === R_CTA,
      size: TEXT.head,
      radius: RADIUS.card,
    });
    // THE EMBLEM, NOT THE LOCKUP. At this height a wordmark beside the CTA's own
    // words is two competing lines of type in one eyeline — the same reason the
    // ad banner uses the square cut. `drawEmblem` has no minimum size and takes
    // the artwork as supplied; it is never tinted, rotated or knocked out here.
    // ON A PAPER PLATE, because the ground under it is the brand's own orange
    // and the emblem's artwork IS an orange plate with a white pin on it. Blitted
    // straight onto the CTA the plate vanishes and the pin floats — which looks
    // like a knockout, and a knockout of a plated cut is exactly what the mark
    // renderer refuses to do. The plate is the supported way to put the supplied
    // artwork on a coloured ground; it is what the splash does with the lockup.
    const eDy = this.pressed === R_CTA ? 2 : 0;
    const eX = cta.x + SPACE.lg;
    const eY = cta.y + eDy + (cta.h - CTA_EMBLEM) / 2;
    const pad = SPACE.sm;
    fillRound(
      ctx,
      rect(eX - pad, eY - pad, CTA_EMBLEM + pad * 2, CTA_EMBLEM + pad * 2),
      COLORS.surface,
      RADIUS.chip,
    );
    drawEmblem(ctx, eX, eY, CTA_EMBLEM);

    label(ctx, IDENTITY.url, cx, this.captionY(), {
      size: TEXT.micro,
      align: 'center',
      color: withAlpha(COLORS.text, 0.45),
      track: TRACK.micro,
    });

    button(ctx, this.regions[R_RETRY]!, COPY.continueBtn, {
      variant: 'secondary',
      pressed: this.pressed === R_RETRY,
      size: TEXT.label,
    });
    // A spent share de-emphasises rather than relabelling. There is no "COPIED"
    // string in COPY, and inventing one here would be exactly the untranslatable
    // inline copy that config/copy.ts exists to prevent.
    button(ctx, this.regions[R_SHARE]!, COPY.shareBtn, {
      variant: this.shared ? 'ghost' : 'secondary',
      pressed: this.pressed === R_SHARE,
      size: TEXT.label,
    });
    button(ctx, this.regions[R_HOME]!, COPY.quit, {
      variant: 'ghost',
      pressed: this.pressed === R_HOME,
      size: TEXT.label,
    });
  }

  onPointer(kind: PointerKind, _id: number, x: number, y: number, _t: number): void {
    if (kind === 'down') {
      this.pressed = hitTest(this.regions, x, y, ROW_SLOP);
      return;
    }
    if (kind === 'cancel') {
      this.pressed = -1;
      return;
    }
    if (kind !== 'up') return;

    const hit = hitTest(this.regions, x, y, ROW_SLOP);
    const was = this.pressed;
    this.pressed = -1;
    if (hit === -1 || hit !== was) return;

    switch (hit) {
      case R_CTA:
        openBrand();
        break;
      case R_RETRY:
        this.cb.onRetry(this.level);
        break;
      case R_SHARE:
        // Fired from inside the pointerup handler, NOT from a later frame: both
        // `navigator.share` and the async clipboard API require a transient user
        // activation, and that activation is gone by the next rAF tick.
        void shareScore(this.score).then((ok) => {
          this.shared = ok;
        });
        break;
      case R_HOME:
        this.cb.onHome();
        break;
    }
  }
}

/** New tab, never this one. A tap here must not destroy the session. */
function openBrand(): void {
  try {
    // Deeplink into the app, falling back to the web when the scheme is not
    // handled — see src/ui/cta.ts. Called synchronously from the handler so
    // the user activation is still live.
    openBrandCta('game_over');
  } catch {
    /* Popup blocked, or an embedder that forbids it. Nothing to recover. */
  }
}

/**
 * The OS share sheet, falling back to the clipboard. Resolves true when the text
 * actually went somewhere.
 */
async function shareScore(score: number): Promise<boolean> {
  const text = `${BRAND_COPY.shareText} ${score}`;
  // THE WEB URL, never IDENTITY.href. A share lands in somebody else's
  // messages — a person who may not have the app, on a device that has never
  // heard of the scheme. A `swiggy://` link pasted into a chat is a dead
  // string, and this is the one surface that reaches a NEW person.
  const url = IDENTITY.webHref;

  // GA4's recommended `share`. `method` separates the OS sheet from the
  // clipboard fallback — they are very different signals of intent.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: IDENTITY.fullTitle, text, url });
      track('share', { method: 'os_sheet', screen: 'game_over' });
      return true;
    } catch {
      // AbortError — the player dismissed the sheet. That is a choice, not a
      // failure, and it must not fall through to silently copying instead.
      return false;
    }
  }

  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return true;
  } catch {
    // No clipboard permission, or an insecure origin. Nothing left to try, and
    // nothing worth interrupting the player with.
    return false;
  }
}

function copyRect(dst: Rect, src: Rect): void {
  dst.x = src.x;
  dst.y = src.y;
  dst.w = src.w;
  dst.h = src.h;
}
