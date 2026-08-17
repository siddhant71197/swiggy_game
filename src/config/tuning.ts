/**
 * ══════════════════════════════════════════════════════════════════════════
 *  TUNING — every number the game feels like, in one file.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: a jump height living in agent.ts, a barrel
 * speed living in barrel.ts, and a timer living in play.ts — so that "the game
 * feels floaty" becomes an archaeology exercise across nine files, and the
 * person who finally finds the number changes it without seeing what else it
 * was balanced against.
 *
 * Per-LEVEL numbers do not live here; they live in config/levels.ts, one row
 * per level. Here is what is true of every level.
 *
 * ─── UNITS ─────────────────────────────────────────────────────────────────
 *
 * Two coordinate spaces, and confusing them is the one expensive mistake:
 *
 *   REFERENCE UNITS  the 720×1280 layout space every screen is composed in.
 *                    Scaled to the device once, in render/canvas.ts.
 *   STAGE UNITS      the 560×760 world the sim runs in. IDENTICAL ON EVERY
 *                    DEVICE — the stage is never resized, only centred, so a
 *                    speed in stage-units/sec means the same thing on a tablet
 *                    and on a 20:9 handset.
 *
 * Everything under PHYS, CLIMB, BARREL, LIFT and BELT is in stage units per
 * second. Everything under REF and UI is in reference units. Nothing anywhere
 * is in pixels.
 */

// ─── The layout frame ───────────────────────────────────────────────────────

export const REF = {
  W: 720,
  H: 1280,
} as const;

/**
 * The four horizontal bands, summing to exactly REF.H.
 *
 * THE STAGE BAND MAY NOT GROW, and the reason is not aesthetic. At 760 units
 * tall with seven floors the gap is 106 and the 44-tall agent plus his 65-unit
 * apex clears it with margin. Push this higher and on a 20:9 phone the WIDTH
 * constraint binds first; the stage would have to scale to fit, and every speed
 * below would then mean a different thing per device. A level-9 barrel dodge
 * would be a measurably different game on a tall handset, and the bug report
 * would say "it feels wrong on my phone" and be unreproducible.
 */
export const BANDS = {
  masthead: 96,
  hud: 112,
  stage: 760,
  pads: 312,
} as const;

// ─── The world ──────────────────────────────────────────────────────────────

export const STAGE = {
  W: 560,
  H: 760,
  floors: 7,
  /**
   * Vertical distance between girder tops. Deliberately larger than the jump
   * apex — see PHYS.jumpV. If these two ever cross, ladders stop mattering and
   * the game becomes a jumping puzzle with decorative ladders in it.
   */
  floorGap: 106,
  /**
   * Vertical slabs the girders are bucketed into for ground queries. 16 keeps a
   * lookup at ~2 candidate segments instead of ~40, which is the difference
   * between the collision pass being free and being the frame's hot spot.
   */
  buckets: 16,
} as const;

// ─── The agent ──────────────────────────────────────────────────────────────

export const AGENT = {
  /** Drawn size. The hitbox is deliberately smaller — see the fractions below. */
  drawW: 30,
  drawH: 44,

  /**
   * THE SPRITE IS ALWAYS BIGGER THAN THE THING THAT KILLS YOU, NEVER SMALLER.
   *
   * A player who dies to a barrel that visibly missed them concludes the game
   * is broken and is right to. A player who survives a barrel that visibly
   * grazed them concludes they are good at the game. Both are the same 8 units
   * of slack; only one of them keeps anybody playing.
   */
  hitboxWFrac: 0.58,
  hitboxHFrac: 0.82,

  lives: 3,
  /** Held on the death frame before the respawn animation starts. */
  deathFreezeSec: 1.0,
  respawnFadeSec: 0.6,
  /** Flashing invulnerability after respawn. */
  invulnSec: 1.4,
  /**
   * Hazards this close to the spawn point are despawned on respawn. Without it
   * a player can respawn directly into the barrel that just killed them, which
   * is the single most rage-inducing thing a game of this shape can do.
   */
  respawnClearRadius: 70,
  /** The monkey holds his throw this long after a respawn. */
  respawnThrowPauseSec: 1.0,
} as const;

export const PHYS = {
  gravity: 2400,
  /**
   * Apex = jumpV² / (2·gravity) = 65.3 units. Airtime = 2·|jumpV| / gravity =
   * 0.47s. Horizontal reach at full run = 70 units.
   *
   * 65 is chosen against two numbers and sits between them: it must clear a
   * 30-unit barrel comfortably, and it must NOT reach the next floor 106 units
   * up. The second constraint is what makes ladders the only way up, which is
   * what makes the level a route rather than a climbing wall.
   */
  jumpV: -560,
  runSpeed: 150,
  /** Air control, as a fraction of ground acceleration. */
  airControl: 0.55,

  /**
   * COYOTE TIME — a jump still fires this long after walking off an edge.
   * On a touchscreen the input pipeline alone eats most of a frame, so without
   * this a "late" jump is often a jump the player made on time.
   */
  coyoteSec: 0.08,
  /**
   * INPUT BUFFER — a jump pressed this long before landing fires on touchdown.
   * The mirror of coyote time, covering the player who is early rather than
   * late. Together these two numbers are most of what "responsive" means.
   */
  bufferSec: 0.12,

  /** Max vertical step the feet will re-snap over while walking a slope. */
  maxSnap: 10,
  /** Tolerance on the swept landing test. */
  landEps: 1.5,
  /** Terminal velocity, so a long fall stays readable rather than teleporting. */
  maxFallSpeed: 900,
} as const;

