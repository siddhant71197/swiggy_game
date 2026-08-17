/**
 * ══════════════════════════════════════════════════════════════════════════
 *  DEV HARNESS — the proof sheet for the render foundation.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: a substrate that is only ever seen through
 * the game. Every bug in this layer — a squircle that is really a rounded rect,
 * a mark that magnifies instead of minifying, a pressed state that never
 * paints, a fallback nobody has looked at because the PNG always loads — is
 * invisible while the game around it is being built, and then expensive.
 *
 * Reached at `?dev=mark`. It draws, in one scrollable-free portrait screen:
 *
 *   · the mark at six sizes, from below the raster's useful range to the
 *     splash hero, so bucket selection and minification are visible at once;
 *   · ALL THREE TIERS side by side — raster, inline, vector — by forcing the
 *     tier rather than by waiting for a failure to happen;
 *   · every button variant in every state;
 *   · each shape primitive, with the squircle next to a rounded rect of the
 *     same radius, which is the only way to see that they are different;
 *   · live fx, so particles and popups can be watched for leaks.
 *
 * The `__` prefix marks it as never-shipped. Nothing in src/ imports it except
 * the guarded dynamic import in main.ts.
 */

import { COLORS, IDENTITY, LOGO, withAlpha } from '../brand';
import { font, RADIUS, SPACE, TEXT, TRACK, WEIGHT } from '../config/theme';
import { REF } from '../config/tuning';
import { createViewport, type Viewport } from './canvas';
import { burst, attachFx, drawFx, handleEvent, motionReduced, popup, updateFx } from './fx';
import { adReserveRef, apronWidth, hudRect, mastheadRect, padBandRect, rect, stageRect } from './layout';
import { drawEmblem, drawMark, loadBrandAssets, markHeight, markTier, MARK_MIN_W, maskEmblem } from './mark';
import { bakeStats, rewarm, setBakeContext } from './prerender';
import { disc, linearWash, pill, roundRect, softShadow, squircle, trackedText } from './shapes';
import { button, card, chip, divider, iconLock, iconPip, iconStar, label, valueRow } from './ui';

/** The six sizes. The first is deliberately BELOW MARK_MIN_W. */
const SIZES = [MARK_MIN_W - 24, MARK_MIN_W, 96, 140, 200, 260] as const;

let pressPhase = 0;

/**
 * ONE FRAME OF THE PROOF SHEET.
 *
 * Exported separately from the mount so a future scene test can call it inside
 * an existing loop rather than starting a second one.
 */
