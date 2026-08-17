/**
 * ══════════════════════════════════════════════════════════════════════════
 *  FX — the feedback layer, and the only place that reads the sim's events.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): the import that points the wrong way.
 * src/core/events.ts explains it at length — the sim must never call a
 * renderer, or the headless bot in tools/ stops being able to run the game at
 * all. This file is the other end of that seam: it DRAINS the event queue and
 * turns records into sparkles, numbers, shake and hit-stop. The sim never
 * learns it exists.
 *
 * THE FAILURE THIS FILE PREVENTS (2): the allocation in the juice. Particles
 * are the classic place a canvas game starts dropping frames — twenty small
 * objects per pickup, three pickups a second, and the minor GC lands on the
 * frame with the most going on, because that is the frame that allocated most.
 * Everything here is POOLED (core/pool.ts) with fixed capacity. `alloc()`
 * returning null means the effect is skipped, and a missing sparkle is not
 * something anybody notices.
 *
 * THE FAILURE THIS FILE PREVENTS (3): the vestibular one. `prefers-reduced-
 * motion` is not a preference dialog, it is an accessibility setting that some
 * people have on because screen shake makes them ill. Under it, shake and
 * hit-stop are OFF, particles are static and popups rise without drifting —
 * the information is all still there, the motion is not. Checked once and
 * cached, with a change listener, because matchMedia in a hot loop is a real
 * cost.
 */

import { COLORS, withAlpha } from '../brand';
import { font, MOTION, TEXT, TRACK, WEIGHT } from '../config/theme';
import { drain, type SimEvent } from '../core/events';
import { makePool, type Pool } from '../core/pool';
import type { Viewport } from './canvas';
import { trackedText } from './shapes';

// ─── Reduced motion ─────────────────────────────────────────────────────────

let reducedMotion = false;

(function watchReducedMotion(): void {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion = mq.matches;
  // The setting can change while the game is running (an OS-level toggle, or a
  // "reduce motion during focus" schedule). Listening costs nothing and the
  // alternative is respecting it only for players who set it before loading.
  const onChange = (e: MediaQueryListEvent): void => {
    reducedMotion = e.matches;
    if (reducedMotion) hitStopT = 0;
  };
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
})();

export function motionReduced(): boolean {
  return reducedMotion;
}

// ─── Pools ──────────────────────────────────────────────────────────────────

/**
 * 160 particles.
 *
 * A rakhi pickup is 14, a barrel smash 18, a death 24. The worst realistic
 * frame — a smash and a pickup landing together while a previous burst is
 * still alive — is under 60. 160 is generous enough that the cap never shapes
 * what the player sees, and small enough that a full pool is 160 structs, not
 * a memory event.
 */
const PARTICLE_CAP = 160;

/** Popups are read, so they last longer and overlap less. Twelve is plenty. */
const POPUP_CAP = 12;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  /** 0 = disc, 1 = square. Two shapes is enough vocabulary for a sparkle. */
  square: number;
}

interface Popup {
  x: number;
  y: number;
  life: number;
  text: string;
  color: string;
  size: number;
  /** Horizontal drift, so two popups in the same spot do not overlap exactly. */
  vx: number;
}

/**
 * `factory` assigns EVERY field — see the two rules in core/pool.ts. A struct
 * that gains a field later is a hidden-class transition on a hot object, which
 * is the deoptimisation the pool exists to avoid, reintroduced invisibly.
 */
const particles: Pool<Particle> = makePool<Particle>(
  PARTICLE_CAP,
  () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 1,
    color: COLORS.scorePop,
    gravity: 0,
    square: 0,
  }),
  (p) => {
    p.x = 0;
    p.y = 0;
    p.vx = 0;
    p.vy = 0;
    p.life = 0;
    p.maxLife = 1;
    p.size = 1;
    p.color = COLORS.scorePop;
    p.gravity = 0;
    p.square = 0;
  },
);

const popups: Pool<Popup> = makePool<Popup>(
  POPUP_CAP,
  () => ({ x: 0, y: 0, life: 0, text: '', color: COLORS.scorePop, size: TEXT.body, vx: 0 }),
  (p) => {
    p.x = 0;
    p.y = 0;
    p.life = 0;
    p.text = '';
    p.color = COLORS.scorePop;
    p.size = TEXT.body;
    p.vx = 0;
  },
);

// ─── Attachment ─────────────────────────────────────────────────────────────

/**
 * The viewport, so shake can be applied to the ROOT transform.
 *
 * Shake decays in canvas.ts rather than here on purpose: the offset has to be
 * folded into the frame's base transform or half the scene shakes and the other
 * half does not. fx decides WHEN; the viewport owns HOW MUCH and applies it.
 */
let vp: Viewport | null = null;

export function attachFx(viewport: Viewport): void {
  vp = viewport;
}

// ─── Hit-stop ───────────────────────────────────────────────────────────────

let hitStopT = 0;

