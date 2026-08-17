/**
 * ══════════════════════════════════════════════════════════════════════════
 *  D-PAD — four pads, one captured thumb, and no fatal mis-press.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): THE PAD THAT ONLY ACCEPTS TAPS. A thumb
 * rolls between pads without leaving the glass. So the pads are fed from a
 * CAPTURED POINTER STREAM rather than from taps: `down` claims the pointer, and
 * every `move` re-tests which pad it is over, so sliding from left to up turns
 * without a lift. That one behaviour is most of whether an on-screen pad feels
 * good, and it cannot be retrofitted onto a tap handler.
 *
 * THE FAILURE THIS FILE PREVENTS (2): THE MIS-PRESS THAT KILLS YOU. On a girder,
 * UP and DOWN mean nothing. If a stray vertical touch cleared the held
 * horizontal direction, the player would STOP DEAD in front of a barrel because
 * their thumb drifted 20 units north — and they would have no idea why. So
 * vertical input is INERT unless `verticalLive` is set, and inert here means
 * genuinely nothing: it does not steer, and it does not clear the run either.
 *
 * THE FAILURE THIS FILE PREVENTS (3): THE DIAGONAL THAT PICKS THE WRONG AXIS.
 * The pads carry `UI.padSlop` of invisible expansion per side, so their corners
 * overlap — which is correct, it is what makes the cluster forgiving — but a
 * point inside two of them has to resolve deterministically. It resolves to the
 * axis that is currently LEGAL first (vertical on a ladder, horizontal off one)
 * and to the nearest pad centre only as a tie-break. Resolving by loop order
 * instead makes the pad feel like it ignores you on exactly the diagonal rolls
 * that a ladder-to-girder transition produces.
 *
 * ─── heldDir CLEARS ON RELEASE, UNLIKE THE MAZE SIBLING ────────────────────
 *
 * The sibling game deliberately KEEPS its held direction after a lift, because
 * in a grid-maze you never stand still. This is a platformer: releasing the pad
 * must stop the run, exactly as releasing an arrow key does. Carrying the
 * direction here would walk the agent off an open girder end while their thumb
 * is nowhere near the screen.
 *
 * THIS OWNS NO LISTENERS. It is fed from Controls, so there is exactly one owner
 * of the gesture stream in the whole app.
 */

import type { Dir, PointerKind } from '../core/types';
import { REF, UI } from '../config/tuning';

/**
 * Pad ordinals. 0 is the decorative hub, which is NEVER hit-tested: its rect
 * overlaps the inner slop of all four pads, so letting it answer would delete
 * the forgiveness in exactly the place a thumb rolls through.
 *
 * The renderer indexes `rects` by these same numbers, so the art and the hit
 * test agree by construction rather than by two people remembering an order.
 */
export const PAD = {
  NONE: 0,
  UP: 1,
  LEFT: 2,
  DOWN: 3,
  RIGHT: 4,
} as const;

export type PadIndex = (typeof PAD)[keyof typeof PAD];

/**
 * Structural, and kept local rather than imported from render/ui. A control that
 * describes its own geometry can be exercised with no renderer in the room, and
 * the shape is plain enough that the renderer's Rect interchanges for free.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Outward unit vector per pad ordinal. Index 0 (the hub) points nowhere. */
const ARM_X: readonly number[] = [0, 0, -1, 0, 1];
const ARM_Y: readonly number[] = [0, -1, 0, 1, 0];

