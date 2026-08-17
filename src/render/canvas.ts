/**
 * ══════════════════════════════════════════════════════════════════════════
 *  VIEWPORT — one measurement, taken from the right box.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: `window.innerWidth`. It is the obvious thing
 * to measure and it is wrong here in three separate ways at once.
 *
 *   1. On the desktop build the game lives inside a phone-shaped frame that is
 *      NOT the window. Measure the window and the canvas is 1920 units wide
 *      with a 720-unit game somewhere inside it — so every scene grows a
 *      `if (desktop)` branch, and the branch is what actually rots.
 *   2. On Android, `innerHeight` changes when the URL bar collapses. The canvas
 *      would resize mid-jump, which changes the apex the player is currently
 *      in the middle of. #phone is sized in `svh`, which does not move.
 *   3. `visualViewport` shrinks when a keyboard opens, and `innerHeight` does
 *      not agree with it. Two clocks, one truth.
 *
 * So: ONE measurement, `#phone.getBoundingClientRect()`. Everything else in
 * src/render/ reads this object and nothing else reads the DOM. That single
 * indirection is the entire desktop-frame story — there is no other branch.
 *
 * ─── WHY HEIGHT MAPS ONTO REF.H AND WIDTH FALLS OUT ────────────────────────
 *
 * The alternative — fitting 720×1280 inside the box and letterboxing — puts
 * black bars on a phone, which reads as a web page in a wrapper. Instead the
 * screen's HEIGHT is defined to be REF.H = 1280 units and the width is whatever
 * that scale makes it:
 *
 *     scale  = cssHeight / 1280            (reference units → CSS pixels)
 *     fieldW = cssWidth / scale            (how wide the field turned out)
 *
 * A TALLER, NARROWER PHONE THEREFORE GETS A NARROWER FIELD, not a smaller one.
 * That is the constraint layout.ts is built against and the reason the stage
 * world may never grow: at 20:9 the field is 576 units wide and the 560-wide
 * stage has 8 units of gutter left. See layout.ts.
 *
 * ─── THE BACKING STORE IS THREE MULTIPLIERS DEEP ───────────────────────────
 *
 *     device pixels = reference units × scale × dpr × qualityScale
 *
 * `scale` is layout, `dpr` is the display, `qualityScale` is the frame budget
 * giving ground (RENDER.scaleLadder, driven down by GameLoop). Folding all
 * three into one `setTransform` means no drawing code anywhere is aware that
 * two of them exist.
 */

import { REF, RENDER } from '../config/tuning';

/** How long a kick takes to decay to nothing. */
const SHAKE_DECAY_SEC = 0.42;

/**
 * Hard ceiling on a single kick, in reference units.
 *
 * Uncapped, two hits landing on the same frame sum into a lurch that reads as
 * a rendering bug rather than as impact — and impact is the entire point.
 */
const SHAKE_MAX = 14;

export class Viewport {
  /** CSS pixels of the #phone box. Not the window's. */
  cssW = 0;
  cssH = 0;

  /** Clamped device pixel ratio. See RENDER.maxDpr for why it is clamped. */
  dpr = 1;

  /** Reference units → CSS pixels. */
  scale = 1;

  /**
   * The field, in reference units. Height is REF.H BY DEFINITION; width is
   * whatever the aspect ratio produced. Everything lays out against these two,
   * never against REF.W — REF.W is only the design's nominal width.
   */
  fieldW: number = REF.W;
  readonly fieldH: number = REF.H;

  /** Current RENDER.scaleLadder multiplier. Falls, never rises. */
  qualityScale = 1;
  qualityLevel = 0;

  /**
   * The home-indicator / gesture-bar inset, in REFERENCE units, MEASURED.
   *
   * Guessing this is how a jump button ends up half under the iOS home bar on
   * exactly the devices nobody on the team owns. A hidden probe element sized
   * in `env(safe-area-inset-bottom)` costs one layout read per resize and is
   * simply correct on every device, including the ones with no inset at all.
   */
  safeBottomRef = 0;
  safeTopRef = 0;

  /** Applied inside begin(). Set by kick(); decays in updateShake(). */
  private shakeMag = 0;
  private shakeT = 0;
  private shakeX = 0;
  private shakeY = 0;

