/**
 * ══════════════════════════════════════════════════════════════════════════
 *  LOOP — a fixed step, and a frame budget that gives ground before it breaks.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS PREVENTS (1): the variable-dt simulation. This is not a
 * nicety for a climbing platformer — jump arcs here are INTEGRATED, so with a
 * variable dt the apex height depends on how the frame times happened to land.
 * The concrete outcome: a 90Hz phone samples the arc more finely, reaches a
 * measurably higher apex, and clears a barrel that a 60Hz phone clips. The same
 * jump is a different jump per device, difficulty is unmeasurable, and the
 * headless bot's verdict describes a game nobody is playing. So the sim only
 * ever advances by exactly LOOP.stepSec, and the renderer is handed the leftover
 * fraction to interpolate with.
 *
 * THE FAILURE THIS PREVENTS (2): the death spiral. A backgrounded tab returns
 * with a thirty-second gap; an unclamped accumulator asks for 1800 steps, that
 * frame takes four seconds, which produces a bigger gap, which asks for more
 * steps. Two guards, and both are needed: rawDt is clamped to LOOP.maxFrameDt
 * BEFORE it is accumulated, and if the step budget is exhausted with time still
 * owed, that time is DISCARDED rather than carried into the next frame.
 *
 * THE FAILURE THIS PREVENTS (3): the honest-but-unplayable render. When frames
 * are consistently over budget the answer is a softer image, not a slower game,
 * so a sustained slow streak steps DOWN the render-scale ladder. It never steps
 * back up: an image oscillating between two sharpnesses is far more noticeable
 * than one that is slightly soft for the rest of the round, and a ladder that
 * can climb will oscillate, because dropping quality is what makes frames fast
 * enough to justify raising it again.
 *
 * ─── THE EXCEPTION TO THE core/ AND game/ DOM BAN ──────────────────────────
 * Nothing in src/core/ or src/game/ may reference `document`, `window`,
 * `navigator`, `performance`, `Date` or `Math.random` — a build gate greps for
 * exactly those — so that tools/ can import the real engine and play every level
 * headless under bare Node. THIS FILE IS EXPLICITLY EXCLUDED FROM THAT GATE,
 * because a browser loop necessarily touches `requestAnimationFrame` and the
 * frame clock. src/core/storage.ts is the only other exclusion.
 *
 * Note what is still NOT here: `performance.now()`. The timestamp arrives as the
 * rAF callback's argument, so the clock is a parameter rather than a global, and
 * a headless driver replaces this class outright instead of stubbing a browser.
 */

export const LOOP = {
  /** 60Hz. Every tuning constant in the game is expressed against this step. */
  stepSec: 1 / 60,
  /**
   * 50ms — three steps' worth. Any real frame longer than this is a hitch, a
   * GC, or a tab that was asleep, and in all three cases replaying the missing
   * time is worse than dropping it: the player did not see it, and a barrel that
   * moved while the phone was in a pocket kills them on the frame they look back.
   */
  maxFrameDt: 0.05,
  /**
   * Three. Two is not enough headroom for a genuine 30fps device, which would
   * then run permanently in slow motion; four lets a slow frame make the NEXT
   * frame slower, which is the spiral guard (2) exists to break.
   */
  maxStepsPerFrame: 3,
} as const;

/**
 * The quality ladder lives in config/tuning.ts with every other tunable number,
 * and is re-exported here only because the loop is what drives it. Defining it
 * in both places — which this file briefly did — gives you two ladders that
 * agree until the day someone tunes one of them.
 */
import { RENDER } from '../config/tuning';
export { RENDER };

export interface LoopCallbacks {
  /** Called with a FIXED dt. May run 0..LOOP.maxStepsPerFrame times per frame. */
  update(dt: number): void;
  /** alpha is the fractional position between the last two sim steps, 0..1. */
  render(alpha: number): void;
  /** Fired once per drop, with the new index into RENDER.scaleLadder. */
  onQualityDrop?(level: number): void;
}

export class GameLoop {
  private rafId = 0;
  /** -1 means "re-baseline on the next frame" — see resync(). */
  private last = -1;
  private acc = 0;
  private running = false;

  /**
   * Seconds of SIMULATED time, and the authoritative clock. The level timer,
   * barrel release cadence and every powerup expiry read this and never wall
   * time, so a device that drops frames does not also get a shorter round.
   */
  simTime = 0;

  private frameMs = 16.7;
  private slowStreak = 0;
  private qualityLevel = 0;

  // Debug readouts.
  fps = 60;
  lastStepCount = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;

  constructor(private readonly cb: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = -1;
    this.acc = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  /**
   * Call after any gap the loop must NOT try to catch up on: returning from a
   * backgrounded tab, dismissing the pause sheet, closing an interstitial.
   *
   * Without it the accumulator spends its whole step budget replaying time
   * nobody saw, and the player unpauses into a barrel that crossed the floor
   * while the sheet was open. Guard (2) bounds the damage; this removes it.
   */
  resync(): void {
    this.last = -1;
    this.acc = 0;
  }

  /** Current index into RENDER.scaleLadder. Only ever increases. */
  get quality(): number {
    return this.qualityLevel;
  }

  /** The resolution multiplier the renderer should currently be drawing at. */
  get renderScale(): number {
    return RENDER.scaleLadder[this.qualityLevel] ?? 1;
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    // Rescheduled FIRST: an exception thrown out of update() or render() then
    // costs one frame rather than silently ending the game loop for good.
    this.rafId = requestAnimationFrame(this.tick);

    // First frame after start()/resync(): establish the baseline and render once
    // at alpha 0. Stepping the sim here would use a garbage dt.
    if (this.last < 0) {
      this.last = now;
      this.lastStepCount = 0;
      this.cb.render(0);
      return;
    }

    const rawDt = (now - this.last) / 1000;
    this.last = now;

    this.trackFrame(rawDt);

    // Clamped BEFORE accumulating — guard (2). A negative dt is possible when a
    // clock is adjusted mid-frame, and would run the sim backwards.
    const dt = rawDt > LOOP.maxFrameDt ? LOOP.maxFrameDt : rawDt < 0 ? 0 : rawDt;
    this.acc += dt;

    let steps = 0;
    while (this.acc >= LOOP.stepSec && steps < LOOP.maxStepsPerFrame) {
      this.cb.update(LOOP.stepSec);
      this.simTime += LOOP.stepSec;
      this.acc -= LOOP.stepSec;
      steps++;
    }
    // Budget exhausted with time still owed: drop it rather than fall further
    // behind every frame. The second half of guard (2).
    if (steps === LOOP.maxStepsPerFrame && this.acc > LOOP.stepSec) this.acc = 0;
    this.lastStepCount = steps;

    this.cb.render(this.acc / LOOP.stepSec);
  };

  private trackFrame(rawDt: number): void {
    const ms = rawDt * 1000;
    // Exponential average: one multiply-add, no ring buffer, and it ignores the
    // single 200ms frame every GC produces rather than reacting to it.
    this.frameMs += (ms - this.frameMs) * 0.1;

    this.fpsAccum += rawDt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    // DOWN ONLY. See guard (3) in the header.
    if (this.frameMs > RENDER.slowFrameMs) {
      this.slowStreak++;
      if (this.slowStreak >= RENDER.slowFrameStreak) {
        this.slowStreak = 0;
        if (this.qualityLevel < RENDER.scaleLadder.length - 1) {
          this.qualityLevel++;
          this.cb.onQualityDrop?.(this.qualityLevel);
        }
      }
    } else {
      this.slowStreak = 0;
    }
  }
}
