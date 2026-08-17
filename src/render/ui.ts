/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE WIDGET KIT — one button, drawn eleven places.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): the eleventh button. Ten scenes draw a
 * CTA. Nine of them are 64 units tall with the card radius; the tenth is 62 and
 * uses the button radius, because whoever wrote it was working from the screen
 * next to it rather than from a shared function. Nobody ever files that bug and
 * everybody can feel it — it is most of what "this feels cheap" is made of.
 *
 * THE FAILURE THIS FILE PREVENTS (2): the hit box that disagrees with the
 * paint. A scene that draws a button at one rect and hit-tests another is the
 * single most common bug in a canvas UI, it is invisible in review, and it only
 * shows up as "the button sometimes doesn't work". So EVERY widget here returns
 * the rect it painted, and the hit-test takes that rect. A scene that wants to
 * know where its button is asks the function that drew it.
 *
 * ─── EVERYTHING HERE IS IN REFERENCE UNITS AND READS ONLY `COLORS` ─────────
 *
 * Not `BRAND_COLORS`, not a literal, not a mix computed on the spot. If a
 * widget needs a colour this file cannot name, the missing thing is a TOKEN in
 * src/brand/theme.ts, not an exception here — that is the rule the whole brand
 * system rests on and this is the file most tempted to break it.
 */

import { COLORS, withAlpha } from '../brand';
import { font, RADIUS, SPACE, TEXT, TRACK, WEIGHT } from '../config/theme';
import { hitRect, type Rect, rect } from './layout';
import {
  disc,
  fillRound,
  measureTracked,
  pill as pillPath,
  roundRect,
  softShadow,
  strokeRound,
  trackedText,
} from './shapes';

export { hitRect, rect, type Rect };

// ─── Buttons ────────────────────────────────────────────────────────────────

/**
 * THREE VARIANTS AND NO MORE.
 *
 *   hero       the one thing this screen wants you to do. `primary`.
 *   secondary  a real alternative. Paper with a keyline.
 *   ghost      a way out. Text only.
 *
 * A fourth variant is nearly always a hero that someone did not want to look
 * as loud as the other hero on the same screen — and the fix for that is one
 * hero per screen, not a quieter one.
 *
 * See the note in src/brand/theme.ts on why the hero is `primary` and never
 * `secondary`: white on a brand's amber measures about 1.9:1.
 */
/**
 * `onBrand`, `outlineOnBrand` and `ghostOnBrand` are the ranks a screen uses
 * when its BACKGROUND is the brand's own colour — the splash, and any sheet
 * over it. On that ground `hero` is orange on orange and does not exist; see
 * the note beside these tokens in src/brand/theme.ts.
 */
export type ButtonVariant =
  | 'hero'
  | 'secondary'
  | 'ghost'
  | 'onBrand'
  | 'outlineOnBrand'
  | 'ghostOnBrand';

export interface ButtonOptions {
  variant?: ButtonVariant;
  pressed?: boolean;
  disabled?: boolean;
  /** Type size. Defaults to TEXT.sub, which is the CTA size. */
  size?: number;
  radius?: number;
}

/** Standard CTA height. Exported so a scene can lay out before it draws. */
export const BUTTON_H = 68;

/** Compact height, for a row of two or three. */
export const BUTTON_H_SM = 52;

/**
 * Draw a button and return its rect.
 *
 * The pressed state moves the button DOWN by its shadow offset and drops the
 * shadow, rather than only darkening the fill. A colour-only press state is
 * invisible under the thumb that caused it — which is the one moment it has to
 * be visible.
 */
