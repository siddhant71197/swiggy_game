/**
 * ══════════════════════════════════════════════════════════════════════════
 *  ANALYTICS — one wrapper, so a blocked script can never break the game.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: `gtag(...)` scattered through the scene graph.
 *
 * A meaningful share of this audience runs an ad blocker — commonly 10–30% on
 * mobile web in India — and for those players `gtag` never comes into existence.
 * A bare call then throws, and it throws inside a scene callback, which means
 * THE GAME BREAKS FOR EXACTLY THE USERS MOST LIKELY TO NOTICE AND LEAST LIKELY
 * TO FORGIVE IT. Funnelling every event through `track()` makes that impossible:
 * the worst case is that numbers go missing, which is the correct failure.
 *
 * ─── WHY THE SCRIPT IS LOADED HERE AND NOT IN index.html ───────────────────
 *
 * Three reasons, in order of weight:
 *
 *   1. The measurement ID belongs to the BRAND (see BrandAnalytics), and this is
 *      the layer that can read a brand module. Hard-coding it in the HTML would
 *      put one brand's property into every re-skin.
 *   2. A brand that declares no `analytics` block loads no third-party script at
 *      all — impossible to express with a static <script> tag.
 *   3. It can be deferred until AFTER the first frame. This game has zero
 *      runtime dependencies and boots fast; that is a property worth keeping,
 *      and no measurement is worth making the first paint wait on a request to
 *      someone else's CDN.
 *
 * ─── ON SESSIONS AND SESSION TIME ──────────────────────────────────────────
 *
 * GA4 counts sessions and engagement time by itself; neither needs an event
 * here. But engagement time only accrues while the tab is FOCUSED, and a session
 * with no events can be under-measured — so the level events below are doing two
 * jobs, and thinning them out later would quietly degrade the duration numbers
 * as well as the funnel.
 */

import { ANALYTICS, IDENTITY } from '../brand';

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let started = false;

/**
 * Inject gtag.js. Safe to call more than once; safe to never call.
 *
 * Call AFTER the first frame — see the header. The queue below means events
 * fired before the script finishes downloading are not lost: the real gtag
 * drains `dataLayer` when it arrives.
 */
export function initAnalytics(): void {
  if (started || typeof window === 'undefined' || typeof document === 'undefined') return;
  const id = ANALYTICS?.measurementId;
  if (!id) return;
  started = true;

  // The standard snippet, with one difference: `gtag` is defined BEFORE the
  // script loads, so calls made in the meantime queue in dataLayer rather than
  // throwing. If the script is blocked they simply accumulate — a few dozen
  // array entries over a session, and no error anywhere.
  window.dataLayer = window.dataLayer || [];
  const gtag = (...args: unknown[]): void => {
    window.dataLayer!.push(args);
  };
  window.gtag = window.gtag ?? gtag;

  gtag('js', new Date());
  gtag('config', id, {
    // Every event carries the brand, so two brands reporting into one property
    // can still be told apart. Cheap now, impossible to backfill later.
    brand: IDENTITY.slug,
    game: IDENTITY.gameTitle,
  });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  // A blocked or failed script must be a non-event, not an unhandled error.
  s.onerror = () => {};
  document.head.appendChild(s);
}

/**
 * Send one event. Never throws, never blocks, no-ops when there is no gtag.
 *
 * Prefer GA4's own recommended names (`level_start`, `level_end`, `post_score`,
 * `tutorial_complete`, `share`) over invented ones: GA4's reporting understands
 * those natively and builds the funnels for you, where a custom name stays an
 * opaque row somebody has to configure.
 */
export function track(name: string, params: Params = {}): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', name, { brand: IDENTITY.slug, ...params });
  } catch {
    // Measurement must never be able to take the game down with it.
  }
}
