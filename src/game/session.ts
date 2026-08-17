/**
 * ══════════════════════════════════════════════════════════════════════════
 *  SESSION — the run's books, and the one rule that stops people quitting.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: LOSING THE SWEEP ON DEATH.
 *
 * This is the single most important anti-quit decision in the game, so it is
 * stated first and it is one line of code: `rakhiTaken` is reset when a LEVEL
 * starts and never when a LIFE starts.
 *
 * The reasoning, because it will look like a bug to whoever reads it next.
 * The level's goal is "collect all N, then the gate opens". Combine that with
 * "lose them on death" and one mistake on the top floor costs a full re-sweep of
 * a tower the player has ALREADY PROVEN they can sweep — they are not asked to
 * demonstrate a skill they lack, they are asked to spend ninety seconds
 * re-demonstrating one they have. That is the exact shape of the moment people
 * close the tab: not "this is too hard", but "I am being asked to redo work".
 * Every death still costs a life, still costs the clock, still costs the chain
 * bonus below. The progress it does NOT cost is the one that would make the
 * player replay content instead of attempting content.
 *
 * The chain is where the pressure went instead. Consecutive rakhis IN ONE LIFE
 * escalate; dying resets the chain to zero but keeps the pickups. So a death is
 * expensive in score — which is what the leaderboard is for — and cheap in time,
 * which is what continuing to play is for.
 *
 * ─── ON THE STREAK MULTIPLIER ──────────────────────────────────────────────
 *
 * `SCORE.streak` multiplies CLEAR and TIME BONUS only, never pickups. A streak
 * that multiplied pickups would reward playing LONG; multiplying the clear
 * rewards playing WELL. The difference shows up on the leaderboard as whether
 * the top scores belong to the best players or the most patient ones.
 *
 * No DOM, no clock — `timeLeft` is advanced by the sim's dt, so a backgrounded
 * tab loses no time and the headless bot's clock is the same clock.
 */

import { AGENT, SCORE } from '../config/tuning';
import { clamp } from '../core/math';
import type { LevelParams } from './level';

export interface RunSummary {
  level: number;
  score: number;
  timeLeft: number;
  deaths: number;
  rakhis: number;
  rakhiTotal: number;
  cleared: boolean;
}

export interface Session {
  level: number;
  lives: number;
  score: number;

  timeLeft: number;
  /** Deaths on THIS level. Drives the rubber band in game/level.ts. */
  deaths: number;

  /**
   * One flag per rakhi in the level row. RESET ON LEVEL START ONLY — see the
   * header. If you are here to "fix" a player keeping their pickups through a
   * death, read the header first; it is the design.
   */
  rakhiTaken: boolean[];
  rakhiCount: number;
  rakhiTotal: number;

  /** Consecutive pickups in the CURRENT life. Reset by death, not by level. */
  chain: number;
  /** Levels cleared back to back without dying. Indexes SCORE.streak. */
  streak: number;

  /** Set once the gate has opened, so the event fires exactly once. */
  gateOpen: boolean;
  /** True if the sweep finished before the player first reached the top half. */
  earlySweepAwarded: boolean;

  cleared: boolean;
  failed: boolean;
}

export function makeSession(params: LevelParams, lives: number, score: number, streak: number): Session {
  const total = params.def.rakhis.length;
  return {
    level: params.level,
    lives,
    score,
    timeLeft: params.timerSec,
    deaths: 0,
    rakhiTaken: new Array<boolean>(total).fill(false),
    rakhiCount: 0,
    rakhiTotal: total,
    chain: 0,
    streak,
    gateOpen: total === 0,
    earlySweepAwarded: false,
    cleared: false,
    failed: false,
  };
}

/** A fresh run. Lives come from tuning, never from a literal at a call site. */
export function startRun(params: LevelParams): Session {
  return makeSession(params, AGENT.lives, 0, 0);
}

/**
 * Carry a finished level's books into the next one. Lives, score and streak
 * survive; the clock, the sweep and the death count do not.
 */
export function nextLevel(prev: Session, params: LevelParams): Session {
  return makeSession(params, prev.lives, prev.score, prev.streak);
}

