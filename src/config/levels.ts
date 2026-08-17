/**
 * ══════════════════════════════════════════════════════════════════════════
 *  LEVELS — the tower, as data, and nothing but data.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: the level that is half in a table and half in
 * an `if (level === 5)`. The moment one archetype needs "just one special case"
 * in the sim, every later level is authored by editing code, every balance pass
 * is a code review, and the headless bot in tools/ is measuring a game whose
 * difficulty lives in nine files. Archetypes differ by DATA — a `kind` string, a
 * belt flag, a spawner row — and src/game/world.ts has exactly one `step()`.
 *
 * ─── WHY `nameIdx` IS A NUMBER ─────────────────────────────────────────────
 *
 * A level row may never hold a display string. Copy is brand-owned and lives in
 * config/copy.ts; a level naming itself would make this file un-reskinnable and
 * would drag the brand module into the sim's import graph, which is what stops
 * the engine running under bare Node. An index costs one lookup at the HUD and
 * keeps game/ free of every string the player ever reads.
 *
 * ─── THE GEOMETRY, AND THE ONE NUMBER IT IS BUILT AROUND ───────────────────
 *
 * Seven floors on a 560×760 stage, `floorGap` 106 apart, girders alternating
 * slope ±1/12 so barrels sweep right on one floor and left on the next with no
 * barrel-specific code anywhere — see the `Girder` header in core/types.ts.
 *
 * Alternating slopes mean the vertical gap between two adjacent floors is NOT
 * 106; it is 106 ∓ the two slopes diverging across the span. That is the one
 * number the layout is built around, because the jump apex is 65.3 and a gap
 * that dips under it turns the ladders into decoration:
 *
 *   girder span 408 → drop 34 → floors staggered 72 apart horizontally
 *   minimum gap = 106 − 34 + 2·(72/12) ÷ … = 78 units, at the open ends.
 *
 * 78 against a 65.3 apex is 12.7 units of headroom — enough that no jump reaches
 * the floor above, tight enough that the tower still reads as climbable. Widen
 * the girders and that margin is the first thing to go.
 *
 * ─── WHY BOTH LEVELS SHARE ONE TOWER ───────────────────────────────────────
 *
 * Level 2 is level 1 with faster barrels and ladder descent switched on. A
 * player who has just learned a route should get to prove they learned it before
 * the geometry moves; changing the map AND the pressure at the same time makes
 * the second level read as "a different game" rather than "the same game, harder",
 * and the difficulty curve becomes unmeasurable because two variables moved.
 */

// ─── Authored shapes ────────────────────────────────────────────────────────

/** A point in stage units. Feet-centre for spawn points; centre for pickups. */
export interface PointDef {
  x: number;
  y: number;
}

/**
 * One floor, as authored. Normalised into a runtime `Girder` by game/stage.ts —
 * which is where `x1 > x0` and the precomputed slope are guaranteed, so nothing
 * here has to be careful about end order.
 *
 * `wallL` / `wallR` default to OPEN. Open is the interesting case and defaults
 * should be the interesting case: a floor is a route with a commitment at one
 * end, and the author who forgets a flag gets a fall, which is visible, rather
 * than an invisible wall, which is not.
 */
export interface GirderDef {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Conveyor push direction. Absent or 0 is a plain girder. */
  belt?: -1 | 0 | 1;
  wallL?: boolean;
  wallR?: boolean;
}

/**
 * A ladder rail. `yTop` is the smaller y — this is screen space, up is less.
 *
 * `gap` is a BROKEN ladder: a stretch of missing rungs that the climb clamps
 * against from whichever side it approaches. `gated` is the SWEEP gate — rakhis
 * AND the customer's order, both required; exactly one ladder per level carries
 * it, and it is refused until every item is collected.
 */
export interface LadderDef {
  x: number;
  yTop: number;
  yBottom: number;
  gap?: { top: number; bottom: number };
  gated?: boolean;
}

/** A vertical lift car. Unused by layout A; typed here so archetypes stay data. */
export interface LiftDef {
  x: number;
  yTop: number;
  yBottom: number;
  /** Half-width of the car, matching the Body contract. */
  w: number;
  speed: number;
  /** 0..1 offset into the cycle, so a bank of cars is staggered by data. */
  phase: number;
}

/**
 * A barrel source. `x,y` is where the barrel's FEET appear, so it must be on a
 * girder surface — a spawner floating in the air produces a falling barrel,
 * which is legal and occasionally what you want.
 */
export interface SpawnerDef {
  x: number;
  y: number;
  intervalSec: number;
  /** Uniform ± jitter on the interval, so releases never metronome. */
  jitterSec: number;
  /** Probability a release is a wild (bouncing, ladder-ignoring) barrel. */
  wildChance: number;
}

/**
 * One dish of the customer's order — the level's SECOND required collectible.
 *
 * `kind` indexes the brand's dish table (`FOOD_PALETTE` / `FOOD_NAMES` in
 * src/brand/index.ts) and is a NUMBER for exactly the reason `nameIdx` is: a level
 * row may never hold a display string, or this file stops being reskinnable and
 * drags the brand module into the sim's import graph. The brand wraps the index,
 * so a level authored against five dishes still renders on a brand shipping three.
 */
export interface FoodDef {
  x: number;
  y: number;
  kind: number;
}

/**
 * A tandoor flame. Authored, never spawned — the count on screen is the count in
 * the table, so a level's pressure is readable from its row.
 *
 * `x,y` is the FEET-CENTRE it starts at and must sit on a girder surface. `dir`
 * is which way it sets off; the patrol reverses at ends and at walls by itself.
 */
export interface FlameDef {
  x: number;
  y: number;
  dir: -1 | 1;
}

/**
 * A falling-tiffin dropper. `x` is the painted lane; `y` is the release height.
 *
 * The cadence carries NO jitter field on purpose. A lane the player must time
 * their crossing of has to be a metronome — see HAZARD.tiffinWarnSec.
 */
export interface TiffinDef {
  x: number;
  y: number;
  intervalSec: number;
  /** Offset into the cycle, so a bank of lanes is staggered by data. */
  phase: number;
}

/**
 * A bouncing scooter source. Also deliberately jitter-free: a hazard you cannot
 * walk under must be learnable, and learnable means the same every time.
 */
export interface ScooterDef {
  x: number;
  y: number;
  dir: -1 | 1;
  speed: number;
  intervalSec: number;
  phase: number;
}

