/**
 * ══════════════════════════════════════════════════════════════════════════
 *  PRERENDER — bake once, blit forever.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: path building in the hot loop.
 *
 * A girder is four fills, a bevel, six rivets and a chevron belt. There are
 * seven of them. A barrel is a body, a shade, two bands and a lid; there can be
 * twenty-four live. Rebuild those paths every frame and the frame is spent in
 * `beginPath`/`arc`/`fill` — none of which is slow on its own, and all of which
 * together is the difference between 16ms and 24ms on a mid-tier Android, which
 * is the difference between a game and a slideshow.
 *
 * Baked, a girder is ONE `drawImage`. The GPU path for a blit is the cheapest
 * thing a 2D context does, and the cost is paid once at level start where a
 * hitch is invisible.
 *
 * ─── WHAT THE KEY HAS TO CONTAIN, AND WHY EACH PART IS THERE ───────────────
 *
 *   kind          which drawing. Obvious.
 *   size          a bake is resolution-specific artwork, not a vector.
 *   dpr           a 2x phone and a 3x phone need different backing stores; one
 *                 cache shared between them serves half the users a soft image.
 *   qualityScale  the frame budget gives ground by dropping resolution
 *                 (RENDER.scaleLadder). Bakes made before the drop are now the
 *                 wrong size — and worse, they are the EXPENSIVE size, so a
 *                 cache that ignored this would keep paying the exact cost the
 *                 drop was meant to avoid.
 *
 * Omit any one of those and the symptom is the same: art that is subtly soft or
 * subtly heavy on some devices and correct on the developer's.
 *
 * ─── THE CEILING IS A BYTE COUNT, NOT AN ENTRY COUNT ───────────────────────
 *
 * Entry-capped caches are a trap: forty 32px chips and forty 512px hero plates
 * are the same "40 entries" and differ by 250× in memory. On a 2GB Android the
 * second one is the tab being killed while the player is mid-level. So eviction
 * is driven by the only number that matters, which is bytes of backing store.
 */

/**
 * 12 MB of backing store.
 *
 * Sized against what one level actually needs: seven girders, a ladder set, a
 * barrel ladder of rotations, four mark buckets and the widget kit come to
 * roughly 4 MB at 3x. Tripling that leaves room for a scene transition holding
 * two levels' worth of bakes at once without evicting anything live, while
 * staying an order of magnitude under the point at which a low-end device
 * starts reclaiming memory from the tab.
 */
const BUDGET_BYTES = 12 * 1024 * 1024;

interface Entry {
  key: string;
  canvas: HTMLCanvasElement;
  bytes: number;
}

/**
 * Insertion-ordered, and that IS the LRU: a Map preserves insertion order, so
 * deleting and re-inserting on every hit moves an entry to the back for free.
 * The alternative — a linked list with a side index — is more code for a cache
 * that holds a few dozen entries.
 */
const cache = new Map<string, Entry>();
let bytes = 0;

/** The context every key is currently baked against. See the header. */
let ctxDpr = 1;
let ctxQuality = 1;

/** Bakes that must exist before the first frame of a scene. See rewarm(). */
const warmers = new Map<string, () => void>();

// ─── Keys ───────────────────────────────────────────────────────────────────

/**
 * Sizes are ROUNDED into the key, not used raw.
 *
 * A float size arrives from `refToDevice()` on almost every call, and floats
 * that differ in the eighth decimal are different cache keys — which turns the
 * cache into a memory leak that also never hits. Rounding to whole device
 * pixels is what a backing store is measured in anyway.
 */
function keyOf(kind: string, w: number, h: number): string {
  return `${kind}|${Math.round(w)}x${Math.round(h)}|${ctxDpr}|${ctxQuality}`;
}

// ─── The cache ──────────────────────────────────────────────────────────────

function evictTo(limit: number): void {
  for (const [key, entry] of cache) {
    if (bytes <= limit) return;
    cache.delete(key);
    bytes -= entry.bytes;
    // Collapsing the backing store to 0×0 releases it immediately rather than
    // at the next GC. On a device under memory pressure — which is the only
    // device that ever reaches this line — that difference is the whole point.
    entry.canvas.width = 0;
    entry.canvas.height = 0;
  }
}

