/**
 * ══════════════════════════════════════════════════════════════════════════
 *  POOL — fixed capacity, decided once, never renegotiated.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS PREVENTS (1): the unwinnable screen. Barrels are released on
 * an interval. A three-second stall — a GC, a backgrounded tab, a slow asset
 * decode — hands the spawner a debt it happily pays all at once, and the player
 * unpauses into forty barrels on one girder with no gap to thread. There is no
 * skill response to that; the level is simply over. The HARD CAP is what makes
 * that impossible: `alloc()` returns null, the spawner skips the release, and
 * the worst case is a slightly emptier screen. A cap is a game-design guarantee
 * here, not a memory optimisation.
 *
 * THE FAILURE THIS PREVENTS (2): the growing pool. A pool that doubles when it
 * fills looks harmless in review and then allocates a block of structs during
 * the single frame that already has the most work in it — which is always the
 * most memorable frame of the round. Capacity is fixed at construction and
 * `alloc()` returning null means DROP IT.
 *
 * THE FAILURE THIS PREVENTS (3): the iteration that allocates. `[...pool]`,
 * `.filter()`, `Array.from`, a generator, or an `active` array rebuilt per frame
 * are all one allocation per frame per pool, which is a minor GC every few
 * seconds, which is a dropped frame mid-jump. `forEach` walks a preallocated
 * dense array by index and allocates nothing.
 *
 * TWO RULES MAKE THIS WORTH HAVING, and breaking either silently undoes it:
 *   1. `factory` must assign EVERY field the struct will ever have, so the
 *      engine keeps one hidden class for the type forever.
 *   2. `reset` must OVERWRITE values. Never add, delete or retype a field, and
 *      never rebuild the object — that is the deoptimisation this exists to
 *      avoid, reintroduced in the one place nobody looks.
 */

export interface Pool<T> {
  /**
   * A struct from the pool, or null when full. NULL MEANS DROP IT — never
   * "grow", never "recycle the oldest". See failure (1): silently stealing a
   * live barrel to satisfy a spawn would teleport a hazard onto the player.
   */
  alloc(): T | null;
  /**
   * Return a struct. Idempotent and tolerant: freeing something already free,
   * or an object this pool never issued, is a no-op rather than a throw. A
   * double-free would otherwise put one struct on two owners' books.
   */
  free(item: T): void;
  /** Every live struct, in no guaranteed order. Allocates nothing. */
  forEach(fn: (item: T) => void): void;
  /** Free everything. Between levels and on death — cheaper and safer than one by one. */
  clear(): void;
  readonly activeCount: number;
}

/**
 * `reset` runs on FREE, not on alloc.
 *
 * Deliberate, and the opposite of the usual choice. Resetting on alloc leaves a
 * dead struct holding its last values — a barrel that still knows its old
 * position and velocity — and anything that walks the backing store while
 * debugging, or any stale reference held one frame too long, sees a plausible
 * live-looking entity. Clearing at the moment of death means a freed struct is
 * visibly inert, so a use-after-free shows up as an entity sitting at the origin
 * rather than as a ghost that behaves almost correctly.
 */
export function makePool<T>(
  capacity: number,
  factory: () => T,
  reset: (item: T) => void,
): Pool<T> {
  const n = capacity > 0 ? capacity | 0 : 0;

  /**
   * Dense array, live structs first. `items[0 .. active-1]` are out on loan and
   * `items[active .. n-1]` are free. Freeing swaps the freed slot with the last
   * live one, which keeps the live set contiguous — that contiguity is what lets
   * forEach be a plain indexed for-loop with no liveness test per element.
   */
  const items = new Array<T>(n);
  for (let i = 0; i < n; i++) items[i] = factory();

  let active = 0;

  /** Position of `item` within the live prefix, or -1. */
  function indexOfLive(item: T): number {
    for (let i = 0; i < active; i++) if (items[i] === item) return i;
    return -1;
  }

  return {
    alloc(): T | null {
      if (active >= n) return null;
      return items[active++] ?? null;
    },

    free(item: T): void {
      const i = indexOfLive(item);
      if (i < 0) return;
      active--;
      // Swap rather than splice: splice shifts the tail and, worse, would
      // reorder the FREE region too, so a struct could be handed out twice.
      const last = items[active]!;
      items[active] = items[i]!;
      items[i] = last;
      reset(item);
    },

    /**
     * Iterated BACKWARDS on purpose. The common pattern is "walk the live set,
     * free the ones that expired", and with swap-removal a forward loop would
     * skip the struct swapped down into the slot just vacated. Descending, the
     * swapped-in struct always comes from an index already visited, so freeing
     * the CURRENT item mid-iteration is safe. Freeing a DIFFERENT one is not —
     * collect and free after the loop.
     */
    forEach(fn: (item: T) => void): void {
      for (let i = active - 1; i >= 0; i--) fn(items[i]!);
    },

    clear(): void {
      for (let i = 0; i < active; i++) reset(items[i]!);
      // The backing array keeps its order; only the live/free boundary moves.
      // Nothing is reallocated, so a clear between levels costs one loop.
      active = 0;
    },

    get activeCount(): number {
      return active;
    },
  };
}