/**
 * FREEZE THE WORLD FOR A FEW FRAMES.
 *
 * The cheapest impact effect there is, and the most easily overdone: past about
 * 150ms it stops reading as weight and starts reading as a hitch, which is the
 * exact thing the frame budget work is trying to avoid looking like. RAKHI
 * .unlockHitStopSec is 0.15 and is the longest one in the game.
 *
 * Off entirely under reduced motion — a freeze is a motion artefact even though
 * nothing moves.
 */
export function hitStop(sec: number): void {
  if (reducedMotion) return;
  if (sec > hitStopT) hitStopT = Math.min(sec, 0.15);
}

/** True while the sim should not be stepped. The scene consults this. */
export function frozen(): boolean {
  return hitStopT > 0;
}

// ─── Emitters ───────────────────────────────────────────────────────────────

/**
 * Deterministic pseudo-random, seeded off a counter.
 *
 * NOT core/rng.ts: that one is the SIM's stream and its sequence is part of
 * what makes a run reproducible. Drawing burst angles from it would mean the
 * particle count changed the sim's future, which turns "the effects look
 * different" into "the game plays differently".
 */
let noiseSeed = 1;
function noise(): number {
  noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
  return noiseSeed / 4294967296;
}

export interface BurstOptions {
  count?: number;
  color?: string;
  speed?: number;
  size?: number;
  gravity?: number;
  life?: number;
  square?: boolean;
}

/** A radial burst. The base of every effect in the game. */
export function burst(x: number, y: number, opts: BurstOptions = {}): void {
  const n = Math.round((opts.count ?? 12) * (reducedMotion ? 0.5 : 1));
  const speed = opts.speed ?? 180;
  const life = opts.life ?? 0.5;
  for (let i = 0; i < n; i++) {
    const p = particles.alloc();
    // Null means the pool is full. DROP IT — see core/pool.ts failure (1). A
    // burst that grows the pool allocates during the busiest frame of the run.
    if (!p) return;
    const a = (i / n) * Math.PI * 2 + noise() * 0.6;
    const s = speed * (0.55 + noise() * 0.65);
    p.x = x;
    p.y = y;
    p.vx = reducedMotion ? 0 : Math.cos(a) * s;
    p.vy = reducedMotion ? 0 : Math.sin(a) * s;
    p.maxLife = life * (0.7 + noise() * 0.6);
    p.life = p.maxLife;
    p.size = opts.size ?? 4;
    p.color = opts.color ?? COLORS.rakhiDiscHi;
    p.gravity = reducedMotion ? 0 : (opts.gravity ?? 420);
    p.square = opts.square ? 1 : 0;
  }
}

/**
 * A FLOATING NUMBER.
 *
 * Rises and fades over MOTION.popupRiseSec. The horizontal drift is what stops
 * a chain of four pickups in the same doorway from stacking into one illegible
 * number — it is not decoration.
 */
export function popup(x: number, y: number, text: string, color?: string, size?: number): void {
  const p = popups.alloc();
  if (!p) return;
  p.x = x;
  p.y = y;
  p.life = MOTION.popupRiseSec;
  p.text = text;
  p.color = color ?? COLORS.scorePop;
  p.size = size ?? TEXT.sub;
  p.vx = reducedMotion ? 0 : (noise() - 0.5) * 26;
}

/** Screen shake, in reference units of peak offset. Ignored under reduced motion. */
export function shake(mag: number): void {
  if (reducedMotion || !vp) return;
  vp.kick(mag);
}

// ─── The event bridge ───────────────────────────────────────────────────────

/**
 * DRAIN THE SIM'S QUEUE AND TURN IT INTO FEEDBACK.
 *
 * Called once per frame by the play scene, AFTER the sim has stepped. Every
 * branch is a mapping from a gameplay fact to a sensory one, and the mapping is
 * the entire design of "game feel" — which is why it is one readable switch in
 * one file rather than a callback per system.
 *
 * `stageX/stageY` translate world coordinates into reference units, because the
 * events carry stage-space positions and the effects are drawn in the field.
 */
export function pumpEvents(stageX: number, stageY: number): void {
  drain((e: SimEvent) => handle(e, stageX, stageY));
}

/** Exposed for the harness and for anything that wants one event, not the queue. */
export function handleEvent(e: SimEvent, stageX = 0, stageY = 0): void {
  handle(e, stageX, stageY);
}

