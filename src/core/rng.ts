/**
 * ══════════════════════════════════════════════════════════════════════════
 *  RNG — randomness that can be asked to happen again.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: the platform's built-in random in the
 * simulation. It costs nothing to write and it costs three capabilities at once,
 * none of which can be recovered afterwards without touching every spawn site:
 *
 *   1. REPLAY. A run cannot be reproduced from its inputs, so "the barrel came
 *      out of nowhere" is a report nobody can act on.
 *   2. `?seed=` BUG REPORTS. A tester pasting a seed into the URL and getting a
 *      byte-identical level is the difference between a fixable bug and a
 *      three-day hunt. That URL only works if the seed is the ONLY source of
 *      variation in the sim.
 *   3. THE HEADLESS BOT. tools/ imports this engine under bare Node and plays
 *      every level to measure difficulty before it ships. If the layout differs
 *      between the bot's run and the build it is measuring, the measurement is
 *      of a game nobody will play. Comparing two BUILDS requires the seed to
 *      pin everything the sim does.
 *
 * The built-in is also unseedable by construction, so this is not a "we could
 * swap it later" situation: it is unseedable in every engine, forever. Which is
 * why the build gate greps src/core/ and src/game/ for it outright.
 *
 * ─── SEPARATE STREAMS, VIA fork() ──────────────────────────────────────────
 * The sim draws from its stream; the cosmetic layer wants jitter too. Share one
 * stream and the number of particles the RENDERER happened to spawn last frame
 * shifts the SIM's next draw — at which point a "seeded" replay reproduces only
 * on a machine with the same frame rate. `fork()` derives an independent stream
 * deterministically from the parent's own next draw, so the split is reproducible
 * but the two streams never interleave.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [0, n). Returns 0 for n <= 0. */
  int(n: number): number;
  /** Float in [a, b). */
  range(a: number, b: number): number;
  /** True with probability p. p <= 0 never, p >= 1 always. */
  chance(p: boolean | number): boolean;
  /** A new independent stream, derived deterministically. See the header. */
  fork(): Rng;
}

/**
 * Mulberry32: 32-bit state, one multiply-xor round, ~2^32 period.
 *
 * Chosen over a bigger generator because the requirement is REPRODUCIBILITY, not
 * cryptographic quality — nothing here guards anything. What matters is that
 * every operation stays in 32-bit integer space via `Math.imul` and `>>>`, so
 * the sequence is bit-identical in every JS engine, on every platform, in the
 * browser and under bare Node. A generator using float arithmetic would drift
 * between engines and quietly break exactly the three properties above.
 */
export function makeRng(seed: number): Rng {
  // `>>> 0` normalises negatives, fractions and NaN into the 32-bit domain the
  // whole generator lives in. A NaN seed would otherwise poison every draw.
  let a = seed >>> 0;

  function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    // Divided by 2^32 rather than masked to a smaller range: keeping all 32 bits
    // means int(n) for large n is not visibly quantised.
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const rng: Rng = {
    next,
    int(n: number): number {
      if (!(n > 0)) return 0;
      return Math.floor(next() * n);
    },
    range(lo: number, hi: number): number {
      return lo + (hi - lo) * next();
    },
    chance(p: boolean | number): boolean {
      // Booleans are accepted so a tuning table can hold `false` for "never"
      // without the caller branching around the draw — and crucially WITHOUT
      // consuming a number, which would shift every subsequent draw and make
      // toggling one flag change the entire level layout.
      if (typeof p === 'boolean') return p;
      if (!(p > 0)) return false;
      if (p >= 1) return true;
      return next() < p;
    },
    fork(): Rng {
      // Seeded from the parent's next raw draw, hashed away from it so a child
      // and its parent do not produce correlated early values.
      return makeRng(Math.imul((next() * 4294967296) >>> 0, 0x9e3779b1) >>> 0);
    },
  };

  return rng;
}

/**
 * The seed a level number deterministically implies.
 *
 * Golden-ratio hash: 0x9e3779b1 is 2^32/φ, which is the standard choice because
 * multiplying by it spreads sequential inputs across the whole 32-bit range
 * rather than into neighbouring buckets. That matters here specifically —
 * levels ARE sequential, and seeding mulberry32 with 1, 2, 3 directly produces
 * three openings that look like variations on each other, because the
 * generator's first output is dominated by the low bits of its state.
 *
 * The consequence worth stating: level 7 is the same level 7 on every device, in
 * every build, forever. No layout is stored anywhere; the number IS the level.
 */
export function seedFor(level: number): number {
  return (level * 0x9e3779b1) >>> 0;
}