export interface StageDef {
  kind: 'girders' | 'kitchen' | 'lifts' | 'delivery';
  /** Index into COPY.levelNames — NEVER a string here. See the header. */
  nameIdx: number;

  girders: GirderDef[];
  ladders: LadderDef[];
  lifts?: LiftDef[];
  spawners: SpawnerDef[];
  rakhis: PointDef[];
  /**
   * The order. REQUIRED — no `?` — because it is a gate condition, and an
   * OPTIONAL gate condition is a level that silently ships with a decorative
   * objective when somebody forgets the field. Every level states its order, and
   * a level that wanted none would state `[]` on purpose.
   */
  foods: FoodDef[];
  pins?: PointDef[];
  hazards?: { kind: 'fire' | 'oil' | 'spring'; x: number; y: number }[];

  flames?: FlameDef[];
  /**
   * Probability a flame at a junction picks the branch toward the player.
   *
   * NEVER 1.0, and the ceiling is not a taste call. A perfectly homing chaser
   * removes the only counterplay the player has — reading which way it will go —
   * and converts every flame encounter into a race the flame's speed decides.
   * Around a third is enough that the flames feel aware and low enough that a
   * player who commits to a route is usually right.
   */
  flameChaseChance?: number;
  tiffins?: TiffinDef[];
  scooters?: ScooterDef[];
  /** Where the masala shakers sit. `shakerCount` says how many of these are live. */
  shakers?: PointDef[];
  /** Where the helmets sit. `helmetCount` says how many of these are live. */
  helmets?: PointDef[];
  /** Where the turbo boosts sit. `turboCount` says how many of these are live. */
  turbos?: PointDef[];

  /**
   * The three throw positions the monkey shifts between, level 10 only. Absent
   * on every other level, which is what makes `monkeyAt` a fixed landmark for
   * the first nine and a moving problem for the last.
   */
  monkeySlots?: PointDef[];
  monkeyShiftSec?: number;

  agentStart: PointDef;
  monkeyAt: PointDef;
  customerAt: PointDef;

  barrelSpeed: number;
  barrelLadderChance: number;
  maxBarrels: number;
  beltPeriodSec?: number;
  timerSec: number;

  shakerCount: number;
  shakerSec: number;

  /**
   * The powerup COUNTS are required on every level, the position tables are not.
   *
   * Same split as `shakerCount`, and required for the same reason: a level's
   * pressure has to be readable off its row without cross-checking an array's
   * length, and an optional count would let "how many helmets does level 8 have"
   * be answered by `undefined` — which reads as zero and is indistinguishable
   * from a deliberate zero. A zero here is a design statement; a missing field is
   * an accident.
   */
  helmetCount: number;
  turboCount: number;
  /** Boost duration. Zero on levels with no turbo — never a leftover from tuning. */
  turboSec: number;

  clearPoints: number;
  timeBonusPerSec: number;
}

// ─── Layout A ───────────────────────────────────────────────────────────────
//
// Floor baselines are 720 − 106·i, and each girder is 408 wide dropping 34 —
// which is exactly 1/12. Even floors run left-to-right and sit at x 40…448;
// odd floors mirror to x 112…520. The 72-unit stagger is what makes a barrel
// leaving one floor's open end land WELL INSIDE the next one rather than on its
// lip, which is the difference between a serpentine and a coin flip.
//
// Every surface y below is an integer on purpose: ladder x values are all ≡ 4
// (mod 12), which lands on an exact rung height on both the even and the odd
// span. Not cosmetic — a ladder foot half a unit under the floor is a mount
// that fails at CLIMB.mountY and is invisible in the data.

function layoutA(): { girders: GirderDef[]; ladders: LadderDef[] } {
  return {
    girders: [
      // F0 — the ground. Walled at BOTH ends, which is the only floor that is.
      // A barrel that has survived the whole tower ends up jammed against the
      // right wall with nowhere downhill to go, and game/barrel.ts retires it
      // there by a general rule, not a floor-0 special case. The player gets a
      // bottom floor they cannot fall off, which is what "clearable first-try"
      // costs at the exact spot a panicking beginner runs.
      { x0: 40, y0: 703, x1: 448, y1: 737, wallL: true, wallR: true },

      // F1…F5 — walled on the UPHILL end, open on the DOWNHILL end. That single
      // rule is the whole barrel routing: a barrel can only ever leave a floor
      // by the end it was already rolling toward.
      { x0: 112, y0: 631, x1: 520, y1: 597, wallL: false, wallR: true },
      { x0: 40, y0: 491, x1: 448, y1: 525, wallL: true, wallR: false },
      { x0: 112, y0: 419, x1: 520, y1: 385, wallL: false, wallR: true },
      { x0: 40, y0: 279, x1: 448, y1: 313, wallL: true, wallR: false },
      { x0: 112, y0: 207, x1: 520, y1: 173, wallL: false, wallR: true },

      // F6 — the delivery platform. Short and walled both ends: it is the one
      // place in the level where the player is asked to stop moving, and a
      // player who walks off the goal floor at the moment of victory quits.
      { x0: 196, y0: 76, x1: 376, y1: 91, wallL: true, wallR: true },
    ],

    ladders: [
      // Zigzag: right, left, right, left, right — so the sweep across each floor
      // is forced, and a rakhi anywhere on the walking line is on the route by
      // construction rather than by the designer remembering to check.
      { x: 400, yTop: 607, yBottom: 733 }, // F0 → F1
      { x: 148, yTop: 500, yBottom: 628 }, // F1 → F2
      { x: 400, yTop: 395, yBottom: 521 }, // F2 → F3
      { x: 160, yTop: 289, yBottom: 415 }, // F3 → F4
      { x: 388, yTop: 184, yBottom: 308 }, // F4 → F5

      // THE GATE. Exactly one per level, and it is the last rung of the climb —
      // so the sweep is not a detour off the route, it IS the route, and the
      // player who ignores the rakhis discovers it at the top rather than
      // halfway up where backtracking still feels like a punishment.
      { x: 292, yTop: 84, yBottom: 192, gated: true }, // F5 → F6
    ],
  };
}

/** Feet-to-centre offset used to sit a pickup on the walking line. */
const ON_LINE = 18;

// ─── The rows ───────────────────────────────────────────────────────────────