/**
 * Get or create a bake.
 *
 * `w`/`h` are in DEVICE pixels — the caller converts through
 * `Viewport.refToDevice()`. Baking at reference size and letting the root
 * transform magnify it is the soft-art bug this whole file exists to avoid, and
 * it is invisible on a 1x desktop display.
 *
 * `draw` receives a context already scaled so that (0,0)→(refW,refH) fills the
 * canvas, so drawing code is written in reference units exactly like everything
 * else and never learns what resolution it landed at.
 */
export function bake(
  kind: string,
  refW: number,
  refH: number,
  deviceW: number,
  deviceH: number,
  draw: (ctx: CanvasRenderingContext2D, refW: number, refH: number) => void,
): HTMLCanvasElement {
  const key = keyOf(kind, deviceW, deviceH);
  const hit = cache.get(key);
  if (hit) {
    // Re-insert to move it to the back of the eviction order.
    cache.delete(key);
    cache.set(key, hit);
    return hit.canvas;
  }

  const w = Math.max(1, Math.round(deviceW));
  const h = Math.max(1, Math.round(deviceH));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const c = canvas.getContext('2d');
  if (c) {
    // NOT alpha:false — a bake composites over whatever is under it, so it must
    // carry transparency. The main canvas is opaque; these are not.
    c.setTransform(w / refW, 0, 0, h / refH, 0, 0);
    draw(c, refW, refH);
  }

  const entry: Entry = { key, canvas, bytes: w * h * 4 };
  cache.set(key, entry);
  bytes += entry.bytes;
  if (bytes > BUDGET_BYTES) evictTo(BUDGET_BYTES);
  return canvas;
}

/**
 * Blit a bake at a reference-unit rect. The inverse of `bake`'s scaling, and
 * the reason no caller ever handles device pixels itself.
 */
export function blit(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (canvas.width === 0 || canvas.height === 0) return;
  ctx.drawImage(canvas, x, y, w, h);
}

// ─── Invalidation and re-warm ───────────────────────────────────────────────

/**
 * Tell the cache which dpr/quality it is now baking for.
 *
 * Changing either does NOT flush: the old entries simply stop being reachable
 * by key and age out under the byte ceiling. Flushing eagerly would be correct
 * and also would drop every bake on the frame the quality ladder steps down —
 * i.e. on the frame the device has already proven it has no headroom. Letting
 * them age out spreads that cost.
 */
export function setBakeContext(dpr: number, qualityScale: number): void {
  if (dpr === ctxDpr && qualityScale === ctxQuality) return;
  ctxDpr = dpr;
  ctxQuality = qualityScale;
}

/**
 * Register work that must be done before the next frame is drawn.
 *
 * Keyed, so re-registering the same warmer (a scene re-entered) replaces rather
 * than duplicates. A scene registers "bake my girders"; a resize or a quality
 * drop replays every registration.
 */
export function registerWarm(key: string, fn: () => void): void {
  warmers.set(key, fn);
}

export function unregisterWarm(key: string): void {
  warmers.delete(key);
}

/**
 * Re-run every warmer. Called from Viewport.onResize — which covers BOTH
 * triggers, because a quality drop calls resize() to reallocate the backing
 * store. One hook, both cases, no chance of wiring only one of them.
 *
 * Errors are swallowed per warmer: a scene whose bake throws should lose its
 * art, not the whole frame including the scenes that baked correctly.
 */
export function rewarm(): void {
  for (const fn of warmers.values()) {
    try {
      fn();
    } catch {
      /* one bad bake must not take the frame down */
    }
  }
}

/** Drop everything. Between brands in the dev harness, and on teardown. */
export function flushBakes(): void {
  evictTo(0);
  cache.clear();
  bytes = 0;
}

/** Debug readout. A number that only grows is a key that includes a float. */
export function bakeStats(): { entries: number; bytes: number; budget: number } {
  return { entries: cache.size, bytes, budget: BUDGET_BYTES };
}
