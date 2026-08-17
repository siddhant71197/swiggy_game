/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE DERIVATION — where the brand's colours GO.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: every screen reaching into `brand.colors` and
 * deciding for itself what "the elevated surface" or "the hero button" means.
 * Do that and the second brand needs forty screens re-audited, six of which get
 * missed, and the re-skin ships with a white-on-amber CTA nobody can read.
 *
 * ─── THE RULE, AND IT IS ABSOLUTE ─────────────────────────────────────────
 *
 * THERE IS NOT ONE COLOUR LITERAL IN THIS FILE. Every value on the right-hand
 * side is a reference into the brand module or a mix of two of them. The build
 * gate greps this file for `#` and fails on a hit, because a single literal
 * here is a colour that silently survives a re-skin — and it will be the one
 * colour nobody thinks to check.
 *
 * Screens read these tokens. Screens never read `brand.colors`.
 */

import type { BrandModule } from './types';

// ─── Colour arithmetic ──────────────────────────────────────────────────────
//
// Exported so that no file anywhere in the game writes an `rgba()` literal or
// hand-mixes two hexes. A one-off `rgba(0,0,0,.4)` scrim is the most common way
// a "fully themed" build turns out to have a hard-coded black in it.

function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

const clamp255 = (n: number): number => (n < 0 ? 0 : n > 255 ? 255 : Math.round(n));

/** `hex` at `a` opacity, as a CSS rgba() string. */
export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Linear blend: t = 0 gives `a`, t = 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = clamp255(r1 + (r2 - r1) * t);
  const g = clamp255(g1 + (g2 - g1) * t);
  const bl = clamp255(b1 + (b2 - b1) * t);
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Relative luminance, and the reason it is here rather than in a maths module:
 * two tokens below CHOOSE between ink and paper based on what the brand's own
 * colour can carry. A brand whose primary is pale gets ink text on its CTA
 * without having to know it asked for that.
 */
function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Whichever of `paper`/`ink` contrasts better against `on`. */
function readableOn(on: string, paper: string, ink: string): string {
  return luminance(on) > 0.45 ? ink : paper;
}

// ─── The token set ──────────────────────────────────────────────────────────

export interface Theme {
  // App chrome
  appBg: string;
  frameBezel: string;
  frameScreen: string;
  masthead: string;
  mastheadRule: string;
  mastheadText: string;

  // Surfaces
  surface: string;
  surfaceQuiet: string;
  surfaceSunken: string;
  surfaceTinted: string;
  surfaceDark: string;
  border: string;
  borderStrong: string;
  borderSelected: string;

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  textOnPrimary: string;
  textOnGold: string;

  // Buttons
  btnHero: string;
  btnHeroText: string;
  btnHeroPressed: string;
  btnSecondary: string;
  btnSecondaryBorder: string;
  btnSecondaryText: string;
  btnSecondaryPressed: string;
  btnGhostText: string;
  btnDisabled: string;
  btnDisabledText: string;
  btnOnBrand: string;
  btnOnBrandText: string;
  btnOnBrandPressed: string;
  btnOutlineOnBrandBorder: string;
  btnOutlineOnBrandText: string;
  btnGhostOnBrandText: string;

  // Stage — the world
  stageSkyTop: string;
  stageSkyBottom: string;
  stageVignette: string;
  stageWatermark: string;
  girderTop: string;
  girderFace: string;
  girderEdge: string;
  girderRivet: string;
  girderBeltA: string;
  girderBeltB: string;
  ladderRail: string;
  ladderRung: string;
  ladderShadow: string;
  ladderBrokenCap: string;
  liftCage: string;
  liftCable: string;
  liftTrim: string;
  pinIdle: string;
  pinPushed: string;
  oilSlick: string;
  springCoil: string;
  flameBody: string;
  flameCore: string;
  flameHot: string;
  flameOutline: string;
  hazardCaution: string;
  chuteBody: string;
  chuteMouth: string;
  shakerBody: string;
  shakerCap: string;
  powerupGo: string;
  powerupGuard: string;

