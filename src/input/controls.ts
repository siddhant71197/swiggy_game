/**
 * ══════════════════════════════════════════════════════════════════════════
 *  CONTROLS — the one owner of the pointer and key streams.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): TWO LISTENERS ON THE SAME ELEMENT. The
 * moment a menu scene registers its own `pointerdown` alongside this one, every
 * tap is handled twice, the two handlers race for the `preventDefault` that
 * suppresses pull-to-refresh and double-tap zoom, and the bug reproduces only on
 * the device that happens to dispatch them in the other order. So there is
 * exactly ONE owner for the whole app. The d-pad, the jump button and the active
 * scene are all FED from here, in reference units, and none of them touches the
 * DOM.
 *
 * THE FAILURE THIS FILE PREVENTS (2): TWO INPUT MODELS. A keyboard path that
 * emits its own events while the pad writes a state gives you a game that
 * behaves differently on a desktop than on a phone — and only one of the two
 * ever gets tested. Held keys write into the SAME `DPad.heldDir` the thumb
 * writes, re-armed every frame by `pumpHeld()`, so there is one model and the
 * keyboard is genuinely just another way to press the pad.
 *
 * THE FAILURE THIS FILE PREVENTS (3): THE PLAYER WHO NEVER FINDS THE PAD. Some
 * fraction of first-time players never work out that the on-screen cluster is a
 * control. A SWIPE UP ANYWHERE IN THE STAGE BAND also jumps, which is the
 * cheapest possible insurance against losing them in the first ten seconds.
 *
 * ─── THE SWIPE CANCEL BUG, WHICH THIS CODEBASE HAS SHIPPED ONCE ────────────
 *
 * See `cancelSwipeFor`. The recogniser is spent for the ONE POINTER a pad
 * actually claimed and for no other. Cancelling unconditionally — which is what
 * a `cancelGesture()` with no argument invites — silently disables swiping
 * across the entire game, and nothing errors, nothing logs, and the on-screen
 * pad still works, so it survives every smoke test there is.
 *
 * ─── Pointer Events only ───────────────────────────────────────────────────
 * No mouse path, no touch path, no `'ontouchstart' in window`. A codebase with
 * both has two input systems and only ever tests one of them.
 */

import type { Dir, PointerKind } from '../core/types';
import { BANDS, UI } from '../config/tuning';
import { DPad } from './dpad';
import { JumpButton } from './jumpButton';

/**
 * The subset of the viewport input needs: client pixels → reference units.
 *
 * DECLARED STRUCTURALLY rather than imported from render/canvas. `Viewport`
 * satisfies it by having the two methods, and no import ever crosses from
 * input/ to render/. That is what lets the whole input layer be driven by a
 * recorded gesture log with no canvas in the process.
 */
export interface RefSpace {
  toRefX(clientX: number): number;
  toRefY(clientY: number): number;
}

/** What `intent()` answers with. Read-only to the caller; see the note below. */
export interface Intent {
  dir: Dir;
  up: boolean;
  down: boolean;
  /** PENDING, not held. Spend it with `consumeJump()`. */
  jump: boolean;
}

/**
 * The stage band, in reference units — the region a swipe-up is read in.
 *
 * Derived from BANDS here rather than imported from render/layout, for the same
 * layering reason RefSpace is structural: input must not depend on the renderer.
 * The bands sum to REF.H by construction, so this cannot drift from the layout.
 */
const STAGE_TOP = BANDS.masthead + BANDS.hud;
const STAGE_BOTTOM = STAGE_TOP + BANDS.stage;

export class Controls {
  readonly pad = new DPad();
  readonly jump = new JumpButton();

  /**
   * Raw pointer tap-through to the ACTIVE SCENE, in reference units. Set by
   * main.ts to `director.onPointer`. Only pointers the pad and the jump button
   * declined are forwarded — a thumb steering the pad must not also be pressing
   * whatever menu button happens to sit under it.
   */
  onPointer: ((kind: PointerKind, id: number, x: number, y: number, t: number) => void) | null =
    null;

  /** Keyboard-only verbs. Every one of them also exists as an on-screen control;
   *  these are the desktop shortcuts, not a second way to play. */
  onPause: (() => void) | null = null;
  onConfirm: (() => void) | null = null;
  onMute: (() => void) | null = null;