export class DPad {
  /**
   * Five rects, indexed by PAD. Allocated ONCE and mutated in place — a layout
   * change must never hand the renderer a fresh array mid-frame.
   */
  readonly rects: readonly Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];

  /** Cluster centre in reference units. Set by `layout`. */
  cx = 0;
  cy: number = UI.padCenterY;

  /** Which pad is under the thumb right now. The renderer reads it. */
  pressedPad: PadIndex = PAD.NONE;

  /** Horizontal run intent. A STATE, re-read every fixed step. */
  heldDir: Dir = 0;
  /** Climb intent. Only ever set while `verticalLive`. See failure (2). */
  heldUp = false;
  heldDown = false;

  /**
   * IS VERTICAL INPUT MEANINGFUL RIGHT NOW?
   *
   * Set by the play scene each step: true when the agent is on a ladder, and
   * also when a ladder is within CLIMB.grabX — because UP is how a grab is
   * initiated, so gating strictly on "already climbing" would make ladders
   * impossible to mount. Off a ladder and out of range, UP and DOWN do nothing
   * at all rather than something surprising.
   */
  verticalLive = false;

  private activeId = -1;

  /**
   * Place the cluster. `right` mirrors it for a left-handed layout.
   *
   * The cluster claims ONE HALF of the pad band on purpose. The rest of the
   * screen stays unclaimed, so a flick there is still read as a swipe by
   * Controls — which is the input path that saves the player who never works out
   * that the pad is a control at all.
   */
  layout(fieldW: number, right = false): void {
    const step = UI.padSize + UI.padGap;
    /** Centre to the outer edge of an arm pad — half the 3×3 cluster. */
    const half = step + UI.padSize / 2;
    this.cx = right ? fieldW - UI.padMarginX - half : UI.padMarginX + half;
    // Clamped so that a short field cannot push the DOWN pad off the bottom,
    // which on a 20:9 handset it otherwise would.
    this.cy = Math.min(UI.padCenterY, REF.H - half - 24);

    const size = UI.padSize;
    for (let d = 0; d <= 4; d++) {
      const r = this.rects[d]!;
      r.w = size;
      r.h = size;
      r.x = this.cx + ARM_X[d]! * step - size / 2;
      r.y = this.cy + ARM_Y[d]! * step - size / 2;
    }
  }

  /**
   * Which pad a point lands on, slop included, or PAD.NONE.
   *
   * The hub is skipped entirely. Overlapping slop is resolved by preferring the
   * legal axis and then by nearest centre — see failure (3).
   */
  hit(x: number, y: number): PadIndex {
    let best: PadIndex = PAD.NONE;
    let bestScore = Infinity;

    for (let d = 1; d <= 4; d++) {
      const r = this.rects[d]!;
      if (
        x < r.x - UI.padSlop ||
        x > r.x + r.w + UI.padSlop ||
        y < r.y - UI.padSlop ||
        y > r.y + r.h + UI.padSlop
      ) {
        continue;
      }
      const dx = x - (r.x + r.w / 2);
      const dy = y - (r.y + r.h / 2);
      let score = dx * dx + dy * dy;

      // The legality bias. A large constant rather than a weight, so a legal pad
      // ALWAYS beats an illegal one no matter how the distances fall — a scaled
      // tie-break would flip somewhere in the overlap and be untraceable.
      const vertical = d === PAD.UP || d === PAD.DOWN;
      if (vertical !== this.verticalLive) score += 1e6;

      if (score < bestScore) {
        bestScore = score;
        best = d as PadIndex;
      }
    }
    return best;
  }

  /**
   * Feed one pointer event. RETURNS TRUE WHEN THE PAD CLAIMED IT.
   *
   * The caller uses that return to spend the swipe recogniser for THIS POINTER
   * AND NO OTHER. See the comment on Controls.cancelSwipeFor — cancelling
   * unconditionally is a bug the sibling codebase has already shipped once.
   */
  handle(kind: PointerKind, id: number, x: number, y: number): boolean {
    if (kind === 'down') {
      // One thumb. A second finger resting on the cluster must never be able to
      // take the pad over from the one that is steering.
      if (this.activeId !== -1) return false;
      const d = this.hit(x, y);
      if (d === PAD.NONE) return false;
      this.activeId = id;
      this.apply(d);
      return true;
    }

    if (id !== this.activeId) return false;

    if (kind === 'move') {
      // Failure (1): re-tested on every move, so a roll from one pad to the next
      // turns without a lift. Sliding into the gap between pads releases the
      // intent, which is right — the thumb is not on a control any more.
      this.apply(this.hit(x, y));
      return true;
    }

    // up | cancel. A cancelled pointer is a released pointer: iOS steals the
    // stream on an edge swipe and there is no way to tell that from a lift, so
    // both must leave the pad idle rather than stuck on.
    this.release();
    return true;
  }

  /** Set the whole intent from one pad ordinal. The single write path. */
  private apply(d: PadIndex): void {
    this.pressedPad = d;
    if (d === PAD.LEFT) {
      this.heldDir = -1;
      this.heldUp = false;
      this.heldDown = false;
      return;
    }
    if (d === PAD.RIGHT) {
      this.heldDir = 1;
      this.heldUp = false;
      this.heldDown = false;
      return;
    }
    if (d === PAD.UP || d === PAD.DOWN) {
      // Failure (2): off a ladder this is a NO-OP, and specifically it does not
      // clear heldDir. A thumb drifting north mid-run keeps running.
      if (!this.verticalLive) return;
      this.heldDir = 0;
      this.heldUp = d === PAD.UP;
      this.heldDown = d === PAD.DOWN;
      return;
    }
    // PAD.NONE — in the gap, still captured. Everything relaxes.
    this.heldDir = 0;
    this.heldUp = false;
    this.heldDown = false;
  }

  private release(): void {
    this.activeId = -1;
    this.pressedPad = PAD.NONE;
    // Cleared, unlike the maze sibling. See the header.
    this.heldDir = 0;
    this.heldUp = false;
    this.heldDown = false;
  }

  /** Hard reset — a life lost, a level change, a scene swap, a lost focus. */
  reset(): void {
    this.release();
    this.verticalLive = false;
  }
}
