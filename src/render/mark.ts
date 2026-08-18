/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE MARK — the one thing in this build that belongs to somebody else.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): A FRAME WITH NO LOGO ON IT. The splash
 * paints before the network does anything useful. The backpack emblem is six
 * device pixels wide, a size at which no raster resolves into anything but a
 * smudge. A decode can simply fail. Three tiers, each degrading into the next,
 * and the last one cannot fail because it is arithmetic:
 *
 *      1. RASTER   the supplied artwork, honouring AssetRef.rect.
 *      2. INLINE   LOGO.inline as a data URI — cannot 404, cannot be slow.
 *      3. VECTOR   the DECLARED fallback shape.
 *
 * THE FAILURE THIS FILE PREVENTS (2): A SWIGGY-SHAPED LOGO UNDER THE NEXT
 * BRAND. This is the more expensive failure and it is the reason tier 3 reads a
 * DECLARATION instead of drawing a pin. Hand-author one brand's mark as
 * arithmetic in the renderer and the next brand inherits that geometry in its
 * own colours — a teal Swiggy pin — which no amount of config can undo, because
 * the shape is in the code. See the comment on `BrandLogo.fallback`: this file
 * implements a VOCABULARY of four shapes and the brand picks one. Nothing below
 * knows what Swiggy looks like.
 *
 * THE FAILURE THIS FILE PREVENTS (3): THE WELL-MEANT GUIDELINE VIOLATION.
 * Nobody sets out to rotate a trademark, stretch it, put a gradient on it or
 * recolour it to match a background. They set out to make a screen look good,
 * and every one of those is a natural move while doing that. So the rules are
 * ENFORCED HERE, in dev, as throws at the call site:
 *
 *   · drawMark() throws inside a rotated or skewed transform.
 *   · drawMark() throws below MARK_MIN_W. Under that, callers use drawEmblem().
 *   · The pin is SOLID. There is no stroked variant in this file to pick.
 *   · No gradient is ever applied to the mark, and no blurred shadow.
 *   · knockout tints to `paper` or `ink` ONLY, and only when LOGO.knockout.
 *   · maskEmblem() degrades to a plain rounded card unless LOGO.maskable.
 *
 * A throw in dev is not hostile. The alternative is a build that ships and a
 * brand team that finds it, and the fix at that point is not one line.
 */

import { COLORS, IDENTITY, LOGO } from '../brand';
import type { AssetRef } from '../brand/types';
import { font, RADIUS, TEXT, TRACK, WEIGHT } from '../config/theme';
import { bake } from './prerender';
import { disc, roundRect, squircle, trackedText } from './shapes';

/**
 * Dev-only enforcement. Read through a cast so this file does not depend on
 * the bundler's ambient types — the guideline checks are worth more than the
 * tidiness of an `import.meta.env` reference that only typechecks under vite.
 */
const DEV: boolean =
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV !== false;

// ─── The contract ───────────────────────────────────────────────────────────

/** Which cut of the artwork. Each degrades to `mark`, and `mark` to vector. */
export type MarkCut = 'mark' | 'wordmark' | 'square' | 'emblem';

/** The ONLY two tints a knockout may use. Not a string, deliberately. */
export type KnockoutTint = 'paper' | 'ink';

export interface MarkOptions {
  cut?: MarkCut;
  /**
   * Re-cut the mark in one flat colour. Requires LOGO.knockout, and the type
   * itself is what makes "tint it to our teal" unexpressible — a guideline
   * enforced by the compiler costs nothing at runtime and cannot be forgotten.
   */
  knockout?: KnockoutTint;
}

