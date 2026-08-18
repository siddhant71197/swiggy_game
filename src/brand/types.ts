/**
 * ══════════════════════════════════════════════════════════════════════════
 *  BRAND MODULE — the contract a brand fills in.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: a "modular" brand system in which the second
 * brand costs as much as the first. A re-skin that expensive does not happen,
 * which would make "modular" a claim rather than a capability.
 *
 * So a brand supplies PRIMITIVES — about twenty-five colours, a name, a logo
 * set, a handful of strings. The GAME derives the ninety-odd semantic tokens it
 * actually paints with, in src/brand/theme.ts.
 *
 *   A brand says what its colours ARE. The game says where they GO.
 *
 * The alternative — each brand declaring all ninety — also puts a hundred
 * decisions about THIS GAME (which surface is elevated, which button is the
 * hero) into a file about a BRAND, where the next brand has to re-derive them
 * from scratch and will get some of them wrong.
 *
 * ─── THE NEUTRAL LADDER IS NAMED BY ROLE, NOT BY HUE ───────────────────────
 *
 * `paper … ink`, not `white … black` and not `grey100 … grey700`. A brand whose
 * neutrals are warm greys, or which inverts to a dark ground, fills the same
 * eight slots and every screen keeps working. Naming them by lightness would
 * make a dark brand's `grey100` a dark colour, which reads as a bug forever
 * after.
 */

// ─── Assets ─────────────────────────────────────────────────────────────────

/**
 * One piece of artwork.
 *
 * `aspect` is width / height and it is REQUIRED, not optional, because the
 * build gate sniffs the real file's header and fails when the declared ratio
 * has drifted. A logo blitted at the wrong ratio is the most common way a
 * re-skin ships looking subtly wrong, and it is invisible in a text diff.
 *
 * ─── WHY `rect` EXISTS ─────────────────────────────────────────────────────
 *
 * Real brand artwork usually arrives as ONE horizontal lockup file containing
 * several cuts — an emblem, a gap, a wordmark. `rect` names a sub-rectangle of
 * `src` in FRACTIONS of the source image, so the emblem and the wordmark are
 * declarations over the authentic artwork rather than two more files.
 *
 * That matters more than it sounds. The alternatives were to re-encode crops
 * (lossy, and the crop boundaries become undocumented magic numbers living in
 * a shell command nobody kept) or to hand-author a vector of the mark — which
 * is how a subtly-wrong trademark gets shipped by someone who was trying to be
 * helpful. Neither survives contact with a brand's legal review; a declared
 * sub-rectangle of the file they gave you does.
 *
 * Omitted means "the whole image".
 */
export interface AssetRef {
  readonly src: string;
  /** width / height OF THE CUT — i.e. of `rect` when one is given, not of the file. */
  readonly aspect: number;
  /** Sub-rectangle of `src`, as fractions in 0..1. Omit for the whole image. */
  readonly rect?: {
    readonly sx: number;
    readonly sy: number;
    readonly sw: number;
    readonly sh: number;
  };

  /**
   * DOES THIS CUT HAVE AN OPAQUE BACKGROUND?
   *
   * True for a plated cut — an emblem sitting on a filled tile — and false or
   * absent for line art on transparency, like a wordmark.
   *
   * It exists to make one specific mistake impossible. A knockout re-cuts
   * artwork in a single colour by tinting its ALPHA, so it only shows anything
   * where the source is transparent. Ask for a paper knockout of a PLATED cut
   * and you get a flat white tile: no error, no warning, just a mark that has
   * silently become a blank rounded square. That failure was made three
   * separate times while building this game — on the splash, in the dev
   * harness, and in the play masthead — by three different authors each
   * reasoning, correctly, that "the artwork is orange and the ground is orange,
   * so it needs the knockout".
   *
   * With this declared, drawMark/drawEmblem throw in dev and name the fix
   * instead. The right move on a brand-coloured ground is a paper plate under
   * the natural artwork, which is also what the brand's own guidelines ask for.
   */
  readonly opaque?: boolean;
}

// ─── Identity ───────────────────────────────────────────────────────────────

