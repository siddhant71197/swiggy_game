/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE GAME'S DESIGN LANGUAGE — radii, spacing, type scale, the ad block.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: `ctx.font = 'bold 24px sans-serif'` appearing
 * in nine scenes, four of which then miss a brand's real face and two of which
 * ask for a weight the family does not ship.
 *
 * ─── THIS FILE HOLDS NO COLOURS ────────────────────────────────────────────
 *
 * Colour lives in src/brand/theme.ts and arrives already derived. What lives
 * here is everything else the game's look is made of, and the split matters:
 * a radius is a BRAND decision (see BrandShape) but a type SCALE is a GAME
 * decision — how big the HUD label is relative to the score has nothing to do
 * with who is sponsoring it.
 *
 * The AD block below is the one exception and it is a composition, not a
 * literal: it names which already-derived tokens the banner is built from.
 */

import { BRAND_AD, BRAND_TYPE, COLORS, IDENTITY, LOGO, SHAPE, withAlpha } from '../brand';

// ─── Type ───────────────────────────────────────────────────────────────────

export const FONT_STACK_CSS = BRAND_TYPE.stack;

/** The three weights the brand actually ships. Never invent a fourth. */
export const WEIGHT = BRAND_TYPE.weights;

/**
 * Reference-unit type scale. A ratio-based ramp rather than hand-picked sizes,
 * so a screen that needs "one step smaller" has somewhere to go that is already
 * consistent with everything else.
 */
export const TEXT = {
  hero: 64,
  title: 44,
  head: 32,
  sub: 24,
  body: 19,
  label: 15,
  micro: 12,
} as const;

/**
 * Canvas font shorthand. Everything that sets `ctx.font` goes through here, so
 * a brand that nominates a real face gets it on the canvas as well as in the
 * DOM — the two drifting apart is a subtle, permanent, hard-to-name wrongness.
 */
export function font(size: number, weight: number = WEIGHT.body): string {
  return `${weight} ${size}px ${FONT_STACK_CSS}`;
}

export const LEADING = BRAND_TYPE.leading;

/** Letter-spacing, as a fraction of size. Display type is set tight; labels wide. */
export const TRACK = {
  display: -0.01,
  body: 0,
  label: 0.08,
  micro: 0.14,
} as const;

// ─── Shape and space ────────────────────────────────────────────────────────

export const RADIUS = {
  card: SHAPE.card,
  button: SHAPE.button,
  pill: SHAPE.pill,
  /** Superellipse exponent for the logo plate and hero surfaces. */
  squircle: SHAPE.squircle,
  /** Small chrome — chips, pips, the HUD's inner wells. */
  chip: Math.max(4, Math.round(SHAPE.button * 0.6)),
} as const;

/** A 4-unit rhythm. Every gap in the game is one of these. */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 36,
  xxl: 56,
} as const;

/**
 * SHADOWS ARE FAKED WITH STACKED FILLS, NEVER WITH ctx.shadowBlur.
 *
 * shadowBlur is the Android frame-budget cliff — a single blurred fill can cost
 * more than the entire rest of the frame on a mid-tier phone, and this game
 * draws a lot of small objects. The gate bans it outright under src/render/.
 *
 * These are the offsets and opacities a "soft shadow" is built from instead: an
 * offset fill of the ink at low alpha, under the real shape.
 */
export const ELEVATION = {
  restY: 2,
  restAlpha: 0.1,
  raisedY: 4,
  raisedAlpha: 0.14,
  overlayY: 8,
  overlayAlpha: 0.2,
} as const;

// ─── Motion ─────────────────────────────────────────────────────────────────

export const MOTION = {
  wipeOutSec: 0.22,
  wipeInSec: 0.18,
  buttonPressSec: 0.08,
  popupRiseSec: 0.7,
  pipPunchSec: 0.25,
  shutterRollSec: 0.5,
} as const;

// ─── The sticky banner ──────────────────────────────────────────────────────

/**
 * The house creative, composed from tokens that are already derived — so it
 * re-skins with everything else and cannot drift from the masthead it sits
 * under. `mountAdCreative()` in src/ui/adSlot.ts replaces the whole thing with
 * a live tag when there is one.
 */
export const AD = {
  enabled: true,
  height: 56,
  maxWidth: 468,
  label: 'AD',
  labelColor: withAlpha(COLORS.textOnPrimary, 0.45),
  houseCreative: {
    headline: BRAND_AD.headline,
    subline: BRAND_AD.subline,
    cta: BRAND_AD.cta,
    href: IDENTITY.href,
    bg: COLORS.masthead,
    headlineColor: COLORS.mastheadText,
    sublineColor: withAlpha(COLORS.mastheadText, 0.82),
    ctaBg: COLORS.surface,
    ctaText: COLORS.text,
    /**
     * The square emblem cut, not the full lockup: at 56px tall a wordmark
     * beside a headline is two competing lines of type in the same eyeline.
     */
    logo: LOGO.square ?? LOGO.mark,
  },
} as const;