export function button(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  label: string,
  opts: ButtonOptions = {},
): Rect {
  const variant = opts.variant ?? 'hero';
  const radius = opts.radius ?? RADIUS.button;
  const size = opts.size ?? TEXT.sub;
  const disabled = opts.disabled === true;
  const pressed = !disabled && opts.pressed === true;

  const dy = pressed ? 2 : 0;
  const box = rect(r.x, r.y + dy, r.w, r.h);

  ctx.save();

  const hasPlate = variant === 'hero' || variant === 'secondary' || variant === 'onBrand';
  if (hasPlate && !pressed && !disabled) {
    softShadow(ctx, (c) => roundRect(c, box.x, box.y, box.w, box.h, radius), 'rest');
  }

  let fill: string;
  let text: string;
  if (disabled) {
    fill = COLORS.btnDisabled;
    text = COLORS.btnDisabledText;
  } else if (variant === 'hero') {
    fill = pressed ? COLORS.btnHeroPressed : COLORS.btnHero;
    text = COLORS.btnHeroText;
  } else if (variant === 'secondary') {
    fill = pressed ? COLORS.btnSecondaryPressed : COLORS.btnSecondary;
    text = COLORS.btnSecondaryText;
  } else if (variant === 'onBrand') {
    fill = pressed ? COLORS.btnOnBrandPressed : COLORS.btnOnBrand;
    text = COLORS.btnOnBrandText;
  } else if (variant === 'outlineOnBrand') {
    // No fill at rest: an outline button on a coloured ground that fills with
    // paper is just the loud button again, and the screen loses its hierarchy.
    fill = pressed ? withAlpha(COLORS.btnOutlineOnBrandBorder, 0.18) : 'transparent';
    text = COLORS.btnOutlineOnBrandText;
  } else if (variant === 'ghostOnBrand') {
    fill = 'transparent';
    text = COLORS.btnGhostOnBrandText;
  } else {
    fill = pressed ? COLORS.surfaceQuiet : COLORS.surface;
    text = COLORS.btnGhostText;
  }

  if (variant === 'ghostOnBrand') {
    if (pressed) fillRound(ctx, box, withAlpha(COLORS.btnGhostOnBrandText, 0.16), radius);
  } else if (variant === 'outlineOnBrand') {
    if (pressed) fillRound(ctx, box, fill, radius);
    strokeRound(ctx, box, COLORS.btnOutlineOnBrandBorder, radius, 2);
  } else if (variant === 'ghost') {
    // A ghost has no plate at rest. Painting one only while pressed is what
    // makes it read as a control at all — an unpressed ghost is just a word,
    // and a word that does nothing when tapped is a bug report.
    if (pressed) fillRound(ctx, box, withAlpha(COLORS.text, 0.06), radius);
  } else {
    fillRound(ctx, box, fill, radius);
    if (variant === 'secondary' && !disabled) {
      strokeRound(ctx, box, COLORS.btnSecondaryBorder, radius, 2);
    }
  }

  ctx.fillStyle = text;
  ctx.font = font(size, WEIGHT.display);
  ctx.textBaseline = 'middle';
  trackedText(
    ctx,
    label,
    box.x + box.w / 2,
    box.y + box.h / 2 + 1,
    size * TRACK.body,
    'center',
  );

  ctx.restore();
  // The UNPRESSED rect is returned, always. Returning the shifted one would
  // make a button that is 2 units harder to hit while you are holding it.
  return r;
}

/**
 * A centred CTA at the standard width. The layout every menu wanted, so that
 * "the button" is the same button on every screen.
 */
export function ctaRect(fieldW: number, y: number, w = 440, h = BUTTON_H): Rect {
  return rect(Math.round((fieldW - Math.min(w, fieldW - 64)) / 2), y, Math.min(w, fieldW - 64), h);
}

// ─── Cards ──────────────────────────────────────────────────────────────────

export interface CardOptions {
  /** `quiet` for a sunken well, `tinted` for a selected row. */
  tone?: 'surface' | 'quiet' | 'tinted' | 'dark';
  elevated?: boolean;
  selected?: boolean;
  radius?: number;
}

export function card(ctx: CanvasRenderingContext2D, r: Rect, opts: CardOptions = {}): Rect {
  const radius = opts.radius ?? RADIUS.card;
  const tone = opts.tone ?? 'surface';
  const fill =
    tone === 'quiet'
      ? COLORS.surfaceQuiet
      : tone === 'tinted'
        ? COLORS.surfaceTinted
        : tone === 'dark'
          ? COLORS.surfaceDark
          : COLORS.surface;

  ctx.save();
  if (opts.elevated) {
    softShadow(ctx, (c) => roundRect(c, r.x, r.y, r.w, r.h, radius), 'raised');
  }
  fillRound(ctx, r, fill, radius);
  // A selected card gets a 2-unit keyline in the BRAND colour, not a fill
  // change: a fill change on a card carrying text moves the text's contrast,
  // and selection must never make a label harder to read.
  strokeRound(
    ctx,
    r,
    opts.selected ? COLORS.borderSelected : COLORS.border,
    radius,
    opts.selected ? 2 : 1,
  );
  ctx.restore();
  return r;
}