export interface BrandIdentity {
  /** As written in prose. 'Swiggy'. */
  readonly name: string;
  /** For tight spaces. May equal `name`. */
  readonly shortName: string;
  /**
   * Lowercase, no spaces. THE DERIVATION SOURCE for the localStorage key and
   * the history-state discriminator. Two brands built from this template must
   * not share a save slot on a device that has played both.
   */
  readonly slug: string;
  /** The game's own name, without the brand. 'DELIVERY CLIMB'. */
  readonly gameTitle: string;
  /** Brand and game together, as the <title> and the splash want it. */
  readonly fullTitle: string;
  readonly tagline: string;
  /** Display form, for a footer. 'swiggy.com'. */
  readonly url: string;
  /**
   * WHERE THE CTA GOES, and it may be an app deeplink.
   *
   * A branded game is an acquisition unit, so the button wants to land the
   * player inside the app rather than on a web page — `swiggy://restaurantList`
   * rather than `https://…`. That is the whole point of the CTA.
   */
  readonly href: string;
  /**
   * THE SAME DESTINATION, AS A UNIVERSAL WEB URL. Never a custom scheme.
   *
   * Two jobs, and both break if `href` is reused for them:
   *
   *   SHARING. A share goes to SOMEBODY ELSE, by definition — a person who may
   *   not have the app, on a device that has never heard of the scheme. A
   *   `swiggy://` link pasted into a chat is a dead string, and the share is the
   *   one place the brand reaches a NEW person.
   *
   *   FALLBACK. A custom scheme does nothing in a desktop browser, which is
   *   exactly where this unit gets reviewed. A CTA that silently does nothing
   *   for the reviewer is a CTA that gets reported as broken.
   *
   * A brand with no app points this at the same value as `href`.
   */
  readonly webHref: string;
}

// ─── Colour ─────────────────────────────────────────────────────────────────

export interface BrandColors {
  /** The brand's own colour. Masthead, chrome, the thing it is known for. */
  readonly primary: string;
  readonly primaryHover: string;
  readonly primaryPressed: string;

  /**
   * The second brand colour — used for emphasis and delight rather than for
   * chrome. A brand with only one colour points this at `primary`.
   */
  readonly secondary: string;
  readonly secondaryDeep: string;

  /**
   * The primary's TINT RAMP, darkest first, five steps.
   *
   * Used for the stage backdrop and every ambient wash. A brand with no
   * published ramp repeats `primary` five times: every gradient then flattens
   * to a solid rather than breaking.
   */
  readonly tints: readonly [string, string, string, string, string];

  /** Neutral ladder, lightest surface through darkest ink. Eight steps. */
  readonly paper: string;
  readonly faint: string;
  readonly muted: string;
  readonly line: string;
  readonly dim: string;
  readonly subtle: string;
  readonly strong: string;
  readonly ink: string;

  /** A dark SURFACE that is not `ink` — panels, the shutter, the night stage. */
  readonly surfaceDark: string;
  /** The pale wash of `primary`, for selected rows and tinted cards. */
  readonly primaryWash: string;

  /** Meaning, never decoration. */
  readonly informative: string;
  readonly positive: string;
  readonly caution: string;
  readonly negative: string;

  /**
   * The colour INSIDE the shipped wordmark artwork, when it differs from
   * `primary`. Real logo files disagree with real brand stylesheets more often
   * than anyone expects. The vector fallback stands in for that artwork, so it
   * has to match the artwork rather than the token, or fallback and asset
   * differ by a hair with no explanation anywhere.
   */
  readonly wordmarkTint: string;

  /**
   * THE COLLECTIBLE'S OWN PALETTE.
   *
   * Here rather than derived because the rakhi is a CULTURAL object, not a
   * brand object: it is gold-and-red because a rakhi is gold-and-red. Deriving
   * it from the brand's primary would produce an orange rakhi under Swiggy and
   * a teal one under the next brand, and both would simply be wrong.
   *
   * `outline` is LOAD-BEARING, not decoration. Rakhi red against Swiggy orange
   * measures ΔE2000 ≈ 21 — under the threshold at which two things read as
   * obviously different at a glance. Without a keyline, the object you must
   * collect and the object that kills you are the same colour. A brand whose
   * primary is nowhere near red still ships one: the outline is what makes the
   * collectible read at 24px against any ground.
   */
  readonly collectible: {
    readonly body: string;
    readonly highlight: string;
    readonly shade: string;
    readonly gem: string;
    readonly bead: string;
    readonly outline: string;
  };