/** Advance the clock. Returns true on the frame the timer runs out. */
export function tickClock(s: Session, dt: number): boolean {
  if (s.cleared || s.failed) return false;
  if (s.timeLeft <= 0) return false;
  s.timeLeft -= dt;
  if (s.timeLeft > 0) return false;
  s.timeLeft = 0;
  return true;
}

/**
 * Score a rakhi. Returns the chain length AFTER this pickup, which is what the
 * `RakhiTaken` event carries to the pop-up.
 *
 * `inAir` doubles it. Jumping a barrel THROUGH a rakhi is the hero moment of
 * this game and it should be worth going out of the way for — which is also why
 * level 1 puts every rakhi flat on the walking line, so the hero moment is
 * something the player discovers rather than something they are forced into.
 */
export function takeRakhi(s: Session, index: number, inAir: boolean): number {
  if (index < 0 || index >= s.rakhiTotal) return s.chain;
  if (s.rakhiTaken[index]) return s.chain;

  s.rakhiTaken[index] = true;
  s.rakhiCount++;
  s.chain++;

  const bonus = Math.min((s.chain - 1) * SCORE.rakhiChainStep, SCORE.rakhiChainCap);
  const base = SCORE.rakhi + bonus;
  s.score += inAir ? base * SCORE.rakhiAirMult : base;

  return s.chain;
}

/** True on the step the last rakhi lands — the caller emits `GateOpened`. */
export function checkGate(s: Session): boolean {
  if (s.gateOpen) return false;
  if (s.rakhiCount < s.rakhiTotal) return false;
  s.gateOpen = true;
  return true;
}

/**
 * Score a barrel cleared in a single jump. `nInThisJump` is how many have been
 * cleared since leaving the ground — one, two, three — and the table is steeply
 * superlinear because a double is a deliberate act and a triple is a story.
 */
export function scoreHop(s: Session, nInThisJump: number): number {
  const tier = clamp(nInThisJump - 1, 0, SCORE.hop.length - 1);
  const pts = SCORE.hop[tier] ?? 0;
  s.score += pts;
  return pts;
}

/** Score a smashed barrel. `n` is how many have been smashed under one powerup. */
export function scoreSmash(s: Session, n: number): number {
  const pts = Math.min(SCORE.smashBase * Math.pow(SCORE.smashMult, Math.max(n - 1, 0)), SCORE.smashCap);
  const rounded = Math.round(pts);
  s.score += rounded;
  return rounded;
}

/** The sweep finished before the player committed to the upper floors. */
export function awardEarlySweep(s: Session): boolean {
  if (s.earlySweepAwarded) return false;
  s.earlySweepAwarded = true;
  s.score += SCORE.earlySweep;
  return true;
}

/**
 * A life is lost. Returns true if that was the last one.
 *
 * Note what this function does NOT touch: `rakhiTaken`. See the header.
 */
export function loseLife(s: Session): boolean {
  s.lives--;
  s.deaths++;
  // The chain — not the sweep — is what death costs. Pressure without rework.
  s.chain = 0;
  // A death anywhere in a run ends the streak, so the multiplier means "clean
  // levels in a row" rather than "levels in a row".
  s.streak = 0;
  if (s.lives > 0) return false;
  s.failed = true;
  return true;
}

/**
 * Close the level out. Returns the points awarded, so the results screen can
 * count them up rather than diffing two totals.
 */
export function clearLevel(s: Session, params: LevelParams, perfect: boolean): number {
  if (s.cleared) return 0;
  s.cleared = true;

  const mult = SCORE.streak[clamp(s.streak, 0, SCORE.streak.length - 1)] ?? 1;
  const timeBonus = Math.floor(Math.max(s.timeLeft, 0)) * params.timeBonusPerSec;

  // The multiplier lands on the clear and the clock ONLY. Pickups were already
  // banked at face value; see the header.
  let award = Math.round((params.clearPoints + timeBonus) * mult);
  if (perfect) award += SCORE.perfectDelivery;

  s.score += award;
  s.streak++;
  return award;
}

export function summarise(s: Session): RunSummary {
  return {
    level: s.level,
    score: s.score,
    timeLeft: Math.max(s.timeLeft, 0),
    deaths: s.deaths,
    rakhis: s.rakhiCount,
    rakhiTotal: s.rakhiTotal,
    cleared: s.cleared,
  };
}