// ─── Chips and pills ────────────────────────────────────────────────────────

export interface ChipOptions {
  fill?: string;
  textColor?: string;
  size?: number;
  padX?: number;
}

/**
 * A small labelled lozenge that SIZES ITSELF to its text and returns the rect
 * it occupied. `x, y` is the left edge and the vertical centre — chips sit
 * inside rows, and a row knows its centreline, not its top.
 */
export function chip(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  text: string,
  opts: ChipOptions = {},
): Rect {
  const size = opts.size ?? TEXT.label;
  const padX = opts.padX ?? SPACE.md;
  const track = size * TRACK.label;

  ctx.save();
  ctx.font = font(size, WEIGHT.mid);
  const tw = measureTracked(ctx, text, track);
  const h = size + SPACE.md;
  const w = tw + padX * 2;
  const r = rect(x, cy - h / 2, w, h);

  ctx.fillStyle = opts.fill ?? COLORS.levelChip;
  pillPath(ctx, r.x, r.y, r.w, r.h);
  ctx.fill();

  ctx.fillStyle = opts.textColor ?? COLORS.levelChipText;
  ctx.textBaseline = 'middle';
  trackedText(ctx, text, r.x + padX, cy + 1, track, 'left');
  ctx.restore();
  return r;
}

/** A bare capsule — a progress track, a tracker pip's bed, a badge ground. */
export function pill(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  fill: string,
): Rect {
  ctx.fillStyle = fill;
  pillPath(ctx, r.x, r.y, r.w, r.h);
  ctx.fill();
  return r;
}

// ─── Text ───────────────────────────────────────────────────────────────────

export type LabelTone = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'onPrimary';
export type LabelAlign = 'left' | 'center' | 'right';

export interface LabelOptions {
  size?: number;
  weight?: number;
  tone?: LabelTone;
  align?: LabelAlign;
  /** Letter-spacing as a FRACTION of size — TRACK.label and friends. */
  track?: number;
  color?: string;
  baseline?: CanvasTextBaseline;
}

function toneColor(tone: LabelTone): string {
  switch (tone) {
    case 'secondary':
      return COLORS.textSecondary;
    case 'tertiary':
      return COLORS.textTertiary;
    case 'inverse':
      return COLORS.textInverse;
    case 'onPrimary':
      return COLORS.textOnPrimary;
    default:
      return COLORS.text;
  }
}

/**
 * The one text call. Returns the advance width so a caller can put something
 * after it without measuring twice.
 *
 * `track` is a FRACTION here and reference units inside shapes.trackedText —
 * the conversion happens once, here, because this is the layer that knows the
 * size and the TRACK constants are all fractions.
 */
export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: LabelOptions = {},
): number {
  const size = opts.size ?? TEXT.body;
  ctx.save();
  ctx.font = font(size, opts.weight ?? WEIGHT.body);
  ctx.fillStyle = opts.color ?? toneColor(opts.tone ?? 'primary');
  ctx.textBaseline = opts.baseline ?? 'middle';
  const w = trackedText(ctx, text, x, y, size * (opts.track ?? 0), opts.align ?? 'left');
  ctx.restore();
  return w;
}

/**
 * A LABEL ON THE LEFT, A VALUE ON THE RIGHT, on one baseline.
 *
 * Its own widget because the obvious implementation — two `label()` calls —
 * puts the two on slightly different baselines whenever their sizes differ, and
 * a results screen is twelve of these stacked up where that misalignment
 * compounds into something visibly crooked.
 */