  /**
   * THE CAST, as colours — skin, hair, and the villain's fur.
   *
   * Here for the same reason `collectible` is: these are REPRESENTATIONAL
   * values, not brand values. A person's skin is not a tint of a food-delivery
   * company's orange, and deriving it from `primary` would produce an orange
   * courier under Swiggy and a teal one under the next brand.
   *
   * They live in the brand module rather than in the game's config for the
   * boring reason that the gate forbids colour literals under `src/`, and for
   * the better reason that a brand operating in a different market may well
   * want a different default cast. Every brand fills the same five slots.
   */
  readonly characters: {
    readonly skin: string;
    readonly skinShade: string;
    readonly hair: string;
    readonly fur: string;
    readonly furDark: string;
  };

  /**
   * THE ORDER — one palette per dish the courier can be asked to deliver.
   *
   * BRAND content, not game content, and that is the whole reason it lives here:
   * Swiggy delivers biryani and dosa, and the next brand delivers something
   * else. Putting the menu in the GAME would mean a grocery re-skin shipping a
   * tower full of curry.
   *
   * DELIBERATELY NOT GOLD-FORWARD, and this is a constraint rather than a
   * preference. The rakhi is the gold object in this game, and rakhis are what
   * unlock the door — so a required food item that reads as a rakhi at 22 units
   * corrupts the one counter the player has to be able to trust. Greens,
   * browns, creams and a syrup-dark do the work instead.
   *
   * `accent` is the single distinguishing mark — a garnish, a filling, a rim.
   * `outline` is load-bearing for the same reason the collectible's is: the
   * tower is orange, and warm food on a warm ground disappears without a
   * keyline. Any length ≥ 1; a level's `kind` index wraps.
   */
  readonly foods: readonly {
    readonly body: string;
    readonly shade: string;
    readonly accent: string;
    readonly outline: string;
  }[];

  /**
   * Decorative tints for stage skins. Any length ≥ 1; the derivation cycles
   * through them, so a brand with three still works.
   */
  readonly accents: readonly string[];

  /**
   * WHAT THE GAME REWARDS AND WHAT IT PUNISHES, as colours.
   *
   * The build gate measures every `hazard` against every `reward` and fails
   * when a punishing colour sits close enough to a rewarding one to be chased
   * by mistake.
   *
   * THIS GAME FILLS BOTH BUCKETS, and that is worth saying because the sibling
   * maze game deliberately leaves `hazard` empty. Here a barrel you must not
   * touch and a rakhi you must collect occupy the same thirty pixels of screen,
   * and telling them apart IS the moment-to-moment read.
   */
  readonly roles: {
    readonly reward: readonly string[];
    readonly hazard: readonly string[];
    readonly neutral: readonly string[];
  };
}

// ─── Type ───────────────────────────────────────────────────────────────────

export interface BrandType {
  /**
   * The CSS font stack, verbatim. Written out in full rather than as a generic
   * system list, so a brand that nominates real faces gets them, and so no
   * other file grows its own copy.
   */
  readonly stack: string;
  readonly mono: string;
  /**
   * The weights this brand's stack ACTUALLY SHIPS.
   *
   * Declared because the failure is silent: ask for a weight the family does
   * not contain and the browser synthesises it, producing a visibly smeared
   * faux-bold that looks like bad rendering rather than like a missing file.
   */
  readonly weights: {
    readonly body: number;
    readonly mid: number;
    readonly display: number;
  };
  /** Line-height multipliers. Some brands set display far tighter than the web default. */
  readonly leading: { readonly display: number; readonly body: number };
  /**
   * The brand's entire shadow vocabulary. Canvas may not use shadows at all
   * (shadowBlur is the Android frame-budget cliff), so these reach only the DOM
   * ad frame and the desktop phone bezel. A brand that is flat sets 'none'.
   */
  readonly shadow: string;
  readonly shadowSoft: string;
}

// ─── Shape ──────────────────────────────────────────────────────────────────

/**
 * The corner language, which is brand-owned and not a game decision. A brand
 * that is square sets card and button to 0 and `squircle` to 2.
 */
export interface BrandShape {
  readonly card: number;
  readonly button: number;
  readonly pill: number;
  /**
   * Superellipse exponent for the logo plate and hero surfaces. 2 is a plain
   * ellipse/rounded-rect; ~4 is the continuous-curve "squircle" that iOS and
   * Swiggy both use. Wrong here and the mark's plate is subtly the wrong shape
   * in a way people notice without being able to name.
   */
  readonly squircle: number;
}

// ─── Ad slot ────────────────────────────────────────────────────────────────

