/**
 * ══════════════════════════════════════════════════════════════════════════
 *  LAYOUT — the band arithmetic, done once.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: `BANDS.masthead + BANDS.hud` typed out in
 * eleven scenes. Ten of them agree. The eleventh has the HUD 8 units low, and
 * because it is the pause overlay nobody sees it until a store review does.
 *
 * Every rectangle the game draws into comes from here, in reference units, so
 * "move the HUD down" is one edit and "what is the stage's top edge" has
 * exactly one answer.
 *
 * ─── THE BINDING CASE, WHICH IS WHY THE STAGE MAY NOT GROW ─────────────────
 *
 * canvas.ts maps HEIGHT onto REF.H and lets width fall out. On a 20:9 handset:
 *
 *     fieldW = 1280 × (9 / 20) = 576 reference units
 *     stage  = 560                    ← STAGE.W, fixed
 *     apron  = (576 − 560) / 2 = 8    ← per side
 *
 * EIGHT UNITS. That is the whole margin on the most common phone aspect on
 * sale, and it is why STAGE.W is 560 rather than the 600 that would look
 * better on a tablet. Nothing here may widen the stage to fill a wider field:
 * the sim's speeds are in stage units per second, so a stage that scaled with
 * the device would make a level-9 barrel dodge a measurably different game per
 * handset — see the header on config/tuning.ts BANDS.
 *
 * So the stage world is 560×760, CENTRED, ALWAYS. On a wider field only the
 * APRON grows, and the apron is decoration (vignette, watermark) that carries
 * no gameplay. A 4:3 tablet gets fieldW = 1707 and a 573-unit apron per side;
 * the game inside is pixel-identical to the one on the phone.
 */

import { AD } from '../config/theme';
import { BANDS, REF, STAGE } from '../config/tuning';
import type { Viewport } from './canvas';

/** A rectangle in reference units. The only geometry type in the renderer. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

/** Point-in-rect with optional invisible slop. See UI.padSlop for why slop. */
export function hitRect(r: Rect, x: number, y: number, slop = 0): boolean {
  return (
    x >= r.x - slop && x <= r.x + r.w + slop && y >= r.y - slop && y <= r.y + r.h + slop
  );
}

export function centerX(r: Rect): number {
  return r.x + r.w / 2;
}

export function centerY(r: Rect): number {
  return r.y + r.h / 2;
}

/** A rect inset on every side. Negative insets grow it, which chips rely on. */
export function inset(r: Rect, dx: number, dy = dx): Rect {
  return { x: r.x + dx, y: r.y + dy, w: r.w - dx * 2, h: r.h - dy * 2 };
}

// ─── The bands ──────────────────────────────────────────────────────────────
//
// Derived by accumulation rather than written out, so BANDS is the only place
// the four numbers exist and a change to one moves everything below it.

const MASTHEAD_TOP = 0;
const HUD_TOP = MASTHEAD_TOP + BANDS.masthead; // 96
const STAGE_BAND_TOP = HUD_TOP + BANDS.hud; // 208
const PAD_BAND_TOP = STAGE_BAND_TOP + BANDS.stage; // 968
// 968 + 312 = 1280 = REF.H exactly.
//
// Checked at module load rather than trusted, because the symptom of an edit
// to BANDS that stops summing is not an error — it is a pad band hanging four
// units off the bottom of a phone, which looks like a device quirk and gets
// debugged as one. This throws at boot, on the line responsible.
if (PAD_BAND_TOP + BANDS.pads !== REF.H) {
  throw new Error(
    `layout: BANDS sum to ${PAD_BAND_TOP + BANDS.pads}, expected REF.H = ${REF.H}`,
  );
}

/** The brand bar. Full field width — it is chrome, so it owns the edges. */
export function mastheadRect(vp: Viewport): Rect {
  return { x: 0, y: MASTHEAD_TOP, w: vp.fieldW, h: BANDS.masthead };
}

/** Score, lives, timer, rakhi tracker. Full width. */
export function hudRect(vp: Viewport): Rect {
  return { x: 0, y: HUD_TOP, w: vp.fieldW, h: BANDS.hud };
}

/**
 * The band the stage SITS IN — full field width, including the apron.
 *
 * Distinct from stageRect(): backdrop, vignette and watermark paint across the
 * whole band, and the world is a smaller rect centred inside it.
 */
