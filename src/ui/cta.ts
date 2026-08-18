/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE CTA — open the app, and fall back to the web when it is not there.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: a click-out that silently does nothing.
 *
 * `IDENTITY.href` is an app deeplink (`swiggy://restaurantList`). On a phone
 * with the app installed that is exactly right — it lands the player inside the
 * product, which is the entire job of a marketing unit. Everywhere else it is a
 * dead string: a desktop browser does not know the scheme, and neither does a
 * phone without the app. The browser's response to an unknown scheme is to do
 * NOTHING VISIBLE — no error, no navigation — so the single most important
 * button in the unit reads as broken, and it reads as broken specifically to
 * the reviewer, who is on a laptop.
 *
 * ─── HOW THE FALLBACK KNOWS ────────────────────────────────────────────────
 *
 * There is no API that answers "is this scheme handled". The reliable signal is
 * indirect: if the app DOES open, this page is backgrounded, and the browser
 * stops firing timers / flips `document.hidden`. So we start the navigation,
 * wait a beat, and if we are still here and still visible, nothing handled it —
 * go to the web URL instead.
 *
 * The wait is a compromise and worth naming: too short and a slow app launch
 * gets a spurious second navigation, too long and the desktop user stares at a
 * dead button. ~1.1s sits past a typical cold app launch on a mid-tier phone.
 */

import { IDENTITY } from '../brand';
import { track } from './analytics';

/** Past a cold app launch on a mid-tier phone, short enough not to feel dead. */
const FALLBACK_MS = 1100;

/**
 * Try the app, then the web.
 *
 * MUST be called synchronously from inside the click/pointerup handler. Both
 * navigations are user-activated actions, and a browser that has lost the
 * activation (because the call was awaited first) blocks them as a popup — the
 * same rule that governs `navigator.share`.
 */
export type CtaPlacement = 'sticky_banner' | 'game_over';

export function openBrandCta(placement: CtaPlacement): void {
  if (typeof window === 'undefined') return;

  // Fired on INTENT, before anything can navigate away. GA4's automatic
  // outbound-link tracking cannot see either of this game's CTAs — the banner
  // calls preventDefault so it can try the deeplink first, and the game-over
  // button is canvas, not an anchor — so this is the only place the click is
  // observable at all.
  track('cta_click', { placement, target: 'app_deeplink' });

  const deeplink = IDENTITY.href;
  const web = IDENTITY.webHref;

  // A brand with no app points both at the same place; skip the dance entirely
  // rather than making every such brand wait out the timer.
  if (deeplink === web || !/^[a-z][a-z0-9+.-]*:/i.test(deeplink) || /^https?:/i.test(deeplink)) {
    window.open(web, '_blank', 'noopener,noreferrer');
    return;
  }
  void 0;

  let settled = false;
  const cancel = (): void => {
    settled = true;
  };

  // If the app takes over, the page is hidden or blurred before the timer runs.
  document.addEventListener('visibilitychange', cancel, { once: true });
  window.addEventListener('pagehide', cancel, { once: true });
  window.addEventListener('blur', cancel, { once: true });

  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', cancel);
    window.removeEventListener('pagehide', cancel);
    window.removeEventListener('blur', cancel);
    if (settled || document.hidden) return;
    // Nothing handled the scheme. Take them to the web instead of nowhere.
    //
    // AND THIS IS A MEASUREMENT, not just a fallback. Reaching here means the
    // deeplink went unanswered, which means the app is not installed (or this
    // is a desktop browser). We can never confirm the positive case — when the
    // app DOES open, the page is backgrounded and nothing more runs — but the
    // ratio of this event to `cta_click` is a usable estimate of how many
    // clickers already have the app. That number is otherwise unobtainable.
    track('cta_fallback_web', { placement });
    window.open(web, '_blank', 'noopener,noreferrer');
  }, FALLBACK_MS);

  // location.href rather than window.open: a popup carrying an unknown scheme
  // is what pops up a blank tab that then sits there, and a blank tab is worse
  // than no tab.
  window.location.href = deeplink;
}