/**
 * MINIMUM CLEAR SIZE for the full mark, in reference units.
 *
 * Below this the wordmark's counters close up and the lockup becomes a coloured
 * smear that is recognisably the brand's colour and not recognisably the brand.
 * 56 units is ~24 CSS pixels of cap height on a phone, which is roughly where
 * published minimum-size rules land for a horizontal lockup.
 *
 * The emblem alone has NO minimum — that is what makes it the emblem, and why
 * `drawEmblem()` exists as a separate entry point rather than as a flag.
 *
 * ─── THIS IS A FLOOR, NOT THE RIGHT SIZE ───────────────────────────────────
 *
 * A `mark` that carries a strapline — Swiggy's does — needs roughly 150 units
 * before the strapline is words rather than texture. That is NOT enforced here
 * and must not be: the gameplay masthead derives its wordmark width FROM this
 * constant, so raising it would push the wordmark out of the ~18 units of band
 * it has and break the most constrained layout in the game. The menu screens
 * size their own mark well above it; this number only stops the absurd case.
 */
export const MARK_MIN_W = 56;

// ─── Asset loading ──────────────────────────────────────────────────────────

interface Loaded {
  img: HTMLImageElement;
  ok: boolean;
}

const images = new Map<string, Loaded>();
let inlineRef: AssetRef | null = null;

/**
 * LOAD EVERY DECLARED CUT AND NEVER REJECT.
 *
 * A rejected promise here means a caller has to decide what to do about a
 * missing logo mid-boot, and every caller will decide the same wrong thing:
 * await it and show nothing. A failed decode is not an error condition in this
 * design — it is tier 1 declining, which is exactly what tiers 2 and 3 are for.
 * So this resolves, always, and `markTier()` tells you what you got.
 */