const LEVEL_1: StageDef = (() => {
  const a = layoutA();
  return {
    kind: 'girders',
    nameIdx: 0,
    girders: a.girders,
    ladders: a.ladders,
    spawners: [
      // On F5's walled right end, under the monkey. Barrels roll left off the
      // open end and begin the serpentine.
      { x: 496, y: 175, intervalSec: 3.4, jitterSec: 0.5, wildChance: 0 },
    ],

    // ─── ALL THREE ON THE WALKING LINE, AND THE SAME THREE AS BEFORE ──────
    // Not one of them requires a jump, a detour, or a second visit to a floor.
    // Level 1's job is to teach that the ORDER gates the top; it is not the level
    // that tests whether you can collect it under pressure. A first level that
    // asks two questions at once answers neither.
    //
    // The three positions are unchanged from when they were three rakhis — only
    // WHAT sits on each one changed, so the route level 1 was tuned around is the
    // route it still has. One rakhi and two dishes teaches both halves of the
    // gate with the smallest possible order.
    rakhis: [
      { x: 280, y: 617 - ON_LINE }, // F1, on the walk from ladder 0 to ladder 1
    ],
    foods: [
      { x: 232, y: 507 - ON_LINE, kind: 0 }, // F2, on the walk from ladder 1 to ladder 2
      { x: 280, y: 299 - ON_LINE, kind: 1 }, // F4, on the walk from ladder 3 to ladder 4
    ],

    agentStart: { x: 80, y: 706.3333333333334 },
    monkeyAt: { x: 496, y: 175 },
    customerAt: { x: 340, y: 88 },

    // 96 IS BELOW PHYS.runSpeed (150), AND THAT IS THE WHOLE DESIGN OF LEVEL 1.
    // A beginner who freezes can simply walk away from every barrel on the
    // screen. Nothing here can corner a player who has not yet learned to jump,
    // so the only way to lose is to stand still — which is a lesson, not a wall.
    barrelSpeed: 96,
    // Zero. Barrels stay on the floor they were thrown onto, so the tower's
    // hazard pattern is fully legible from the first floor upward.
    barrelLadderChance: 0,
    maxBarrels: 4,

    timerSec: 90,
    shakerCount: 0,
    shakerSec: 0,
    helmetCount: 0,
    turboCount: 0,
    turboSec: 0,

    clearPoints: 1000,
    timeBonusPerSec: 50,
  };
})();

const LEVEL_2: StageDef = (() => {
  const a = layoutA();
  return {
    kind: 'girders',
    nameIdx: 1,
    girders: a.girders,
    ladders: a.ladders,
    spawners: [
      { x: 496, y: 175, intervalSec: 2.9, jitterSec: 0.5, wildChance: 0 },
    ],
    // Level 2 is level 1's tower and level 1's route. The order is the same size
    // and sits on the same three spots; only the DISHES differ, so the second
    // level reads as the same job for a different customer rather than as a
    // second thing to learn. See the header on why both levels share one tower.
    rakhis: [{ x: 280, y: 617 - ON_LINE }],
    foods: [
      { x: 232, y: 507 - ON_LINE, kind: 2 },
      { x: 280, y: 299 - ON_LINE, kind: 3 },
    ],
    agentStart: { x: 80, y: 706.3333333333334 },
    monkeyAt: { x: 496, y: 175 },
    customerAt: { x: 340, y: 88 },

    // Still under runSpeed. The step from 96 to 104 is deliberately small: what
    // actually changes on level 2 is the ladder descent, and raising both by a
    // lot at once would hide which of the two the player is failing to read.
    barrelSpeed: 104,
    // Barrels now leave their floor. One in five, so the pattern is still mostly
    // the pattern the player learned — a surprise that happens every time is
    // just a different rule, and a surprise that never happens is decoration.
    barrelLadderChance: 0.2,
    maxBarrels: 5,

    timerSec: 90,
    shakerCount: 0,
    shakerSec: 0,
    helmetCount: 0,
    turboCount: 0,
    turboSec: 0,

    clearPoints: 1200,
    timeBonusPerSec: 50,
  };
})();

// ─── Layouts B–F, from one generator ────────────────────────────────────────
//
// WHY THESE ARE NOT SIX HAND-TYPED TABLES.
//
// The header's geometry argument — 408-wide girders dropping 34, staggered 72,
// minimum floor gap 78 against a 65.3 apex — is only true if every layout is
// built from the same three lines. Typed by hand six times it survives exactly
// until someone rounds a y to a whole number to make a ladder "line up", at which
// point one floor is 76 apart, one jump reaches it, and the ladders on that
// floor become decoration. Nobody notices, because the level still looks right.
//
// So the surface is a FUNCTION, and every girder end, every ladder end and every
// rakhi in layouts B–F is evaluated from it. Layouts differ in what the header
// says they may differ in: where the ladders are, which floors carry belts,
// where a floor is cut in two. Not in the numbers the invariant is made of.
//
// Layout A is left as literals above, deliberately: it is the shipped geometry of
// levels 1–2 and re-deriving it would be a silent re-authoring of the two levels
// that are already tuned.

const FLOOR_GAP = 106;
const SPAN = 408;
/** The delivery platform is short — see layout A's F6 on why. */
const TOP_SPAN = 180;
const FLOORS = 7;

function floorSpan(i: number): number {
  return i === FLOORS - 1 ? TOP_SPAN : SPAN;
}
function floorX0(i: number): number {
  return i === FLOORS - 1 ? 196 : i % 2 === 0 ? 40 : 112;
}
/** ±1/12, alternating. The serpentine is this sign and nothing else. */
function floorSlope(i: number): number {
  return (i % 2 === 0 ? 1 : -1) / 12;
}

/**
 * The surface height of floor `i` at `x`. THE one geometry expression for
 * layouts B–F; the validator in tools/ evaluates the same numbers off the
 * built girders, so a layout that drifts from this is caught rather than shipped.
 */
export function towerSurfaceY(i: number, x: number): number {
  const cx = floorX0(i) + floorSpan(i) / 2;
  return 720 - FLOOR_GAP * i + floorSlope(i) * (x - cx);
}

/**
 * A pickup sitting on floor `i`'s walking line at `x`.
 *
 * ─── WHY EVERY DISH OF EVERY ORDER GOES THROUGH THIS FUNCTION ──────────────
 *
 * The order is a REQUIRED objective on all ten levels, which means every one of
 * its dishes is a mandatory visit. A required pickup off the walking line is not
 * "a bit of extra challenge" — it is a fixed toll on the clock, paid on every
 * attempt, including the attempts where the player already knows the route. Ten
 * levels of that is a game about walking.
 *
 * So the dishes are placed exactly the way level 10's order pins were: on floors
 * the sweep already crosses, between the ladder the player arrives by and the
 * ladder they leave by, so they cost no detour. The tension comes from WHICH SIDE
 * OF THE DISH THE BARREL IS ON, which is free, renewable and different every run.
 * The route-ratio budget in tools/validate-levels.ts fails the build if this
 * discipline slips, so it is checked rather than remembered.
 */
