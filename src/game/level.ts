/**
 * ══════════════════════════════════════════════════════════════════════════
 *  LEVEL — the only place in the codebase that turns a number into a level.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): `LEVELS[level - 1]` scattered across the
 * play scene, the HUD, the results screen and the bot. Four sites, four
 * off-by-one opportunities, and — the one that actually ships — four different
 * behaviours when the index is past the end of a table that is short because
 * levels 3–10 have not been authored yet. Here the lookup is CLAMPED, once, so a
 * build with two levels answers "level 7" with a playable level instead of a
 * black screen, and the day levels 3–10 land nothing else changes.
 *
 * THE FAILURE THIS FILE PREVENTS (2): the rubber band applied twice. EASE
 * multipliers are tempting to apply where they are felt — the spawner scales its
 * own interval, the timer scales itself — and then a player on their sixth death
 * gets a 1.5× interval AND a 1.5× interval, because two modules each thought
 * they owned it. The row comes out of this function already adjusted, and
 * nothing downstream knows the rubber band exists.
 *
 * ─── THE BAND IS NEVER ANNOUNCED ───────────────────────────────────────────
 *
 * Nothing here returns a "difficulty was reduced" flag, and nothing may add one.
 * A player told the game has been made easier for them has been insulted; a
 * player who simply stops dying has been rescued. The whole value of the
 * mechanism is that it is invisible — see EASE in config/tuning.ts.
 */

import { LEVELS, type StageDef } from '../config/levels';
import { EASE } from '../config/tuning';
import { clamp } from '../core/math';

export interface LevelParams {
  /** The level number as asked for, NOT the clamped index. The HUD shows this. */
  level: number;
  def: StageDef;

  /** Already rubber-banded. Consumers apply nothing further. */
  barrelSpeed: number;
  barrelLadderChance: number;
  maxBarrels: number;
  /** Multiplier on every spawner's authored interval. */
  intervalMult: number;
  timerSec: number;
  beltPeriodSec: number;

  clearPoints: number;
  timeBonusPerSec: number;

  /** How many hazard emitters to drop, on levels that have them. Never negative. */
  flameCountDelta: number;

  /** True once the player has died enough that a skip should be offered. */
  offerSkip: boolean;
}

/**
 * Row for `level`, eased for `deaths`.
 *
 * `deaths` is deaths ON THIS LEVEL, not across the run — the band is meant to
 * rescue someone stuck on one wall, not to reward someone who has been losing
 * comfortably for twenty minutes.
 */
export function levelParams(level: number, deaths: number): LevelParams {
  const idx = clamp(Math.floor(level) - 1, 0, LEVELS.length - 1);
  const def = LEVELS[idx]!;

  // One tier per `deathsPerStep`, clamped to the shortest EASE table so adding
  // a fourth entry to one array cannot index past a three-entry sibling.
  const steps = Math.min(
    EASE.barrelIntervalMult.length,
    EASE.barrelSpeedMult.length,
    EASE.timerMult.length,
    EASE.flameCountDelta.length,
  );
  const tier = clamp(Math.floor(Math.max(deaths, 0) / EASE.deathsPerStep), 0, steps - 1);

  return {
    level,
    def,
    barrelSpeed: def.barrelSpeed * (EASE.barrelSpeedMult[tier] ?? 1),
    // Ladder chance is NOT eased. It changes the SHAPE of the hazard rather than
    // its pressure, and a player who has learned "barrels stay on their floor"
    // must not have that quietly become false because they died twice.
    barrelLadderChance: def.barrelLadderChance,
    maxBarrels: def.maxBarrels,
    intervalMult: EASE.barrelIntervalMult[tier] ?? 1,
    timerSec: def.timerSec * (EASE.timerMult[tier] ?? 1),
    beltPeriodSec: def.beltPeriodSec ?? 0,
    clearPoints: def.clearPoints,
    timeBonusPerSec: def.timeBonusPerSec,
    flameCountDelta: EASE.flameCountDelta[tier] ?? 0,
    offerSkip: deaths >= EASE.offerSkipAfterDeaths,
  };
}

/** How many levels this build actually ships. The menu reads this, not a literal. */
export function levelCount(): number {
  return LEVELS.length;
}