export function drawMarkTest(ctx: CanvasRenderingContext2D, vp: Viewport, t = 0): void {
  const W = vp.fieldW;

  // ── Ground and bands ─────────────────────────────────────────────────────
  linearWash(ctx, 0, 0, W, REF.H, COLORS.stageSkyTop, COLORS.stageSkyBottom);

  const mh = mastheadRect(vp);
  ctx.fillStyle = COLORS.masthead;
  ctx.fillRect(mh.x, mh.y, mh.w, mh.h);
  ctx.fillStyle = COLORS.mastheadRule;
  ctx.fillRect(mh.x, mh.y + mh.h - 3, mh.w, 3);

  ctx.fillStyle = COLORS.mastheadText;
  ctx.font = font(TEXT.label, WEIGHT.display);
  ctx.textBaseline = 'middle';
  trackedText(
    ctx,
    'RENDER FOUNDATION',
    W / 2,
    mh.h / 2 - 10,
    TEXT.label * TRACK.label,
    'center',
  );
  ctx.font = font(TEXT.micro, WEIGHT.body);
  ctx.fillStyle = withAlpha(COLORS.mastheadText, 0.8);
  trackedText(
    ctx,
    `${IDENTITY.slug} · tier ${markTier()} · field ${Math.round(W)}×${REF.H} · apron ${Math.round(apronWidth(vp))}`,
    W / 2,
    mh.h / 2 + 16,
    TEXT.micro * TRACK.micro,
    'center',
  );

  // The band edges, so the arithmetic in layout.ts is visible rather than
  // trusted. A misplaced band is obvious here and nowhere else.
  const hud = hudRect(vp);
  const stage = stageRect(vp);
  const pads = padBandRect(vp, 'menu');
  ctx.strokeStyle = withAlpha(COLORS.text, 0.16);
  ctx.lineWidth = 1;
  for (const r of [hud, stage, pads]) {
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }
  // The stage's 560-unit world, outlined in the brand colour — on a 20:9 phone
  // the gap to the field edge should be about 8 units per side. See layout.ts.
  ctx.strokeStyle = COLORS.borderSelected;
  ctx.lineWidth = 2;
  ctx.strokeRect(stage.x, stage.y, stage.w, stage.h);

  // ── HUD band: the widget kit's small parts ───────────────────────────────
  let x = SPACE.lg;
  const hudCy = hud.y + hud.h / 2;
  chip(ctx, x, hudCy, 'LEVEL 3', { fill: COLORS.levelChip, textColor: COLORS.text });
  x += 132;
  for (let i = 0; i < 5; i++) iconPip(ctx, x + i * 26, hudCy, 9, i < 3);
  x += 5 * 26 + SPACE.md;
  for (let i = 0; i < 3; i++) iconStar(ctx, x + i * 30, hudCy, 12, i < 2);
  x += 3 * 30 + SPACE.md;
  iconLock(ctx, x, hudCy, 24);

  // ── The mark, six sizes ──────────────────────────────────────────────────
  let y = stage.y + SPACE.md;
  sectionLabel(ctx, stage.x + SPACE.md, y, `MARK · SIX SIZES · MIN ${MARK_MIN_W}`);
  y += 22;

  let mx = stage.x + SPACE.md;
  for (const s of SIZES) {
    const h = markHeight(s, 'mark');
    if (s < MARK_MIN_W) {
      // BELOW THE MINIMUM, drawMark() throws by design. This is the case the
      // harness exists to make visible: the emblem cut is what belongs here.
      drawEmblem(ctx, mx, y, s);
      caption(ctx, mx, y + s + 12, `${s} → emblem`);
      mx += s + SPACE.md;
    } else {
      if (mx + s > stage.x + stage.w - SPACE.md) {
        mx = stage.x + SPACE.md;
        y += 120;
      }
      drawMark(ctx, mx, y, s);
      caption(ctx, mx, y + h + 12, `${s}`);
      mx += s + SPACE.md;
    }
  }
  y += 130;

  // ── The three tiers ──────────────────────────────────────────────────────
  sectionLabel(ctx, stage.x + SPACE.md, y, 'THREE TIERS · RASTER / INLINE / VECTOR');
  y += 22;
  const tileW = 108;
  const tiers: Array<[string, () => void]> = [
    ['raster', (): void => drawMark(ctx, stage.x + SPACE.md, y, tileW)],
    [
      LOGO.inline ? 'inline' : 'inline (none)',
      (): void => {
        // No inline SVG for this brand, so the slot shows what it would occupy
        // rather than pretending. The code path is exercised by any brand that
        // supplies one; leaving the tile out entirely is how a path nobody has
        // run ships broken.
        ctx.save();
        ctx.strokeStyle = withAlpha(COLORS.text, 0.24);
        ctx.setLineDash([4, 4]);
        squircle(ctx, stage.x + SPACE.md + tileW + SPACE.md, y, tileW, tileW, RADIUS.squircle);
        ctx.stroke();
        ctx.restore();
      },
    ],
    [
      `vector · ${LOGO.fallback?.shape ?? 'plate-wordmark'}`,
      (): void => {
        // Forced, not waited for. The fallback is the tier that only appears on
        // a cold connection or a decode failure, which is exactly why nobody
        // has ever looked at it.
        drawDeclaredFallback(ctx, stage.x + SPACE.md + (tileW + SPACE.md) * 2, y, tileW);
      },
    ],
  ];
  for (let i = 0; i < tiers.length; i++) {
    const entry = tiers[i]!;
    entry[1]();
    caption(ctx, stage.x + SPACE.md + (tileW + SPACE.md) * i, y + tileW + 14, entry[0]);
  }

  // Knockout and mask, the two gated operations.
  const kx = stage.x + SPACE.md + (tileW + SPACE.md) * 3;
  if (LOGO.knockout) {
    ctx.fillStyle = COLORS.masthead;
    roundRect(ctx, kx, y, tileW, tileW, RADIUS.card);
    ctx.fill();
    // THE WORDMARK, not the emblem — and that is the point of the tile.
    //
    // A knockout re-cuts artwork in one flat colour by tinting its ALPHA, so it
    // only shows anything where the source is transparent. The wordmark is
    // orange letterforms on transparency, so knocking it out gives white
    // letterforms: exactly the official inverse lockup, and exactly what the
    // masthead needs. The emblem cut is an OPAQUE plate with the pin knocked
    // out of it in white, so its alpha is a plain square — tinting it is
    // correct and produces a featureless white squircle, which is a useless
    // demo and, worse, looks like the feature is broken.
    drawMark(ctx, kx + 10, y + tileW / 2 - 10, tileW - 20, {
      cut: 'wordmark',
      knockout: 'paper',
    });
    caption(ctx, kx, y + tileW + 14, 'knockout · wordmark');
  }
  const maskX = kx + tileW + SPACE.md;
  if (maskX + tileW < stage.x + stage.w) {
    maskEmblem(ctx, maskX, y, tileW, (c, mxx, myy, s) => {
      linearWash(c, mxx, myy, s, s, COLORS.rakhiDiscHi, COLORS.rakhiGem);
    });
    caption(ctx, maskX, y + tileW + 14, LOGO.maskable ? 'masked' : 'mask denied');
  }
  y += tileW + 40;

  // ── Shape primitives ─────────────────────────────────────────────────────
  sectionLabel(ctx, stage.x + SPACE.md, y, 'PRIMITIVES · SQUIRCLE vs ROUNDRECT');
  y += 22;
  const ps = 84;
  let px = stage.x + SPACE.md;

  ctx.fillStyle = COLORS.markPlate;
  squircle(ctx, px, y, ps, ps, RADIUS.squircle);
  ctx.fill();
  caption(ctx, px, y + ps + 12, `squircle n=${RADIUS.squircle}`);
  px += ps + SPACE.md;

  ctx.fillStyle = COLORS.surfaceSunken;
  roundRect(ctx, px, y, ps, ps, RADIUS.card);
  ctx.fill();
  caption(ctx, px, y + ps + 12, 'roundRect');
  px += ps + SPACE.md;

  ctx.fillStyle = COLORS.girderFace;
  pill(ctx, px, y + ps * 0.3, ps, ps * 0.4);
  ctx.fill();
  caption(ctx, px, y + ps + 12, 'pill');
  px += ps + SPACE.md;

  softShadow(ctx, (c) => roundRect(c, px, y, ps, ps, RADIUS.card), 'overlay');
  ctx.fillStyle = COLORS.surface;
  roundRect(ctx, px, y, ps, ps, RADIUS.card);
  ctx.fill();
  caption(ctx, px, y + ps + 12, 'softShadow');
  px += ps + SPACE.md;

  linearWash(ctx, px, y, ps, ps, COLORS.stageSkyTop, COLORS.girderFace);
  caption(ctx, px, y + ps + 12, 'linearWash');
  y += ps + 40;

  // ── Buttons, every state ─────────────────────────────────────────────────
  sectionLabel(ctx, stage.x + SPACE.md, y, 'BUTTONS · VARIANTS × STATES');
  y += 22;
  // Cycles so the pressed state is actually seen rather than reasoned about.
  pressPhase = Math.floor(t * 1.2) % 2;
  const bw = Math.min(180, (stage.w - SPACE.md * 4) / 3);
  const variants = ['hero', 'secondary', 'ghost'] as const;
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]!;
    const bx = stage.x + SPACE.md + i * (bw + SPACE.md);
    button(ctx, rect(bx, y, bw, 52), v.toUpperCase(), { variant: v, size: TEXT.label });
    button(ctx, rect(bx, y + 62, bw, 52), 'PRESSED', {
      variant: v,
      size: TEXT.label,
      pressed: pressPhase === 1,
    });
    button(ctx, rect(bx, y + 124, bw, 52), 'DISABLED', {
      variant: v,
      size: TEXT.label,
      disabled: true,
    });
  }
  y += 190;

  // ── Card, rows, divider ──────────────────────────────────────────────────
  const cr = rect(stage.x + SPACE.md, y, stage.w - SPACE.md * 2, 118);
  card(ctx, cr, { elevated: true, selected: true });
  valueRow(ctx, rect(cr.x + SPACE.md, cr.y + 10, cr.w - SPACE.md * 2, 32), 'BAKES', String(bakeStats().entries));
  divider(ctx, cr.x + SPACE.md, cr.y + 48, cr.w - SPACE.md * 2);
  valueRow(
    ctx,
    rect(cr.x + SPACE.md, cr.y + 56, cr.w - SPACE.md * 2, 32),
    'REDUCED MOTION',
    motionReduced() ? 'ON' : 'OFF',
  );
  divider(ctx, cr.x + SPACE.md, cr.y + 92, cr.w - SPACE.md * 2);

  // ── Pad band: fx and the ad reserve ──────────────────────────────────────
  ctx.fillStyle = withAlpha(COLORS.text, 0.05);
  ctx.fillRect(pads.x, pads.y, pads.w, pads.h);
  label(ctx, `ad reserve ${Math.round(adReserveRef(vp))}u · safe ${Math.round(vp.safeBottomRef)}u`, W / 2, pads.y + 18, {
    size: TEXT.micro,
    tone: 'tertiary',
    align: 'center',
    track: TRACK.micro,
  });
  disc(ctx, W / 2, pads.y + pads.h / 2, 4, withAlpha(COLORS.text, 0.2));

  drawFx(ctx);
}

function sectionLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  label(ctx, text, x, y, {
    size: TEXT.micro,
    weight: WEIGHT.display,
    tone: 'tertiary',
    track: TRACK.micro,
    baseline: 'top',
  });
}

function caption(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  label(ctx, text, x, y, { size: TEXT.micro, tone: 'secondary', baseline: 'top' });
}

/**
 * The declared fallback, drawn WITHOUT the raster tier in the way.
 *
 * mark.ts routes to tier 1 whenever the image is loaded, which on a warm cache
 * is always — so the only way to look at the vector art is to ask for it. This
 * duplicates four lines of dispatch on purpose rather than adding a `forceTier`
 * option to the shipping API, because a production entry point with a "draw it
 * wrong" flag is a flag somebody eventually passes.
 */
function drawDeclaredFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  const shape = LOGO.fallback?.shape ?? 'plate-wordmark';
  const ix = (LOGO.fallback?.insetX ?? 0.2) * size;
  const iy = (LOGO.fallback?.insetY ?? 0.2) * size;
  ctx.save();
  ctx.fillStyle = COLORS.markPlate;
  if (shape === 'pin-squircle') {
    squircle(ctx, x, y, size, size, RADIUS.squircle);
    ctx.fill();
    ctx.fillStyle = COLORS.markPin;
    const w = size - ix * 2;
    const h = size - iy * 2;
    const r = w / 2;
    const d = h - r;
    const alpha = Math.acos(Math.max(-1, Math.min(1, r / d)));
    const cx = x + ix + r;
    const cy = y + iy + r;
    ctx.beginPath();
    ctx.moveTo(cx, cy + d);
    ctx.lineTo(cx + r * Math.cos(Math.PI / 2 - alpha), cy + r * Math.sin(Math.PI / 2 - alpha));
    ctx.arc(cx, cy, r, Math.PI / 2 - alpha, Math.PI / 2 + alpha, true);
    ctx.closePath();
    ctx.fill();
  } else {
    roundRect(ctx, x, y, size, size, RADIUS.card);
    ctx.fill();
    ctx.fillStyle = COLORS.markPin;
    ctx.font = font(size * 0.3, WEIGHT.display);
    ctx.textBaseline = 'middle';
    trackedText(ctx, IDENTITY.shortName.toUpperCase(), x + size / 2, y + size / 2, 1, 'center');
  }
  ctx.restore();
}