function onLine(i: number, x: number): PointDef {
  return { x, y: towerSurfaceY(i, x) - ON_LINE };
}

/** A body standing on floor `i` at `x` — spawners, flames, the agent, the monkey. */
function onFloor(i: number, x: number): PointDef {
  return { x, y: towerSurfaceY(i, x) };
}

interface TowerOpts {
  /** Six ladder x values, F0→F1 up to the gated F5→F6. */
  ladderXs: readonly number[];
  /** Floor index → conveyor direction. Absent floors are plain. */
  belts?: Readonly<Record<number, -1 | 1>>;
  /** Floors cut in two, with the gap centred at `at` and `gap` units wide. */
  splits?: readonly { floor: number; at: number; gap: number }[];
}

function tower(o: TowerOpts): { girders: GirderDef[]; ladders: LadderDef[] } {
  const girders: GirderDef[] = [];

  for (let i = 0; i < FLOORS; i++) {
    const x0 = floorX0(i);
    const x1 = x0 + floorSpan(i);
    const belt = o.belts?.[i];
    // Walls follow layout A's single rule: the ground and the delivery platform
    // are closed at both ends, every other floor is walled on its UPHILL end and
    // open on the downhill one, which is the whole of the barrel routing.
    const wallL = i === 0 || i === FLOORS - 1 || i % 2 === 0;
    const wallR = i === 0 || i === FLOORS - 1 || i % 2 === 1;

    const split = o.splits?.find((s) => s.floor === i);
    if (!split) {
      girders.push({
        x0,
        y0: towerSurfaceY(i, x0),
        x1,
        y1: towerSurfaceY(i, x1),
        belt,
        wallL,
        wallR,
      });
      continue;
    }

    // A CUT FLOOR IS STILL ONE LINE. Both pieces are evaluated from the same
    // surface function, so the jump across the gap is flat-ish and the barrel
    // that misses it falls exactly where the uncut floor would have carried it.
    const lx = split.at - split.gap / 2;
    const rx = split.at + split.gap / 2;
    girders.push({
      x0,
      y0: towerSurfaceY(i, x0),
      x1: lx,
      y1: towerSurfaceY(i, lx),
      belt,
      wallL,
      wallR: false,
    });
    girders.push({
      x0: rx,
      y0: towerSurfaceY(i, rx),
      x1,
      y1: towerSurfaceY(i, x1),
      belt,
      wallL: false,
      wallR,
    });
  }

  const ladders: LadderDef[] = [];
  for (let k = 0; k < FLOORS - 1; k++) {
    const x = o.ladderXs[k]!;
    ladders.push({
      x,
      // Evaluated, never typed. A ladder foot half a unit under the floor is a
      // mount that fails at CLIMB.mountY and is invisible in the data.
      yTop: towerSurfaceY(k + 1, x),
      yBottom: towerSurfaceY(k, x),
      gated: k === FLOORS - 2,
    });
  }

  return { girders, ladders };
}

// ─── The five new towers ────────────────────────────────────────────────────
//
// Six towers across ten levels, and every tower is seen twice except E and F.
// A tower you meet a second time is one you get to be GOOD at: the second visit
// keeps the route you learned and adds exactly one thing. That is the only way a
// difficulty curve can be steep and fair at the same time — steepness that comes
// from new geometry is just a new game every level, and nothing accumulates.

// ─── THE AXIS NOBODY WOULD GUESS FROM A SCREENSHOT: THE GRAIN ──────────────
//
// A ladder layout decides, floor by floor, whether the player sweeps ACROSS the
// barrels or ALONG WITH them, and it is the single biggest difficulty lever in
// the game — bigger than barrel speed, and completely invisible in the level
// row's numbers.
//
//   AGAINST THE GRAIN: the traverse runs uphill, into the barrel flow. Every
//   encounter is head-on, closing fast, and the answer is the jump — a decision
//   the player makes once and either wins or loses cleanly.
//
//   WITH THE GRAIN: the traverse runs downhill, the same way the barrels roll.
//   The player overtakes them from behind at a closing speed of a few units a
//   second, so every barrel is a slow, ambiguous negotiation, and the ladder at
//   the far end is the exact spot barrels pile up before they fall off.
//
// Measured with tools/simulate.ts, the same tower costs roughly two extra deaths
// a run with the grain. So it is assigned deliberately: B and D run against it
// (levels 3, 5, 6, 8 — the teaching levels and the rest beat), C, E and F run
// with it (levels 4, 7, 9, 10 — where the game is supposed to bite).

/** B — the kitchen. Belts on the odd floors. AGAINST the grain on every floor. */
const LADDERS_B = [140, 396, 152, 404, 168, 268] as const;
/** C — plain girders, a long sweep on every floor. WITH the grain throughout. */
const LADDERS_C = [372, 176, 356, 132, 420, 316] as const;
/** D — the lift shafts. Ladders stay; the cars are a faster, riskier alternate. */
const LADDERS_D = [152, 416, 144, 424, 168, 300] as const;
/** E — the gauntlet. Two floors cut in half; the gap is the level. */
const LADDERS_E = [404, 200, 396, 180, 412, 260] as const;
/** F — the finale. B's rhythm, D's shaft, E's pressure. */
const LADDERS_F = [388, 160, 380, 172, 400, 292] as const;

/**
 * D's two cars.
 *
 * Both are ALTERNATES, never the only way up — every floor of layout D still has
 * its ladder. A lift that is the sole route turns a timing hazard into a queue,
 * and a player who mistimes it stands still watching the clock, which is the one
 * thing a 75-second level cannot afford.
 */
function liftsD(): LiftDef[] {
  return [
    // Car A skips a WHOLE FLOOR PAIR (F2→F4) rather than a single hop, and it
    // lands at the head of F4's traverse rather than in the middle of it. Both
    // are consequences of one rule the validator enforces: a shortcut that drops
    // the player ABOVE a rakhi they still need turns the optimal sweep into a
    // climb back down, and descending through barrels you already passed is
    // rework rather than difficulty. tools/validate-levels.ts fails the build on
    // it, which is how this car ended up here instead of on F1→F3.
    { x: 436, yTop: towerSurfaceY(4, 436), yBottom: towerSurfaceY(2, 436), w: 30, speed: 46, phase: 0 },
    { x: 496, yTop: towerSurfaceY(3, 496), yBottom: towerSurfaceY(1, 496), w: 30, speed: 40, phase: 0.5 },
  ];
}