  // The agent
  agentShirt: string;
  agentShirtShade: string;
  agentBand: string;
  agentTrouser: string;
  agentTrouserShade: string;
  agentSkin: string;
  agentSkinShade: string;
  agentHelmet: string;
  agentHelmetStripe: string;
  agentVisor: string;
  agentBag: string;
  agentBagShade: string;
  agentBagEdge: string;
  agentBagEmblem: string;
  agentShoe: string;
  agentOutline: string;

  // The monkey
  monkeyFur: string;
  monkeyFurDark: string;
  monkeyMuzzle: string;
  monkeyEye: string;
  monkeyBrow: string;
  monkeyOutline: string;

  // Barrels
  barrelBody: string;
  barrelBodyShade: string;
  barrelBand: string;
  barrelLid: string;
  barrelWildBody: string;
  barrelOutline: string;

  // Rakhis
  rakhiDisc: string;
  rakhiDiscHi: string;
  rakhiDiscShade: string;
  rakhiGem: string;
  rakhiBead: string;
  rakhiThread: string;
  rakhiOutline: string;
  rakhiGhost: string;

  // The customer, the door, the gate
  customerBody: string;
  customerHair: string;
  customerSkin: string;
  doorFrame: string;
  doorPanel: string;
  shutterClosed: string;
  shutterSlat: string;
  shutterLockIcon: string;
  shutterOpenGlow: string;

  // HUD
  hudCard: string;
  hudCardEdge: string;
  hudLabel: string;
  hudValue: string;
  trackerPipEmpty: string;
  trackerPipFilled: string;
  trackerPipEdge: string;
  trackerCompleteFlash: string;
  timerTrack: string;
  timerFill: string;
  timerFillUrgent: string;
  timerText: string;
  lifeFull: string;
  lifeSpent: string;
  scorePop: string;
  scorePopBonus: string;
  levelChip: string;
  levelChipText: string;

  // Controls
  padPlate: string;
  padFace: string;
  padFacePressed: string;
  padChevron: string;
  padHub: string;
  jumpFace: string;
  jumpFacePressed: string;
  jumpRing: string;
  jumpGlyph: string;

  // Overlays and transitions
  scrim: string;
  pausePanel: string;
  wipe: string;
  deathFlash: string;
  unlockFlash: string;

  // The mark
  markPlate: string;
  markPin: string;
  markWordmark: string;
  emblemFill: string;
}

// ─── The derivation ─────────────────────────────────────────────────────────