// ─── Mount ──────────────────────────────────────────────────────────────────

/**
 * Takes over the canvas with its own loop. Deliberately NOT reusing GameLoop:
 * the harness must keep drawing when the game's loop is not running, and a
 * fixed-step sim is meaningless here.
 */
export function mountMarkTest(): void {
  const vp = createViewport();
  attachFx(vp);
  setBakeContext(vp.dpr, vp.qualityScale);
  vp.onResize((v) => {
    setBakeContext(v.dpr, v.qualityScale);
    rewarm();
  });

  // Fires effects on a slow cycle so particles, popups, shake and hit-stop can
  // all be watched running for as long as anyone wants to watch them.
  let next = 0;
  let last = 0;

  const frame = (ms: number): void => {
    const now = ms / 1000;
    const dt = last === 0 ? 0 : Math.min(0.05, now - last);
    last = now;

    if (now > next) {
      next = now + 1.6;
      const s = stageRect(vp);
      handleEvent(
        { type: 'RakhiTaken', index: 0, x: s.w * 0.5, y: s.h * 0.72, chain: 3 },
        s.x,
        s.y,
      );
      burst(s.x + s.w * 0.3, s.y + s.h * 0.8, { count: 12, color: COLORS.girderFace });
      popup(s.x + s.w * 0.7, s.y + s.h * 0.8, '+200', COLORS.scorePopBonus);
    }

    updateFx(dt, now);
    vp.begin();
    vp.clear(COLORS.stageSkyTop);
    drawMarkTest(vp.ctx, vp, now);
    vp.end();
    requestAnimationFrame(frame);
  };

  // The mark waits for its artwork, but the harness does not wait for the mark:
  // the first frames deliberately show the VECTOR tier, which is the state a
  // cold connection actually produces and the one nobody ever sees otherwise.
  void loadBrandAssets();
  requestAnimationFrame(frame);

  document.getElementById('boot')?.classList.add('hidden');
}