// ─── Levels 3–10 ────────────────────────────────────────────────────────────
//
// ─── THE INVARIANT, AND WHERE IT BREAKS ON PURPOSE ─────────────────────────
//
// Levels 1–6 keep barrelSpeed BELOW PHYS.runSpeed (150). That is the beginner's
// whole safety net: every mistake has an escape that needs no timing, because
// walking away always works. It is why a first-time player survives level 4.
//
// FROM LEVEL 7 THE BARRELS ARE FASTER THAN THE PLAYER. Walking away stops
// working, and the only answers left are the jump, the ladder and the shaker —
// which is exactly the set levels 1–6 spent six levels teaching. The difficulty
// spike at 7 is not new content; it is the removal of the crutch, timed for the
// moment the alternatives are already fluent.
//
// The hard ceiling is 1.35 × runSpeed = 202. Past that a barrel crosses the
// agent's own hitbox width inside two frames and the jump window closes below
// human reaction time — the level stops being hard and starts being random.
// tools/validate-levels.ts fails the build on it rather than trusting this note.
//
// ─── THE CURVE IS NON-MONOTONE, AND THAT IS THE DESIGN ─────────────────────
//
// L3 DIPS on barrel pressure because it introduces an archetype. No level in
// this game introduces two things at once; the level that teaches belts is not
// also the level that teaches speed, or the player learns neither and blames the
// one they can see.
//
// L6 IS THE REST BEAT AND MUST NOT READ AS FILLER. Longest timer of the first
// nine, one pickup on every floor from F1 to F5, a shaker, and a tower the player
// already knows. It is a playground and a score payday, not a spacer — a rest beat that
// feels like a gap in the game is a place people stop playing.
//
// L9 IS THE HIGHEST DENSITY AND THE SHORTEST TARGET TIME. Intensity, not
// endurance: the hardest thirty seconds in the game, deliberately over quickly.
//
// L10 has the hardest parameters AND the longest timer AND two shakers. A finale
// is the hardest level, not an impossible one — the last thing a player does
// should be the best they have ever played, and that requires enough room to
// actually play it.

const LEVEL_3: StageDef = (() => {
  // Belts push AGAINST the barrel roll on F1 and F5 and WITH it on F3, so the
  // first belt the player ever meets helps them and the third one does not.
  const t = tower({ ladderXs: LADDERS_B, belts: { 1: 1, 3: -1, 5: 1 } });
  return {
    kind: 'kitchen',
    nameIdx: 2,
    girders: t.girders,
    ladders: t.ladders,
    spawners: [{ x: 496, y: towerSurfaceY(5, 496), intervalSec: 2.9, jitterSec: 0.5, wildChance: 0 }],
    // The four positions level 3 was tuned around, resplit: one rakhi, three
    // dishes. The rakhi is on F1, which is a BELT floor — the conveyor carries the
    // player into it, so the first pickup of the level costs zero seconds and the
    // level's new mechanic is the thing that hands it over.
    rakhis: [onLine(1, 300)],
    foods: [
      { ...onLine(2, 250), kind: 0 },
      { ...onLine(3, 280), kind: 1 },
      { ...onLine(4, 300), kind: 2 },
    ],

    agentStart: onFloor(0, 80),
    monkeyAt: onFloor(5, 496),
    customerAt: onFloor(6, 330),

    // 108. Still well under runSpeed — see the invariant above. The belts are
    // the lesson; the barrels are the same barrels.
    barrelSpeed: 108,
    barrelLadderChance: 0.32,
    maxBarrels: 6,
    // Zero: these belts do not reverse. That arrives on level 6, on this same
    // tower, so the player learns the reversal against a route they already own.
    beltPeriodSec: 0,
    timerSec: 85,

    shakerCount: 0,
    shakerSec: 0,
    helmetCount: 0,
    turboCount: 0,
    turboSec: 0,

    clearPoints: 1400,
    timeBonusPerSec: 50,
  };
})();

const LEVEL_4: StageDef = (() => {
  const t = tower({ ladderXs: LADDERS_C });
  return {
    kind: 'girders',
    nameIdx: 3,
    girders: t.girders,
    ladders: t.ladders,
    // A SLOWER CADENCE THAN LEVEL 3'S, on a harder tower. Layout C runs WITH the
    // grain (see the note above LADDERS_B), which measured out at roughly two
    // extra deaths a run on its own — so the level that INTRODUCES the flames
    // buys that back with air between the barrels. The new mechanic is the
    // lesson; the barrels are not allowed to be a second one.
    spawners: [{ x: 496, y: towerSurfaceY(5, 496), intervalSec: 3.2, jitterSec: 0.5, wildChance: 0 }],
    rakhis: [onLine(1, 260)],
    foods: [
      { ...onLine(2, 270), kind: 3 },
      { ...onLine(3, 240), kind: 4 },
      { ...onLine(4, 280), kind: 0 },
    ],

    // Two flames and the answer to them, on the same level and in that order:
    // the shaker sits on F2, one floor below the first flame's deck.
    flames: [
      { ...onFloor(2, 400), dir: -1 },
      { ...onFloor(4, 120), dir: 1 },
    ],
    flameChaseChance: 0.34,
    shakers: [onLine(2, 300)],

    agentStart: onFloor(0, 80),
    monkeyAt: onFloor(5, 496),
    customerAt: onFloor(6, 316),

    barrelSpeed: 116,
    barrelLadderChance: 0.38,
    maxBarrels: 7,
    timerSec: 85,

    shakerCount: 1,
    shakerSec: 6,
    helmetCount: 0,
    turboCount: 0,
    turboSec: 0,

    clearPoints: 1600,
    timeBonusPerSec: 50,
  };
})();