export function loadBrandAssets(): Promise<void> {
  // EVERY blittable cut, discovered rather than listed.
  //
  // This was a hand-written array of four cuts, and it was a trap the moment a
  // cut pointed somewhere new: Swiggy's cuts now come from TWO files — the
  // gameplay masthead reads the plain lockup, the menus read the one carrying
  // the strapline — and a cut whose file never preloads does not error. It
  // falls through to the vector tier and stays there, which reads as a
  // rendering bug and is a config one. Walking the object cannot fall behind it.
  //
  // `favicon` is excluded deliberately: it is the <link rel=icon> asset, the
  // browser fetches it, and nothing in this file ever blits it.
  const srcs = new Set<string>();
  for (const [key, ref] of Object.entries(LOGO)) {
    if (key === 'favicon') continue;
    const asset = ref as Partial<AssetRef> | undefined;
    if (asset && typeof asset.src === 'string') srcs.add(asset.src);
  }

  const jobs: Promise<void>[] = [];

  for (const src of srcs) {
    if (images.has(src)) continue;
    const img = new Image();
    const rec: Loaded = { img, ok: false };
    images.set(src, rec);
    jobs.push(
      new Promise<void>((resolve) => {
        img.onload = (): void => {
          // A decoded image with zero dimensions is a corrupt file that fired
          // `load` anyway — treat it as a failure rather than blitting nothing.
          rec.ok = img.naturalWidth > 0 && img.naturalHeight > 0;
          resolve();
        };
        img.onerror = (): void => resolve();
        img.src = src;
      }),
    );
  }

  // Tier 2. Swiggy supplies no inline SVG; the path exists because a brand that
  // does supply one gets a mark that cannot fail to load, and wiring that only
  // when the first such brand arrives means wiring it under time pressure.
  if (LOGO.inline && !inlineRef) {
    const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(LOGO.inline)}`;
    inlineRef = { src: uri, aspect: LOGO.emblem?.aspect ?? 1 };
    const img = new Image();
    const rec: Loaded = { img, ok: false };
    images.set(uri, rec);
    jobs.push(
      new Promise<void>((resolve) => {
        img.onload = (): void => {
          // An SVG with no intrinsic size decodes with naturalWidth 0. It is
          // still perfectly drawable, so unlike a raster this is not a failure.
          rec.ok = true;
          resolve();
        };
        img.onerror = (): void => resolve();
        img.src = uri;
      }),
    );
  }

  return Promise.all(jobs).then(() => undefined);
}

function cutRef(cut: MarkCut): AssetRef | undefined {
  switch (cut) {
    case 'wordmark':
      return LOGO.wordmark ?? LOGO.mark;
    case 'square':
      return LOGO.square ?? LOGO.mark;
    case 'emblem':
      return LOGO.emblem ?? LOGO.square ?? LOGO.mark;
    default:
      return LOGO.mark;
  }
}

function loadedFor(ref: AssetRef | undefined): HTMLImageElement | null {
  if (!ref) return null;
  const rec = images.get(ref.src);
  return rec && rec.ok ? rec.img : null;
}

export type MarkTier = 'raster' | 'inline' | 'vector';

/** Which tier a given cut would currently draw at. The dev harness reads this. */
export function markTier(cut: MarkCut = 'mark'): MarkTier {
  if (loadedFor(cutRef(cut))) return 'raster';
  if (inlineRef && loadedFor(inlineRef)) return 'inline';
  return 'vector';
}

/** Height of a cut drawn at width `w`, from its DECLARED aspect. */
export function markHeight(w: number, cut: MarkCut = 'mark'): number {
  const ref = cutRef(cut);
  const aspect = ref?.aspect ?? fallbackAspect();
  return w / aspect;
}

/**
 * The vector fallback's aspect. Square for everything except the wordmark
 * plate, which is a lockup shape and has to be wide or the brand's name is set
 * at four units tall inside it.
 */
function fallbackAspect(): number {
  return (LOGO.fallback?.shape ?? 'plate-wordmark') === 'plate-wordmark' ? 3.2 : 1;
}

// ─── Guideline enforcement ──────────────────────────────────────────────────

/**
 * A ROTATED OR SKEWED MARK, caught at the call site.
 *
 * `b` and `c` of the current transform are zero for any combination of
 * translate and axis-aligned scale, and non-zero for rotation or skew — which
 * is exactly the distinction the guideline draws. Reading the transform is a
 * single cheap call and it catches the case that no amount of code review does:
 * a mark drawn inside a parent's `ctx.rotate()` three frames deep.
 *
 * A NEGATIVE scale is caught too. A mirrored logo is a different violation of
 * the same rule and it is the one people genuinely do not notice.
 */
function assertUpright(ctx: CanvasRenderingContext2D, who: string): void {
  if (!DEV) return;
  const m = ctx.getTransform();
  if (Math.abs(m.b) > 1e-4 || Math.abs(m.c) > 1e-4) {
    throw new Error(
      `${who}: the mark may not be drawn inside a rotated or skewed transform. ` +
        `Draw it upright, then rotate what is around it.`,
    );
  }
  if (m.a < 0 || m.d < 0) {
    throw new Error(`${who}: the mark may not be mirrored.`);
  }
}

function assertKnockoutAllowed(
  tint: KnockoutTint | undefined,
  who: string,
  cut: MarkCut,
): void {
  if (!DEV || !tint) return;
  if (!LOGO.knockout) {
    throw new Error(
      `${who}: brand "${IDENTITY.slug}" does not publish a one-colour cut ` +
        `(logo.knockout is not true). Put the mark on a paper plate instead.`,
    );
  }
  // A knockout tints ALPHA, so on plated artwork it paints a flat tile: the
  // mark silently becomes a blank rounded square, with nothing thrown and
  // nothing logged. That exact bug shipped three times during this build before
  // the artwork started declaring which cuts are plated.
  if (cutRef(cut)?.opaque) {
    throw new Error(
      `${who}: the "${cut}" cut is plated artwork (AssetRef.opaque), so a ` +
        `knockout of it is a flat ${tint} tile, not a mark. On a brand-coloured ` +
        `ground, draw the natural artwork on a paper plate instead — or knock ` +
        `out the "wordmark" cut, which is line art on transparency.`,
    );
  }
}

/**
 * The two permitted knockout colours, resolved from tokens.
 *
 * `paper` and `ink` and nothing else — the function takes the enum, not a
 * colour, so there is no argument to pass an arbitrary value through.
 */
function knockoutColor(tint: KnockoutTint): string {
  return tint === 'paper' ? COLORS.textInverse : COLORS.text;
}

// ─── Raster tier ────────────────────────────────────────────────────────────

/**
 * Bake bucket ladder, in device pixels of WIDTH.
 *
 * Bucketing rather than baking at the exact requested size, because the mark is
 * drawn at a dozen slightly-different sizes across the game and an exact-size
 * cache would hold a dozen near-identical bakes. Snapping up to the next bucket
 * means at most a 1.5× downscale at draw time, which is invisible, and at most
 * eleven entries ever.
 */
const BUCKETS = [16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768] as const;

/**
 * ALWAYS MINIFY, NEVER MAGNIFY.
 *
 * The bucket is clamped to the source cut's real pixel width. Baking a 298px
 * emblem into a 512px canvas produces a blurry 512px emblem and then charges
 * three times the memory for it — magnification in a bake is strictly worse
 * than magnification at draw time, because it is permanent.
 */
function bucketFor(deviceW: number, sourceW: number): number {
  let chosen: number = BUCKETS[BUCKETS.length - 1]!;
  for (const b of BUCKETS) {
    if (b >= deviceW) {
      chosen = b;
      break;
    }
  }
  return Math.max(1, Math.min(chosen, Math.round(sourceW)));
}

/**
 * Draw the artwork — or a sub-rectangle of it — into a bake and return it.
 *
 * The 9-argument drawImage is the entire point of `AssetRef.rect`: the emblem
 * and the wordmark are DECLARATIONS OVER ONE AUTHENTIC FILE rather than
 * re-encoded crops. See the note on AssetRef in src/brand/types.ts for why that
 * matters to a brand's legal review and not just to the download size.
 */
function bakedCut(
  ref: AssetRef,
  img: HTMLImageElement,
  deviceW: number,
  tint: KnockoutTint | undefined,
): HTMLCanvasElement {
  const r = ref.rect;
  const nw = img.naturalWidth || 1;
  const nh = img.naturalHeight || 1;
  const sx = r ? r.sx * nw : 0;
  const sy = r ? r.sy * nh : 0;
  const sw = r ? r.sw * nw : nw;
  const sh = r ? r.sh * nh : nh;

  const w = bucketFor(deviceW, sw);
  const h = Math.max(1, Math.round(w / ref.aspect));
  const key = `mark:${ref.src}:${r ? `${r.sx},${r.sy},${r.sw},${r.sh}` : 'full'}:${tint ?? 'as-is'}`;

  return bake(key, w, h, w, h, (c) => {
    c.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    if (!tint) return;
    // `source-in` keeps the artwork's ALPHA and replaces its colour — a true
    // knockout, not a colourised overlay. Done in the bake so the composite
    // mode never touches the main context, where leaking it would recolour
    // whatever drew next.
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = knockoutColor(tint);
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
  });
}

// ─── Vector tier: the declared shapes ───────────────────────────────────────

/**
 * A SOLID TEARDROP PIN. Filled, never stroked, and there is deliberately no
 * `strokePin` in this file for anyone to reach for by accident.
 *
 * Constructed as a circle plus its two tangent lines to a point below, so the
 * tail meets the head with continuous tangency at any proportion. The naive
 * construction — a circle with a triangle stuck under it — leaves two visible
 * kinks where the triangle's edges cross the arc, and at 40 units those kinks
 * are the entire difference between a location pin and a balloon.
 *
 *   cos α = r / d    where d is the tip's distance below the head's centre.
 */
function pinPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  let r = w / 2;
  const cx = x + r;
  const cy = y + r;
  let d = h - r;
  // A box too square for a pin: shrink the head until a tail exists at all.
  // Without this the tangent solve goes imaginary and the path silently
  // collapses to nothing — a missing logo with no error anywhere.
  if (d <= r * 1.08) {
    r = h / 2.2;
    d = h - r;
  }
  const alpha = Math.acos(Math.max(-1, Math.min(1, r / d)));
  const tipY = cy + d;
  const a1 = Math.PI / 2 - alpha;
  const a2 = Math.PI / 2 + alpha;

  ctx.beginPath();
  ctx.moveTo(cx, tipY);
  ctx.lineTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
  // Anticlockwise, so the sweep goes over the TOP of the head rather than
  // cutting straight across the tail's mouth.
  ctx.arc(cx, cy, r, a1, a2, true);
  ctx.closePath();
}

/**
 * THE DECLARED FALLBACK. Four shapes; the brand names one.
 *
 * Read the comment on `BrandLogo.fallback` before changing anything here. The
 * insets are TWO fractions, not one, because real marks are anisotropic and
 * collapsing them to a single inset reads as slightly wrong to anyone who knows
 * the mark, in a way they will not be able to name.
 */
function drawFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const spec = LOGO.fallback;
  const shape = spec?.shape ?? 'plate-wordmark';
  const ix = (spec?.insetX ?? 0.2) * w;
  const iy = (spec?.insetY ?? 0.2) * h;
  const inX = x + ix;
  const inY = y + iy;
  const inW = Math.max(1, w - ix * 2);
  const inH = Math.max(1, h - iy * 2);

  ctx.save();
  // No gradient, ever. The fill is a flat token and the plate carries no
  // elevation of its own — a mark with a shadow under it is a mark that has
  // been given a treatment, which is the thing brand guidelines are about.
  ctx.fillStyle = COLORS.markPlate;

  switch (shape) {
    case 'pin-squircle': {
      squircle(ctx, x, y, w, h, RADIUS.squircle);
      ctx.fill();
      ctx.fillStyle = COLORS.markPin;
      pinPath(ctx, inX, inY, inW, inH);
      ctx.fill();
      break;
    }

    case 'plate-ellipse': {
      roundRect(ctx, x, y, w, h, Math.min(RADIUS.card, Math.min(w, h) * 0.22));
      ctx.fill();
      // The mark vocabulary publishes exactly two colours — plate and pin — so
      // the inset form takes the pin's role here. Reaching past the mark tokens
      // for the brand's raw `secondary` would be this file deciding a colour,
      // which is precisely what src/brand/theme.ts exists to stop.
      ctx.fillStyle = COLORS.markPin;
      ctx.beginPath();
      ctx.ellipse(inX + inW / 2, inY + inH / 2, inW / 2, inH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'disc-initial': {
      const r = Math.min(w, h) / 2;
      disc(ctx, x + w / 2, y + h / 2, r, COLORS.markPlate);
      ctx.fillStyle = COLORS.markPin;
      ctx.font = font(r * 1.15, WEIGHT.display);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // The brand's own initial, from the brand's own name. Nothing about which
      // letter it is lives in this file.
      ctx.fillText(IDENTITY.shortName.charAt(0).toUpperCase(), x + w / 2, y + h / 2 + r * 0.04);
      break;
    }

    case 'plate-wordmark':
    default: {
      roundRect(ctx, x, y, w, h, Math.min(RADIUS.card, Math.min(w, h) * 0.28));
      ctx.fill();
      ctx.fillStyle = COLORS.markPin;
      const name = IDENTITY.shortName.toUpperCase();
      // Sized to the INNER box and then clamped against the name's length, so a
      // brand with a nine-character short name gets smaller type rather than
      // type that runs off its own plate.
      const size = Math.min(inH * 0.82, (inW / Math.max(1, name.length)) * 1.55);
      ctx.font = font(size, WEIGHT.display);
      ctx.textBaseline = 'middle';
      trackedText(
        ctx,
        name,
        x + w / 2,
        y + h / 2,
        size * TRACK.display,
        'center',
      );
      break;
    }
  }
  ctx.restore();
}

// ─── The public draws ───────────────────────────────────────────────────────

/**
 * DRAW THE MARK. `x, y` is the top-left; height comes from the cut's aspect,
 * so the mark can never be stretched — there is no height parameter to get
 * wrong, which is a cheaper guarantee than validating one.
 */
export function drawMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  opts: MarkOptions = {},
): void {
  assertUpright(ctx, 'drawMark');
  assertKnockoutAllowed(opts.knockout, 'drawMark', opts.cut ?? 'mark');

  if (DEV && w < MARK_MIN_W) {
    throw new Error(
      `drawMark: ${Math.round(w)} units is below the ${MARK_MIN_W}-unit minimum ` +
        `clear size for the full mark. Use drawEmblem() — it has no minimum.`,
    );
  }

  paint(ctx, opts.cut ?? 'mark', x, y, w, opts.knockout);
}

/**
 * THE EMBLEM CUT. No minimum size, which is the whole reason it is a separate
 * entry point: the delivery backpack's emblem is about six device pixels wide
 * and drawing the lockup there would be a grey smudge with a trademark's name
 * attached to it.
 */
export function drawEmblem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  knockout?: KnockoutTint,
): void {
  assertUpright(ctx, 'drawEmblem');
  assertKnockoutAllowed(knockout, 'drawEmblem', 'emblem');
  paint(ctx, 'emblem', x, y, size, knockout);
}

/** Centred convenience. Every HUD and masthead call site wanted this. */
export function drawMarkCentered(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  opts: MarkOptions = {},
): void {
  const h = markHeight(w, opts.cut ?? 'mark');
  drawMark(ctx, cx - w / 2, cy - h / 2, w, opts);
}

function paint(
  ctx: CanvasRenderingContext2D,
  cut: MarkCut,
  x: number,
  y: number,
  w: number,
  tint: KnockoutTint | undefined,
): void {
  const ref = cutRef(cut);
  const img = loadedFor(ref);

  // Tier 1.
  if (ref && img) {
    const h = w / ref.aspect;
    // The transform's own scale is folded in so the bucket is chosen against
    // real device pixels rather than against reference units — the difference
    // is a factor of three on the phones this actually ships to.
    const m = ctx.getTransform();
    const deviceW = w * Math.abs(m.a);
    const canvas = bakedCut(ref, img, deviceW, tint);
    ctx.drawImage(canvas, x, y, w, h);
    return;
  }

  // Tier 2.
  if (inlineRef) {
    const inlineImg = loadedFor(inlineRef);
    if (inlineImg) {
      const h = w / inlineRef.aspect;
      if (tint) {
        const m = ctx.getTransform();
        const canvas = bakedCut(inlineRef, inlineImg, w * Math.abs(m.a), tint);
        ctx.drawImage(canvas, x, y, w, h);
      } else {
        // SVG scales for free; baking it would only lose resolution.
        ctx.drawImage(inlineImg, x, y, w, h);
      }
      return;
    }
  }

  // Tier 3. Cannot fail.
  const h = w / fallbackAspect();
  if (tint) {
    // A knockout of the fallback is a single flat silhouette, which is what a
    // one-colour cut of any of these shapes is anyway.
    ctx.save();
    ctx.fillStyle = knockoutColor(tint);
    if ((LOGO.fallback?.shape ?? 'plate-wordmark') === 'pin-squircle') {
      squircle(ctx, x, y, w, h, RADIUS.squircle);
    } else {
      roundRect(ctx, x, y, w, h, Math.min(RADIUS.card, Math.min(w, h) * 0.24));
    }
    ctx.fill();
    ctx.restore();
    return;
  }
  drawFallback(ctx, x, y, w, h);
}

// ─── Masking ────────────────────────────────────────────────────────────────

/**
 * CLIP CONTENT TO THE EMBLEM SILHOUETTE — Swiggy's signature device, and a
 * thing plenty of other brands forbid outright.
 *
 * Gated on LOGO.maskable, and the ungated path DEGRADES QUIETLY to a plain
 * rounded card rather than throwing. That asymmetry with the other rules is
 * deliberate: a scene that wants a masked hero image still needs to draw
 * something, and a rounded card is a correct, unremarkable, guideline-safe
 * version of the same layout. Throwing here would mean a brand that forbids
 * masking cannot render a screen at all.
 *
 * The raster path uses `destination-in` against the artwork's own alpha in an
 * offscreen buffer — the composite never touches the live context, where
 * leaking it would erase everything drawn before it that frame.
 */
export function maskEmblem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  paintContent: (c: CanvasRenderingContext2D, x: number, y: number, s: number) => void,
): void {
  assertUpright(ctx, 'maskEmblem');

  if (!LOGO.maskable) {
    ctx.save();
    roundRect(ctx, x, y, size, size, RADIUS.card);
    ctx.clip();
    paintContent(ctx, x, y, size);
    ctx.restore();
    return;
  }

  const ref = cutRef('emblem');
  const img = loadedFor(ref);

  if (ref && img) {
    const m = ctx.getTransform();
    const deviceSize = Math.max(1, Math.round(size * Math.abs(m.a)));
    const scratch = document.createElement('canvas');
    scratch.width = deviceSize;
    scratch.height = deviceSize;
    const c = scratch.getContext('2d');
    if (c) {
      c.setTransform(deviceSize / size, 0, 0, deviceSize / size, 0, 0);
      paintContent(c, 0, 0, size);
      c.globalCompositeOperation = 'destination-in';
      const r = ref.rect;
      const nw = img.naturalWidth || 1;
      const nh = img.naturalHeight || 1;
      c.drawImage(
        img,
        r ? r.sx * nw : 0,
        r ? r.sy * nh : 0,
        r ? r.sw * nw : nw,
        r ? r.sh * nh : nh,
        0,
        0,
        size,
        size,
      );
      c.globalCompositeOperation = 'source-over';
      ctx.drawImage(scratch, x, y, size, size);
      return;
    }
  }

  // Vector silhouette. The declared shape's OUTER form is the silhouette — the
  // plate, not the pin, because a plate-shaped mask is what "clipped to the
  // emblem" means for every shape in the vocabulary except one.
  ctx.save();
  if ((LOGO.fallback?.shape ?? 'plate-wordmark') === 'pin-squircle') {
    squircle(ctx, x, y, size, size, RADIUS.squircle);
  } else {
    roundRect(ctx, x, y, size, size, RADIUS.card);
  }
  ctx.clip();
  paintContent(ctx, x, y, size);
  ctx.restore();
}

/**
 * The tiled emblem watermark on the stage apron.
 *
 * Its own function because the naive version — drawEmblem in a double loop —
 * would hit the guideline check dozens of times a frame and, worse, would be
 * dozens of blits. This bakes ONE tile and repeats it via a pattern, so the
 * whole watermark is one fill.
 */
export function emblemWatermarkTile(cellRef: number, deviceCell: number): HTMLCanvasElement {
  return bake('mark:watermark', cellRef, cellRef, deviceCell, deviceCell, (c, w, h) => {
    const s = w * 0.52;
    c.globalAlpha = 1;
    c.fillStyle = COLORS.stageWatermark;
    if ((LOGO.fallback?.shape ?? 'plate-wordmark') === 'pin-squircle') {
      pinPath(c, (w - s * 0.7) / 2, (h - s) / 2, s * 0.7, s);
    } else {
      roundRect(c, (w - s) / 2, (h - s) / 2, s, s, RADIUS.chip);
    }
    c.fill();
  });
}

/** Reference-unit height of a caption set beside the mark. Used by the harness. */
export const MARK_CAPTION_SIZE = TEXT.micro;
