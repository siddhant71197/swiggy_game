/**
 * ══════════════════════════════════════════════════════════════════════════
 *  SWIGGY — the brand module.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * TO BUILD THIS GAME FOR A DIFFERENT BRAND: copy this directory, edit the
 * values, drop replacement artwork into `public/brand/`, then
 * `BRAND=<slug> npm run build`. Nothing under `src/` changes. That is the
 * whole contract, and `npm run check:brand` is what keeps it true.
 *
 * ─── THE PRIMARY IS #FF5200, NOT #FC8019 ──────────────────────────────────
 *
 * #FC8019 is the PREVIOUS Swiggy identity. It is still what essentially every
 * brand-colour aggregator publishes, so it is what anyone "checking the hex"
 * will find and what a well-meaning contributor will eventually re-introduce.
 *
 * #FF5200 is confirmed by Swiggy's own brandbook (Pantone 021 C) and by
 * sampling the official app icon. It is materially redder and more saturated,
 * so mixing the two generations in one screen does not read as a mistake — it
 * reads as bad printing, which is worse.
 *
 * The build gate fails on #FC8019 appearing anywhere in the repo.
 */

import type {
  BrandAd,
  BrandAnalytics,
  BrandColors,
  BrandCopy,
  BrandIdentity,
  BrandLogo,
  BrandShape,
  BrandType,
  BrandVocabulary,
} from '../../src/brand/types';

export const identity = {
  name: 'Swiggy',
  shortName: 'Swiggy',
  slug: 'swiggy',
  gameTitle: 'DELIVERY CLIMB',
  fullTitle: 'Swiggy Delivery Climb',
  /** The current brand platform line, verbatim. */
  tagline: 'Scene hai toh Swiggy hai.',
  url: 'swiggy.com',
  /** The app deeplink — the CTA's real target, straight to the restaurant list. */
  href: 'swiggy://restaurantList',
  /** The universal fallback: used for sharing, and when the scheme does not
   *  resolve (desktop, or a device without the app). See BrandIdentity.webHref. */
  webHref: 'https://www.swiggy.com',
} satisfies BrandIdentity;