const LEVEL_5: StageDef = (() => {
  const t = tower({ ladderXs: LADDERS_D });
  return {
    kind: 'lifts',
    nameIdx: 4,
    girders: t.girders,
    ladders: t.ladders,
    lifts: liftsD(),
    spawners: [{ x: 496, y: towerSurfaceY(5, 496), intervalSec: 2.7, jitterSec: 0.5, wildChance: 0 }],

    // THE F4 DISH IS THE FREE ONE. It sits in car A's column at the top of its
    // travel, so a player who rides up collects it without stopping — and a
    // player who takes the ladder walks twelve units right and gets it anyway.
    // A collectible that costs zero seconds is what makes "collect them all"
    // read as generous rather than as a tax on the clock, and it is now the ORDER
    // that gets the gift rather than the rakhis, because the order is the bigger
    // half of the sweep from here on.
    rakhis: [onLine(1, 280), onLine(2, 290)],
    foods: [
      { ...onLine(3, 300), kind: 1 },
      { ...onLine(4, 436), kind: 2 },
      { ...onLine(5, 250), kind: 3 },
    ],

    // THE FIRST HELMET IN THE GAME, on F2, one floor BELOW the F3 traverse that
    // this level's deaths happen on (see the shaker note). Deliberately in front
    // of the danger rather than on top of it: a charge the player is already
    // wearing when they arrive is one they get to spend on the mistake, whereas a
    // charge sitting on the killing floor is one they collect after surviving it.
    helmets: [onLine(2, 250)],

    // MID-FLOOR LANES, deliberately clear of every ladder head (144/152/168/
    // 300/416/424). A lane over a ladder is a lane the player meets at the one
    // moment they cannot dodge, and it would make the tiffins read as the
    // ladders being unsafe rather than as a timing problem of their own.
    tiffins: [
      { x: 250, y: 60, intervalSec: 3.6, phase: 0 },
      { x: 340, y: 60, intervalSec: 3.6, phase: 0.5 },
    ],

    // ON F3, WHICH IS WHERE THIS LEVEL KILLS PEOPLE. Measured, not guessed:
    // tools/simulate.ts put nearly every death on the F3 traverse, where a
    // barrel train arrives head-on with the ladder head at the far end and no
    // side exit. Level 5 is the only level that introduces TWO mechanics at once
    // — the cars and the lanes — and the shaker is the tax that buys back.
    shakers: [onLine(3, 360)],

    agentStart: onFloor(0, 80),
    monkeyAt: onFloor(5, 496),
    customerAt: onFloor(6, 300),

    barrelSpeed: 120,
    barrelLadderChance: 0.4,
    maxBarrels: 6,
    timerSec: 80,

    // FOUR SECONDS, and the shortest window in the game. Measured: with no
    // shaker at all level 5 came out harder than level 9 (the bot cleared 3 of 8
    // and died twice a run), and at six seconds it cleared 8 of 8 without dying
    // once. The window is the dial between those two, and it is short because
    // this is the level that TEACHES the powerup's shape — long enough to cross
    // the floor that kills you, not long enough to climb the tower under it.
    shakerCount: 1,
    shakerSec: 4,
    helmetCount: 1,
    turboCount: 0,
    turboSec: 0,

    clearPoints: 1800,
    timeBonusPerSec: 50,
  };
})();

const LEVEL_6: StageDef = (() => {
  const t = tower({ ladderXs: LADDERS_B, belts: { 1: 1, 3: -1, 5: 1 } });
  return {
    kind: 'kitchen',
    nameIdx: 5,
    girders: t.girders,
    ladders: t.ladders,
    spawners: [{ x: 496, y: towerSurfaceY(5, 496), intervalSec: 2.6, jitterSec: 0.5, wildChance: 0 }],

    // FIVE PICKUPS, ONE CHAIN — two rakhis and a three-dish order, all on the
    // line, one per floor from F1 to F5. This is the payday: the chain is shared
    // across both collectibles (see game/session.ts), so a clean sweep here banks
    // a five-long chain, and the chain cap is what the score screen is made of.
    //
    // The old sixth pickup — a second one on F2 — is simply gone rather than
    // relocated. The totals across all ten levels stay flat against the 47 they
    // were tuned at, and a rest beat is the right place to spend the difference.
    rakhis: [onLine(1, 300), onLine(2, 330)],
    foods: [
      { ...onLine(3, 280), kind: 1 },
      { ...onLine(4, 300), kind: 2 },
      { ...onLine(5, 210), kind: 3 },
    ],
    shakers: [onLine(3, 330)],

    agentStart: onFloor(0, 80),
    monkeyAt: onFloor(5, 496),
    customerAt: onFloor(6, 330),

    barrelSpeed: 126,
    barrelLadderChance: 0.44,
    maxBarrels: 8,
    // THE ONE NEW THING. Nine seconds a cycle, with BELT.flipWarnSec of
    // telegraph — long enough to finish the traverse you started.
    beltPeriodSec: 9,
    // The longest timer of the first nine levels, on a tower the player has
    // already cleared once. Room, on purpose.
    timerSec: 90,

    shakerCount: 1,
    shakerSec: 8,
    helmetCount: 0,
    turboCount: 0,
    turboSec: 0,

    clearPoints: 2000,
    timeBonusPerSec: 50,
  };
})();

const LEVEL_7: StageDef = (() => {
  const t = tower({ ladderXs: LADDERS_C });
  return {
    kind: 'girders',
    nameIdx: 6,
    girders: t.girders,
    ladders: t.ladders,
    spawners: [{ x: 496, y: towerSurfaceY(5, 496), intervalSec: 2.5, jitterSec: 0.45, wildChance: 0.12 }],
    rakhis: [onLine(1, 260), onLine(3, 240)],
    // FOUR DISHES, and the first one is on the GROUND FLOOR — on the walk from
    // the start to the first ladder, before a single barrel has reached the
    // player. The biggest order so far opens with the easiest item in the game,
    // which is how a level that removes the beginner's crutch avoids also
    // removing their footing.
    foods: [
      { ...onLine(0, 220), kind: 0 },
      { ...onLine(2, 270), kind: 1 },
      { ...onLine(4, 280), kind: 2 },
      { ...onLine(5, 360), kind: 3 },
    ],

    // Fixed cadence, no jitter. See ScooterDef.
    scooters: [
      { ...onFloor(1, 500), dir: -1, speed: 132, intervalSec: 5.5, phase: 0 },
      { ...onFloor(3, 500), dir: -1, speed: 132, intervalSec: 5.5, phase: 0.5 },
    ],
    shakers: [onLine(2, 320)],

    // THE FIRST TURBO, ON THE LEVEL WHERE WALKING AWAY STOPPED WORKING, and on
    // F1 — the first floor above the ground, which is where the player meets a
    // 158-unit barrel for the first time. 1.45 × 150 is 217, so for five seconds
    // the old crutch is handed back: the answer to a barrel is once again "walk
    // away from it". Teaching a powerup by using it to restore a rule the player
    // has just lost is the clearest lesson this game can give.
    turbos: [onLine(1, 320)],

    agentStart: onFloor(0, 80),
    monkeyAt: onFloor(5, 496),
    customerAt: onFloor(6, 316),

    // ─── 158. THE INVARIANT BREAKS HERE, ON PURPOSE. ───────────────────────
    // Above PHYS.runSpeed for the first time. Walking away no longer works, and
    // the player is left with the jump, the ladder and the shaker — the three
    // things levels 1–6 exist to teach. The tower is layout C, which they have
    // already cleared on level 4, so the ONLY new variable is the speed.
    barrelSpeed: 158,
    barrelLadderChance: 0.46,
    maxBarrels: 9,
    timerSec: 75,

    shakerCount: 1,
    shakerSec: 6,
    helmetCount: 0,
    turboCount: 1,
    turboSec: 5,

    clearPoints: 2400,
    timeBonusPerSec: 50,
  };
})();