/** The house creative shown until a live ad tag is wired in. */
export interface BrandAd {
  readonly headline: string;
  readonly subline: string;
  readonly cta: string;
}

// ─── Vocabulary ─────────────────────────────────────────────────────────────

/**
 * THE WORDS THIS BRAND USES FOR THE GAME'S NOUNS AND VERBS.
 *
 * Separate from `copy` because these are SUBSTITUTED INTO game sentences rather
 * than being whole sentences. src/config/copy.ts writes "Collect every {c}" one
 * time and the brand supplies the noun.
 *
 * That is the difference between a re-skin costing four values and a re-skin
 * costing forty rewritten strings — and a re-skin that costs forty strings is
 * one that gets done badly under time pressure, or not at all.
 */
export interface BrandVocabulary {
  readonly hero: string;
  readonly heroShort: string;
  readonly villain: string;
  readonly goal: string;
  readonly collectible: string;
  readonly collectiblePl: string;
  /**
   * The dishes, in the SAME ORDER as `colors.foods`. The build gate asserts the
   * two arrays are the same length — a brand that adds a sixth dish and forgets
   * to name it would otherwise ship a blank line on the receipt.
   */
  readonly foods: readonly string[];
  /** What a full set of them is called. 'order'. */
  readonly order: string;
  /** Rakhis and food together, as the player is asked to think of them. 'items'. */
  readonly items: string;
  readonly hazard: string;
  readonly hazardPl: string;
  readonly powerup: string;
  readonly deliverVerb: string;
  readonly ctaShort: string;
}

// ─── Copy that carries the brand's name ─────────────────────────────────────

/**
 * ONLY the strings that literally contain the brand, or that would be a LIE
 * about it. Everything else the game says lives in src/config/copy.ts, because
 * it is the GAME talking, not the brand, and it should not be re-authored per
 * brand.
 *
 * The test: would this string be FALSE under a different brand, or merely
 * flavourless? "Picking up your order…" survives a re-skin. "Scene hai toh
 * Swiggy hai" does not.
 */
export interface BrandCopy {
  /**
   * The line under the boot splash.
   *
   * Here rather than in the game's copy for a mechanical reason as well as an
   * editorial one: it paints in index.html BEFORE the module graph runs, so it
   * can only come from a value the build can substitute statically — and the
   * only such values are the brand module's.
   */
  readonly bootLine: string;
  readonly splashKicker: string;
  readonly winLine: string;
  readonly loseLine: string;
  /** Fires once per run on a seeded roll. Pure brand flavour. */
  readonly easterEgg: string;
  /** The canvas's accessible description. Names the brand, so it lives here. */
  readonly a11y: string;
  /** Share-sheet text. Contains the brand and the URL, so it cannot be generic. */
  readonly shareText: string;
}

// ─── Logo ───────────────────────────────────────────────────────────────────

export type ThemeToken = string;

/**
 * Artwork. `mark` and `favicon` are the only required cuts — everything else
 * degrades to `mark`, and `mark` degrades to `fallback`. A brand with one image
 * and one favicon is a complete brand.
 */
export interface BrandLogo {
  /** The full lockup: emblem + wordmark. The splash and the ad banner use this. */
  readonly mark: AssetRef;
  /** The wordmark alone. */
  readonly wordmark?: AssetRef;
  /** The emblem on its plate — the app-icon cut. */
  readonly square?: AssetRef;
  /**
   * The emblem ALONE, no wordmark and no plate. This is what gets embossed on
   * the delivery backpack, at sizes where a wordmark would be a grey smudge.
   */
  readonly emblem?: AssetRef;
  readonly favicon: AssetRef;

  /**
   * The emblem as an inline SVG string, decoded to a data URI at runtime.
   *
   * Worth the bytes only for a mark small enough to inline: an asset that
   * cannot fail to load cannot leave a frame without a mark on it, which is
   * what matters for the first few frames of a cold connection. Above a couple
   * of KB, ship the file and let `fallback` cover the gap.
   */
  readonly inline?: string;