export const colors = {
  primary: '#FF5200',
  primaryHover: '#F04C00',
  primaryPressed: '#E04600',

  /** Amber — the one non-orange accent Swiggy uses at scale (ratings, offers). */
  secondary: '#FFA700',
  secondaryDeep: '#D98D00',

  /** The published orange tint ramp, darkest first. */
  tints: ['#FC5200', '#F58B55', '#F8AE88', '#FAD2BB', '#FDF5EE'],

  paper: '#FFFFFF',
  faint: '#F4F4F5',
  muted: '#ECEBEB',
  line: '#D3D5DF',
  dim: '#9A9DAA',
  subtle: '#686B78',
  strong: '#3D4152',
  /**
   * #02060C, never #000000. Swiggy's ink carries a trace of blue and their
   * palette contains no pure black at all; a true black set beside it reads as
   * a hole punched in the screen rather than as text.
   */
  ink: '#02060C',

  surfaceDark: '#171A29',
  primaryWash: '#FFEEE5',

  informative: '#1BA672',
  positive: '#1BA672',
  caution: '#FFA700',
  negative: '#FA4A5B',

  wordmarkTint: '#FF5200',

  /**
   * THE RAKHI. Gold disc, red gem, pearl beads — because that is what a rakhi
   * IS, not because of anything Swiggy publishes.
   *
   * `outline` is #02060C and it is doing real work: rakhi red (#D42A2A)
   * against Swiggy orange (#FF5200) measures ΔE2000 ≈ 21, which is below the
   * "obviously different at a glance" threshold. Every rakhi carries an ink
   * keyline. Without it, the thing the level REQUIRES you to collect and the
   * thing that kills you are the same colour on an orange girder.
   */
  collectible: {
    body: '#D4AF37',
    highlight: '#F4C430',
    shade: '#A67C00',
    gem: '#D42A2A',
    bead: '#FFF8E7',
    outline: '#02060C',
  },

  /**
   * The cast. A warm mid-brown skin tone, since the game is set in India and
   * its hero is an Indian delivery rider; a near-black hair; and a grey-brown
   * fur for the monkey chosen to sit clearly apart from both the girders'
   * orange and the barrels' slate.
   */
  characters: {
    skin: '#C68642',
    skinShade: '#A06A2C',
    hair: '#1C1712',
    fur: '#7A5C42',
    furDark: '#54402F',
  },

  /**
   * THE MENU. Six items, each with a silhouette the art can make unmistakable
   * and a palette that survives an orange ground.
   *
   * Note what is absent: gold. See the note on BrandColors.foods — the rakhi
   * owns gold in this game because rakhis are what open the door, and a food
   * item that reads as a rakhi breaks the counter the player must trust.
   *
   * FOUR OF THESE SIX ARE BREAD WITH A FILLING — burger, pizza, sub, sandwich —
   * and that is the hardest thing this palette has been asked to do. Baked
   * dough is one narrow band of warm tan, so the tans here are SPREAD ON
   * PURPOSE and each one is minuted below: burger bun palest (#EEB878), pizza
   * crust a shade deeper (#E0A75F), sub roll deeper and browner still
   * (#DFA967), and the sandwich refusing the band altogether at #F7F2E6. That
   * last one is not a fifth tan, it is the ABSENCE of one — pale sliced bread
   * with no crust colour, which is the separation that survives at 22 units
   * when the four silhouettes are all "slab with a stripe in it".
   *
   * The second axis is which ONE of them owns red. The pizza does, alone: its
   * body IS the sauce. The sub carries red only as a thin tomato stripe, the
   * burger and the sandwich carry none. Break that and the two reddest items
   * become the two hardest to tell apart at speed.
   */
  foods: [
    // Burger — the round one, and the item whose four roles have to carry FIVE
    // visible parts. `body` is the BUN, and it is the PALEST of the four tans
    // in this set on purpose: the sub roll below is the same object family
    // (baked dough round a filling) and the two must differ in value as well as
    // in aspect ratio. `shade` is the CHEESE, a cheddar amber that also does
    // the bun's toasting at low alpha; it is pushed ORANGE-ward (~31°) rather
    // than yellow, because a yellow-gold slab in a food is the rakhi's colour
    // and this file's one job is never to draw that. `accent` is LETTUCE — the
    // brightest green in the set, which is what keeps the burger's frill
    // distinct from the sub's deeper lettuce and the sandwich's herb line. The
    // PATTY has no slot of its own: it is mixed from `shade` toward `outline`
    // in the art, which is why no fifth token is needed here.
    { body: '#EEB878', shade: '#E08A22', accent: '#6FBF3C', outline: '#02060C' },
    // Pastry — pink frosting, cream layers (`shade`), a red glacé cherry. The
    // cream is held in `shade` rather than `accent` because the cherry needs
    // the accent slot: it is the one mark that names this slice.
    { body: '#F49CB8', shade: '#FFF3E3', accent: '#E0293F', outline: '#02060C' },
    // Motichoor laddu — SAFFRON-ORANGE, and deliberately not marigold-yellow.
    // This is the one dish in the set that shares the rakhi's shape family, so
    // its hue is pushed warm and RED-ward (~30°), a long way from the reward
    // palette's #D4AF37 / #F4C430 (~44°): a gold-yellow ball would be a rakhi
    // with the threads cut off. `shade` is the boondi shadow the granular
    // texture is stippled in — granularity is what tells this from a smooth
    // medallion at speed. `accent` is a COOL pale paper case, the one cold
    // value in the drawing, which is what stops the ball dissolving into the
    // Swiggy-orange girder it sits on.
    { body: '#E4761B', shade: '#9E430A', accent: '#E6E9F3', outline: '#02060C' },
    // Pizza — THE ONLY RED-DOMINANT ITEM IN THE SET, and that exclusivity is
    // the separation. `body` is the SAUCE and it is the biggest area in the
    // drawing, so a pizza wedge is a red object where the other three bread
    // items are tan objects; nothing else here is allowed to take that.
    // #C33A26 is pushed BRICK-ward — browner and darker than the rakhi's gem
    // (#D42A2A) and than the pastry's cherry (#E0293F) — because the one red
    // this game cannot lend out is the gem's. `shade` is the CRUST, a tan that
    // sits between the burger's bun and the sub's roll. `accent` is the melted
    // CHEESE, a pale cream rather than a yellow: mozzarella drawn in yellow is
    // the rakhi's hue arriving through the back door. The PEPPERONI has no slot
    // — it is `body` mixed toward `outline` in the art, which is exactly the
    // relationship sauce and salami have on a real slice.
    { body: '#C33A26', shade: '#E0A75F', accent: '#FFE9C4', outline: '#02060C' },
    // Sub sandwich — NOT named for anybody's chain, and drawn as a generic long
    // roll. `body` is the ROLL, and it is the CRUMB rather than the crust: the
    // baked outside of both halves is an ink wash laid over it in the art,
    // which lands near #C29A62 and puts the sub visibly deeper than the
    // burger's #EEB878 — the two items that most resemble each other must not
    // also share a value. `shade` is TOMATO, and it does two ingredients: the
    // slices themselves, and the MEAT LINE, which is this red mixed back toward
    // the roll to a warm salmon. That mix is what buys a three-colour filling
    // without a fifth slot. `accent` is LETTUCE, deliberately DEEPER than the
    // burger's #6FBF3C: the two items that both show a green frill must not
    // show the same green.
    { body: '#E4B071', shade: '#D63B2C', accent: '#4E9B2C', outline: '#02060C' },
    // Sandwich — PALE SLICED BREAD WITH NO CRUST COLOUR, and the paleness does
    // as much work as the shape. Every other bread item here is warm tan;
    // #F7F2E6 is barely tinted at all, so at 22 units on an orange girder this
    // is the WHITE item and no amount of blur makes it a pizza or a sub.
    // `shade` is a COOL grey-blue: it tints the back half so the two triangles
    // separate, and being cold is the point — a warm shadow would put the tan
    // straight back in. `accent` is the filling, a single herb green, and the
    // filling is single-coloured ON PURPOSE where the sub's is three-coloured.
    { body: '#F7F2E6', shade: '#C3C9D9', accent: '#5EA733', outline: '#02060C' },
  ],

  accents: [
    '#FF5200',
    '#FFA700',
    '#1BA672',
    '#FA4A5B',
    '#F58B55',
    '#F8AE88',
    '#FAD2BB',
    '#FDF5EE',
    '#171A29',
    '#686B78',
    '#D3D5DF',
    '#EEF0F5',
  ],

  roles: {
    /** Rakhi gold, rakhi highlight, the unlock flash. */
    reward: ['#D4AF37', '#F4C430', '#FFA700'],
    /**
     * Barrels, fire, the wild barrel. FILLED, unlike the sibling maze game's,
     * because here a hazard and a reward share the frame and hue IS the read.
     */
    hazard: ['#3D4152', '#171A29', '#FA4A5B'],
    neutral: ['#FFFFFF', '#EEF0F5', '#686B78', '#02060C'],
  },
} satisfies BrandColors;