const LEVEL_8: StageDef = (() => {
  // D's second visit adds exactly one thing: belts, on the two floors the cars
  // do not serve, so the lift and the conveyor are never the same decision.
  const t = tower({ ladderXs: LADDERS_D, belts: { 2: -1, 4: 1 } });
  return {
    kind: 'lifts',
    nameIdx: 7,
    girders: t.girders,
    ladders: t.ladders,
    lifts: liftsD(),
    spawners: [{ x: 496, y: towerSurfaceY(5, 496), intervalSec: 2.4, jitterSec: 0.45, wildChance: 0.14 }],
    rakhis: [onLine(1, 280), onLine(2, 290)],
    foods: [
      { ...onLine(2, 200), kind: 0 },
      { ...onLine(4, 270), kind: 1 },
      { ...onLine(4, 436), kind: 2 },
      { ...onLine(5, 250), kind: 3 },
    ],
    // NO SHAKER. Layout D's second visit is the level where the player is
    // expected to own the tower: they have already cleared it once, the route is
    // memorised, and the belts are the only new thing. Handing them the powerup
    // as well measured out at a third of a death per run — a level 8 easier than
    // level 4, which is not a curve, it is a plateau with a bump in it.
    //
    // A HELMET INSTEAD, and the two are not interchangeable. The shaker is a
    // window that rewrites six seconds of the level; the helmet is one free
    // mistake and changes nothing else. On the level where the player is meant to
    // prove they own the tower, forgiving a single error is the right size of
    // help — it removes the sting of one death without removing the floor's
    // pressure for even a second. Placed on F3, the traverse between the two
    // belt floors, so it is picked up between the level's two new problems.
    helmets: [onLine(3, 300)],

    agentStart: onFloor(0, 80),
    monkeyAt: onFloor(5, 496),
    customerAt: onFloor(6, 300),

    barrelSpeed: 168,
    barrelLadderChance: 0.48,
    maxBarrels: 9,
    beltPeriodSec: 0,
    timerSec: 75,

    shakerCount: 0,
    shakerSec: 0,
    helmetCount: 1,
    turboCount: 0,
    turboSec: 0,

    clearPoints: 2800,
    timeBonusPerSec: 50,
  };
})();

const LEVEL_9: StageDef = (() => {
  // 48-unit cuts against a 70-unit jump reach: comfortably clearable, close
  // enough that a mistimed one is a fall rather than a stumble. The validator
  // fails the build past 90% of reach, which is 63.
  const t = tower({
    ladderXs: LADDERS_E,
    splits: [
      { floor: 2, at: 244, gap: 48 },
      { floor: 4, at: 244, gap: 48 },
    ],
  });
  return {
    kind: 'girders',
    nameIdx: 8,
    girders: t.girders,
    ladders: t.ladders,
    spawners: [
      { x: 496, y: towerSurfaceY(5, 496), intervalSec: 2.2, jitterSec: 0.4, wildChance: 0.16 },
      // The second thrower is what makes this the density level, but it is
      // deliberately slow: two sources on a 2.2s cadence would put barrels on
      // the tower faster than they can leave it, and a screen with no gap in it
      // is not difficulty, it is a stopped game.
      { x: 448, y: towerSurfaceY(3, 448), intervalSec: 6, jitterSec: 0.5, wildChance: 0 },
    ],
    rakhis: [onLine(1, 300), onLine(3, 280)],
    // BOTH F2 AND F4 DISHES SIT ON THE FAR PIECE OF A CUT FLOOR — past the gap
    // the player arrives needing to cross anyway, never suspended over it. A
    // required collectible above a hole is a level that asks for a jump the
    // player must land twice: once to progress, once to not lose the item.
    foods: [
      { ...onLine(2, 300), kind: 0 },
      { ...onLine(4, 340), kind: 1 },
      { ...onLine(5, 340), kind: 2 },
    ],

    // ON THE CUT FLOORS, both of them, and NOWHERE ELSE. A flame on a split
    // deck contests the gap jump, which is what this level is about; two
    // hazards stacked on the FIRST floor the player reaches is not density, it
    // is a wall, and a wall at the start of a 70-second level is where people
    // put the phone down.
    // ONE flame, on a cut deck, contesting the gap jump. Two was measurably a
    // wall rather than a gauntlet: L9 already carries the highest barrel count
    // in the game, two spawners and the shortest clock, and density that stacks
    // three unrelated threats on one floor stops being readable.
    // On the SECOND cut deck, not the first. F2 is where the player learns the
    // gap; putting the flame there means their first attempt at a new verb is
    // also their first attempt at a new verb under fire, and they learn neither.
    flames: [{ ...onFloor(4, 340), dir: -1 }],
    flameChaseChance: 0.4,
    scooters: [{ ...onFloor(3, 500), dir: -1, speed: 138, intervalSec: 5, phase: 0.25 }],
    // ON F1, THE FIRST FLOOR ABOVE THE GROUND. The highest-density level in the
    // game is also the one where the player is under pressure soonest, so its
    // one shaker is placed where the pressure starts rather than as a reward for
    // having already survived it.
    shakers: [onLine(1, 300)],
    // THE FULL KIT, ON THE DENSEST LEVEL, AND DELIBERATELY BACK-LOADED. Both sit
    // on the FAR piece of a cut floor: the helmet past F2's gap, the turbo past
    // F4's. The player therefore crosses both gaps unaided and is paid for it
    // afterwards, which is the only ordering that leaves this level's signature
    // moment — the jump over the hole — an actual test.
    //
    // Measured, and the ordering is the whole difference. Every floor the turbo is
    // moved DOWN to hands the boost to the gap crossings and softens the level:
    // F3 clears 5 of 8 at 1.13 deaths a run, F2 clears 6 of 8 at 0.75. Back-loaded
    // onto F4 it is 4 of 8 at 1.50 — a level 9 that is still the hardest thirty
    // seconds in the game, which is the shape this level is for.
    helmets: [onLine(2, 340)],
    turbos: [onLine(4, 300)],

    agentStart: onFloor(0, 80),
    monkeyAt: onFloor(5, 496),
    customerAt: onFloor(6, 280),

    barrelSpeed: 180,
    barrelLadderChance: 0.52,
    maxBarrels: 11,
    // THE SHORTEST TIMER IN THE GAME, against the highest density. Seventy
    // seconds is roughly 1.75× the 40-second target — the same headroom every
    // other level gets. Short and sharp is a shape, not a punishment.
    timerSec: 70,

    shakerCount: 1,
    shakerSec: 6,
    helmetCount: 1,
    turboCount: 1,
    turboSec: 5,

    clearPoints: 3200,
    timeBonusPerSec: 50,
  };
})();

