/**
 * ══════════════════════════════════════════════════════════════════════════
 *  AD SLOT — the sticky bottom banner, and the reason it is DOM.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: a rewrite on the day real demand is wired in.
 * A live ad tag — GPT, AdSense, IMA — renders its own cross-origin iframe. An
 * iframe cannot paint into a 2D context, so a banner drawn on the canvas is
 * artwork that gets thrown away the first time anybody sells this inventory.
 * Building it as DOM now means the integration point already exists and already
 * has the right shape, and `mountAdCreative()` IS that point: it clears the
 * house creative and hands back a container an SDK can render into.
 *
 * ─── VISIBILITY IS DRIVEN FROM OUTSIDE EVERY SCENE ─────────────────────────
 *
 * `setAdVisible()` is called ONCE PER FRAME from main.ts, from the one place
 * that can see which scene is current and what state it is in. A scene that
 * shows and hides the banner itself gets it wrong on the one transition nobody
 * tested — the pause that comes from a backgrounded tab, the death on the frame
 * a level clears — and the symptom is a banner over the playfield, which is the
 * single worst thing this unit can do.
 *
 * ─── THE LOGO IS A SUB-RECTANGLE, WHICH `<img>` CANNOT BLIT ────────────────
 *
 * `LOGO.square` is an AssetRef with a `rect`: a declared cut of a larger lockup
 * PNG (see src/brand/types.ts on why the cuts are declarations over the
 * authentic artwork rather than re-encoded crops). `<img src>` has no way to
 * show part of a file, so the emblem is a `<div>` with a background-image sized
 * and offset from the rect fractions. Getting this wrong does not throw — it
 * shows the wordmark, or half of it, in the banner. It is the logo. It matters.
 */

import type { AssetRef } from '../brand/types';
import type { Viewport } from '../render/canvas';
import { AD, FONT_STACK_CSS, RADIUS, SPACE, WEIGHT } from '../config/theme';
import { openBrandCta } from './cta';

let root: HTMLElement | null = null;
let creative: HTMLElement | null = null;
let visible = false;

export function initAdSlot(): void {
  if (!AD.enabled) return;
  root = document.getElementById('ad-slot');
  if (!root) return;

  const frame = document.createElement('div');
  frame.id = 'ad-frame';
  frame.style.cssText = [
    'position:relative',
    `width:min(100%, ${AD.maxWidth}px)`,
    `height:${AD.height}px`,
    `border-radius:${RADIUS.chip}px`,
    'overflow:hidden',
  ].join(';');

  // The disclosure marker sits OUTSIDE #ad-creative so that mounting a live tag
  // — which replaces that node's children wholesale — cannot take the label with
  // it. An undisclosed ad is a policy violation, not a cosmetic slip.
  const label = document.createElement('span');
  label.textContent = AD.label;
  label.style.cssText = [
    'position:absolute',
    'top:2px',
    'left:4px',
    'z-index:2',
    'font-size:8px',
    `font-weight:${WEIGHT.display}`,
    'letter-spacing:0.12em',
    `color:${AD.labelColor}`,
    'pointer-events:none',
  ].join(';');

  creative = document.createElement('div');
  creative.id = 'ad-creative';
  creative.style.cssText = 'width:100%;height:100%';
  creative.appendChild(buildHouseCreative());

  frame.appendChild(creative);
  frame.appendChild(label);
  root.appendChild(frame);
}

/**
 * A `<div>` showing `rect` of `ref.src` at exactly `h` tall.
 *
 * The arithmetic: to show a sub-rectangle occupying `sw`×`sh` of the source, the
 * WHOLE source must be scaled to `w/sw` × `h/sh`, and then shifted left/up by
 * the sub-rectangle's origin in that scaled space — `sx/sw * w`. Both numbers
 * are fractions of the box, never of the file, which is what makes this
 * independent of the PNG's pixel dimensions and therefore safe when a brand
 * ships the same cuts at a different resolution.
 */
function buildAssetBox(ref: AssetRef, h: number): HTMLElement {
  const w = h * ref.aspect;
  const el = document.createElement('div');
  const css = [
    `width:${w}px`,
    `height:${h}px`,
    'flex:0 0 auto',
    `background-image:url(${ref.src})`,
    'background-repeat:no-repeat',
  ];

  const r = ref.rect;
  if (r) {
    css.push(`background-size:${w / r.sw}px ${h / r.sh}px`);
    css.push(`background-position:${-(r.sx / r.sw) * w}px ${-(r.sy / r.sh) * h}px`);
  } else {
    // No rect means the whole image, and `contain` is right rather than `cover`:
    // a logo cropped to fill its box is a damaged logo.
    css.push('background-size:contain');
    css.push('background-position:center');
  }

  el.style.cssText = css.join(';');
  return el;
}

/**
 * The house creative, composed entirely from AD.houseCreative — which is itself
 * composed from already-derived theme tokens, so this bar re-skins with the rest
 * of the game and cannot drift from the masthead it sits under.
 */