  /**
   * WHAT TO DRAW BEFORE ANY IMAGE HAS DECODED, and at sizes at which no image
   * would resolve — the backpack emblem is about six CSS pixels wide.
   *
   * DECLARED rather than coded, and this is the single most important line in
   * the whole brand system. A hand-authored vector of one brand's mark is the
   * least swappable thing a swappable brand system can contain: draw Swiggy's
   * pin geometry as arithmetic in the renderer and the next brand inherits a
   * Swiggy-shaped logo in its own colours, which no amount of config will fix.
   *
   *   'pin-squircle'   a `primary` squircle carrying a SOLID teardrop pin in
   *                    `paper`. The location-pin silhouette, generalised.
   *   'plate-wordmark' a `primary` rect with `shortName` set across it in
   *                    `paper`. THE DEFAULT — every brand has a name, and not
   *                    every brand has a lozenge.
   *   'plate-ellipse'  a `primary` rect with an inset `secondary` ellipse.
   *   'disc-initial'   a `primary` circle with the brand's initial in `paper`.
   *
   * Insets are FRACTIONS OF THE BOX, and they are two numbers rather than one
   * because real marks are anisotropic; collapsing them to a single inset reads
   * as slightly wrong to anyone who knows the mark, in a way they cannot name.
   */
  readonly fallback?: {
    readonly shape: 'pin-squircle' | 'plate-wordmark' | 'plate-ellipse' | 'disc-initial';
    readonly insetX?: number;
    readonly insetY?: number;
  };

  /**
   * MAY THE EMBLEM BE USED AS A CLIPPING MASK for colour or photo content?
   *
   * Swiggy's own guidelines say yes and it is their signature device. Plenty of
   * brands forbid exactly this. Declared so the renderer can ASK rather than
   * assume, and so a brand that forbids it quietly gets a plain rounded card
   * instead of a guideline violation shipped inside a game.
   */
  readonly maskable?: boolean;

  /**
   * MAY THE MARK BE RE-CUT IN A SINGLE FLAT COLOUR (knockout / inverse)?
   *
   * Distinct from `maskable`. Most brands publish a one-colour inverse lockup
   * for use on their own primary — Swiggy's app icon is exactly that, a white
   * emblem on orange — but a brand with a multi-colour mark has no legitimate
   * one-colour cut, and flattening it would destroy the mark.
   *
   * When true, the renderer may tint the artwork's alpha to `paper` or `ink`
   * ONLY. It may never tint it to an arbitrary colour: that is recolouring the
   * logo, which every brand in the world forbids.
   */
  readonly knockout?: boolean;
}

// ─── Analytics ──────────────────────────────────────────────────────────────

/**
 * WHERE THIS BRAND'S NUMBERS GO.
 *
 * Per-brand rather than per-build, because the property belongs to the brand's
 * own marketing team: two brands sharing one measurement ID means their traffic
 * is merged into one report and neither can be read on its own. Optional,
 * because a brand with no property should ship a game that simply never loads a
 * third-party script — not one that fails to build.
 */
export interface BrandAnalytics {
  /** A GA4 measurement ID, `G-XXXXXXXXXX`. */
  readonly measurementId: string;
}

// ─── The module ─────────────────────────────────────────────────────────────

/**
 * WHAT A BRAND DIRECTORY EXPORTS — one named export per section.
 *
 * Named exports rather than one default object, and that is not a style choice.
 * The build gate and the index.html substituter both read these files
 * STATICALLY, without executing them, using the same reader
 * (tools/lib/brand-read.mjs). That reader understands top-level `const`
 * declarations; a default-exported object literal flattens to nothing, and the
 * gate then reports a brand with zero paths and every rule "not applicable" —
 * a green build that checked precisely nothing.
 *
 * Each section carries its own `satisfies`, so a brand that gets one wrong
 * fails typecheck at that section rather than at the whole file.
 */
export interface BrandModule {
  readonly identity: BrandIdentity;
  readonly colors: BrandColors;
  readonly type: BrandType;
  readonly shape: BrandShape;
  readonly ad: BrandAd;
  readonly vocab: BrandVocabulary;
  readonly copy: BrandCopy;
  readonly logo: BrandLogo;
  /** Omit entirely and the game loads no analytics script at all. */
  readonly analytics?: BrandAnalytics;

  /**
   * PER-TOKEN ESCAPE HATCH, and it should stay nearly empty.
   *
   * The derivation in src/brand/theme.ts is good for most brands and wrong for
   * some — a brand whose secondary is too dark to carry ink text, say. Rather
   * than growing a special case per brand in the derivation, that brand names
   * the two or three tokens it wants different.
   *
   * If this map is getting long for a brand, the DERIVATION is wrong and should
   * be fixed for everyone instead.
   */
  readonly theme?: Readonly<Record<string, ThemeToken>>;
}