export function buildTheme(b: BrandModule): Theme {
  const c = b.colors;
  const k = c.collectible;
  const ch = c.characters;

  // The two ends of the tint ramp the stage is built from. Named here so the
  // stage tokens below read as intent rather than as array indexing.
  const washLightest = c.tints[4];
  const washLight = c.tints[3];

  const t: Theme = {
    // ── App chrome ──────────────────────────────────────────────────────────
    appBg: c.primary,
    /** The desktop phone bezel. Dark, so the orange screen reads as lit. */
    frameBezel: c.surfaceDark,
    frameScreen: washLightest,
    masthead: c.primary,
    mastheadRule: c.primaryPressed,
    mastheadText: readableOn(c.primary, c.paper, c.ink),

    // ── Surfaces ────────────────────────────────────────────────────────────
    surface: c.paper,
    surfaceQuiet: c.faint,
    surfaceSunken: c.muted,
    surfaceTinted: c.primaryWash,
    surfaceDark: c.surfaceDark,
    border: c.line,
    borderStrong: c.dim,
    borderSelected: c.primary,

    // ── Text ────────────────────────────────────────────────────────────────
    text: c.ink,
    textSecondary: c.subtle,
    textTertiary: c.dim,
    textInverse: c.paper,
    textOnPrimary: readableOn(c.primary, c.paper, c.ink),
    textOnGold: readableOn(k.body, c.paper, c.ink),

    // ── Buttons ─────────────────────────────────────────────────────────────
    //
    // THE HERO IS `primary`, NEVER `secondary`, AND THAT IS THE ONE DERIVATION
    // DECISION MOST WORTH DEFENDING. Swiggy's own CTA is white on orange, which
    // clears contrast at display weight. Their amber reads as the more
    // "energetic" colour and is therefore exactly what someone re-skinning this
    // will reach for — and white on amber is about 1.9:1, i.e. illegible. The
    // secondary's job here is emphasis inside a surface, never a filled CTA.
    btnHero: c.primary,
    btnHeroText: readableOn(c.primary, c.paper, c.ink),
    btnHeroPressed: c.primaryPressed,
    btnSecondary: c.paper,
    btnSecondaryBorder: c.line,
    btnSecondaryText: c.ink,
    btnSecondaryPressed: c.faint,
    btnGhostText: c.subtle,
    btnDisabled: c.muted,
    btnDisabledText: c.dim,

    // ── Buttons ON THE BRAND'S OWN GROUND ───────────────────────────────────
    //
    // THE BUG THIS SET EXISTS TO PREVENT: a hero CTA painted `primary` on a
    // screen whose background is also `primary`. The splash is deliberately the
    // brand's colour — it carries over from the boot overlay, which is the
    // whole reason the boot overlay is that colour — and on that ground the
    // ordinary hero button is orange on orange and simply does not exist.
    //
    // It is not enough to swap in `btnSecondary`, because the screen needs
    // THREE ranks and paper-on-orange would then be two of them. So: the
    // loudest is a paper fill carrying the brand's colour as its text, the
    // middle is an outline, and the quietest is bare paper text.
    btnOnBrand: c.paper,
    /**
     * The PRESSED step of the primary, not the primary itself. #FF5200 on white
     * is 3.4:1 — which passes only as large text and fails the moment someone
     * reuses this token at label size. The darker step is 4.3:1 and passes
     * outright, and against a paper fill the two are indistinguishable anyway.
     */
    btnOnBrandText: c.primaryPressed,
    btnOnBrandPressed: c.faint,
    btnOutlineOnBrandBorder: c.paper,
    btnOutlineOnBrandText: c.paper,
    btnGhostOnBrandText: c.paper,

    // ── Stage ───────────────────────────────────────────────────────────────
    //
    // The backdrop is the PALE end of the tint ramp, not the primary. An
    // orange playfield would be the obvious "on-brand" choice and it is the
    // wrong one: the agent's shirt, his bag, the girders and the rakhi's gold
    // are all warm, and against saturated orange every one of them stops
    // reading. The brand lives in the STRUCTURE — see `girderFace` — and the
    // background stays out of the way.
    stageSkyTop: washLightest,
    stageSkyBottom: washLight,
    stageVignette: withAlpha(c.primaryPressed, 0.1),
    /** The tiled emblem watermark. Barely there by design. */
    stageWatermark: withAlpha(c.primary, 0.07),

    /** THE GIRDERS ARE THE BRAND COLOUR. This is where the orange lives. */
    girderTop: mix(c.primary, c.paper, 0.22),
    girderFace: c.primary,
    girderEdge: c.primaryPressed,
    girderRivet: mix(c.primary, c.paper, 0.45),
    /** Conveyor chevrons: a light/dark pair cut from the girder itself. */
    girderBeltA: mix(c.primary, c.paper, 0.3),
    girderBeltB: c.primaryPressed,

    ladderRail: c.strong,
    ladderRung: mix(c.strong, c.paper, 0.3),
    ladderShadow: withAlpha(c.ink, 0.14),
    /** The cap on a broken ladder's gap — a warning, so it takes the warning colour. */
    ladderBrokenCap: c.caution,

    liftCage: c.strong,
    liftCable: c.dim,
    liftTrim: c.secondary,
    pinIdle: c.dim,
    pinPushed: c.positive,
    oilSlick: withAlpha(c.surfaceDark, 0.55),
    springCoil: c.secondaryDeep,

    /**
     * THE FLAME is the only PURE-PRIMARY MOVING object on the field, and that
     * is load-bearing rather than decorative: the girders are the same colour,
     * so motion — not hue — is what separates the hazard from the structure.
     * It carries a dark foot for the value break, and the ink keyline every
     * actor gets.
     */
    flameBody: c.primary,
    flameCore: c.secondary,
    /** The innermost, hottest step. Without a third value the flare reads as a
     *  flat orange shape — which on orange girders is no read at all. */
    flameHot: mix(c.secondary, c.paper, 0.6),
    flameOutline: c.ink,

    /**
     * Painted lanes and the belt-reversal telegraph.
     *
     * Its own token rather than borrowing `ladderBrokenCap`, which is what the
     * first pass did. Both happen to be the caution colour today, and that is
     * exactly the trap: they are different NOUNS, so a brand that retints its
     * broken-ladder caps would silently retint every hazard lane in the game
     * and nobody would connect the two.
     */
    hazardCaution: c.caution,

    chuteBody: c.surfaceDark,
    chuteMouth: mix(c.surfaceDark, c.paper, 0.16),

    /**
     * The powerup MUST READ AS A REWARD, not as one more thing that kills you.
     * So it takes the collectible's gold rather than any hazard colour — it is
     * this game's hammer, and a player who mistakes it for a threat walks around
     * the only thing that would have saved them.
     */
    shakerBody: c.paper,
    shakerCap: k.body,

    /**
     * "GO" — the turbo's chevrons and speed trail.
     *
     * Its own token rather than borrowing `timerFill`, which is what the first
     * pass did. Both are the brand's positive green today, and that is exactly
     * the trap: `timerFill` is derived FOR THE DELIVERY CLOCK, so a brand that
     * retinted its timer would silently restyle a power-up pickup, and nobody
     * would connect the two. Same mistake, same shape, as the hazard lanes
     * borrowing `ladderBrokenCap`.
     *
     * It must not be the primary: flames are the only pure-orange MOVING object
     * on the field by design, so an orange speed flare would read as fire.
     */
    powerupGo: c.positive,
    /** The helmet's protective read — deliberately not a hazard colour. */
    powerupGuard: c.informative,

    // ── The agent ───────────────────────────────────────────────────────────
    //
    // Recognition cue hierarchy, and the art must honour it in this order:
    // the orange cube bag, then the orange shirt, then the dark helmet. The bag
    // gets the purest primary in the frame for that reason.
    agentShirt: c.primary,
    agentShirtShade: c.primaryPressed,
    /** Reflective bands. Also the silhouette separator that keeps an orange
     *  agent legible while he is standing on an orange girder — without these
     *  he disappears into the structure at small sizes. */
    agentBand: c.paper,
    agentTrouser: c.strong,
    agentTrouserShade: c.surfaceDark,
    agentSkin: ch.skin,
    agentSkinShade: ch.skinShade,
    agentHelmet: c.surfaceDark,
    agentHelmetStripe: c.primary,
    agentVisor: withAlpha(c.paper, 0.28),
    agentBag: c.primary,
    agentBagShade: c.primaryPressed,
    agentBagEdge: mix(c.primary, c.ink, 0.35),
    agentBagEmblem: c.paper,
    agentShoe: c.ink,
    agentOutline: c.ink,

    // ── The monkey ──────────────────────────────────────────────────────────
    monkeyFur: ch.fur,
    monkeyFurDark: ch.furDark,
    monkeyMuzzle: mix(ch.fur, c.paper, 0.42),
    monkeyEye: c.ink,
    monkeyBrow: ch.furDark,
    monkeyOutline: c.ink,

    // ── Barrels ─────────────────────────────────────────────────────────────
    //
    // SLATE, NOT RED. A red barrel on an orange girder is invisible, and red is
    // the intuitive choice for "the thing that kills you", so this is a trap
    // worth naming. Dark reads against every stage skin the ramp can produce.
    // `negative` is reserved for the WILD barrel and the urgent timer, which
    // are the two places a red genuinely earns its alarm.
    barrelBody: c.strong,
    barrelBodyShade: c.surfaceDark,
    barrelBand: c.dim,
    barrelLid: mix(c.strong, c.paper, 0.25),
    barrelWildBody: c.negative,
    barrelOutline: c.ink,

    // ── Rakhis ──────────────────────────────────────────────────────────────
    //
    // The only tokens in this file that pass a brand value through unchanged.
    // See the note on BrandColors.collectible for why the rakhi is not derived
    // from the brand at all.
    rakhiDisc: k.body,
    rakhiDiscHi: k.highlight,
    rakhiDiscShade: k.shade,
    rakhiGem: k.gem,
    rakhiBead: k.bead,
    rakhiThread: k.gem,
    rakhiOutline: k.outline,
    /** The locate-pulse on an un-collected rakhi. */
    rakhiGhost: withAlpha(k.highlight, 0.45),

    // ── The customer, the door, the gate ────────────────────────────────────
    customerBody: c.informative,
    customerHair: ch.hair,
    customerSkin: ch.skin,
    doorFrame: c.strong,
    doorPanel: mix(c.strong, c.paper, 0.55),
    /** A CLOSED SHOP, not a hazard — so the dark surface, never the alarm red.
     *  The shutter is an instruction ("come back with the rakhis"), and dressing
     *  an instruction as a threat teaches the player to avoid it instead of
     *  reading it. */
    shutterClosed: c.surfaceDark,
    shutterSlat: mix(c.surfaceDark, c.paper, 0.16),
    shutterLockIcon: c.caution,
    shutterOpenGlow: k.highlight,

    // ── HUD ─────────────────────────────────────────────────────────────────
    hudCard: c.paper,
    hudCardEdge: c.line,
    hudLabel: c.subtle,
    hudValue: c.ink,
    trackerPipEmpty: withAlpha(c.ink, 0.16),
    trackerPipFilled: k.body,
    trackerPipEdge: k.outline,
    trackerCompleteFlash: k.highlight,
    timerTrack: c.muted,
    timerFill: c.positive,
    timerFillUrgent: c.negative,
    timerText: c.ink,
    lifeFull: c.primary,
    lifeSpent: withAlpha(c.ink, 0.14),
    scorePop: c.ink,
    scorePopBonus: k.shade,
    levelChip: withAlpha(c.paper, 0.18),
    levelChipText: readableOn(c.primary, c.paper, c.ink),

    // ── Controls ────────────────────────────────────────────────────────────
    padPlate: withAlpha(c.ink, 0.06),
    padFace: c.paper,
    padFacePressed: c.primaryWash,
    padChevron: c.strong,
    padHub: c.muted,
    jumpFace: c.primary,
    jumpFacePressed: c.primaryPressed,
    jumpRing: withAlpha(c.ink, 0.1),
    jumpGlyph: readableOn(c.primary, c.paper, c.ink),

    // ── Overlays ────────────────────────────────────────────────────────────
    scrim: withAlpha(c.ink, 0.55),
    pausePanel: c.paper,
    /** A fade to the BRAND'S colour is a beat. A fade to black is the absence
     *  of one — and it is the cheapest branding in the whole build, one
     *  fillRect between every pair of screens. */
    wipe: c.primary,
    deathFlash: withAlpha(c.negative, 0.42),
    /** The unlock flashes in the collectible's own gold, so cause and effect
     *  share a colour and the player never has to be told what just happened. */
    unlockFlash: k.highlight,

    // ── The mark ────────────────────────────────────────────────────────────
    markPlate: c.primary,
    markPin: c.paper,
    markWordmark: c.wordmarkTint,
    emblemFill: c.paper,
  };

  // The per-brand escape hatch. Applied last so a brand can override anything,
  // and deliberately unvalidated beyond key existence: a brand that names a
  // token this game does not have is a typo, and a silent no-op would hide it.
  if (b.theme) {
    for (const [key, value] of Object.entries(b.theme)) {
      if (!(key in t)) {
        throw new Error(
          `brand "${b.identity.slug}" overrides unknown theme token "${key}"`,
        );
      }
      (t as unknown as Record<string, string>)[key] = value;
    }
  }

  return t;
}
