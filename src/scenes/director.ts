/**
 * ══════════════════════════════════════════════════════════════════════════
 *  DIRECTOR — one scene at a time, and the wipe between them.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): SCENES THAT NAVIGATE THEMSELVES. The
 * moment a scene knows what comes after it, the flow of the game stops being
 * readable in any one place and becomes a graph you reconstruct by grepping —
 * and adding a screen becomes an edit in three files, two of which the next
 * person finds by breaking them. So scenes take CALLBACKS, the Director owns the
 * swap, and main.ts declares the entire graph in one block.
 *
 * THE FAILURE THIS FILE PREVENTS (2): INPUT ARRIVING MID-TRANSITION. See
 * `onPointer`. This one is worth the whole file on its own.
 *
 * THE WIPE IS THE BRAND'S OWN COLOUR. A fade to black is the absence of a
 * transition; a fade to `COLORS.wipe` is a beat, and it is the cheapest branding
 * in the entire build — it happens between every pair of screens and costs one
 * fillRect.
 */

import type { PointerKind } from '../core/types';
import type { Viewport } from '../render/canvas';
import { COLORS } from '../brand';
import { MOTION } from '../config/theme';
import { clamp } from '../core/math';

export type SceneId =
  | 'splash'
  | 'rules'
  | 'levelSelect'
  | 'play'
  | 'delivered'
  | 'gameOver';

export interface GameScene {
  readonly id: SceneId;
  /** `payload` is whatever main.ts passed to `go()`. Scenes cast it; nothing
   *  else in the game knows what a given scene expects. */
  enter(payload?: unknown): void;
  exit(): void;
  update(dt: number, simTime: number): void;
  render(ctx: CanvasRenderingContext2D, alpha: number, simTime: number): void;
  onPointer(kind: PointerKind, id: number, x: number, y: number, t: number): void;
}

type Phase = 'idle' | 'out' | 'in';

export class Director {
  private current: GameScene | null = null;
  private next: GameScene | null = null;
  private pendingPayload: unknown = undefined;
  private phase: Phase = 'idle';
  private fade = 0;

  constructor(private readonly vp: Viewport) {}

  get scene(): GameScene | null {
    return this.current;
  }

  get transitioning(): boolean {
    return this.phase !== 'idle';
  }

  /** Immediate swap, no wipe. Boot only — there is nothing to wipe away from. */
  set(scene: GameScene, payload?: unknown): void {
    this.current?.exit();
    this.current = scene;
    this.next = null;
    this.phase = 'idle';
    this.fade = 0;
    scene.enter(payload);
  }

  /**
   * Fade out, swap at the midpoint, fade in. IGNORED while already moving — a
   * double-tap on a menu button would otherwise queue two transitions and land
   * on the second one, skipping a screen for no reason the player can see.
   */
  go(scene: GameScene, payload?: unknown): void {
    if (this.phase !== 'idle') return;
    this.next = scene;
    this.pendingPayload = payload;
    this.phase = 'out';
    this.fade = 0;
  }

  update(dt: number, simTime: number): void {
    if (this.phase === 'out') {
      this.fade += dt / MOTION.wipeOutSec;
      if (this.fade >= 1) {
        this.fade = 1;
        this.current?.exit();
        this.current = this.next;
        this.next = null;
        this.current?.enter(this.pendingPayload);
        this.pendingPayload = undefined;
        this.phase = 'in';
      }
    } else if (this.phase === 'in') {
      this.fade -= dt / MOTION.wipeInSec;
      if (this.fade <= 0) {
        this.fade = 0;
        this.phase = 'idle';
      }
    }
    // Out is slower than in (MOTION): leaving wants to feel deliberate, arriving
    // wants to get out of the way, because the player is already looking at the
    // new screen and any further ceremony is just latency.
    this.current?.update(dt, simTime);
  }

  render(ctx: CanvasRenderingContext2D, alpha: number, simTime: number): void {
    this.current?.render(ctx, alpha, simTime);
    if (this.fade > 0) {
      ctx.globalAlpha = clamp(this.fade, 0, 1);
      ctx.fillStyle = COLORS.wipe;
      // Overdrawn well past the field on both sides: the canvas is letterboxed
      // on a 20:9 handset and a wipe that stops at the field edge leaves two
      // unfaded strips, which is the exact opposite of what a wipe is for.
      ctx.fillRect(-this.vp.fieldW, 0, this.vp.fieldW * 3, this.vp.fieldH);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * SWALLOWS INPUT MID-TRANSITION, AND THAT GUARD IS THE POINT.
   *
   * Without it, a tap landing during the 0.22s wipe is delivered to a scene that
   * is on its way out — one that has already handed its result to a callback and
   * whose buttons now fire a second time, or to a scene that is fading IN and
   * whose layout has not been computed for this frame yet. The symptom is a
   * button that "sometimes does nothing", or a level that starts twice, and it
   * is very nearly impossible to reproduce deliberately because it requires
   * tapping inside a 220ms window that is showing a full-screen colour wash.
   *
   * Two hundred milliseconds of ignored input costs nothing: there is nothing on
   * screen to tap.
   */
  onPointer(kind: PointerKind, id: number, x: number, y: number, t: number): void {
    if (this.phase !== 'idle') return;
    this.current?.onPointer(kind, id, x, y, t);
  }
}