export const type = {
  /**
   * Gilroy is Swiggy's face and it is commercial — it cannot ship. POPPINS is
   * the nominated free substitute: the same geometric sans skeleton, near
   * circular 'o', single-storey 'a', and a weight range wide enough to carry
   * the same hierarchy. It is SELF-HOSTED from public/fonts as three subset
   * woff2 files, so it is an asset rather than a network dependency and the
   * game works offline.
   *
   * Gilroy stays in the stack ahead of it: on a machine that legitimately has
   * it installed, the real face wins.
   */
  stack: '"Poppins", "Gilroy", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  /**
   * EXACTLY the three weights public/fonts ships. Do not add 600: it is not
   * there, and asking for it makes the browser synthesise a smeared faux-bold
   * that reads as a rendering bug rather than as a missing file.
   */
  weights: { body: 400, mid: 500, display: 800 },
  /** Swiggy sets display type tight — ×1.1 — and that tightness is the look. */
  leading: { display: 1.1, body: 1.4 },
  shadow: '0 3px 15px 0 rgba(40, 44, 63, 0.3)',
  shadowSoft: '0 2px 8px rgba(2, 6, 12, 0.2)',
} satisfies BrandType;

export const shape = {
  card: 14,
  button: 10,
  pill: 999,
  /** The superellipse exponent that matches the emblem's plate. */
  squircle: 4.2,
} satisfies BrandShape;

export const ad = {
  headline: 'Rakhi delivered in 10 minutes',
  subline: 'Instamart has 100+ rakhis. Your cousin is waiting.',
  cta: 'Order now',
} satisfies BrandAd;

export const vocab = {
  hero: 'delivery partner',
  heroShort: 'partner',
  villain: 'the monkey',
  goal: 'customer',
  collectible: 'rakhi',
  collectiblePl: 'rakhis',
  /** Same order as colors.foods — the gate asserts the lengths match. */
  foods: [
    'Burger',
    'Pastry',
    'Motichoor Laddu',
    'Pizza',
    // NOT "Subway". The chain is a trademark, and a competitor's name inside a
    // Swiggy-branded game implies a partnership that does not exist. The item
    // is the shape, not the shop.
    'Sub Sandwich',
    'Sandwich',
  ],
  order: 'order',
  items: 'items',
  hazard: 'tiffin drum',
  hazardPl: 'tiffin drums',
  powerup: 'masala shaker',
  deliverVerb: 'Deliver',
  ctaShort: 'Order now',
} satisfies BrandVocabulary;

export const copy = {
  bootLine: 'Picking up your order…',
  splashKicker: 'Swiggy karo, phir jo chahe karo.',
  winLine: 'Delivered. Rate your partner 5 stars.',
  loseLine: 'Order cancelled. The monkey is not sorry.',
  /** Swiggy's real Raksha Bandhan campaign line, and the only place it appears. */
  easterEgg: 'Happy Rakhi! (But is Rakhi happy?)',
  a11y:
    'Swiggy Delivery Climb. Climb the girders as a Swiggy delivery partner, ' +
    'collect every rakhi, dodge the tiffin drums the monkey rolls down, and ' +
    'reach the customer waiting at the top before the delivery clock runs out.',
  shareText: 'I delivered every rakhi in Swiggy Delivery Climb. Beat my score:',
} satisfies BrandCopy;

