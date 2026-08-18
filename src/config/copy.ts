/**
 * ══════════════════════════════════════════════════════════════════════════
 *  COPY — everything the GAME says.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: a re-skin that has to re-author forty strings
 * because each of them names the brand's collectible inline. A re-skin that
 * expensive gets done badly under time pressure, or not at all.
 *
 * ─── WHAT LIVES HERE AND WHAT LIVES IN THE BRAND ───────────────────────────
 *
 * The test is whether a string would be FALSE under a different brand, or
 * merely flavourless.
 *
 *   "Collect every {collectiblePl}"        → HERE. True of any brand.
 *   "Scene hai toh Swiggy hai."            → brand.copy. False of any other.
 *
 * Strings here use {token} placeholders filled from the brand's `vocab` by
 * `t()` below. That is the mechanism that makes a re-skin cost four words
 * instead of forty sentences.
 *
 * ─── THE LEVEL NAMES ARE THE ONE DELIBERATE EXCEPTION ──────────────────────
 *
 * They are Hinglish and food-flavoured, which is Swiggy's register rather than
 * a universal one. They live here anyway, because they are the GAME'S content —
 * ten levels of a specific game — and a brand module is not the place to
 * re-author a game's level list. A brand that wants different names overrides
 * the array; that is a bigger ask than a vocab word and it should look like one.
 */

import { VOCAB } from '../brand';

/**
 * Fill {placeholders} from the brand vocabulary.
 *
 * Throws on an unknown token rather than leaving it in the string. A `{gaol}`
 * typo that renders literally is a bug a player sees and a reviewer screenshots;
 * one that throws is a bug the first person to open that screen fixes.
 */
export function t(template: string, extra?: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (extra && key in extra) return String(extra[key]);
    if (key in VOCAB) {
      const v = VOCAB[key as keyof typeof VOCAB];
      // `vocab.foods` is a LIST, and a list has no sensible rendering in the
      // middle of a sentence. Joining it would silently produce "Collect every
      // Biryani,Dosa,Samosa" — grammatical nonsense that no type error catches
      // and that reads as a data bug to whoever sees it on screen. A template
      // that wants one dish indexes the list and passes it through `extra`.
      if (typeof v !== 'string') {
        throw new Error(
          `copy: {${key}} is a list, not a word — index it and pass it via the extra map`,
        );
      }
      return v;
    }
    throw new Error(`copy: unknown token {${key}}`);
  });
}

/**
 * `t()`, then upper-case the first letter.
 *
 * Exists because a template that OPENS with a vocabulary token — "{villain}
 * rolls them down at you" — renders as "the monkey rolls them down at you", a
 * sentence starting in lower case. The alternative fixes are both worse: giving
 * the brand a second, capitalised vocab entry doubles the re-skin's word count
 * for a typographic detail, and hard-coding "The monkey" into the template
 * makes the string false under every other brand.
 *
 * It only ever touches the FIRST character, so a token that legitimately begins
 * lower case in the middle of a string is untouched.
 */
