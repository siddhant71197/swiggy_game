/**
 * ══════════════════════════════════════════════════════════════════════════
 *  TYPES — the shape agreements that stop two modules from being subtly wrong.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: the disagreement that typechecks. A physics
 * module that thinks `y` is the top of a sprite and a collision module that
 * thinks it is the feet both compile perfectly, and the bug that results is a
 * character who sinks into girders on slopes only, on some floors only. There
 * is no test that catches it and no stack trace that points at it.
 *
 * So the conventions that cannot be expressed in the type system are written
 * down HERE, next to the fields they govern, rather than in a design doc that
 * the next person does not read.
 *
 * This file declares types only. It has no runtime, no imports, and — like
 * everything else under core/ except loop.ts and storage.ts — no reference to
 * any DOM global, wall clock or unseeded randomness, which is what lets tools/
 * import the real engine and play every level under bare Node.
 */

// ─── Scalars ────────────────────────────────────────────────────────────────

/** Horizontal intent, and conveyor direction. 0 is genuinely "neither". */
export type Dir = -1 | 0 | 1;

/**
 * The four pointer phases the input layer normalises touch and mouse into.
 * `cancel` is separate from `up` on purpose: a browser stealing the gesture for
 * a scroll must release the D-pad WITHOUT counting as a jump release, or the
 * player jumps every time they brush the edge of the screen.
 */
export type PointerKind = 'down' | 'move' | 'up' | 'cancel';

// ─── Bodies ─────────────────────────────────────────────────────────────────

/**
 * Axis-aligned dynamic body — the agent, every barrel, every pin.
 *
 * ─── x,y IS FEET-CENTRE, AND THAT IS A CONTRACT ────────────────────────────
 *
 * Not a convention, not a preference: a contract, because every ground query in
 * this game is literally "what is under my feet at my x". Girders are sloped
 * segments, so the answer is `y0 + slope * (x - x0)` evaluated at the body's x —
 * and that expression wants the body's x to be its horizontal CENTRE and its y
 * to be the point that rests on the line.
 *
 * Store top-left instead and that same expression grows a `+ h` and an
 * `+ w * 0.5`, at roughly forty call sites: landing, the swept landing test,
 * conveyor transfer, ladder snap, barrel steering, the fall-off-an-open-end
 * check, hazard overlap, the render lerp, the camera follow. Forty is well past
 * the number at which one of them is eventually written without the offset. The
 * symptom is a body half-sunk into a girder on slopes only — no crash, no test
 * failure, just a character who looks wrong on the floors that slope down.
 *
 * `w` is HALF-width and `h` is FULL height measured UPWARD from y. Half on one
 * axis and full on the other looks inconsistent and is deliberate: horizontal
 * tests are always symmetric about the centre (`x ± w`), and vertical tests are
 * always "from my feet up" (`y - h` is the head). Each field is stored in the
 * form the code actually uses, so neither one is ever halved or doubled at a
 * call site.
 */
export interface Body {
  /** Feet-centre. See the header — this is a contract. */
  x: number;
  y: number;

  vx: number;
  vy: number;

  /**
   * The PREVIOUS step's x,y. Two consumers, and both are load-bearing.
   *
   * The swept landing test: at fall speed a body can cross a girder entirely
   * within one 1/60s step, so landing is decided by whether the segment
   * `(px,py) → (x,y)` crossed the girder line, never by a point test at the new
   * position. Without this a fast barrel falls through the floor it should have
   * bounced on.
   *
   * The render lerp: the renderer draws at `lerp(p, current, alpha)` so a fixed
   * 60Hz sim presents smoothly on a 120Hz panel.
   */
  px: number;
  py: number;

  /** HALF-width. Horizontal extent is x ± w. */
  w: number;
  /** FULL height ABOVE y. The head is at y - h. */
  h: number;

  grounded: boolean;

