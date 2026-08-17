/**
 * ══════════════════════════════════════════════════════════════════════════
 *  MONKEY — the thrower, and the only thing in the game that gets to cheat.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): THE UNTELEGRAPHED RELEASE. A barrel that
 * simply appears is not a hazard the player can plan around; it is a tax on
 * reaction time, and it is indistinguishable from a frame hitch. The wind-up is
 * a SIM-SIDE timer, not an animation the renderer invents, because the moment
 * the presentation layer owns the telegraph the two can disagree — and a
 * telegraph that is sometimes wrong teaches the player to ignore it, which is
 * strictly worse than never having had one.
 *
 * THE FAILURE THIS FILE PREVENTS (2): `if (level === 10)`. The monkey moves on
 * exactly one level, which is precisely the shape of special case config/levels.ts
 * exists to refuse. It moves because the row carries `monkeySlots`; a level
 * without them has a monkey that never shifts, and this file has no idea which
 * level it is running.
 *
 * ─── WHY MOVING THE THROWER IS THE FINALE'S MECHANIC ───────────────────────
 *
 * Every level in this game can be opened from memory: the first barrel leaves
 * the same place at the same moment, and by level 9 the player has a rehearsed
 * first eight seconds. Shifting the throw position changes the ENTRY LANE, so
 * the cascade down the tower starts somewhere else and the rehearsal stops
 * paying. It costs one number in the level row and it invalidates muscle memory
 * without making anything less fair — the barrels are the same barrels, arriving
 * by a route the player has to actually look at.
 *
 * No DOM, no clock, no unseeded randomness. The shift is driven by sim time and
 * the jitter comes from the world's seeded stream.
 */

import type { PointDef, StageDef } from '../config/levels';
import { TIMER } from '../config/tuning';
import type { Rng } from '../core/rng';

/** How long the wind-up holds before the barrel actually leaves. */
const WINDUP_SEC = 0.45;

export interface Monkey {
  /** Per-spawner countdown, seconds. Parallel to `def.spawners`. */
  timers: number[];
  /**
   * Per-spawner wind-up remaining. Zero means "not winding up". The renderer
   * reads this and nothing else to decide whether to draw the raised barrel.
   */
  windup: number[];

  /** Which of `def.monkeySlots` is current. Always 0 when the row has none. */
  slot: number;
  /** Countdown to the next shift. Zero when the monkey does not move. */
  shiftTimer: number;
  /**
   * Where the monkey is RIGHT NOW. The renderer draws here; the spawners throw
   * from here. One position, so the sprite can never be somewhere the barrels
   * are not coming from.
   */
  x: number;
  y: number;
}

export function makeMonkey(def: StageDef, intervalMult: number): Monkey {
  const timers: number[] = [];
  const windup: number[] = [];
  for (const s of def.spawners) {
    // Staggered by the AUTHORED interval, never by a draw: the first barrel of a
    // level must arrive at the same moment on every device and every replay,
    // because the opening seconds are the part every player sees most often.
    timers.push(s.intervalSec * intervalMult);
    windup.push(0);
  }

  const slots = def.monkeySlots;
  const at: PointDef = slots && slots.length > 0 ? slots[0]! : def.monkeyAt;

  return {
    timers,
    windup,
    slot: 0,
    shiftTimer: slots && slots.length > 1 ? (def.monkeyShiftSec ?? 0) : 0,
    x: at.x,
    y: at.y,
  };
}

/**
 * Drop every wind-up. Called when the world holds the throws after a respawn —
 * the PAUSE itself is the world's (see AGENT.respawnThrowPauseSec), because it
 * outlives any one monkey and the presentation layer reads it there.
 */
export function clearWindups(m: Monkey): void {
  for (let i = 0; i < m.windup.length; i++) m.windup[i] = 0;
}

/**
 * One step of throwing.
 *
 * `release` is called with the position and kind of each barrel that leaves this
 * step. The monkey never touches the barrel pool: it says "throw", and the world
 * decides whether the level's cap has room. That separation is what lets the cap
 * be a game-design guarantee (see core/pool.ts) rather than a spawn bug.
 */
export function stepMonkey(
  m: Monkey,
  def: StageDef,
  rng: Rng,
  intervalMult: number,
  timeLeft: number,
  dt: number,
  release: (x: number, y: number, wild: boolean) => void,
): void {
  // The SHIFT runs even while the throws are held. A monkey frozen mid-pause
  // would resume from wherever the player last saw him, which makes the respawn
  // pause quietly re-sync the entry lane to the death — a hidden rule that
  // rewards dying at the right moment.
  stepShift(m, def, dt);

  for (let i = 0; i < def.spawners.length; i++) {
    const s = def.spawners[i]!;
    let t = (m.timers[i] ?? 0) - dt;

    // THE TELEGRAPH IS DERIVED FROM THE COUNTDOWN, never timed separately, so
    // the wind-up and the release cannot drift apart. See failure (1).
    m.windup[i] = t <= WINDUP_SEC && t > 0 ? t : 0;

    if (t > 0) {
      m.timers[i] = t;
      continue;
    }
    m.windup[i] = 0;

    // A row with `monkeySlots` throws from wherever the monkey currently is; a
    // row without them throws from its own authored spawner point. One branch,
    // driven by data, and no level number anywhere.
    const useSlot = (def.monkeySlots?.length ?? 0) > 0;
    release(useSlot ? m.x : s.x, useSlot ? m.y : s.y, rng.chance(s.wildChance));

    const base = s.intervalSec * intervalMult;
    const jitter = s.jitterSec > 0 ? rng.range(-s.jitterSec, s.jitterSec) : 0;
    // Under the urgency threshold the tower leans on the player. The ONLY
    // difficulty change this game ever announces, and it announces it by
    // reddening the clock rather than by saying anything.
    const urgent = timeLeft <= TIMER.urgentSec ? TIMER.urgentIntervalMult : 1;
    t = Math.max((base + jitter) * urgent, dt);
    m.timers[i] = t;
  }
}

function stepShift(m: Monkey, def: StageDef, dt: number): void {
  const slots = def.monkeySlots;
  if (!slots || slots.length < 2 || m.shiftTimer <= 0) return;

  m.shiftTimer -= dt;
  if (m.shiftTimer > 0) return;

  // ROUND ROBIN, NOT RANDOM. The point is that the lane MOVES, not that it is
  // unpredictable — a player who watches gets to know where the next one comes
  // from, which is the difference between a finale and a slot machine.
  m.slot = (m.slot + 1) % slots.length;
  const at = slots[m.slot]!;
  m.x = at.x;
  m.y = at.y;
  m.shiftTimer += def.monkeyShiftSec ?? 6;
}
