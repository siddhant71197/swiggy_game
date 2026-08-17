/**
 * ══════════════════════════════════════════════════════════════════════════
 *  HAPTICS — one guarded call site for the vibration motor.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): `navigator.vibrate(...)` written inline in
 * a scene. It is undefined on every iOS browser and on desktop Safari, so the
 * inline version is a TypeError on the exact device most reviewers use, thrown
 * from inside a render callback, which takes the frame — and therefore the game
 * — down with it. It is also silently ignored inside a cross-origin iframe
 * without a user gesture, which is where this game lives.
 *
 * THE FAILURE THIS FILE PREVENTS (2): a haptic fired from the SIMULATION. See
 * the header of core/events.ts: `src/game/` may not touch a device API at all.
 * One vibrate() call from inside the fixed step makes the sim unrepeatable,
 * untestable under bare Node, and — on the frame a life is lost — indist-
 * inguishable from a hitch, because that call is not free. The sim emits a
 * SimEvent; the SCENE drains it and decides to buzz. This module is called from
 * `src/scenes/` and from nowhere else, and the layering gate can enforce that by
 * grepping `src/game/` for this import.
 *
 * ─── ORDINAL-INDEXED, NOT STRING-KEYED ─────────────────────────────────────
 *
 * The patterns are an array indexed by a small integer, and callers pass
 * `HAPTIC.hit` rather than `'hit'`. Two reasons, and the second is the real one:
 * a lookup on the event path never touches a hash, and a typo becomes a
 * typecheck failure instead of a haptic that quietly never fires. A silent
 * no-op is the worst possible failure for something you cannot see.
 */

/**
 * Pattern ordinals. The values are indices into PATTERNS below and the two must
 * stay in step — which they do because PATTERNS is written in this order and
 * nothing else indexes it.
 */
export const HAPTIC = {
  tap: 0,
  jump: 1,
  land: 2,
  pickup: 3,
  unlock: 4,
  hit: 5,
  clear: 6,
  warn: 7,
} as const;

export type HapticKind = (typeof HAPTIC)[keyof typeof HAPTIC];

/**
 * Milliseconds; odd indices are pauses. Everything is SHORT on purpose — a
 * phone motor takes ~15ms to spin up and ~20ms to stop, so anything under about
 * 8ms is inaudible and anything over about 60ms reads as a notification rather
 * than as feedback, and a game that buzzes like a notification gets muted at the
 * OS level, which also mutes the two buzzes that were worth having.
 */
const PATTERNS: readonly (readonly number[])[] = [
  [10], // tap — a button acknowledging a thumb
  [12], // jump
  [8], // land: lighter than the jump, because it is a consequence, not an act
  [10, 30, 10], // pickup: a double, so a chain reads as a rhythm
  [18, 40, 18, 40, 30], // unlock: the one celebratory pattern
  [45], // hit: the longest single buzz in the set, and the only one that stings
  [20, 50, 20, 50, 45], // clear
  [8, 60, 8], // warn: two taps, deliberately faint
];

/**
 * Master switch. Off follows the sound toggle in practice — main.ts points this
 * at `!sfx.muted` — but it is separate because a player can reasonably want
 * silence WITH feedback, and on a phone in a pocket that is the common case.
 */
let enabled = true;

export function setHapticsEnabled(v: boolean): void {
  enabled = v;
  if (!v) cancelHaptics();
}

export function hapticsEnabled(): boolean {
  return enabled;
}

/**
 * Whether the device can do this at all. Read once at module scope — the
 * capability cannot change mid-session, and `navigator` itself is absent under
 * the headless tools/ runner.
 */
const supported: boolean =
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function hapticsSupported(): boolean {
  return supported;
}

/**
 * Fire one pattern. Total: unsupported, disabled, or an out-of-range ordinal all
 * return without doing anything, so no call site needs a guard.
 *
 * The try/catch is not defensive padding. Chrome throws on `vibrate` from a
 * frame that has not yet seen a user gesture, and this game's first frames run
 * before anyone has touched it.
 */
export function haptic(kind: HapticKind): void {
  if (!enabled || !supported) return;
  const p = PATTERNS[kind];
  if (!p) return;
  try {
    navigator.vibrate(p as number[]);
  } catch {
    /* No gesture yet, or the embedder forbids it. Nothing to recover. */
  }
}

/**
 * Stop anything in progress. On pause, on scene teardown, and on losing the
 * tab — a five-element celebration pattern that keeps buzzing after the player
 * has switched away is the thing that makes them turn haptics off for good.
 */
export function cancelHaptics(): void {
  if (!supported) return;
  try {
    navigator.vibrate(0);
  } catch {
    /* Nothing running, or forbidden. Either way there is nothing to stop. */
  }
}