/**
 * ─── ONE FILE, SEVERAL CUTS ────────────────────────────────────────────────
 *
 * The brand supplied a single horizontal lockup. Rather than re-encoding crops
 * of it (lossy, and the crop numbers end up as magic constants in a shell
 * command nobody keeps) or hand-drawing the emblem (which is how a subtly wrong
 * trademark gets shipped), every cut below is a declared sub-rectangle of that
 * authentic file.
 *
 * The fractions were MEASURED off the artwork's alpha channel, not eyeballed:
 *   plate    x  80…377  y  17…311   →  298 × 295 px, aspect 1.0102
 *   wordmark x 452…1062 y  93…269   →  611 × 177 px, aspect 3.4520
 * against a 1143 × 333 source. The plate is 1% off square, which is real and
 * is why `aspect` says 1.0102 rather than 1 — declaring it square would blit it
 * 1% wide forever.
 */
export const logo = {
  /** The full lockup. Splash hero, ad banner, masthead. */
  mark: {
    src: './brand/logo-lockup.png',
    aspect: 1143 / 333,
    // The lockup contains the filled plate, so it is opaque too: only the
    // wordmark cut is line art and therefore the only cut a knockout suits.
    opaque: true,
  },

  wordmark: {
    src: './brand/logo-lockup.png',
    aspect: 611 / 177,
    rect: { sx: 452 / 1143, sy: 93 / 333, sw: 611 / 1143, sh: 177 / 333 },
  },

  /** The emblem on its plate — the app-icon cut. */
  square: {
    src: './brand/logo-lockup.png',
    aspect: 298 / 295,
    rect: { sx: 80 / 1143, sy: 17 / 333, sw: 298 / 1143, sh: 295 / 333 },
    // The plate is filled, so this cut cannot be knocked out — see AssetRef.opaque.
    opaque: true,
  },

  /**
   * The backpack emblem — the same cut as `square`, and that is correct rather
   * than lazy.
   *
   * The supplied artwork has the pin knocked out of the plate in white, so the
   * pin does not exist as separable transparent art and could only be obtained
   * by redrawing it. It also does not need to be: a real Swiggy delivery bag
   * carries the plated emblem, so an orange square with a white pin on the
   * backpack is what the thing actually looks like.
   */
  emblem: {
    src: './brand/logo-lockup.png',
    aspect: 298 / 295,
    rect: { sx: 80 / 1143, sy: 17 / 333, sw: 298 / 1143, sh: 295 / 333 },
    opaque: true,
  },

  favicon: { src: './brand/favicon.svg', aspect: 1 },

  /**
   * The location-pin silhouette, generalised. Drawn only before the artwork has
   * decoded, and at sizes where no raster resolves.
   *
   * SOLID-FILLED AND NEVER OUTLINED — that is a published guideline, not a
   * preference, which is why the shape vocabulary has no stroked variant to
   * pick by accident.
   */
  /**
   * Insets measured against the real artwork rather than guessed: in the
   * supplied plate the pin occupies roughly 46% of the plate's width and 66% of
   * its height, which is what makes it read as a location pin rather than as a
   * balloon.
   *
   * The two numbers are far apart on purpose, and the gap is the whole point of
   * `insetX`/`insetY` being separate. An earlier pass used 0.18/0.14 — nearly
   * square — and the resulting head was so large relative to its tail that the
   * tangent solve produced a 37° taper and the mark came out bulbous. At 0.27 /
   * 0.17 the taper is 58° and the silhouette matches the artwork it stands in
   * for.
   */
  fallback: { shape: 'pin-squircle', insetX: 0.27, insetY: 0.17 },

  /** Swiggy's signature device: the pin silhouette used as a content mask. */
  maskable: true,

  /**
   * The official app icon is a white emblem on orange, so a one-colour cut is a
   * legitimate use of this mark and the renderer may knock it out to `paper` or
   * `ink`. It may not tint it to anything else — see BrandLogo.knockout.
   */
  knockout: true,
} satisfies BrandLogo;

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  ANALYTICS — this brand's own GA4 property.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Here rather than in index.html so a second brand gets its own property by
 * copying a directory, and so a brand with no property simply omits this key
 * and loads no third-party script at all. src/ui/analytics.ts reads it.
 */
export const analytics = {
  measurementId: 'G-XJLK9LRW86',
} satisfies BrandAnalytics;

/**
 * NO OVERRIDES, which is the outcome to aim for.
 *
 * The one place this game departs from swiggy.com — an orange PLAYFIELD rather
 * than orange chrome on a white page — is not a Swiggy-specific decision and
 * lives in the derivation, where the next brand inherits it.
 */
export const theme: Readonly<Record<string, string>> = {};