export const CLIMB = {
  /**
   * Deliberately slower than running. A ladder is a COMMITMENT — you give up
   * your ability to dodge for the duration — and it has to cost something or
   * the optimal play is to climb everywhere and the girders stop mattering.
   */
  speed: 96,
  /**
   * Horizontal distance within which UP grabs a ladder. Generous on purpose:
   * mis-aligned ladder grabs are the number one killer in every clone of this
   * game, and the failure is invisible — the player presses UP, nothing
   * happens, and a barrel arrives.
   */
  grabX: 11,
  /** How long the auto-snap to the rail takes once a grab is accepted. */
  snapSec: 0.06,
  /** Vertical tolerance for mounting a ladder from the girder it tops out at. */
  mountY: 8,
  /** Vertical tolerance for finding the girder to step off onto. */
  dismountY: 6,
} as const;

// ─── Hazards ────────────────────────────────────────────────────────────────

export const BARREL = {
  r: 15,
  /** Hitbox radius as a fraction of `r`. See the note on AGENT.hitboxWFrac. */
  hitboxFrac: 0.68,
  /**
   * THE GRACE TAIL. The trailing 12% of a barrel is inert, so a late jump that
   * visually clips the back of one survives.
   *
   * Nobody will ever notice this. Everybody will feel it — it converts the most
   * common near-miss death, which reads as unfair, into the most common
   * near-miss survival, which reads as skill.
   */
  graceTail: 0.12,
  descendSpeed: 140,
  gravity: 2000,
  /** Wild barrels bounce on landing instead of rolling. */
  bounceV: -380,
  wildSpeedMult: 1.35,
  /** Horizontal distance from a ladder head at which the descent roll happens. */
  ladderX: 8,
  /**
   * Hard cap on live barrels, and it is the cap rather than the spawn interval
   * that keeps a stalled player from facing an unwinnable screen. A per-level
   * `maxBarrels` clamps below this; this is the pool's physical size.
   */
  cap: 24,
} as const;

export const BELT = {
  /** Telegraph before a reversing belt actually flips. */
  flipWarnSec: 1.2,
} as const;

/**
 * THE NON-BARREL HAZARDS.
 *
 * Every one of these is a number the player has to LEARN, so each is chosen
 * against the same question: "after how many deaths does this become readable?"
 *
 *   flameSpeed 52 is a third of PHYS.runSpeed. A flame is a wall that moves, not
 *   a chase — the player must always be able to outwalk one, because the flame's
 *   job is to close a route, not to catch a runner. A chaser faster than the
 *   player has exactly one counterplay (leave the floor) and therefore is not a
 *   decision.
 *
 *   scooterBounceV is a FIXED impulse, and the level rows give scooters a
 *   jitter-free cadence, on purpose. A hazard you cannot walk under has to be
 *   learnable to the frame, and a jittered bounce is a coin flip wearing a
 *   pattern's clothes.
 *
 *   tiffinWarnSec is longer than a full jump arc (0.47s), so the telegraph is
 *   always long enough to walk out of the lane rather than only long enough to
 *   flinch.
 */
export const HAZARD = {
  flameSpeed: 52,
  flameClimbSpeed: 74,
  flameDrawW: 22,
  flameDrawH: 30,
  /** Hitbox fractions, matching the agent's promise: the sprite is bigger. */
  flameHitFrac: 0.6,
  /** Horizontal distance from a ladder head at which a flame considers it. */
  flameLadderX: 9,
  /** Cap on live flames per level. Flames are authored, never spawned. */
  flameCap: 4,

  tiffinDrawW: 24,
  tiffinDrawH: 24,
  tiffinHitFrac: 0.66,
  tiffinGravity: 1500,
  /** Telegraph before a dropper releases. Longer than one jump arc. */
  tiffinWarnSec: 0.8,
  tiffinCap: 10,

  scooterDrawW: 30,
  scooterDrawH: 26,
  scooterHitFrac: 0.6,
  scooterGravity: 2000,
  scooterBounceV: -430,
  scooterCap: 8,

  /** Pickup radius for the shaker and push radius for an order pin. */
  shakerR: 22,
  pinR: 20,
  /** Telegraph on the shaker running out, so the last second is a warning. */
  shakerWarnSec: 1.5,
} as const;