export function stageBandRect(vp: Viewport): Rect {
  return { x: 0, y: STAGE_BAND_TOP, w: vp.fieldW, h: BANDS.stage };
}

/**
 * THE WORLD. 560×760, centred, never resized. See the header.
 *
 * `Math.round` on the origin, not on the size: an unrounded origin puts every
 * girder edge on a half-unit and the whole stage renders a touch soft, while
 * an unrounded SIZE would change the world's dimensions, which is the thing
 * that must never happen.
 */
export function stageRect(vp: Viewport): Rect {
  return {
    x: Math.round((vp.fieldW - STAGE.W) / 2),
    y: STAGE_BAND_TOP,
    w: STAGE.W,
    h: STAGE.H,
  };
}

/**
 * The decorative strip beside the stage, per side. Zero-width on a 20:9 phone
 * in all but name (8 units), wide on a tablet. Nothing with gameplay in it.
 */
export function apronWidth(vp: Viewport): number {
  return Math.max(0, (vp.fieldW - STAGE.W) / 2);
}

// ─── The pad band, and the one place that knows about the ad ────────────────

export type LayoutMode = 'play' | 'menu';

/**
 * Reference units the sticky ad reserves at the bottom of the screen.
 *
 * AD.height is CSS PIXELS — it is a DOM overlay, not a canvas drawing — so it
 * has to be converted through the viewport rather than used directly. Getting
 * that wrong is invisible at 1x and puts the ad through the buttons on a 3x
 * phone, which is the configuration nobody develops on.
 *
 * The safe-area inset is added because index.html anchors the slot ABOVE it.
 */
export function adReserveRef(vp: Viewport): number {
  if (!AD.enabled) return vp.safeBottomRef;
  // 12 CSS px of breathing room: index.html pads the slot 6px top and bottom.
  return vp.pxToRef(AD.height + 12) + vp.safeBottomRef;
}

/**
 * The lowest y a MENU may place anything at. Play scenes ignore this — see
 * padBandRect.
 */
export function contentBottom(vp: Viewport): number {
  return REF.H - adReserveRef(vp);
}

/**
 * THE ONE PLACE THAT KNOWS THE AD MOVES.
 *
 * During play the slot is slid out (index.html's `data-hidden`) and stops
 * taking input, precisely so the d-pad can own the full 312-unit band right
 * down to the bottom edge — a jump button that has to dodge an ad is a jump
 * button the player's thumb misses.
 *
 * On menus the slot is visible, so the band ends above it.
 *
 * Every other file asks for a rect and never learns which mode produced it.
 * The alternative — scenes each subtracting an ad height — is how the ad ends
 * up double-counted on two screens and ignored on a third.
 */
export function padBandRect(vp: Viewport, mode: LayoutMode = 'play'): Rect {
  if (mode === 'play') {
    return { x: 0, y: PAD_BAND_TOP, w: vp.fieldW, h: BANDS.pads };
  }
  const bottom = contentBottom(vp);
  return { x: 0, y: PAD_BAND_TOP, w: vp.fieldW, h: Math.max(0, bottom - PAD_BAND_TOP) };
}

/**
 * Everything below the masthead that a menu may compose in — the splash hero,
 * the level select grid, the results panel. Spans the hud, stage and pad bands
 * because a menu has no hud and no stage.
 */
export function menuContentRect(vp: Viewport): Rect {
  return {
    x: 0,
    y: HUD_TOP,
    w: vp.fieldW,
    h: Math.max(0, contentBottom(vp) - HUD_TOP),
  };
}

/**
 * A centred column, clamped so it never touches the field edge on a narrow
 * phone and never sprawls on a tablet.
 *
 * REF.W is the design width and this is the only place it is used as one: the
 * field can be wider (tablet) or narrower (20:9), and a column that tracked
 * fieldW would be unreadably wide on the first and clipped on the second.
 */
export function columnRect(vp: Viewport, top: number, height: number, margin = 40): Rect {
  const w = Math.min(REF.W - margin * 2, vp.fieldW - margin * 2);
  return { x: Math.round((vp.fieldW - w) / 2), y: top, w, h: height };
}

/** Band tops, for anything that needs an edge rather than a rect. */
export const BAND_TOP = {
  masthead: MASTHEAD_TOP,
  hud: HUD_TOP,
  stage: STAGE_BAND_TOP,
  pads: PAD_BAND_TOP,
} as const;