export function valueRow(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  name: string,
  value: string,
  opts: { size?: number; valueSize?: number; muted?: boolean } = {},
): Rect {
  const size = opts.size ?? TEXT.body;
  const vSize = opts.valueSize ?? size;
  const cy = r.y + r.h / 2;
  label(ctx, name, r.x, cy, {
    size,
    weight: WEIGHT.body,
    tone: opts.muted ? 'tertiary' : 'secondary',
    track: TRACK.label,
  });
  label(ctx, value, r.x + r.w, cy, {
    size: vSize,
    weight: WEIGHT.display,
    tone: opts.muted ? 'tertiary' : 'primary',
    align: 'right',
  });
  return r;
}

/**
 * A hairline rule.
 *
 * Drawn as a 1-unit fillRect rather than a stroke: a stroked line straddles its
 * path, so at a fractional device scale half of it lands in each of two pixel
 * rows and the rule renders at half opacity and two pixels tall. A fill covers
 * a defined box and cannot do that.
 */
export function divider(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color: string = COLORS.border,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 1);
}

// ─── Icons ──────────────────────────────────────────────────────────────────
//
// Drawn rather than shipped as art. Two glyphs at two sizes is not worth an
// atlas, a decode, or a tier of fallbacks — and a locked level's padlock
// appearing a frame after the card it sits on would be worse than either.

/**
 * A padlock. The shackle is a STROKED arc and the body a filled rounded rect,
 * which is the only combination that reads as a lock at 20 units — a fully
 * filled shackle closes its own hole and becomes a mushroom.
 */
export function iconLock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string = COLORS.shutterLockIcon,
): void {
  const bodyW = size * 0.78;
  const bodyH = size * 0.56;
  const bodyY = cy + size * 0.5 - bodyH;
  const shackleR = bodyW * 0.32;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.11);
  ctx.beginPath();
  ctx.arc(cx, bodyY - shackleR * 0.15, shackleR, Math.PI, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = color;
  roundRect(ctx, cx - bodyW / 2, bodyY, bodyW, bodyH, size * 0.12);
  ctx.fill();
  ctx.restore();
}

/**
 * A five-pointed star. Used for level ratings and the results screen.
 *
 * `filled` false draws the same path as a keyline rather than a different,
 * simpler shape — an empty state whose outline does not match its filled
 * sibling makes a row of three read as three different objects.
 */
export function iconStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  filled: boolean,
  color: string = COLORS.rakhiDisc,
  emptyColor: string = COLORS.trackerPipEmpty,
): void {
  const inner = r * 0.46;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : inner;
    // -π/2 puts a point at the top. Without it the star sits on a point, which
    // is a different symbol.
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = COLORS.rakhiOutline;
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.stroke();
  } else {
    ctx.strokeStyle = emptyColor;
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.stroke();
  }
  ctx.restore();
}

/** A tracker pip — the rakhi counter's unit. Filled or empty, same silhouette. */
export function iconPip(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  filled: boolean,
): void {
  disc(ctx, cx, cy, r, filled ? COLORS.trackerPipFilled : COLORS.trackerPipEmpty);
  if (filled) {
    ctx.strokeStyle = COLORS.trackerPipEdge;
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.beginPath();
    ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * THE D-PAD, AS A PICTURE OF ITSELF. Not a control — a drawing of one, for the
 * rules screen's control diagram.
 *
 * It lives here rather than in the rules scene because the thing it depicts is
 * `padPlate` / `padFace` / `padChevron`, the same token group the live pad in
 * play.ts is built from. A diagram assembled out of whatever grey the tutorial
 * author reached for is a diagram that stops resembling the control the first
 * time the pad is restyled — and nobody re-opens the tutorial to check.
 *
 * `lit` is the pad index to show pressed, in the same UP/DOWN/LEFT/RIGHT order
 * `PAD` uses, or -1 for none. The rules screen cycles it, which is what turns a
 * static diagram into an instruction.
 */
export function iconDpad(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  lit = -1,
): void {
  const key = size * 0.34;
  const gap = key * 0.12;
  const step = key + gap;
  const plate = size / 2;

  ctx.save();
  fillRound(ctx, rect(cx - plate, cy - plate, plate * 2, plate * 2), COLORS.padPlate, RADIUS.card);

  // Order matches PAD: 0 up, 1 down, 2 left, 3 right. Written as offsets rather
  // than four blocks so the chevron and the key can never disagree about which
  // direction a given face is.
  const off: readonly [number, number][] = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];
  for (let i = 0; i < off.length; i++) {
    const [ox, oy] = off[i]!;
    const kx = cx + ox * step - key / 2;
    const ky = cy + oy * step - key / 2;
    const down = i === lit;
    fillRound(
      ctx,
      rect(kx, ky, key, key),
      down ? COLORS.padFacePressed : COLORS.padFace,
      RADIUS.chip,
    );
    // A triangle, pointing the way the key goes. Built from the key's own box so
    // it is centred at every size without a magic inset.
    const m = key * 0.26;
    const tipX = cx + ox * (step + key * 0.22);
    const tipY = cy + oy * (step + key * 0.22);
    ctx.fillStyle = COLORS.padChevron;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - oy * m - ox * m, tipY - ox * m - oy * m);
    ctx.lineTo(tipX + oy * m - ox * m, tipY + ox * m - oy * m);
    ctx.closePath();
    ctx.fill();
  }
  disc(ctx, cx, cy, key * 0.22, COLORS.padHub);
  ctx.restore();
}