export const LIFT = {
  /** Vertical tolerance for being considered aboard a car. */
  boardY: 8,
  /**
   * A body on a car inherits the car's dy rather than re-landing each frame.
   * Without this the agent jitters against the platform and can slide off a
   * rising car, which players read as the lift "throwing" them.
   */
  carryDy: true,
} as const;

// ─── Objective ──────────────────────────────────────────────────────────────

export const RAKHI = {
  /** Pickup radius. Generous — a required collectible must never feel fiddly. */
  pickupR: 22,
  bobAmp: 4,
  bobSec: 1.8,
  /**
   * Seconds without a pickup before a chevron points at the nearest one.
   *
   * Only after the player has demonstrably lost the thread. An always-on
   * waypoint would remove the route-planning, and the route-planning is the
   * entire reason this game gates the goal on a sweep instead of on a climb.
   */
  nudgeAfterSec: 12,
  /** How long the unlock beat holds the sim still. */
  unlockHoldSec: 0.9,
  /** Hit-stop on the unlock. The one moment in a level that stops time. */
  unlockHitStopSec: 0.15,
} as const;

export const TIMER = {
  /** Below this the HUD reddens and the barrels lean on you. */
  urgentSec: 10,
  urgentIntervalMult: 0.8,
} as const;

// ─── Scoring ────────────────────────────────────────────────────────────────

export const SCORE = {
  rakhi: 200,
  /** Each consecutive rakhi in one life is worth this much more. */
  rakhiChainStep: 100,
  rakhiChainCap: 700,
  /** Collecting one mid-air. Jumping a barrel THROUGH a rakhi is the hero moment. */
  rakhiAirMult: 2,

  /** Barrels cleared in a single jump: one, two, three. */
  hop: [100, 300, 800] as readonly number[],

  smashBase: 300,
  smashMult: 1.5,
  smashCap: 1500,

  perfectDelivery: 2000,
  /** Full sweep completed before reaching the upper floors. Rewards planning. */
  earlySweep: 1000,

  /**
   * Applied to level-clear and time bonus only, never to pickups — so a streak
   * multiplies the reward for playing well, not the reward for playing long.
   */
  streak: [1.0, 1.1, 1.25, 1.5] as readonly number[],
} as const;

/**
 * THE SILENT RUBBER BAND.
 *
 * Applied multiplicatively on top of the level row after repeated deaths, and
 * NEVER ANNOUNCED. A player told the game has been made easier for them has
 * been insulted; a player who simply stops dying has been rescued. The whole
 * value of this mechanism is that it is invisible.
 */
export const EASE = {
  barrelIntervalMult: [1.0, 1.25, 1.5] as readonly number[],
  barrelSpeedMult: [1.0, 0.92, 0.85] as readonly number[],
  timerMult: [1.0, 1.2, 1.35] as readonly number[],
  flameCountDelta: [0, 0, -1] as readonly number[],
  deathsPerStep: 2,
  /** After this many deaths on one level, offer to skip it. */
  offerSkipAfterDeaths: 6,
} as const;

// ─── Controls ───────────────────────────────────────────────────────────────

export const UI = {
  /** Reference units. The d-pad cluster's individual pad size. */
  padSize: 96,
  padGap: 8,
  /**
   * Invisible hit expansion per side. A thumb is about 45 units across and
   * lands where the player is looking, which is the screen, not their hand.
   */
  padSlop: 20,
  padCenterY: 1090,
  padMarginX: 44,

  jumpR: 66,
  jumpSlop: 24,
  jumpCenterY: 1096,
  jumpMarginX: 116,

  /**
   * A swipe up anywhere in the stage band also jumps.
   *
   * Some fraction of first-time players never work out that the on-screen pad
   * is a control at all. This is the cheapest possible insurance against losing
   * them in the first ten seconds.
   */
  swipeJumpMinDy: 34,
  swipeJumpMaxSec: 0.3,
} as const;

// ─── Render ─────────────────────────────────────────────────────────────────

export const RENDER = {
  /**
   * Backing-store resolution multipliers, sharpest first.
   *
   * Stepped DOWN on a sustained slow streak and NEVER BACK UP: a game that
   * oscillates between two resolutions looks broken in a way that is worse
   * than simply being slightly soft.
   *
   * 0.6 is the floor. Below it the barrels stop reading as circles at phone
   * size, and an unreadable hazard is worse than a dropped frame.
   */
  scaleLadder: [1, 0.85, 0.7, 0.6] as readonly number[],
  /** Above ~22ms a 60Hz device is missing vsync every frame, not occasionally. */
  slowFrameMs: 22,
  /** Consecutive slow frames before dropping. ~1s, so a GC pause cannot trip it. */
  slowFrameStreak: 60,
  /**
   * Past 2.5 the extra backing store costs fill rate for a sharpness nobody can
   * see on a phone held at arm's length.
   */
  maxDpr: 2.5,
} as const;