export function tSentence(template: string, extra?: Record<string, string | number>): string {
  const s = t(template, extra);
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

/**
 * `t()`, then upper-case the whole line.
 *
 * For the one string that is SET in caps as a display decision —
 * `completeTitle`. Writing the caps into the template would leave `{collectiblePl}`
 * substituting a lower-case vocabulary word into the middle of it, producing
 * "SAARE rakhis DELIVERED": a typographic mistake caused by a data join, which
 * is exactly the class of bug a token system introduces if nobody owns the
 * casing. The brand does not get a second, shouted copy of its vocabulary for
 * this.
 */
export function tUpper(template: string, extra?: Record<string, string | number>): string {
  return t(template, extra).toUpperCase();
}

export const COPY = {
  // ── Level names ─────────────────────────────────────────────────────────
  levelNames: [
    'Pehli Delivery',
    'Barrel Ka Traffic',
    'Kitchen Mein Kya Chal Raha Hai',
    'Tandoor Se Bacho',
    'Lift Kara De',
    'Thoda Chill, Thoda Grill',
    'Scooter Ki Speed',
    'Doosri Manzil, Doosra Order',
    'Rush Hour, Bhai',
    'Scene Hai Toh Swiggy Hai',
  ] as readonly string[],

  /** One per level, shown on the receipt. Indexed by level - 1. */
  levelPunchline: [
    'Pehli delivery, pehli mithai.',
    'Barrel dodge kiya, order nahi.',
    'Kitchen garam, delivery thandi.',
    'Tandoor se nikle, seedha customer tak.',
    'Lift band thi. Aap nahi ruke.',
    'Belt chala, aap uske upar chale.',
    'Scooter se tez sirf aap.',
    'Doosri manzil? Do minute.',
    'Rush hour mein bhi on time. Respect.',
    'Sab deliver ho gaya. Wahi toh scene hai.',
  ] as readonly string[],

  /** Overrides the per-level line when earned. */
  punchlinePerfect: 'Zero drops. Zero excuses.',
  /** After a rescue or a skip. NEVER scolding — a player who struggled and
   *  finished is a player who finished. */
  punchlineRescued: 'Late hai, par pahunch gaya. Chalega.',

  // ── HUD ─────────────────────────────────────────────────────────────────
  hudTimer: 'DELIVER IN',
  hudLives: 'TRIES',
  hudScore: 'SCORE',
  hudRakhi: '{collectiblePl}',

  // ── HUD, second counter ─────────────────────────────────────────────────
  hudFood: '{order}',

  // ── The gate ────────────────────────────────────────────────────────────
  //
  // The gate now needs BOTH collectibles, so these talk about `{items}` rather
  // than naming one of them. doorLocked/doorUnlocked were dead strings until
  // now — the shutter had no label at all — and this is what they were for.
  doorLocked: 'Poora {order} pehle, doorbell baad mein',
  doorUnlocked: 'Doorbell bajao!',
  gateOpenToast: 'Full {order} — top floor open!',

  // ── Splash ──────────────────────────────────────────────────────────────
  play: 'PLAY',
  howToPlay: 'HOW TO PLAY',
  levels: 'LEVELS',
  highScore: 'BEST',

  // ── Rules ───────────────────────────────────────────────────────────────
  rulesTitle: 'How to play',
  rules: [
    {
      title: 'Climb to the {goal}',
      body: 'Your order is waiting at the top. Ladders are the only way up — you cannot jump between floors.',
    },
    {
      // NAMES BOTH COLLECTIBLES, and it has to.
      //
      // This panel used to say only "Collect every rakhi", which predated food
      // becoming a second REQUIRED objective. A player read it, collected the
      // rakhi, found the door still shut, and had been misled by the tutorial
      // itself — the worst place in a game to be wrong.
      title: 'Collect the {collectible} and the food',
      body: 'The top floor stays shut until you have every one of them — the {collectible} AND the whole order. Plan your route: sweep the floor you are already crossing.',
    },
    {
      title: 'Dodge the {hazardPl}',
      body: '{villain} rolls them down at you. Jump one for points — jump two at once for a lot more.',
    },
    {
      title: 'Grab the {powerup}',
      body: 'For a few seconds you smash anything you touch. It runs out, so spend it moving.',
    },
  ] as readonly { title: string; body: string }[],
  rulesControls: 'Left pad to move and climb. Right button to jump — or swipe up anywhere.',
  rulesStart: 'GOT IT',

  // ── Level select ────────────────────────────────────────────────────────
  levelSelectTitle: 'Pick a stop',
  levelLocked: 'Locked',
  levelBest: 'Best',

  // ── Play ────────────────────────────────────────────────────────────────
  ready: 'GO!',
  paused: 'Paused',
  resume: 'RESUME',
  restart: 'RESTART',
  quit: 'HOME',
  timeUp: 'Order late!',

  // ── Delivered ───────────────────────────────────────────────────────────
  deliveredTitle: 'DELIVERED',
  /**
   * The headline row on the receipt: everything that reached the customer.
   *
   * A literal rather than a vocab template, because it is true under every
   * brand — whatever the collectibles are, they are the items that got
   * delivered. The two rows beneath it name the specifics.
   */
  receiptItems: 'Items delivered',
  receiptRakhis: '{collectiblePl}',
  receiptFood: '{order}',
  receiptBarrels: 'Barrels jumped',
  receiptOnTime: 'On time',
  receiptClear: 'Level clear',
  receiptPerfect: 'Perfect delivery',
  receiptSweep: 'Clean sweep',
  receiptTotal: 'TOTAL',
  nextLevel: 'AGLA ORDER',

  // ── Game over ───────────────────────────────────────────────────────────
  gameOverTitle: 'Out of tries',
  retryPrompt: 'Phir se try karein?',
  continueBtn: 'CONTINUE',
  skipOffer: 'Order cancel karein? Agle stop pe chalein.',
  skipBtn: 'SKIP THIS ONE',

  // ── Game complete ───────────────────────────────────────────────────────
  completeTitle: 'SAARE {items} DELIVERED',
  completeLevels: 'Levels',
  completeRakhis: '{collectiblePl}',
  completeStreak: 'Best streak',
  completePerfect: 'Perfect deliveries',
  completeScore: 'FINAL SCORE',
  shareBtn: 'SHARE',
  playAgain: 'PHIR SE',

  // ── Toasts ──────────────────────────────────────────────────────────────
  toastAirCatch: 'HAWA MEIN CATCH!',
  toastEarlySweep: 'SAB LE LIYA',
  /**
   * The helmet absorbing a hit. Popped over the agent on the frame he would
   * otherwise have died.
   *
   * It names nothing — not the helmet, not the collectible — because the beat is
   * about the player, and "BACH GAYE" is true whatever the guard happened to be.
   */
  toastHelmetSave: 'BACH GAYE!',
  toastDoubleHop: 'DOUBLE!',
  toastTripleHop: 'TRIPLE!',
} as const;
