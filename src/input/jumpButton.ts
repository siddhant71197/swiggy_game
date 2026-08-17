/**
 * ══════════════════════════════════════════════════════════════════════════
 *  JUMP BUTTON — a press EDGE, never a held state.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: the auto-jumping agent. If `pressed` were what
 * the sim read, a thumb resting on the button — which is where a thumb rests,
 * because there is nowhere else for it to be between jumps — would re-fire on
 * every single landing. The player would bunny-hop across the level without
 * asking to, land on a barrel they were trying to stand still and wait out, and
 * report it as "the jump button is stuck".
 *
 * So the button produces exactly one CONSUMABLE EDGE per press. `pressed` exists
 * only so the renderer can draw the pushed state; nothing reads it for gameplay.
 * The edge survives across frames until consumed, which is what lets it feed
 * PHYS.bufferSec — a jump pressed just before touchdown fires ON touchdown
 * rather than being thrown away by the frame it happened to land in.
 *
 * A ROUND target with `UI.jumpSlop` of invisible expansion. The slop is radial
 * rather than a bounding box: a square hit area on a round button is generous at
 * the corners and mean at the edges, which is precisely backwards from where a
 * thumb actually misses.
 *
 * THIS OWNS NO LISTENERS. It is fed from Controls.
 */

import type { PointerKind } from '../core/types';
import { REF, UI } from '../config/tuning';

export class JumpButton {
  /** Centre and radius in reference units. Set by `layout`; the renderer reads them. */
  cx = 0;
  cy: number = UI.jumpCenterY;
  readonly r: number = UI.jumpR;

  /** Drawing state only. NOTHING in the sim may read this — see the header. */
  pressed = false;

  private activeId = -1;
  private edge = false;

  /** `left` mirrors the control for a left-handed layout. */
  layout(fieldW: number, left = false): void {
    this.cx = left ? UI.jumpMarginX : fieldW - UI.jumpMarginX;
    this.cy = Math.min(UI.jumpCenterY, REF.H - UI.jumpR - 24);
  }

  /** Radial test, slop included. */
  hit(x: number, y: number): boolean {
    const dx = x - this.cx;
    const dy = y - this.cy;
    const reach = this.r + UI.jumpSlop;
    return dx * dx + dy * dy <= reach * reach;
  }

  /**
   * Feed one pointer event. Returns true when the button CLAIMED it — the caller
   * uses that to spend the swipe recogniser for this pointer only.
   *
   * `move` is claimed but does nothing. Sliding off the button does NOT cancel a
   * jump that has already fired: the jump happened on the down edge, and
   * "un-jumping" is not a thing the physics can express anyway.
   */
  handle(kind: PointerKind, id: number, x: number, y: number): boolean {
    if (kind === 'down') {
      if (this.activeId !== -1) return false;
      if (!this.hit(x, y)) return false;
      this.activeId = id;
      this.pressed = true;
      // The one write. Holding adds nothing after this line.
      this.edge = true;
      return true;
    }

    if (id !== this.activeId) return false;

    if (kind === 'move') return true;

    this.release();
    return true;
  }

  /** Fire from a key press. Same edge, same consumer, one input model. */
  press(): void {
    this.edge = true;
  }

  /**
   * Is an unconsumed press waiting? A PEEK — it does not spend the edge, so a
   * HUD that wants to flash the button and a sim that wants to jump can both ask
   * without one of them stealing the other's input.
   */
  get pending(): boolean {
    return this.edge;
  }

  /**
   * Take the pending press, if there is one. Returns true AT MOST ONCE per press
   * — a second call in the same frame is false, which is what makes this safe to
   * poll from more than one place during the buffered-jump window.
   */
  consume(): boolean {
    if (!this.edge) return false;
    this.edge = false;
    return true;
  }

  private release(): void {
    this.activeId = -1;
    this.pressed = false;
    // The EDGE is deliberately NOT cleared here. A tap shorter than one frame —
    // which a fast player produces regularly at 60Hz — must still be delivered.
  }

  /** Hard reset — a scene swap or a lost focus. Drops the unconsumed edge too,
   *  so a jump pressed on the results screen cannot fire on the next level. */
  reset(): void {
    this.release();
    this.edge = false;
  }
}
