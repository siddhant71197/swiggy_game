/**
 * ══════════════════════════════════════════════════════════════════════════
 *  EVENTS — the one-way seam out of the sim, and why game/ has no renderer.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS PREVENTS (1): the import that points the wrong way. The sim
 * needs to say "a rakhi was taken at (x, y), fourth in the chain" and something
 * needs to pop a number, shake the screen and fire a haptic. The lazy wiring is
 * `import { shake } from '../render/juice'` inside src/game/ — one line, works
 * immediately, and the moment it exists src/game/ can no longer be imported
 * under bare Node, the layering gate fails, and the fix is a refactor rather
 * than a deletion. So the sim emits records and never learns who listens.
 *
 * THE FAILURE THIS PREVENTS (2): the headless bot with no renderer. tools/ runs
 * this exact engine to play every level and measure difficulty before it ships.
 * That only works if "no renderer at all" is a supported configuration, and it
 * is supported precisely because nothing in the sim calls a renderer — it pushes
 * here, and a bot that never drains simply accumulates and drops. The bot can
 * also READ the queue, which is how it counts near-misses and barrel jumps
 * without any instrumentation living in the sim.
 *
 * THE FAILURE THIS PREVENTS (3): a haptic fired from the simulation. One call
 * into the device's vibrate API makes the sim untestable, unrepeatable, and —
 * on the frame a life is lost — indistinguishable from a hitch, because that
 * call is not free. The sim expresses INTENT; the presentation layer owns the
 * device.
 *
 * ─── ON ALLOCATION ─────────────────────────────────────────────────────────
 * These are discrete gameplay moments — a pickup, a hit, a gate — not per-entity
 * per-frame traffic, so a handful of small records a second is nothing, and a
 * typed discriminated union is worth far more here than the flat two-number
 * struct a preallocated ring would force. The per-frame paths that DO need zero
 * allocation (barrels, particles) use core/pool.ts instead. If a new event ever
 * fires per entity per step, it does not belong in this file.
 *
 * ─── OVERFLOW DROPS THE OLDEST AND NEVER THROWS ────────────────────────────
 * A full ring means a consumer stopped draining: a scene transition, a paused
 * tab, the headless bot. The newest events describe the world the player is
 * about to see; the oldest describe one that is already gone. And a queue that
 * throws is a black screen, which is strictly worse than a missing sparkle.
 */

/** Every event the sim can raise. Discriminated on `type`. */
export type SimEvent =
  /** `index` into the level's rakhi table; `chain` is the running combo count. */
  | { type: 'RakhiTaken'; index: number; x: number; y: number; chain: number }
  /** The last rakhi was taken and the top of the tower is now enterable. */
  | { type: 'GateOpened' }
  /** Cleared a barrel. `count` is the running jump tally — the scoring multiplier. */
  | { type: 'BarrelJumped'; x: number; y: number; count: number }
  | { type: 'BarrelSmashed'; x: number; y: number }
  | { type: 'AgentHit'; x: number; y: number }
  | { type: 'AgentRespawn' }
  /** `timeLeft` in seconds, which is the time bonus the results screen counts up. */
  | { type: 'LevelCleared'; timeLeft: number }
  | { type: 'TimeUp' }
  | { type: 'ShakerTaken'; x: number; y: number }
  /** The powerup ran out on its own rather than being spent. */
  | { type: 'ShakerExpired' }
  /** `index` into the level's pin table. */
  | { type: 'PinPushed'; index: number; x: number; y: number };

export type SimEventType = SimEvent['type'];

/**
 * One frame's worth, generously sized.
 *
 * A single fixed step can realistically emit a rakhi, its chain gate, a barrel
 * jump and a pin push at once; sixty-four is an order of magnitude past the
 * worst case anyone has been able to construct. Sized so that overflow means
 * "nobody is draining", never "a busy frame".
 */
const CAPACITY = 64;

const ring: (SimEvent | null)[] = new Array<SimEvent | null>(CAPACITY).fill(null);

/** Index of the oldest queued event. */
let head = 0;
let count = 0;
let dropped = 0;

/** Queue an event. Never throws; see the header on overflow. */
export function emit(e: SimEvent): void {
  if (count === CAPACITY) {
    // Evict the oldest to make room: head advances, count stays at CAPACITY.
    head = head + 1 === CAPACITY ? 0 : head + 1;
    count--;
    dropped++;
  }
  let tail = head + count;
  if (tail >= CAPACITY) tail -= CAPACITY;
  ring[tail] = e;
  count++;
}

/**
 * Consume every queued event, oldest first.
 *
 * The record is POPPED BEFORE the callback runs, so a consumer that emits while
 * draining cannot corrupt the ring or be handed a record it already handled. The
 * CAPACITY guard bounds that re-entrancy: a consumer emitting one event per
 * event handled terminates instead of spinning the frame away.
 *
 * The slot is nulled on the way out so a drained event is not retained by the
 * ring — a level's worth of stale coordinates pinned by a buffer nobody looks at
 * is the sort of retention that only shows up on a low-memory device.
 */
export function drain(fn: (e: SimEvent) => void): void {
  let guard = 0;
  while (count > 0 && guard < CAPACITY) {
    const e = ring[head];
    ring[head] = null;
    head = head + 1 === CAPACITY ? 0 : head + 1;
    count--;
    guard++;
    if (e) fn(e);
  }
}

/**
 * Discard without consuming. On scene teardown and on a fresh run, so a hit
 * taken on the last level cannot flash over the first frame of the next.
 */
export function clearEvents(): void {
  for (let i = 0; i < CAPACITY; i++) ring[i] = null;
  head = 0;
  count = 0;
}

/** How many are queued. Consumers should not need this; tools/ does. */
export function eventCount(): number {
  return count;
}

/**
 * Debug only. A non-zero value means either CAPACITY is too small or a consumer
 * stopped draining. Both are bugs, and neither is visible without this counter.
 */
export function droppedEvents(): number {
  return dropped;
}