  private probe: HTMLDivElement | null = null;
  private readonly listeners: Array<(vp: Viewport) => void> = [];

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly ctx: CanvasRenderingContext2D,
    /** THE BOX. Not the window. */
    readonly host: HTMLElement,
  ) {
    this.installProbe();
    this.resize();
  }

  // ─── Measurement ──────────────────────────────────────────────────────────

  /**
   * The probe is a 1px-wide invisible div pinned to the bottom of the host with
   * its height set from the safe-area env(). It is `visibility:hidden` rather
   * than `display:none` because a display-none element has no box to measure.
   */
  private installProbe(): void {
    const d = this.host.ownerDocument;
    const el = d.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = [
      'position:absolute',
      'left:0',
      'bottom:0',
      'width:1px',
      'pointer-events:none',
      'visibility:hidden',
      // content-box explicitly: index.html's reset sets `* { box-sizing:
      // border-box }`, under which the padding below would be ABSORBED into
      // the height instead of adding to it, and both insets would collapse
      // into one wrong number.
      'box-sizing:content-box',
      'height:env(safe-area-inset-bottom, 0px)',
      'padding-top:env(safe-area-inset-top, 0px)',
    ].join(';');
    this.host.appendChild(el);
    this.probe = el;
  }

  /**
   * Re-measure and re-establish the backing store. Idempotent, so it is safe to
   * call from `resize`, `orientationchange`, a ResizeObserver and a visibility
   * change all at once — which is roughly what it takes to catch every device.
   */
  resize(): void {
    const r = this.host.getBoundingClientRect();
    this.cssW = r.width;
    this.cssH = r.height;

    this.dpr = Math.min(window.devicePixelRatio || 1, RENDER.maxDpr);
    this.scale = this.cssH / REF.H;
    this.fieldW = this.scale > 0 ? this.cssW / this.scale : REF.W;

    if (this.probe) {
      const p = this.probe.getBoundingClientRect();
      // The probe's border box is the bottom inset; its top padding is the top
      // inset. Two insets, one element, one layout read.
      this.safeBottomRef = this.pxToRef(p.height - this.probeTopPx());
      this.safeTopRef = this.pxToRef(this.probeTopPx());
    }

    const back = this.dpr * this.qualityScale;
    const w = Math.max(1, Math.round(this.cssW * back));
    const h = Math.max(1, Math.round(this.cssH * back));
    // Assigning width/height is a full backing-store reallocation AND a context
    // reset, so it is guarded: a ResizeObserver that fires with unchanged
    // dimensions would otherwise clear the frame and drop every context setting.
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    for (const fn of this.listeners) fn(this);
  }

  private probeTopPx(): number {
    if (!this.probe) return 0;
    const cs = getComputedStyle(this.probe);
    return parseFloat(cs.paddingTop) || 0;
  }

  /** Fired after every re-measure. Bake caches re-warm from here. */
  onResize(fn: (vp: Viewport) => void): void {
    this.listeners.push(fn);
  }

  // ─── Unit conversion ──────────────────────────────────────────────────────

  /** CSS pixels → reference units. The AD block is declared in CSS pixels. */
  pxToRef(px: number): number {
    return this.scale > 0 ? px / this.scale : px;
  }

  /** Reference units → CSS pixels. */
  refToPx(ref: number): number {
    return ref * this.scale;
  }

  /**
   * Reference units → DEVICE pixels. What prerender.ts sizes a bake against:
   * baking at reference size and letting the transform magnify it is exactly
   * the soft-logo bug that makes a build look cheap on a 3x display.
   */
  refToDevice(ref: number): number {
    return ref * this.scale * this.dpr * this.qualityScale;
  }

  /** A CSS-pixel point (a pointer event) in reference units. */
  toRefX(clientX: number): number {
    const r = this.host.getBoundingClientRect();
    return this.pxToRef(clientX - r.left);
  }

  toRefY(clientY: number): number {
    const r = this.host.getBoundingClientRect();
    return this.pxToRef(clientY - r.top);
  }

  // ─── Quality ──────────────────────────────────────────────────────────────

  /**
   * Wired to GameLoop.onQualityDrop. Reallocates the backing store at the new
   * multiplier; every bake keyed on the old one is now stale, which is why the
   * resize listeners fire (prerender.ts re-warms from there).
   */
  setQuality(level: number): void {
    const next = RENDER.scaleLadder[level] ?? 1;
    if (next === this.qualityScale) return;
    this.qualityScale = next;
    this.qualityLevel = level;
    this.resize();
  }

  // ─── Shake ────────────────────────────────────────────────────────────────

  /**
   * SHAKE LIVES HERE, NOT IN fx.ts, and the split is deliberate: fx.ts decides
   * WHEN the screen shakes (it reads the SimEvent stream), but the offset has
   * to be baked into the frame's root transform or half the scene shakes and
   * the other half does not. fx.ts calls kick(); this owns the decay.
   */
  kick(mag: number): void {
    const m = Math.min(mag, SHAKE_MAX);
    if (m <= this.shakeMag) return; // A weaker hit never interrupts a stronger one.
    this.shakeMag = m;
    this.shakeT = SHAKE_DECAY_SEC;
  }

  /**
   * Deterministic, not random. A random offset per frame at 60Hz is visually
   * indistinguishable from a decaying sinusoid, and the sinusoid cannot produce
   * the two-frame run of identical values that reads as a stutter.
   */
  updateShake(dt: number, now: number): void {
    if (this.shakeT <= 0) {
      this.shakeMag = 0;
      this.shakeX = 0;
      this.shakeY = 0;
      return;
    }
    this.shakeT -= dt;
    const k = Math.max(0, this.shakeT) / SHAKE_DECAY_SEC;
    const amp = this.shakeMag * k * k;
    this.shakeX = Math.sin(now * 74) * amp;
    this.shakeY = Math.cos(now * 61) * amp * 0.7;
  }

  /** True while a kick is still decaying. Cheap enough to poll per frame. */
  get shaking(): boolean {
    return this.shakeT > 0;
  }

  cancelShake(): void {
    this.shakeT = 0;
    this.shakeMag = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  // ─── The frame ────────────────────────────────────────────────────────────

  /**
   * Establishes the root transform. After this call every coordinate anywhere
   * in the renderer is a REFERENCE UNIT — there is no pixel arithmetic past
   * this line, which is what makes the same scene code correct at 1x, at 3x and
   * at a degraded 0.6 quality step.
   */
  begin(): void {
    const k = this.scale * this.dpr * this.qualityScale;
    this.ctx.setTransform(k, 0, 0, k, this.shakeX * k, this.shakeY * k);
  }

  /**
   * Restores the identity transform. Not cosmetic: anything that reads the
   * canvas afterwards (a bake, a screenshot, the ad slot compositing over it)
   * expects device space.
   */
  end(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /**
   * Clears the whole field including the shake gutter.
   *
   * The clear is one unit PAST the field on every side, because during a shake
   * the transform is offset and an exact-size clear leaves a smeared strip of
   * the previous frame along the leading edge.
   */
  clear(fill: string): void {
    const g = this.ctx;
    g.fillStyle = fill;
    g.fillRect(-SHAKE_MAX, -SHAKE_MAX, this.fieldW + SHAKE_MAX * 2, REF.H + SHAKE_MAX * 2);
  }
}

/**
 * The one construction site.
 *
 * Throws rather than degrading: a missing #phone means index.html and the
 * renderer disagree about the document, and every subsequent symptom of that
 * would be a geometry mystery somewhere else.
 */
export function createViewport(
  canvasId = 'game',
  hostId = 'phone',
): Viewport {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  const host = document.getElementById(hostId);
  if (!canvas) throw new Error(`viewport: no canvas with id "${canvasId}"`);
  if (!host) throw new Error(`viewport: no host element with id "${hostId}"`);

  // `alpha:false` is worth real fill rate on mobile GPUs — the compositor stops
  // blending the canvas against the page behind it. Safe here because the game
  // paints every pixel of the field every frame.
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('viewport: 2d context unavailable');

  const vp = new Viewport(canvas, ctx, host);

  const onResize = (): void => vp.resize();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  // The URL-bar collapse on Android does not always fire `resize` on the
  // window, but it always changes #phone's box. Observing the box directly is
  // the only measurement that catches every case.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(onResize).observe(host);
  }

  return vp;
}