const LEVEL_10: StageDef = (() => {
  const t = tower({ ladderXs: LADDERS_F, belts: { 1: 1, 4: -1 } });
  return {
    kind: 'delivery',
    nameIdx: 9,
    girders: t.girders,
    ladders: t.ladders,
    lifts: [
      { x: 468, yTop: towerSurfaceY(3, 468), yBottom: towerSurfaceY(1, 468), w: 30, speed: 50, phase: 0 },
    ],
    spawners: [{ x: 496, y: towerSurfaceY(5, 496), intervalSec: 2.2, jitterSec: 0.4, wildChance: 0.18 }],
    // THREE RAKHIS AND A FOUR-DISH ORDER — the largest of both in the game, and
    // still seven pickups against the six the finale was tuned with. One dish is
    // on F0, which is the one floor the player crosses before the first barrel
    // arrives: the biggest order in the game opens with a free item, because a
    // finale should feel like a victory lap that gets harder, not like a tax
    // levied at the front door.
    rakhis: [onLine(1, 280), onLine(3, 280), onLine(5, 340)],
    foods: [
      { ...onLine(0, 320), kind: 0 },
      { ...onLine(2, 200), kind: 1 },
      { ...onLine(2, 270), kind: 2 },
      { ...onLine(4, 280), kind: 3 },
    ],

    // THE ORDER PINS. Four, all on floors the route already crosses, and the
    // door will not accept the delivery until every one is pushed. They are the
    // finale's second objective layer and they cost no detour — the finale asks
    // the player to do what they have been doing, under everything at once.
    pins: [onLine(0, 250), onLine(1, 340), onLine(3, 240), onLine(4, 330)],

    flames: [
      { ...onFloor(2, 400), dir: -1 },
      { ...onFloor(4, 120), dir: 1 },
    ],
    flameChaseChance: 0.42,
    tiffins: [
      { x: 220, y: 60, intervalSec: 4, phase: 0 },
      { x: 420, y: 60, intervalSec: 4, phase: 0.5 },
    ],
    scooters: [{ ...onFloor(3, 500), dir: -1, speed: 140, intervalSec: 5.5, phase: 0 }],
    // TWO shakers, one low and one high. The finale is meant to be BEATEN — but
    // spread, not banked: back-to-back pickups refresh one window rather than
    // stacking two (see game/hazards.ts), so placing both early would spend the
    // level's whole safety net on its easiest floors.
    shakers: [onLine(1, 220), onLine(4, 340)],
    // EVERY TOOL THE GAME HAS, ON THE FLOORS THE SHAKERS DO NOT COVER. Shakers
    // are on F1 and F4; the helmet takes F2 (the flame deck) and the turbo F3 (the
    // scooter traverse), so no floor of the finale carries two answers to the same
    // problem and no floor carries none.
    //
    // THE TURBO'S FLOOR IS THE WHOLE DIFFICULTY OF THIS LEVEL, measured, and the
    // answer is "the middle". Every other floor trivialises the finale outright:
    // on F1 the bot clears 8 of 8 without dying, because a boost taken early
    // blitzes the bottom of the tower before it has become dangerous; on F4 also 8
    // of 8, because that is the last long traverse under the 195-unit barrel
    // train; on F5, 8 of 8 again, because six seconds covers the whole approach to
    // the gated ladder. On F3 it is 6 of 8 at 0.88 deaths a run — the boost buys
    // the player exactly one hard floor and leaves the other five intact.
    //
    // The x is 330 rather than 300 for a reason that is not tuning: F3 already
    // carries a pin at 240 and a rakhi at 280, and two pickups whose 22-unit radii
    // overlap are two pickups the player cannot aim at separately. The duration is
    // NOT the dial here — dropping turboSec from 6 to 4 moved nothing measurable,
    // because what this powerup is worth on this level is decided by which floor
    // it is spent on, not by how long it lasts.
    helmets: [onLine(2, 320)],
    turbos: [onLine(3, 330)],

    agentStart: onFloor(0, 80),
    monkeyAt: onFloor(5, 496),
    // Three positions, six seconds apart, so the barrel ENTRY LANE moves and the
    // memorised opening stops being an opening.
    monkeySlots: [onFloor(5, 496), onFloor(5, 460), onFloor(5, 424)],
    monkeyShiftSec: 6,
    customerAt: onFloor(6, 330),

    // 195, against the 202 ceiling. The hardest number in the game and still
    // under the line where the jump window closes below reaction time.
    barrelSpeed: 195,
    barrelLadderChance: 0.55,
    maxBarrels: 12,
    beltPeriodSec: 10,
    // The LONGEST timer in the game. A finale is the hardest level, not an
    // impossible one, and 100 seconds against a 62-second target is the room a
    // player needs to actually play their best run rather than their fastest.
    timerSec: 100,

    shakerCount: 2,
    shakerSec: 7,
    helmetCount: 1,
    turboCount: 1,
    turboSec: 6,

    clearPoints: 4000,
    timeBonusPerSec: 60,
  };
})();

/**
 * All ten. game/level.ts CLAMPS the lookup, so a build that ships fewer rows is
 * a build with fewer levels rather than a black screen.
 */
export const LEVELS: readonly StageDef[] = [
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  LEVEL_4,
  LEVEL_5,
  LEVEL_6,
  LEVEL_7,
  LEVEL_8,
  LEVEL_9,
  LEVEL_10,
];