  /**
   * Fired on the FIRST user gesture of the session, once. main.ts points this at
   * `sfx.unlock()` — an AudioContext created before a gesture is created
   * suspended, and its first sound is swallowed.
   */
  onFirstGesture: (() => void) | null = null;
  private gestured = false;

  private el: HTMLElement | null = null;
  private prevTouchAction = '';

  /** -1 when idle. Only the FIRST finger steers; a second thumb resting on the
   *  glass must never take over mid-round. */
  private activeId = -1;
  private startX = 0;
  private startY = 0;
  private startT = 0;
  /** True once the swipe has fired or been cancelled for this pointer. */
  private swipeSpent = true;
  /** The pointer a pad or the jump button claimed, or -1. */
  private claimedId = -1;

  /**
   * MAY THE PAD AND JUMP BUTTON CLAIM POINTERS?
   *
   * THE BUG THIS EXISTS TO PREVENT, which shipped and was caught by someone
   * clicking a menu button that did nothing: the pad and jump button are laid
   * out unconditionally and took first refusal on EVERY pointer, on every
   * scene. They are only DRAWN during a round, so on the menus they were
   * invisible dead zones — the right pad key claiming x 232–368 / y 1022–1158
   * and the jump disc x 523–703 / y 1006–1186, in reference units.
   *
   * That is not a cosmetic overlap. The game-over screen's brand CTA spans
   * x 44–684 / y 1050–1149 and was dead across BOTH of them: the single most
   * important button in a marketing unit, unclickable, with nothing on screen
   * to suggest why.
   *
   * Re-laying-out the menus cannot fix it, because menus have to put their
   * buttons where the thumb is. Set from main.ts once per frame, alongside the
   * ad rule and for the same reason — one derived line, from outside every
   * scene, with no edges to miss.
   */
  gameplayInput = false;

  /** Held key state. Tracked as a SET rather than a single value so that
   *  releasing D while A is still down falls back to left instead of to nothing,
   *  which is what a player rolling their fingers is actually asking for. */
  private kLeft = false;
  private kRight = false;
  private kUp = false;
  private kDown = false;

  /**
   * Preallocated and OVERWRITTEN. `intent()` is called from the fixed step, and
   * a helper that returns a fresh object there is sixty allocations a second —
   * which never looks like a leak, only like a dropped frame every few seconds,
   * landing on a missed jump.
   */
  private readonly out: Intent = { dir: 0, up: false, down: false, jump: false };