  /**
   * Index into `stage.girders` while grounded, else -1.
   *
   * Held rather than re-derived per step because a body standing on the overlap
   * of two girders must not flicker between them: which one it is ON is history,
   * not geometry, and re-querying every step would let a rounding wobble hand it
   * to the other segment and teleport it by the slope difference.
   */
  segId: number;
}

// ─── Level geometry ─────────────────────────────────────────────────────────

/**
 * One floor of the tower.
 *
 * ─── A GIRDER IS A LINE SEGMENT, NOT A ROW OF TILES ────────────────────────
 *
 * The tile grid is the obvious representation and it cannot express this game.
 * The floors slope at roughly 1-in-12, and a grid has exactly two ways to say
 * that, both of which are worse:
 *
 *   1. Stair-step it. Now the surface is a sequence of vertical walls, which
 *      CHANGES THE PHYSICS — a rolling barrel catches on every riser, and a
 *      running agent gets free upward impulses. The gameplay is different, not
 *      just the picture.
 *   2. Keep the grid and add a per-tile sub-tile height offset table. That is a
 *      line segment sampled at tile resolution, i.e. a grid in name only, with
 *      the segment's arithmetic reimplemented badly and a quantisation seam at
 *      every tile boundary.
 *
 * A segment plus a precomputed `slope` is one multiply-add to get the surface
 * height at any x, exactly, with no seams. Everything downstream — landing,
 * walking, barrel roll acceleration, the camera — is that one expression.
 *
 * ─── WHY THE SLOPE SIGN IS THE LEVEL DESIGN ────────────────────────────────
 *
 * Slopes ALTERNATE by floor. Barrels roll downhill, so on one floor they sweep
 * right and on the next they sweep left, and the player is threading a lane that
 * reverses every storey. That serpentine — the thing that makes the tower feel
 * like a tower rather than a stack of identical corridors — is not implemented
 * anywhere. There is no barrel logic that says "reverse on odd floors". It falls
 * out of the sign of `slope`, which means level design happens by editing two
 * numbers in a level table rather than by editing entity behaviour.
 *
 * `x1 > x0` ALWAYS. Normalised at load, once, so that no consumer has to ask
 * which end is which. An un-normalised segment silently inverts `slope`, which
 * inverts the barrel sweep, which quietly turns a designed level into a
 * different one.
 */
export interface Girder {
  id: number;

  x0: number;
  y0: number;
  /** Strictly greater than x0 — normalised on load. */
  x1: number;
  y1: number;

  /** (y1 - y0) / (x1 - x0), precomputed at load. Read every step, per body. */
  slope: number;

  /**
   * Conveyor push direction; 0 is a plain girder.
   *
   * A `Dir`-shaped field written out inline because a belt is a property of the
   * floor rather than an intent, and reusing the intent alias here would invite
   * someone to assign a body's facing to it.
   */
  belt: -1 | 0 | 1;

  /**
   * What happens at each end. A SOLID end stops you; an OPEN end drops you.
   *
   * Per-end rather than per-girder because that asymmetry is the level's
   * grammar: a floor walled on the left and open on the right is a one-way
   * commitment, and the same segment mirrored on the floor above is what makes
   * the climb read as a route instead of a corridor.
   */
  solidLeft: boolean;
  solidRight: boolean;
}

// ─── Persistence ────────────────────────────────────────────────────────────

/**
 * Everything that survives a reload. Deliberately flat and deliberately small.
 *
 * `version` is checked on load and a mismatch discards the whole file rather
 * than migrating it — see core/storage.ts for why that is the cheaper mistake.
 *
 * `levelBest` is a sparse-by-convention array indexed by level number; a short
 * array from an older build is read through the same coercion as everything
 * else, so a missing index is a default rather than an `undefined` that reaches
 * the results screen.
 */
export interface SaveData {
  version: number;
  bestLevel: number;
  highScore: number;
  /** Whether the rules card has been shown. Gates the tutorial, nothing else. */
  seenRules: boolean;
  muted: boolean;
  /** Best score per level, indexed by level number. */
  levelBest: number[];
}