function handle(e: SimEvent, ox: number, oy: number): void {
  switch (e.type) {
    case 'RakhiTaken': {
      const x = ox + e.x;
      const y = oy + e.y;
      burst(x, y, { count: 14, color: COLORS.rakhiDiscHi, speed: 200, size: 4 });
      burst(x, y, { count: 6, color: COLORS.rakhiGem, speed: 120, size: 3 });
      // The chain is shown as a multiplier only from the second link on: a
      // permanent "x1" trains the player to ignore the number that matters.
      popup(x, y - 18, e.chain > 1 ? `+${e.chain}x` : '+', COLORS.scorePopBonus);
      shake(2);
      break;
    }

    case 'GateOpened': {
      // The unlock flashes in the COLLECTIBLE'S gold, not the brand's orange,
      // so cause and effect share a colour and nobody has to be told what just
      // happened. See COLORS.unlockFlash in src/brand/theme.ts.
      // No position on this event — the gate is a level-wide fact, so the beat
      // is a whole-screen one. RAKHI.unlockHoldSec holds the sim; the scene
      // paints COLORS.unlockFlash over the field. All this owes is the impact.
      hitStop(0.15);
      shake(6);
      break;
    }

    case 'BarrelJumped': {
      const x = ox + e.x;
      const y = oy + e.y;
      // No particles. A barrel jump happens two or three times a second at
      // pace, and a burst on each turns the stage into confetti at exactly the
      // moment the player most needs to see the next barrel.
      popup(x, y - 24, `${e.count}`, COLORS.scorePop, TEXT.label);
      break;
    }

    case 'BarrelSmashed': {
      const x = ox + e.x;
      const y = oy + e.y;
      burst(x, y, {
        count: 18,
        color: COLORS.barrelBody,
        speed: 260,
        size: 5,
        gravity: 700,
        square: true,
      });
      shake(5);
      hitStop(0.06);
      break;
    }

    case 'AgentHit': {
      const x = ox + e.x;
      const y = oy + e.y;
      burst(x, y, { count: 20, color: COLORS.deathFlash, speed: 220, size: 5, life: 0.7 });
      shake(12);
      hitStop(0.1);
      break;
    }

    case 'ShakerTaken': {
      const x = ox + e.x;
      const y = oy + e.y;
      burst(x, y, { count: 16, color: COLORS.unlockFlash, speed: 240, size: 4 });
      shake(4);
      break;
    }

    case 'PinPushed': {
      burst(ox + e.x, oy + e.y, { count: 8, color: COLORS.pinPushed, speed: 130, size: 3 });
      break;
    }

    case 'LevelCleared': {
      shake(4);
      break;
    }

    case 'AgentRespawn':
    case 'ShakerExpired':
    case 'TimeUp':
      // Deliberately silent here. Respawn and time-up are SCENE beats — a fade,
      // a wipe, a results screen — and firing a particle burst under a scene
      // transition is an effect nobody ever sees.
      break;
  }
}

// ─── Update and draw ────────────────────────────────────────────────────────

/**
 * Advance every effect. Takes REAL dt, not sim dt: effects keep running during
 * hit-stop, which is what makes the freeze read as impact rather than as a
 * stall. A frozen frame with frozen sparkles is indistinguishable from a hang.
 */
export function updateFx(dt: number, now: number): void {
  if (hitStopT > 0) hitStopT -= dt;

  particles.forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      particles.free(p);
      return;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  });

  popups.forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) popups.free(p);
  });

  if (vp) vp.updateShake(dt, now);
}

/**
 * Draw everything, in reference units, in ONE pass over each pool.
 *
 * Particles are grouped by nothing and sorted by nothing: they are small, they
 * are additive to the eye, and sorting sixty translucent squares would cost
 * more than drawing them.
 */
export function drawFx(ctx: CanvasRenderingContext2D): void {
  ctx.save();

  particles.forEach((p) => {
    const t = p.life / p.maxLife;
    ctx.globalAlpha = t < 0.35 ? t / 0.35 : 1;
    ctx.fillStyle = p.color;
    const s = p.size * (0.4 + t * 0.6);
    if (p.square === 1) {
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.globalAlpha = 1;
  ctx.textBaseline = 'middle';
  popups.forEach((p) => {
    const t = p.life / MOTION.popupRiseSec;
    const rise = reducedMotion ? 0 : (1 - t) * 54;
    // Fades only in the last third. A number that starts fading immediately is
    // a number that is never fully legible.
    ctx.globalAlpha = t < 0.33 ? t / 0.33 : 1;
    ctx.font = font(p.size, WEIGHT.display);
    const x = p.x + p.vx * (1 - t);
    const y = p.y - rise;
    // A one-unit halo in the inverse ink, so a score pop stays legible over the
    // girders it is most often drawn on. Cheaper and sharper than any shadow,
    // and it does not use the banned blur property.
    ctx.fillStyle = withAlpha(COLORS.textInverse, 0.55);
    trackedText(ctx, p.text, x + 1, y + 1, p.size * TRACK.display, 'center');
    ctx.fillStyle = p.color;
    trackedText(ctx, p.text, x, y, p.size * TRACK.display, 'center');
  });

  ctx.restore();
}

/**
 * Drop every live effect. On scene teardown and on a fresh run — a hit taken on
 * the last level must not flash over the first frame of the next.
 */
export function resetFx(): void {
  particles.clear();
  popups.clear();
  hitStopT = 0;
  if (vp) vp.cancelShake();
}

/** Debug readout for the harness. */
export function fxStats(): { particles: number; popups: number; frozen: boolean } {
  return {
    particles: particles.activeCount,
    popups: popups.activeCount,
    frozen: hitStopT > 0,
  };
}