/**
 * THE JUMP BUTTON, AS A PICTURE OF ITSELF. Same reasoning as `iconDpad`, and
 * the same glyph the live button carries: a triangle over a bar, two primitives,
 * legible at any size a diagram would use it at.
 */
export function iconJump(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  pressed = false,
): void {
  ctx.save();
  disc(ctx, cx, cy, r, pressed ? COLORS.jumpFacePressed : COLORS.jumpFace);
  ctx.strokeStyle = COLORS.jumpRing;
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.beginPath();
  ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = COLORS.jumpGlyph;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.48);
  ctx.lineTo(cx + r * 0.44, cy + r * 0.04);
  ctx.lineTo(cx - r * 0.44, cy + r * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - r * 0.17, cy + r * 0.04, r * 0.34, r * 0.4);
  ctx.restore();
}

/**
 * A DASHED HAIRLINE, for the receipt's tear-off rules.
 *
 * Fills, not `setLineDash`: the same reason `divider` fills — a stroked hairline
 * at a fractional device scale lands half in each of two pixel rows and renders
 * grey and two units tall. A dash pattern makes that twice as visible because
 * the eye has a hard edge every few units to compare against.
 */
export function dashedDivider(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color: string = COLORS.border,
  dash = 6,
  gapLen = 5,
): void {
  ctx.fillStyle = color;
  const stride = dash + gapLen;
  for (let dx = 0; dx < w; dx += stride) {
    ctx.fillRect(x + dx, y, Math.min(dash, w - dx), 1);
  }
}

// ─── Hit testing ────────────────────────────────────────────────────────────

/**
 * A HIT REGION IS A RECT PLUS SLOP, and the slop is invisible.
 *
 * UI.padSlop exists because a thumb is about 45 reference units across and
 * lands where the player is LOOKING, which is the screen, not their hand. The
 * same logic applies to every control: a 68-unit button with 12 units of
 * invisible slop is hit reliably; the same button drawn 92 units tall to get
 * the same hit area is a fat button.
 */
export function hitTest(regions: readonly Rect[], x: number, y: number, slop = 12): number {
  // Reverse order: later widgets are drawn on top, so they must test first, or
  // a dialog's button loses to the card underneath it.
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i];
    if (r && hitRect(r, x, y, slop)) return i;
  }
  return -1;
}

/** A circular control — the jump button. Returns squared distance for cheapness. */
export function hitDisc(
  cx: number,
  cy: number,
  r: number,
  x: number,
  y: number,
  slop = 0,
): boolean {
  const dx = x - cx;
  const dy = y - cy;
  const rr = r + slop;
  return dx * dx + dy * dy <= rr * rr;
}

// ─── Scrim ──────────────────────────────────────────────────────────────────

/**
 * The dim behind a modal. Full field, including the shake gutter — a scrim that
 * stops at the field edge shows a bright seam on the frame a pause opens during
 * a shake.
 */
export function scrim(ctx: CanvasRenderingContext2D, fieldW: number, fieldH: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS.scrim;
  ctx.fillRect(-20, -20, fieldW + 40, fieldH + 40);
  ctx.restore();
}