  constructor(private readonly space: RefSpace) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  attach(el: HTMLElement): void {
    this.detach();
    this.el = el;

    // Without this the browser claims the gesture as a scroll after ~10px and
    // simply stops delivering pointermove, so the swipe past the threshold is
    // the one that never arrives. preventDefault alone is too late by then.
    this.prevTouchAction = el.style.touchAction;
    el.style.touchAction = 'none';

    // Non-passive on purpose: these handlers preventDefault to suppress scroll,
    // pull-to-refresh and double-tap zoom, and a passive listener may not.
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp, { passive: false });
    el.addEventListener('pointercancel', this.onCancel, { passive: false });
    el.addEventListener('lostpointercapture', this.onLostCapture, { passive: false });
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp, { passive: false });
    // Alt-tabbing away with a key held never delivers the keyup, and the agent
    // runs into a wall until that key is pressed and released again.
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    const el = this.el;
    if (el) {
      el.removeEventListener('pointerdown', this.onDown);
      el.removeEventListener('pointermove', this.onMove);
      el.removeEventListener('pointerup', this.onUp);
      el.removeEventListener('pointercancel', this.onCancel);
      el.removeEventListener('lostpointercapture', this.onLostCapture);
      el.style.touchAction = this.prevTouchAction;
    }
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.el = null;
    this.reset();
  }

  /** Re-place the controls after a resize. `fieldW` is in reference units. */
  layout(fieldW: number, leftHanded = false): void {
    this.pad.layout(fieldW, leftHanded);
    this.jump.layout(fieldW, leftHanded);
  }

  /** Hard reset — a scene swap, a life lost, a lost focus. */
  reset(): void {
    this.activeId = -1;
    this.claimedId = -1;
    this.swipeSpent = true;
    this.clearKeys();
    this.pad.reset();
    this.jump.reset();
  }

  // ── What the game reads ───────────────────────────────────────────────────

  /**
   * Call ONCE PER FRAME before the fixed steps.
   *
   * A held key is a STATE, not an event, and the pad clears its state on
   * release — so a key that is still down has to restate itself every frame or
   * a thumb lifting off the pad would cancel the keyboard. See failure (2).
   */
  pumpHeld(): void {
    const kd: Dir = this.kLeft && !this.kRight ? -1 : this.kRight && !this.kLeft ? 1 : 0;
    if (kd !== 0) this.pad.heldDir = kd;

    if (this.pad.verticalLive) {
      if (this.kUp) this.pad.heldUp = true;
      if (this.kDown) this.pad.heldDown = true;
    }
  }

  /**
   * The whole input model, in one struct. THE SAME OBJECT EVERY CALL — copy the
   * fields out if you need to keep them past the current step.
   */
  intent(): Readonly<Intent> {
    const o = this.out;
    o.dir = this.pad.heldDir;
    // Gated a second time here as well as in the pad, because `verticalLive` can
    // go false between the press and the read — stepping off a ladder mid-hold
    // must stop the climb on that frame, not on the next release.
    o.up = this.pad.verticalLive && this.pad.heldUp;
    o.down = this.pad.verticalLive && this.pad.heldDown;
    o.jump = this.jump.pending;
    return o;
  }

  /** Take the pending jump. True AT MOST ONCE per press — never a held state. */
  consumeJump(): boolean {
    return this.jump.consume();
  }

  /** Play sets this every step: true on a ladder or within CLIMB.grabX of one. */
  setVerticalLive(v: boolean): void {
    this.pad.verticalLive = v;
    if (!v) {
      this.pad.heldUp = false;
      this.pad.heldDown = false;
    }
  }

  // ── Pointer ───────────────────────────────────────────────────────────────

  private onDown = (ev: PointerEvent): void => {
    ev.preventDefault();
    this.firstGesture();
    if (this.activeId !== -1) return;

    const x = this.space.toRefX(ev.clientX);
    const y = this.space.toRefY(ev.clientY);
    const t = ev.timeStamp / 1000;

    this.activeId = ev.pointerId;
    this.startX = x;
    this.startY = y;
    this.startT = t;

    // A swipe is only armed inside the stage band. Below it is the pad cluster,
    // above it is the HUD; a flick that starts on either is a mis-hit, not a
    // jump, and reading it as one would fire a jump every time a player drags
    // their thumb up off the d-pad.
    this.swipeSpent = !(y >= STAGE_TOP && y <= STAGE_BOTTOM);

    // The controls get first refusal, in order — BUT ONLY WHILE A ROUND IS
    // RUNNING. See `gameplayInput`: off the play scene the pad and the jump
    // button are invisible, and an invisible control that still swallows taps
    // is a menu button that silently does nothing.
    let claimed = false;
    if (this.gameplayInput) {
      claimed = this.pad.handle('down', ev.pointerId, x, y);
      if (!claimed) claimed = this.jump.handle('down', ev.pointerId, x, y);
    }
    if (claimed) {
      this.claimedId = ev.pointerId;
      this.cancelSwipeFor(ev.pointerId);
    } else {
      this.claimedId = -1;
      this.forward('down', ev.pointerId, x, y, t);
    }

    // Capture, so a thumb that leaves the element still reports its release.
    // Without it a swipe off the edge leaves activeId stuck on that pointer and
    // every later input is ignored for the rest of the run.
    try {
      this.el?.setPointerCapture(ev.pointerId);
    } catch {
      // Capture is an optimisation. Some browsers throw for a pointer already
      // released between dispatch and here, and there is nothing to do about it.
    }
  };

  private onMove = (ev: PointerEvent): void => {
    if (ev.pointerId !== this.activeId) return;
    ev.preventDefault();

    const x = this.space.toRefX(ev.clientX);
    const y = this.space.toRefY(ev.clientY);
    const t = ev.timeStamp / 1000;

    if (ev.pointerId === this.claimedId) {
      this.pad.handle('move', ev.pointerId, x, y);
      this.jump.handle('move', ev.pointerId, x, y);
    } else {
      this.forward('move', ev.pointerId, x, y, t);
    }

    if (this.swipeSpent) return;

    const dy = y - this.startY;
    // UP is negative y. A downward drag is not a failed swipe-up, it is a
    // different gesture, so it neither fires nor spends the recogniser.
    if (dy > -UI.swipeJumpMinDy) return;
    if (t - this.startT > UI.swipeJumpMaxSec) {
      // Too slow to be a flick. Spend it, so a long slow drag cannot cross the
      // threshold again later in the same press and fire a jump the player did
      // not ask for.
      this.swipeSpent = true;
      return;
    }

    this.swipeSpent = true;
    this.jump.press();
  };

  private onUp = (ev: PointerEvent): void => {
    if (ev.pointerId !== this.activeId) return;
    ev.preventDefault();
    this.finish('up', ev);
  };

  private onCancel = (ev: PointerEvent): void => {
    if (ev.pointerId !== this.activeId) return;
    this.finish('cancel', ev);
  };

  /**
   * Lost capture is a cancel — something else took the finger, and there is no
   * API that distinguishes iOS's edge-swipe theft from any other cause. It also
   * fires benignly after our own release in `finish`, but by then activeId is
   * -1 and the guard rejects it.
   */
  private onLostCapture = (ev: PointerEvent): void => {
    if (ev.pointerId !== this.activeId) return;
    this.finish('cancel', ev);
  };

  private finish(kind: 'up' | 'cancel', ev: PointerEvent): void {
    const x = this.space.toRefX(ev.clientX);
    const y = this.space.toRefY(ev.clientY);
    const t = ev.timeStamp / 1000;

    if (ev.pointerId === this.claimedId) {
      this.pad.handle(kind, ev.pointerId, x, y);
      this.jump.handle(kind, ev.pointerId, x, y);
    } else {
      this.forward(kind, ev.pointerId, x, y, t);
    }

    this.activeId = -1;
    this.claimedId = -1;
    this.swipeSpent = true;

    const el = this.el;
    try {
      if (el && el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
    } catch {
      // Already gone. Nothing to release and nothing to report.
    }
  }

  /**
   * SPEND THE SWIPE RECOGNISER FOR ONE POINTER, AND ONLY THAT POINTER.
   *
   * A thumb sliding from the left pad to the right pad travels far past
   * `UI.swipeJumpMinDy` on the way; without this the same motion produces a pad
   * direction AND a phantom jump. But note the argument, and note that it is
   * checked: the tempting shape is a bare `cancelGesture()` that just sets a
   * flag, and THIS CODEBASE HAS ALREADY SHIPPED THAT ONCE. A pad that cancels
   * unconditionally disables swipe-to-jump across the entire game — silently,
   * with no error and no log, and with the on-screen pad still working, so it
   * passes every smoke test and is only ever found by a player who says the
   * swipe "used to work".
   */
  cancelSwipeFor(pointerId: number): void {
    if (pointerId !== this.activeId) return;
    this.swipeSpent = true;
  }

  private forward(kind: PointerKind, id: number, x: number, y: number, t: number): void {
    this.onPointer?.(kind, id, x, y, t);
  }

  private firstGesture(): void {
    if (this.gestured) return;
    this.gestured = true;
    this.onFirstGesture?.();
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────

  private onKeyDown = (ev: KeyboardEvent): void => {
    // OS auto-repeat is redundant: the held state is already set and pumpHeld()
    // re-arms from it every frame. Allowing it through would also re-fire the
    // jump edge every 30ms, which is the auto-jump bug by another route.
    if (ev.repeat) return;

    switch (ev.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.kLeft = true;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.kRight = true;
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.kUp = true;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.kDown = true;
        break;
      case ' ':
      case 'Spacebar':
      case 'z':
      case 'Z':
        this.jump.press();
        break;
      case 'p':
      case 'P':
      case 'Escape':
        this.onPause?.();
        break;
      case 'Enter':
        this.onConfirm?.();
        break;
      case 'm':
      case 'M':
        this.onMute?.();
        break;
      default:
        // Only preventDefault for keys we own. Swallowing everything breaks
        // reload, devtools and tab-away, and does it silently.
        return;
    }
    ev.preventDefault();
    this.firstGesture();
  };

  private onKeyUp = (ev: KeyboardEvent): void => {
    switch (ev.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.kLeft = false;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.kRight = false;
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.kUp = false;
        this.pad.heldUp = false;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.kDown = false;
        this.pad.heldDown = false;
        break;
      default:
        return;
    }
    ev.preventDefault();
    // Fall back to whichever horizontal key is still down rather than to nothing.
    if (!this.kLeft && !this.kRight) this.pad.heldDir = 0;
  };

  private onBlur = (): void => {
    this.clearKeys();
    this.pad.reset();
    this.jump.reset();
  };

  private clearKeys(): void {
    this.kLeft = false;
    this.kRight = false;
    this.kUp = false;
    this.kDown = false;
  }
}
