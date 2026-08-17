/**
 * ══════════════════════════════════════════════════════════════════════════
 *  SHAPES — the primitives, and the two the platform does not give you.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): THE BLURRED SHADOW. The canvas API ships
 * a soft-shadow property and it is the single most expensive thing a 2D context
 * can do on a mid-tier Android GPU — one soft-shadowed fill can cost more than
 * the entire rest of a frame, and this game draws a lot of small objects. The
 * build gate bans the property outright under src/render/, so `softShadow()`
 * below fakes it with two or three offset flat fills. Nobody has ever noticed
 * the difference at phone size; everybody notices the dropped frames.
 *
 * THE FAILURE THIS FILE PREVENTS (2): THE SQUIRCLE THAT IS A ROUNDED RECT. The
 * brand plate is a SUPERELLIPSE — |x/a|ⁿ + |y/b|ⁿ = 1 with n ≈ 4 — which has
 * continuous curvature, no straight edge, and no point where an arc meets a
 * line. A rounded rectangle has all three. At 40 units nobody can name the
 * difference and everybody can see it: the rounded rect reads as "the app icon,
 * but wrong". `SHAPE.squircle` is a brand-owned value for exactly this reason,
 * and this is the only file that consumes it.
 *
 * THE FAILURE THIS FILE PREVENTS (3): letter-spacing. Canvas has no such
 * property in the browsers this ships to. Every HUD label in the game is set
 * wide (TRACK.label), so without `trackedText()` the canvas type and the DOM
 * type would be visibly different typography on the same screen.
 *
 * ─── NO COLOUR IS DECIDED HERE ─────────────────────────────────────────────
 * Every function takes its fill as an argument or reads a COLORS token. There
 * is not a literal in this file and there must never be one.
 */

import { COLORS, withAlpha } from '../brand';
import { ELEVATION, RADIUS } from '../config/theme';
import type { Rect } from './layout';

/** A function that appends one closed shape to the current path. */
export type PathFn = (ctx: CanvasRenderingContext2D) => void;

// ─── Rounded rectangle ──────────────────────────────────────────────────────