function buildHouseCreative(): HTMLElement {
  const c = AD.houseCreative;

  const a = document.createElement('a');
  a.href = c.href;
  /**
   * `_blank` + `noopener noreferrer` is LOAD-BEARING, not boilerplate. Without
   * it a mis-tap on a banner pinned to the bottom of a game — i.e. exactly where
   * a thumb rests — navigates the tab away and destroys an in-progress run.
   * `noopener` additionally denies the landing page a handle on `window.opener`.
   */
  a.target = '_blank';
  a.rel = 'noopener noreferrer';

  /**
   * PROGRESSIVE ENHANCEMENT ONTO A LINK THAT ALREADY WORKS.
   *
   * The href above is the web URL, so this banner is a real, valid, copyable
   * link with no script at all. The handler then tries the app deeplink first
   * and only falls through to that href when nothing handles the scheme.
   *
   * That ordering matters: making the href itself `swiggy://` would give a
   * desktop reviewer a link that does nothing, shows a meaningless target in
   * the status bar, and cannot be copied or opened in a new tab.
   */
  a.addEventListener('click', (ev) => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    ev.preventDefault();
    openBrandCta('sticky_banner');
  });
  a.style.cssText = [
    'display:flex',
    'align-items:center',
    `gap:${SPACE.sm}px`,
    'width:100%',
    'height:100%',
    `padding:0 ${SPACE.sm}px`,
    `background:${c.bg}`,
    'text-decoration:none',
    `font-family:${FONT_STACK_CSS}`,
  ].join(';');

  const logo = buildAssetBox(c.logo, AD.height - SPACE.lg);

  const text = document.createElement('div');
  text.style.cssText = 'flex:1 1 auto;min-width:0;line-height:1.15';

  const headline = document.createElement('div');
  headline.textContent = c.headline;
  headline.style.cssText = [
    `color:${c.headlineColor}`,
    'font-size:13px',
    // Only the three weights the brand actually ships are ever named; asking for
    // a fourth makes the browser synthesise a smeared faux-bold.
    `font-weight:${WEIGHT.display}`,
    'letter-spacing:0.01em',
    'white-space:nowrap',
    'overflow:hidden',
    'text-overflow:ellipsis',
  ].join(';');

  const subline = document.createElement('div');
  subline.textContent = c.subline;
  subline.style.cssText = [
    `color:${c.sublineColor}`,
    'font-size:10px',
    `font-weight:${WEIGHT.body}`,
    'white-space:nowrap',
    'overflow:hidden',
    'text-overflow:ellipsis',
  ].join(';');

  const cta = document.createElement('span');
  cta.textContent = c.cta;
  cta.style.cssText = [
    'flex:0 0 auto',
    `background:${c.ctaBg}`,
    `color:${c.ctaText}`,
    'font-size:10px',
    `font-weight:${WEIGHT.display}`,
    'letter-spacing:0.06em',
    `padding:${SPACE.xs + 2}px ${SPACE.md - 4}px`,
    `border-radius:${RADIUS.pill}px`,
  ].join(';');

  text.appendChild(headline);
  text.appendChild(subline);
  a.appendChild(logo);
  a.appendChild(text);
  a.appendChild(cta);
  return a;
}

export function showAd(): void {
  if (!root || visible) return;
  visible = true;
  root.dataset['hidden'] = 'false';
}

export function hideAd(): void {
  if (!root || !visible) return;
  visible = false;
  // The CSS on #ad-slot[data-hidden] also sets pointer-events:none, so a swipe
  // that runs off the bottom of the stage cannot land on a banner that is
  // visually gone but still in the hit-test tree.
  root.dataset['hidden'] = 'true';
}

export function setAdVisible(v: boolean): void {
  if (v) showAd();
  else hideAd();
}

/** Whether the banner is currently shown. Debug and tests; main.ts drives it. */
export function isAdVisible(): boolean {
  return visible;
}

/**
 * Vertical space the banner occupies, in REFERENCE UNITS, for layout that must
 * keep content clear of it.
 *
 * MEASURED OFF THE LIVE ELEMENT rather than computed from AD.height, because the
 * slot's padding includes `env(safe-area-inset-bottom)` — a number that only the
 * browser knows and that differs between a notched phone, a home-indicator
 * phone, and the desktop frame. Guessing it puts the CTA under the home
 * indicator on exactly the devices nobody tests on.
 *
 * Returns 0 when the slot is disabled or absent, so deleting ads reclaims the
 * space automatically instead of leaving a hole where the banner used to be.
 */
export function adReservedRef(vp: Viewport): number {
  if (!AD.enabled || !root) return 0;
  const cssHeight = root.offsetHeight || AD.height + SPACE.md;
  return cssHeight / vp.scale;
}

/**
 * Mount a real ad tag. Clears the house creative and hands back the container.
 *
 *   const el = mountAdCreative();
 *   if (el) googletag.cmd.push(() => googletag.display(el.id));
 */
export function mountAdCreative(): HTMLElement | null {
  if (!creative) return null;
  creative.replaceChildren();
  return creative;
}