/**
 * Path only — no fill, no stroke. Callers decide, which is what lets the same
 * path serve as a fill, a clip and a shadow silhouette without three variants.
 *
 * The radius is CLAMPED to half the shorter side. Unclamped, a card narrower
 * than twice its radius produces arcs that overshoot and the browser renders a
 * shape with a pinched waist — a bug that only appears on the narrowest device.
 */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number = RADIUS.card,
): void {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** The Rect-shaped overload, so scenes never unpack a rect by hand. */
export function roundRectR(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  radius: number = RADIUS.card,
): void {
  roundRect(ctx, r.x, r.y, r.w, r.h, radius);
}

// ─── Squircle ───────────────────────────────────────────────────────────────

/**
 * Segments per quadrant.
 *
 * 16 (64 total) is where the polygon stops being visible at the largest size
 * this game ever draws a plate — the splash hero, about 220 units, roughly 660
 * device pixels on a 3x phone. That puts a segment at ~10px of arc, well under
 * the ~1px sagitta at which a chord reads as flat. Doubling it costs 64 more
 * lineTo calls for a difference nobody can see, and every plate in the game is
 * baked once by prerender.ts anyway.
 */
const SQUIRCLE_STEPS = 16;

/**
 * A TRUE SUPERELLIPSE, not a rounded rect. Path only.
 *
 * Parametrised rather than solved, because the implicit form has infinite
 * slope at the axes and a naive x-sweep bunches every sample into the corners —
 * which is exactly where the curve needs them least. The parametric form
 *
 *     x = a · sgn(cos t) · |cos t|^(2/n)
 *     y = b · sgn(sin t) · |sin t|^(2/n)
 *
 * distributes samples evenly around the perimeter for any exponent.
 *
 * `n` defaults to the BRAND's exponent. A brand that is square declares 2 (a
 * plain ellipse) and this still works; nothing here assumes a Swiggy value.
 */
export function squircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  n: number = RADIUS.squircle,
): void {
  const a = w / 2;
  const b = h / 2;
  const cx = x + a;
  const cy = y + b;
  // Exponents below 2 produce a concave star, which is never a plate.
  const e = 2 / Math.max(2, n);

  ctx.beginPath();
  const total = SQUIRCLE_STEPS * 4;
  for (let i = 0; i <= total; i++) {
    const t = (i / total) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const px = cx + a * Math.sign(c) * Math.abs(c) ** e;
    const py = cy + b * Math.sign(s) * Math.abs(s) ** e;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ─── Pill ───────────────────────────────────────────────────────────────────

/**
 * A fully-rounded capsule. Its own function rather than `roundRect(…, h/2)`
 * because a pill's radius must track its HEIGHT, and passing RADIUS.pill (a
 * large brand constant) through roundRect's clamp only accidentally produces
 * the same thing. Making it explicit means a brand that sets `pill` to 8 gets
 * a capsule here and a soft-cornered chip there, which is what it asked for.
 */
export function pill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  roundRect(ctx, x, y, w, h, h / 2);
}

// ─── Elevation ──────────────────────────────────────────────────────────────

export type Elevation = 'rest' | 'raised' | 'overlay';

const ELEV: Record<Elevation, { y: number; alpha: number }> = {
  rest: { y: ELEVATION.restY, alpha: ELEVATION.restAlpha },
  raised: { y: ELEVATION.raisedY, alpha: ELEVATION.raisedAlpha },
  overlay: { y: ELEVATION.overlayY, alpha: ELEVATION.overlayAlpha },
};

/**
 * A soft shadow made of STACKED OFFSET FILLS. No blur property is used or
 * permitted; see failure (1) in the header.
 *
 * Three fills at descending offset and descending alpha. The eye integrates
 * them into a gradient because each is drawn over the last, so the overlap
 * region accumulates alpha — a two-stop approximation of a blur that costs
 * three flat fills, which is roughly free, and looks correct at any size the
 * game uses.
 *
 * The shadow colour is the INK token at low alpha, never a grey and never a
 * black: on a brand with warm neutrals a neutral-grey shadow reads as dirt.
 */
export function softShadow(
  ctx: CanvasRenderingContext2D,
  path: PathFn,
  level: Elevation = 'rest',
): void {
  const spec = ELEV[level];
  ctx.save();
  for (let i = 3; i >= 1; i--) {
    const t = i / 3;
    ctx.save();
    ctx.translate(0, spec.y * t);
    ctx.fillStyle = withAlpha(COLORS.text, spec.alpha * (1 - t * 0.45));
    path(ctx);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ─── Washes ─────────────────────────────────────────────────────────────────

/**
 * A two-stop linear gradient fill.
 *
 * Gradients are cheap; what is expensive is BUILDING one, so this is for
 * backdrops painted once per frame, never for per-entity fills. Anything that
 * needs a gradient on a small repeated object should bake it (prerender.ts).
 */
export function linearWash(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  from: string,
  to: string,
  vertical = true,
): void {
  const g = ctx.createLinearGradient(x, y, vertical ? x : x + w, vertical ? y + h : y);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/**
 * A radial darkening at the edges of a rect. Used on the stage apron.
 *
 * The inner stop is fully transparent so the centre of the stage is untouched;
 * a vignette that dims the playfield makes barrels harder to see, which is a
 * gameplay change dressed as a decoration.
 */
export function vignette(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  tint: string,
  innerFrac = 0.55,
): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const outer = Math.max(r.w, r.h) * 0.72;
  const g = ctx.createRadialGradient(cx, cy, outer * innerFrac, cx, cy, outer);
  g.addColorStop(0, withAlpha(COLORS.text, 0));
  g.addColorStop(1, tint);
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

// ─── Tracked text ───────────────────────────────────────────────────────────

export type TextAlign = 'left' | 'center' | 'right';

/**
 * Width of `text` at the CURRENT ctx.font with `track` units between glyphs.
 *
 * Separate from the draw so a caller can centre a chip around its label
 * without drawing it twice — measuring by drawing and discarding is the usual
 * shortcut and it doubles the text cost of every HUD.
 */
export function measureTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  track: number,
): number {
  if (text.length === 0) return 0;
  let w = 0;
  for (let i = 0; i < text.length; i++) w += ctx.measureText(text[i]!).width;
  return w + track * (text.length - 1);
}

/**
 * LETTER-SPACED TEXT, which canvas does not provide.
 *
 * `track` is in reference units, already multiplied out by the caller
 * (TEXT.label × TRACK.label), rather than a fraction — the caller always knows
 * the size and this way the function does not have to parse ctx.font, which is
 * a string whose format is not guaranteed.
 *
 * PER-GLYPH POSITIONING BREAKS SHAPING. That is a real cost and it is accepted
 * only because every string this is used on is a HUD label, a chip or a button
 * caption in a Latin script. Nothing that could contain a ligature, a Devanagari
 * conjunct or a bidi run goes through here — those use fillText, which shapes
 * the whole run. If a brand's vocabulary ever lands in an Indic script, this is
 * the function that has to be bypassed, not fixed.
 *
 * Returns the advance width, so a caller can put an icon after the text.
 */
export function trackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  track: number,
  align: TextAlign = 'left',
): number {
  if (text.length === 0) return 0;
  if (track === 0) {
    // No tracking asked for: use the platform's own shaping. Strictly better
    // output for free.
    const prev = ctx.textAlign;
    ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
    ctx.fillText(text, x, y);
    ctx.textAlign = prev;
    return ctx.measureText(text).width;
  }

  const total = measureTracked(ctx, text, track);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;

  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + track;
  }
  ctx.textAlign = prev;
  return total;
}

// ─── Clipping ───────────────────────────────────────────────────────────────

/**
 * Run `draw` clipped to `path`, and ALWAYS restore.
 *
 * A bare ctx.clip() is permanent until a restore that a `return` or a throw can
 * skip — and a leaked clip does not fail loudly, it silently removes part of
 * every subsequent frame. Wrapping it in a function makes the restore
 * structural rather than remembered.
 */
export function clipToPath(
  ctx: CanvasRenderingContext2D,
  path: PathFn,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  ctx.save();
  path(ctx);
  ctx.clip();
  try {
    draw(ctx);
  } finally {
    ctx.restore();
  }
}

// ─── Small helpers the widget kit shares ────────────────────────────────────

/** A filled rounded rect. The single most common two lines in the renderer. */
export function fillRound(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  fill: string,
  radius: number = RADIUS.card,
): void {
  ctx.fillStyle = fill;
  roundRect(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fill();
}

/**
 * A 1-unit inner keyline.
 *
 * INSET BY HALF THE LINE WIDTH, because a stroke straddles the path. Stroked
 * on the path itself, half of every border falls outside the shape and two
 * adjacent cards show a 1-unit double line between them.
 */
export function strokeRound(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  stroke: string,
  radius: number = RADIUS.card,
  width = 1,
): void {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  roundRect(
    ctx,
    r.x + width / 2,
    r.y + width / 2,
    r.w - width,
    r.h - width,
    Math.max(0, radius - width / 2),
  );
  ctx.stroke();
}

/** A filled circle. Path and fill, because nothing ever wants just the path. */
export function disc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}
