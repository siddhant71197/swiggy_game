/**
 * ══════════════════════════════════════════════════════════════════════════
 *  PLAY — the round. The sim, the controls, the HUD, and the ad rule.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): THE BANNER THAT COVERS THE PLAYFIELD ON
 * THE ONE TRANSITION NOBODY TESTED.
 *
 * `live` below is the ENTIRE ad-visibility rule for the whole game, and it is a
 * plain getter over the state enum precisely so that it cannot disagree with
 * itself. main.ts calls, once per frame, from outside every scene:
 *
 *   setAdVisible(!(scene instanceof PlayScene && scene.live));
 *
 * A scene that showed and hid the banner itself would need a call on every edge
 * into and out of every one of eight states — respawn, pause, time-up, death,
 * the unlock hold — and the one that gets missed is the one where the player
 * dies with the banner still hidden, or pauses with it still covering the
 * girders. Polling one boolean has no edges to miss.
 *
 * `unlocked` is still a running round with a thumb on the pad; the gate opening
 * changes the objective, not the input. `dying`, `respawn`, `timeup` and
 * `delivered` are all beats the player WATCHES — the sim is frozen or on rails,
 * nothing they do matters, and that is exactly when an impression is worth
 * something and costs nothing.
 *
 * THE FAILURE THIS FILE PREVENTS (2): THE SECOND COORDINATE CONVERSION. The sim
 * runs in a fixed 560×760 STAGE space and the renderer composes in 720×1280
 * REFERENCE units. Convert at each of the thirty draw sites and one of them is
 * off by the apron, forever, on tablets only. There is exactly one conversion in
 * this file — `ox`/`oy`, recomputed once per frame in `layout()` — and the world
 * layer is drawn inside a single `ctx.translate`. It is a TRANSLATION and never a
 * scale, because render/layout.ts guarantees stageRect is exactly STAGE.W×STAGE.H;
 * a scale here would silently make fx's event offsets wrong, since pumpEvents
 * takes an offset and not a matrix.
 *
 * THE FAILURE THIS FILE PREVENTS (3): ART BUILT AGAINST PHYSICS THAT THEN CHANGE.
 * EVERYTHING IN THE WORLD LAYER IS A FLAT RECTANGLE, A PARALLELOGRAM OR A DISC,
 * ON PURPOSE. The game has to be playable and tunable before anyone spends a day
 * on the delivery agent's backpack — otherwise the art is drawn against a jump
 * arc and a hitbox that are still moving, and it gets redrawn. Phase 3 replaces
 * these primitives behind the same call sites. Colours are already the real
 * brand tokens, so the flat build is correctly themed and only the SHAPES are
 * provisional.
 *
 * ─── URL OVERRIDES, SO A BUG REPORT IS A URL ───────────────────────────────
 *
 *   ?level=N   start on level N (clamped by game/level.ts, never a crash)
 *   ?seed=N    override the RNG seed; omit and the LEVEL NUMBER is the seed
 *
 * Read once at module load. `?level` only applies when main.ts did not pass a
 * level of its own, so the flow still owns navigation — the override seeds the
 * first round rather than pinning every round to one level.
 */

import { COLORS, FOOD_PALETTE, foodKind, withAlpha } from '../brand';
import { COPY, t } from '../config/copy';
import { font, MOTION, RADIUS, SPACE, TEXT, TRACK, WEIGHT } from '../config/theme';
import { AGENT, BARREL, EASE, RAKHI, STAGE, TIMER, UI } from '../config/tuning';
import type { DeliveredPayload } from './delivered';
import { clearEvents, drain, type SimEvent } from '../core/events';
import { clamp, lerp } from '../core/math';
import type { AgentState } from '../game/agent';
import { canGrabHere, type Intent } from '../game/agent';
import { summarise } from '../game/session';
import type { Ladder } from '../game/stage';
import { BELT_WARN_SEC, beltPhase, createWorld, step, type World } from '../game/world';
import type { Controls } from '../input/controls';
import { PAD } from '../input/dpad';
import type { PointerKind } from '../core/types';
import type { Viewport } from '../render/canvas';
import {
  attachFx,
  burst,
  drawFx,
  handleEvent,
  hitStop,
  popup,
  resetFx,
  shake,
  updateFx,
} from '../render/fx';
import {
  hudRect,
  inset,
  mastheadRect,
  padBandRect,
  rect,
  stageBandRect,
  stageRect,
  type Rect,
} from '../render/layout';
import { drawEmblem, drawMark, MARK_MIN_W, markHeight } from '../render/mark';
import { disc, fillRound, roundRect, strokeRound, trackedText } from '../render/shapes';
import { agentPose, drawAgentArt } from '../render/art/agent';
import { barrelPhase, drawBarrelArt } from '../render/art/barrel';
import { drawCustomerArt } from '../render/art/customer';
import { drawMonkeyArt, monkeyPose } from '../render/art/monkey';
import {
  drawBeltChevrons,
  drawBeltFlipWarn,
  drawShutterArt,
  drawShutterOpenArt,
} from '../render/art/props';
import {
  drawDropperHeadArt,
  drawDropperLaneArt,
  drawFlameArt,
  drawLiftCarArt,
  drawLiftShaftArt,
  drawPinArt,
  drawScooterArt,
  drawShakerArt,
  drawShakerHeldArt,
  drawTiffinArt,
  flamePhase,
} from '../render/art/hazards';
import { drawRakhiArt, rakhiShine } from '../render/art/rakhi';
import { drawFoodArt, drawFoodIconArt, foodBob } from '../render/art/food';
import {
  drawHelmetArt,
  drawHelmetWornArt,
  drawTurboArt,
  drawTurboTrailArt,
} from '../render/art/powerups';
import { registerWarm, rewarm, setBakeContext, unregisterWarm } from '../render/prerender';
import { drawStageBackdrop, drawStageLayer, stageLayer } from '../render/stageView';
import {
  BUTTON_H,
  BUTTON_H_SM,
  button,
  card,
  hitTest,
  iconLock,
  iconOrderBag,
  iconPip,
  label,
  scrim,
} from '../render/ui';
import { HAPTIC, haptic } from '../ui/haptics';
import type { Sfx } from '../ui/sfx';
import type { GameScene, SceneId } from './director';

/**
 * Every state a round can be in. THE REAL UNION — nothing may be added to it
 * without deciding what it means for `live`.
 */
export type PlayState =
  | 'ready'
  | 'playing'
  | 'unlocked'
  | 'dying'
  | 'respawn'
  | 'delivered'
  | 'timeup'
  | 'paused';

export interface PlayCallbacks {
  /** The round ended with lives left and the level cleared. */
  /**
   * The FULL receipt, not just a total.
   *
   * An earlier version passed `(level, score)` and the results screen rendered
   * "rakhis 0/0, barrels jumped 0, on time 0s" beside a correct total — every
   * line the player earned reading as zero. A payload that carries only what
   * the caller happened to have is a payload that silently loses the rest.
   */
  onDelivered(summary: DeliveredPayload): void;
  /** Out of tries, or out of time with no tries left. */
  onGameOver(level: number, score: number): void;
  /** The player asked to leave — the pause sheet's HOME. */
  onQuit(): void;
}

// ─── Beat lengths ───────────────────────────────────────────────────────────
//
// Local rather than in config/tuning.ts because these are PRESENTATION holds
// owned by this scene — how long a word stays on screen — while tuning.ts holds
// numbers the sim reads. The two that the sim DOES own (the death freeze, the
// unlock hold) are imported from AGENT and RAKHI below and are not restated here.

/** "GO!" before control is handed over. Long enough to read, short enough not to wait. */
const READY_HOLD_SEC = 0.9;
/** The end-of-round beat before the results screen wipes in. */
const END_HOLD_SEC = 1.6;

// ─── World-layer geometry, in STAGE units ───────────────────────────────────

/**
 * The shutter box over the gated ladder's mouth.
 *
 * 88 RATHER THAN 76, AND THE TWELVE UNITS ARE THE SECOND COUNT'S. The gate now
 * needs the collectibles AND the dishes, so the sign has two glyphs and two
 * numerals on one line (see `drawShutterCounts`); at 76 the group only fitted by
 * dropping the digits to TEXT.micro, and the digits are the message. Widening the
 * SIGN costs nothing — it is presentation over a ladder mouth, it carries no
 * collision, and the box is still narrower than the girder it hangs under.
 */
const SHUTTER_W = 88;
const SHUTTER_H = 62;

/**
 * Chevron scroll speed on a conveyor floor, in pattern-periods per SIM second.
 *
 * Sim seconds, not wall seconds — see the note at `drawBeltChevrons`. A belt
 * that keeps scrolling through the death freeze and the unlock hit-stop
 * undermines the two moments in a level that exist because time stopped.
 */
const BELT_SCROLL = 1.4;

/** The customer's hop on delivery: amplitude in stage units, and its rate. */
const HOP_AMP = 6;
const HOP_RATE = 7;

/** Below this the agent is standing, not running. */
const RUN_EPS = 6;

// ─── The order counter, in the HUD's left third ─────────────────────────────
//
// THE BAND DID NOT GROW. BANDS.hud is 112 units and BANDS must keep summing to
// REF.H (assertion at src/render/layout.ts:86) — a fourth HUD row could only be
// paid for out of BANDS.stage, which rescales the playfield. What pays for the
// second counter instead is that a level's collectibles are now 1–3 rather than
// 3–6: at PIP_R = 11 on a 30-unit pitch the pip strip needs 30–90 units of a
// 224-unit column instead of 90–180, and the dishes go in the space that freed.
//
// It is a GLYPH AND A NUMERAL rather than a second pip strip on purpose. Two
// strips of near-identical dots in one eyeline is the fastest way to make the
// one number the gate depends on unreadable — see the header of art/food.ts on
// why the dishes are not allowed to impersonate the collectible anywhere.

/** Collected-pip radius. The strip's pitch is PIP_R * 2 + SPACE.sm. */
const PIP_R = 11;
/** The takeaway bag beside the pips. Inside food.ts's stated 16–20 HUD range. */
const FOOD_ICON = 18;
/** Gap between the pip strip and the dish readout. */
const COUNTER_GAP = SPACE.md;
/**
 * The punch's peak scale — the same 0.55 growth the pips get, named because the
 * HUD glyph has to BAKE at the peak and be scaled DOWN to rest.
 *
 * prerender's cache key is the DEVICE SIZE, so a glyph whose size is driven by a
 * continuous timer bakes a new canvas every frame it animates. Baking once at
 * the top of the punch and shrinking with a transform is one canvas, and it is
 * the crisper of the two at every scale. `drawHelmetWornArt` does the same thing
 * for the same reason.
 */
const PUNCH_MAX = 1.55;

// ─── URL overrides ──────────────────────────────────────────────────────────

function urlInt(key: string): number | null {
  if (typeof location === 'undefined') return null;
  const raw = new URLSearchParams(location.search).get(key);
  if (raw === null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

const URL_LEVEL = urlInt('level');
const URL_SEED = urlInt('seed');

// ─── Pause sheet regions ────────────────────────────────────────────────────

const R_RESUME = 0;
const R_RESTART = 1;
const R_HOME = 2;

export class PlayScene implements GameScene {
  readonly id: SceneId = 'play';

  /** Current round state. Public because the HUD and main.ts both read it. */
  state: PlayState = 'ready';

  level = 1;
  score = 0;

  private world: World | null = null;
  /** The one gated rail, resolved once per level rather than searched per frame. */
  private gate: Ladder | null = null;

  /** Seconds in the CURRENT state. Every beat below is a comparison against this. */
  private stateT = 0;
  /** 0 = shutter down, 1 = fully rolled. Animated over MOTION.shutterRollSec. */
  private shutterT = 0;
  /**
   * Per-tracked-item punch timer for the HUD, seconds remaining.
   *
   * One slot per collectible, plus ONE more at `foodSlot` for the whole order —
   * the dishes share a single glyph in the HUD (see FOOD_ICON), so they share a
   * single punch. Reusing this array rather than adding a second field is what
   * keeps the decay loop in update() the only place that ages a punch.
   */
  private punch: number[] = [];
  /** Index into `punch` for the dish glyph. Set in enter(); see `punch`. */
  private foodSlot = 0;
  /** Previous frame's agent state, so jump/land cues are edges rather than polls. */
  private prevAgent: AgentState = 'run';
  /** Latched so the urgency cue fires once per level, not once per frame under 10s. */
  private warned = false;
  /** Barrels cleared this level, for the receipt. Reset in enter(). */
  private barrelsJumped = 0;

  private stage: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private band: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private hud: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private head: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private pauseBtn: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** Stage origin in reference units. THE ONLY stage→screen conversion. */
  private ox = 0;
  private oy = 0;
  /**
   * DEVICE PIXELS PER STAGE UNIT, recomputed in layout().
   *
   * Every baked drawing is sized against this. Baking at reference size and
   * letting the root transform magnify it is the soft-art bug prerender.ts
   * exists to avoid, and it is invisible on a 1x desktop display — which is the
   * only display this gets developed on.
   *
   * Stage units and reference units are 1:1 (the world layer is translated, never
   * scaled), so this is simply `refToDevice(1)`.
   */
  private px = 1;

  /**
   * Seconds since the thrower last released. Presentation only.
   *
   * Derived by watching the sim's own spawn countdown RESET — a timer that jumps
   * up is a timer that just fired. The alternative is a `BarrelThrown` event,
   * which would put an animation cue in the sim's event contract for the benefit
   * of exactly one drawing.
   */
  private throwAge = 99;
  private prevSpawnMin = 0;

  private readonly sheet: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];
  private pressed = -1;
  private pausePressed = false;

  /**
   * Preallocated and overwritten every step. A fresh intent object per fixed step
   * is sixty allocations a second on the hottest path in the game — the same
   * reason Controls.intent() hands back one struct forever.
   */
  private readonly intent: Intent = { dir: 0, up: false, down: false, jump: false };

  constructor(
    private readonly vp: Viewport,
    private readonly controls: Controls,
    private readonly sfx: Sfx,
    private readonly cb: PlayCallbacks,
  ) {
    // ONE HOOK, BOTH TRIGGERS. A quality drop calls resize() to reallocate the
    // backing store, so this listener covers the rotate/resize case AND the
    // frame-budget case — and there is no second place to forget to wire.
    //
    // `setBakeContext` first, `rewarm` second: the warmers bake, and a bake made
    // before the context is updated is a bake filed under the OLD dpr key, which
    // is both wasted work and a cache miss on the very next frame.
    vp.onResize((v) => {
      setBakeContext(v.dpr, v.qualityScale);
      rewarm();
    });
  }

  /**
   * TRUE ONLY WHILE THE PLAYER IS ACTUALLY PLAYING.
   *
   * The whole ad-visibility policy, in one expression, read from outside. See
   * the file header.
   */
  get live(): boolean {
    return this.state === 'playing' || this.state === 'unlocked';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  enter(payload?: unknown): void {
    const p = payload as { level?: number } | undefined;
    this.level = Math.max(1, p?.level ?? URL_LEVEL ?? 1);

    // Both queues are dropped BEFORE the world exists: a hit taken on the last
    // level must not flash over the first frame of this one.
    clearEvents();
    resetFx();
    attachFx(this.vp);

    const w = createWorld(this.level, URL_SEED === null ? undefined : { seed: URL_SEED });
    this.world = w;
    this.gate = w.stage.ladders.find((l) => l.gated) ?? null;

    this.score = w.session.score;
    this.foodSlot = w.session.rakhiTotal;
    this.punch = new Array<number>(w.session.rakhiTotal + 1).fill(0);
    this.prevAgent = w.agent.state;
    this.warned = false;
    this.barrelsJumped = 0;
    this.throwAge = 99;
    this.prevSpawnMin = Number.POSITIVE_INFINITY;
    this.shutterT = w.session.gateOpen ? 1 : 0;
    this.pressed = -1;
    this.pausePressed = false;

    // Vertical is dead until the sim says otherwise, and the pad is cleared so a
    // round never begins with the agent already walking into the first barrel.
    this.controls.reset();
    this.controls.setVerticalLive(false);

    this.go('ready');
    this.layout();

    // THE LEVEL BAKE, PAID BEFORE THE FIRST FRAME.
    //
    // Registered rather than merely called, so a rotate or a quality drop
    // mid-level rebuilds the stage layer during the resize instead of during the
    // frame that first needs it — which would be a hitch on the one device that
    // has already proven it has no headroom.
    setBakeContext(this.vp.dpr, this.vp.qualityScale);
    registerWarm('play:stage', () => {
      const live = this.world;
      if (live) stageLayer(this.vp, live.stage, this.level);
    });
    stageLayer(this.vp, w.stage, this.level);
  }

  exit(): void {
    this.state = 'ready';
    this.world = null;
    this.gate = null;
    // The warmer closes over `this.world`; leaving it registered would make
    // every future resize re-run a bake for a level nobody is playing.
    unregisterWarm('play:stage');
    clearEvents();
    resetFx();
    this.controls.reset();
  }

  /** Called by main.ts's pause handling. Kept here so the state enum has one owner. */
  pause(): void {
    if (!this.live) return;
    this.state = 'paused';
    this.stateT = 0;
    this.pressed = -1;
    // A held pad survives a pause otherwise, and the agent resumes mid-stride
    // into whatever the player paused to get away from.
    this.controls.reset();
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.go('playing');
  }

  private go(next: PlayState): void {
    this.state = next;
    this.stateT = 0;
  }

  /**
   * Watch the spawn countdown for a RESET — the only observable a throw leaves.
   *
   * The countdown runs down to zero and is then re-armed to the next interval,
   * so any frame where it JUMPS UP is a frame in which a barrel was released.
   * That inference is exact, it costs one comparison, and it keeps the animation
   * cue out of the sim's event contract entirely.
   */
  private trackThrow(w: World, dt: number): void {
    this.throwAge += dt;
    let min = Number.POSITIVE_INFINITY;
    for (const t of w.spawnTimers) if (t < min) min = t;
    if (Number.isFinite(min) && min > this.prevSpawnMin + dt) this.throwAge = 0;
    this.prevSpawnMin = min;
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  private layout(): void {
    this.head = mastheadRect(this.vp);
    this.hud = hudRect(this.vp);
    this.band = stageBandRect(this.vp);
    this.stage = stageRect(this.vp);
    this.ox = this.stage.x;
    this.oy = this.stage.y;
    this.px = this.vp.refToDevice(1);

    const s = SPACE.md;
    const btn = this.head.h - s * 2;
    this.pauseBtn = { x: this.head.w - s - btn, y: this.head.y + s, w: btn, h: btn };

    const panelW = Math.min(440, this.vp.fieldW - SPACE.xl * 2);
    const panelX = Math.round((this.vp.fieldW - panelW) / 2);
    let y = this.band.y + this.band.h / 2 - BUTTON_H;
    place(this.sheet[R_RESUME]!, panelX, y, panelW, BUTTON_H);
    y += BUTTON_H + SPACE.md;
    place(this.sheet[R_RESTART]!, panelX, y, panelW, BUTTON_H_SM);
    y += BUTTON_H_SM + SPACE.sm;
    place(this.sheet[R_HOME]!, panelX, y, panelW, BUTTON_H_SM);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt: number, simTime: number): void {
    this.layout();
    // REAL dt, always, and outside every state branch: effects keep running
    // through the death freeze and the unlock hold, which is what makes a freeze
    // read as impact rather than as a hang.
    updateFx(dt, simTime);

    const w = this.world;
    if (!w) return;

    this.stateT += dt;
    for (let i = 0; i < this.punch.length; i++) {
      if (this.punch[i]! > 0) this.punch[i] = Math.max(0, this.punch[i]! - dt);
    }
    this.trackThrow(w, dt);

    switch (this.state) {
      case 'ready':
        if (this.stateT >= READY_HOLD_SEC) this.go('playing');
        break;

      case 'playing':
      case 'unlocked':
        this.stepLive(w, dt);
        break;

      case 'dying':
      case 'respawn':
        // The world is still stepped, with a NEUTRAL intent. The death freeze,
        // the respawn and the thrower's pause are all sim-side timers; running
        // them from a scene-side clock would give the presentation and the sim
        // two opinions about when the player gets their agent back.
        this.stepDead(w, dt);
        break;

      case 'timeup':
        if (this.stateT >= END_HOLD_SEC) this.finish(false);
        break;

      case 'delivered':
        if (this.stateT >= END_HOLD_SEC) this.finish(true);
        break;

      case 'paused':
        break;
    }

    if (w.session.gateOpen && this.shutterT < 1) {
      this.shutterT = Math.min(1, this.shutterT + dt / MOTION.shutterRollSec);
    }
    this.score = w.session.score;
  }

  /** One fixed step with the player's own input. */
  private stepLive(w: World, dt: number): void {
    // UP and DOWN are inert off a ladder — see the d-pad's failure (2). The test
    // includes "already climbing" as well as "could grab", because findGrab is a
    // proximity query and a rail can be left behind mid-climb on a broken ladder.
    this.controls.setVerticalLive(
      w.agent.state === 'climb' || canGrabHere(w.stage, w.agent, w.session.gateOpen),
    );

    const raw = this.controls.intent();
    const i = this.intent;
    i.dir = raw.dir;
    i.up = raw.up;
    i.down = raw.down;
    // The EDGE, spent here. agent.ts re-derives an edge from this flag, which is
    // harmless — a consumed press is true for exactly one step, so the two agree.
    i.jump = this.controls.consumeJump();

    this.advance(w, i, dt);
  }

  /** One fixed step with no input at all. Death, respawn — the beats on rails. */
  private stepDead(w: World, dt: number): void {
    this.controls.setVerticalLive(false);
    const i = this.intent;
    i.dir = 0;
    i.up = false;
    i.down = false;
    i.jump = false;
    this.advance(w, i, dt);
  }

  /**
   * Step the sim, drain what it said, then read the state machine off the world.
   *
   * NOTE that fx.frozen() is deliberately NOT consulted to skip the step. The
   * sim owns its own freezes (`world.hold` for the unlock, `agent.freeze` for
   * death) and skipping steps from the render side would stop those timers from
   * counting down — the round would hang for exactly as long as the hit-stop it
   * was supposed to punctuate.
   */
  private advance(w: World, i: Intent, dt: number): void {
    const gateWas = w.session.gateOpen;
    step(w, i, dt);

    drain((e: SimEvent) => {
      handleEvent(e, this.ox, this.oy);
      // Counted here rather than in the session: the sim has no reason to carry
      // a stat only the results screen reads, and the event already says it.
      if (e.type === 'BarrelJumped') this.barrelsJumped++;
      this.react(e);
    });

    // The urgency cue, latched. TIMER.urgentSec is also where the tower starts
    // leaning on the player — the reddening clock is the only announcement the
    // difficulty change ever gets, so the sound is the same moment or nothing.
    if (!this.warned && w.session.timeLeft <= TIMER.urgentSec && !w.done) {
      this.warned = true;
      this.sfx.play('timeWarn');
      haptic(HAPTIC.warn);
    }

    this.readAgentCues(w);

    // ── The state machine, read from the world rather than pushed into it ────
    if (w.session.cleared) {
      this.go('delivered');
      return;
    }
    if (w.agent.state === 'hit') {
      if (this.state !== 'dying') this.go('dying');
      // Out of lives: world.done is set once the freeze expires, and the run
      // ends on the beat rather than on the frame of the collision.
      if (w.done) this.go('timeup');
      return;
    }
    if (w.done) {
      this.go('timeup');
      return;
    }
    if (this.state === 'dying' || this.state === 'respawn') {
      if (this.stateT >= AGENT.respawnFadeSec) this.go('playing');
      return;
    }
    if (!gateWas && w.session.gateOpen) {
      this.go('unlocked');
      return;
    }
    // The unlock beat is exactly as long as the sim is held for, so control
    // returns on the frame the world starts moving again and not before.
    if (this.state === 'unlocked' && this.stateT >= RAKHI.unlockHoldSec + RAKHI.unlockHitStopSec) {
      this.go('playing');
    }
  }

  /** Sound and haptics for things the sim does not emit an event for. */
  private readAgentCues(w: World): void {
    const now = w.agent.state;
    const was = this.prevAgent;
    this.prevAgent = now;
    if (was === now) return;
    if (now === 'air' && w.agent.body.vy < 0) {
      this.sfx.play('jump');
      haptic(HAPTIC.jump);
    } else if (was === 'air' && now === 'run') {
      this.sfx.play('land');
      haptic(HAPTIC.land);
    }
  }

  /**
   * The device half of a sim event. fx has already turned it into sparkles;
   * this is the part that touches the speaker and the motor, which the sim is
   * not allowed to do — see core/events.ts failure (3).
   */
  private react(e: SimEvent): void {
    switch (e.type) {
      case 'RakhiTaken':
        this.sfx.play('rakhi');
        haptic(HAPTIC.pickup);
        if (e.index < this.punch.length) this.punch[e.index] = MOTION.pipPunchSec;
        break;
      // THE SAME BEAT AS A COLLECTIBLE, DELIBERATELY.
      //
      // One order, one chain (see the note on FoodTaken in core/events.ts), so a
      // dish must not feel like a lesser pickup than a rakhi — the gate weighs
      // them equally and a quieter cue would teach the player it does not. The
      // burst is in the DISH'S own body colour, which is the one thing here that
      // is not shared with the rakhi: it is how the eye confirms what was taken.
      case 'FoodTaken': {
        this.sfx.play('rakhi');
        haptic(HAPTIC.pickup);
        this.punch[this.foodSlot] = MOTION.pipPunchSec;
        const dish = FOOD_PALETTE[foodKind(e.kind)];
        const x = this.ox + e.x;
        const y = this.oy + e.y;
        if (dish) burst(x, y, { count: 14, color: dish.body, speed: 200, size: 4 });
        popup(x, y - 18, e.chain > 1 ? `+${e.chain}x` : '+', COLORS.scorePopBonus);
        shake(2);
        break;
      }

      // Both powerups get the pickup cue and a burst in their OWN meaning's
      // colour — guard for the helmet, go for the turbo — rather than the
      // collectible's gold. A powerup that flashes gold reads as progress toward
      // the gate, which is the one thing it is not.
      case 'HelmetTaken':
        this.sfx.play('rakhi');
        haptic(HAPTIC.pickup);
        burst(this.ox + e.x, this.oy + e.y, {
          count: 14,
          color: COLORS.powerupGuard,
          speed: 220,
          size: 4,
        });
        shake(3);
        break;

      case 'TurboTaken':
        this.sfx.play('rakhi');
        haptic(HAPTIC.pickup);
        burst(this.ox + e.x, this.oy + e.y, {
          count: 16,
          color: COLORS.powerupGo,
          speed: 260,
          size: 4,
        });
        shake(4);
        break;

      // ── A LIFE SAVED, AND IT MUST NOT READ AS A LIFE LOST ──────────────────
      //
      // This fires on the frame a hit would otherwise have killed the player, so
      // it lands in the same instant they expect the death flash — and if it is
      // quieter than `AgentHit` they will believe they died and lost the helmet
      // both. So it is the loudest positive cue in the round: the smash, the
      // clear haptic, a hit-stop, and a word. The shake is under AgentHit's 12,
      // because the screen must still say "that went well".
      case 'HelmetBroke':
        this.sfx.play('smash');
        haptic(HAPTIC.clear);
        hitStop(0.1);
        shake(8);
        burst(this.ox + e.x, this.oy + e.y, {
          count: 20,
          color: COLORS.powerupGuard,
          speed: 260,
          size: 5,
        });
        popup(this.ox + e.x, this.oy + e.y - 26, COPY.toastHelmetSave, COLORS.powerupGuard);
        break;

      case 'GateOpened':
        this.sfx.play('unlock');
        haptic(HAPTIC.unlock);
        break;
      case 'BarrelSmashed':
        this.sfx.play('smash');
        break;
      case 'AgentHit':
        this.sfx.play('hit');
        haptic(HAPTIC.hit);
        break;
      case 'LevelCleared':
        this.sfx.play('levelClear');
        haptic(HAPTIC.clear);
        break;
      case 'AgentRespawn':
        this.go('respawn');
        break;
      default:
        break;
    }
  }

  /** The one exit. Both callbacks get their numbers from `summarise`, never from
   *  a field that could have been updated at a different time. */
  private finish(delivered: boolean): void {
    const w = this.world;
    if (!w) return;
    const s = summarise(w.session);
    if (!delivered) {
      this.cb.onGameOver(s.level, s.score);
      return;
    }
    this.cb.onDelivered({
      level: s.level,
      score: s.score,
      rakhis: s.rakhis,
      rakhisTotal: s.rakhiTotal,
      // The dishes come off the SAME summary as the collectibles, not off a
      // scene-side tally: the receipt's headline row adds the two together, and
      // two numbers added from two different sources is how a receipt ends up
      // claiming 5/6 of an order the player actually completed.
      food: s.foods,
      foodTotal: s.foodTotal,
      barrelsJumped: this.barrelsJumped,
      timeLeft: Math.floor(s.timeLeft),
      // Perfect is zero deaths on this level, which is also what the streak
      // multiplier keys off — one definition, read in both places.
      perfect: s.deaths === 0,
      // The rescue is silent while it is happening, but the receipt has to know:
      // it is what swaps the punchline for one that does not scold.
      rescued: s.deaths >= EASE.deathsPerStep,
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D, alpha: number, simTime: number): void {
    this.layout();
    const w = this.world;

    this.drawBackdrop(ctx);
    if (w) {
      ctx.save();
      // THE conversion. Everything between here and restore() is in STAGE units.
      ctx.translate(this.ox, this.oy);
      this.drawWorld(ctx, w, alpha, simTime);
      ctx.restore();
    }

    // Effects are in reference units — the events carried stage coordinates and
    // fx was handed the offset when they were drained.
    drawFx(ctx);

    this.drawMasthead(ctx);
    if (w) this.drawHud(ctx, w);
    this.drawControls(ctx);
    if (w) this.drawOverlays(ctx, w);
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D): void {
    drawStageBackdrop(ctx, this.vp, this.band);
  }

  // ── The world ─────────────────────────────────────────────────────────────
  //
  // Everything static — girders, ladders, the doorway — arrives as ONE blit off
  // the level bake. What is left in this method is exactly what moves.

  private drawWorld(
    ctx: CanvasRenderingContext2D,
    w: World,
    alpha: number,
    simTime: number,
  ): void {
    // FLOOR MARKING FIRST, under the whole tower: the dropper lanes are paint on
    // the world, not objects in it, so anything drawn over them is standing IN
    // the lane — which is exactly the reading the telegraph wants.
    this.drawDropperLanes(ctx, w, simTime);

    drawStageLayer(ctx, this.vp, w.stage, this.level);

    // Belts are the one part of the structure that cannot be baked. Driven by
    // SIM time, so a paused or frozen world has stationary belts.
    const bp = beltPhase(w);
    // ZERO IS THE TELEGRAPH, not "stopped" — see beltPhase's own note. The
    // blink is derived from the sim's elapsed seconds against the warning's own
    // length, so it cannot run at a different rate than the warning it belongs to.
    const flipOn = bp === 0 && Math.floor((w.elapsed / BELT_WARN_SEC) * 8) % 2 === 0;
    for (const g of w.stage.girders) {
      if (g.belt === 0) continue;
      drawBeltChevrons(ctx, g, simTime * BELT_SCROLL);
      // The incoming direction is the current one negated — the flip is a sign
      // change on the authored belt, so this is the same statement the sim makes.
      if (bp === 0) drawBeltFlipWarn(ctx, g, -g.belt, flipOn);
    }

    this.drawLifts(ctx, w);
    this.drawCustomer(ctx, w);
    this.drawThrower(ctx, w);
    this.drawRakhis(ctx, w, simTime);
    this.drawFoods(ctx, w, simTime);
    this.drawPickups(ctx, w, simTime);
    this.drawHazards(ctx, w, alpha, simTime);
    this.drawBarrels(ctx, w, alpha);
    this.drawAgent(ctx, w, alpha, simTime);
    this.drawShutter(ctx, w);
    // The hoppers LAST of the world layer, so a lane's source is never hidden
    // behind the floor it is bolted to.
    this.drawDropperHeads(ctx, w);
  }

  /**
   * The painted lanes. Always on, brighter while `warn`.
   *
   * `d.warn` is the SIM's own flag — it goes true exactly `HAZARD.tiffinWarnSec`
   * before the release and is cleared on the step the tiffin leaves — so the
   * flash and the drop cannot disagree. Nothing here re-derives the window from
   * a timer of its own, which is the only way a telegraph stays honest.
   */
  private drawDropperLanes(ctx: CanvasRenderingContext2D, w: World, simTime: number): void {
    for (const d of w.hazards.droppers) {
      // A blink, not a fade: a lane that brightens smoothly is a lane the eye
      // never catches starting.
      const blink = Math.floor(simTime * 8) % 2 === 0 ? 1 : 0.45;
      drawDropperLaneArt(ctx, d.x, d.y, STAGE.H, d.warn ? blink : 0);
    }
  }

  private drawDropperHeads(ctx: CanvasRenderingContext2D, w: World): void {
    for (const d of w.hazards.droppers) {
      drawDropperHeadArt(ctx, d.x, d.y, this.px, d.warn);
    }
  }

  /**
   * The cars, at the sim's own surface height.
   *
   * NOT drawn from `stage.girders[liftBase + i]`, and not baked into the stage
   * layer either — see the note in render/stageView.ts. The car IS that girder,
   * so drawing both would put two of every lift on screen, one of them stuck at
   * the bottom of its shaft.
   */
  private drawLifts(ctx: CanvasRenderingContext2D, w: World): void {
    for (const car of w.hazards.lifts) {
      const d = car.def;
      drawLiftShaftArt(ctx, d.x, d.yTop, d.yBottom, d.w);
      drawLiftCarArt(ctx, d.x, car.y, d.w, d.yTop, this.px);
    }
  }

  /** The shakers and the order pins. Both are pickups, drawn at their centres. */
  private drawPickups(ctx: CanvasRenderingContext2D, w: World, simTime: number): void {
    for (const p of w.hazards.pins) {
      drawPinArt(ctx, p.x, p.y, this.px, p.taken);
    }
    for (const s of w.hazards.shakers) {
      if (s.taken) continue;
      // The halo breathes on the rakhi's own rhythm, because it is making the
      // same offer and the player has already learnt what that pulse means.
      const pulse = (Math.sin(simTime * 3.4) + 1) * 0.5;
      drawShakerArt(ctx, s.x, s.y, this.px, pulse);
    }
    // The two guards. NO PULSE ON EITHER, and that is the distinction being
    // drawn: the halo is the shaker's offer of a rule change for a few seconds,
    // and a helmet sitting still reads as equipment rather than as a timer the
    // player is already late for.
    for (const hm of w.hazards.helmets) {
      if (hm.taken) continue;
      drawHelmetArt(ctx, hm.x, hm.y, this.px);
    }
    for (const tb of w.hazards.turbos) {
      if (tb.taken) continue;
      drawTurboArt(ctx, tb.x, tb.y, this.px);
    }
  }

  /** Flames, tiffins and scooters — everything that moves and is not a barrel. */
  private drawHazards(
    ctx: CanvasRenderingContext2D,
    w: World,
    alpha: number,
    simTime: number,
  ): void {
    const h = w.hazards;

    for (const f of h.flames) {
      if (!f.live) continue;
      const b = f.body;
      const x = lerp(b.px, b.x, alpha);
      const y = lerp(b.py, b.y, alpha);
      // A climbing flame faces the rail rather than its patrol direction, so it
      // does not appear to walk sideways up a ladder.
      const face = f.mode === 'climb' ? 1 : f.dir;
      drawFlameArt(ctx, x, y, this.px, flamePhase(b.x, simTime), face);
    }

    h.tiffins.forEach((t) => {
      if (!t.live) return;
      const b = t.body;
      drawTiffinArt(ctx, lerp(b.px, b.x, alpha), lerp(b.py, b.y, alpha), this.px);
    });

    h.scooters.forEach((s) => {
      if (!s.live) return;
      const b = s.body;
      drawScooterArt(ctx, lerp(b.px, b.x, alpha), lerp(b.py, b.y, alpha), this.px, Math.sign(b.vx) || 1);
    });
  }

  /** The goal. She hops on delivery, and the hop is a transform, never a bake. */
  private drawCustomer(ctx: CanvasRenderingContext2D, w: World): void {
    const door = w.params.def.customerAt;
    const done = this.state === 'delivered';
    // abs(sin) rather than sin: a hop leaves the ground and comes back, it does
    // not sink into it.
    const hop = done ? Math.abs(Math.sin(this.stateT * HOP_RATE)) * HOP_AMP : 0;
    drawCustomerArt(ctx, door.x, door.y - hop, this.px, done ? 'happy' : 'wait');
  }

  /**
   * The monkey, posed off the SPAWNER's own countdown.
   *
   * `throwAge` is scene-side presentation state, not sim state: the sim has no
   * reason to know that a throw has a visible follow-through, and putting it
   * there would make the headless bot carry an animation timer.
   */
  private drawThrower(ctx: CanvasRenderingContext2D, w: World): void {
    // `world.monkey`, NOT `def.monkeyAt`. On level 10 the thrower shifts between
    // three slots (game/monkey.ts) and the row's `monkeyAt` is only where he
    // started — drawn from the row he would throw from one place and stand in
    // another, which is the single most confusing thing a spawner can do.
    const m = w.monkey;
    // The soonest of the spawners is the one worth telegraphing — a second
    // spawner further out must not cancel the wind-up of the imminent one.
    let soonest = Number.POSITIVE_INFINITY;
    for (const t of w.spawnTimers) if (t < soonest) soonest = t;
    if (w.throwPause > 0) soonest = Number.POSITIVE_INFINITY;

    // THE RAISED BARREL. `windup[i] > 0` is the sim's own 0.45s telegraph, and
    // drawing the barrel he is about to throw makes the wind-up pose say what it
    // is winding up.
    //
    // Read as a plain "is any spawner winding up", never scaled by the timer's
    // value: the wind-up length lives in game/monkey.ts and restating it here to
    // drive a rise would be a second copy of a number the sim owns.
    let winding = false;
    for (const t of w.monkey.windup) if (t > 0) winding = true;
    if (winding) drawBarrelArt(ctx, m.x, m.y - 52, this.px, barrelPhase(m.x), false);

    drawMonkeyArt(ctx, m.x, m.y, this.px, monkeyPose(soonest, this.throwAge));
  }

  private drawRakhis(ctx: CanvasRenderingContext2D, w: World, simTime: number): void {
    const pts = w.params.def.rakhis;
    for (let i = 0; i < pts.length; i++) {
      if (w.session.rakhiTaken[i]) continue;
      const p = pts[i]!;
      // The bob is phase-offset per index so a row of three reads as three
      // objects rather than as one object drawn three times.
      const bob = Math.sin((simTime / RAKHI.bobSec + i * 0.37) * Math.PI * 2) * RAKHI.bobAmp;
      drawRakhiArt(ctx, p.x, p.y + bob, this.px, rakhiShine(simTime, i));
    }
  }

  /**
   * The dishes. Same loop, same bob and the same tuning numbers as the rakhis.
   *
   * `foodBob` returns a -1…+1 PHASE rather than an offset, so the amplitude here
   * is RAKHI.bobAmp — the collectible's own. Two collectibles on one girder
   * hovering at two different heights would read as two different kinds of
   * object, one of which is broken; they are one order, so they breathe together.
   */
  private drawFoods(ctx: CanvasRenderingContext2D, w: World, simTime: number): void {
    const pts = w.params.def.foods;
    for (let i = 0; i < pts.length; i++) {
      if (w.session.foodTaken[i]) continue;
      const p = pts[i]!;
      drawFoodArt(ctx, p.x, p.y + foodBob(simTime, i) * RAKHI.bobAmp, this.px, p.kind);
    }
  }

  private drawBarrels(ctx: CanvasRenderingContext2D, w: World, alpha: number): void {
    w.barrels.pool.forEach((b) => {
      if (!b.live) return;
      const body = b.body;
      // Drawn at the interpolated position, so a 60Hz sim presents smoothly on a
      // 120Hz panel. The HITBOX is at body.x — this is presentation only.
      const x = lerp(body.px, body.x, alpha);
      const y = lerp(body.py, body.y, alpha) - BARREL.r;
      // The ROLL PHASE reads the sim's x, not the lerped one: one phase is ~6
      // units of travel, so the difference is invisible, and reading the lerp
      // would make the barrel judder between two drawings while standing still.
      drawBarrelArt(ctx, x, y, this.px, barrelPhase(body.x), b.kind === 'wild');
    });
  }

  private drawAgent(
    ctx: CanvasRenderingContext2D,
    w: World,
    alpha: number,
    simTime: number,
  ): void {
    const a = w.agent;
    const body = a.body;
    const x = lerp(body.px, body.x, alpha);
    const y = lerp(body.py, body.y, alpha);

    ctx.save();
    // Invulnerability BLINKS rather than dims: a permanently translucent agent
    // reads as a rendering bug, and the player needs to know the state is
    // temporary. 12Hz is fast enough to be obviously deliberate.
    if (a.invuln > 0 && Math.floor(simTime * 12) % 2 === 0) ctx.globalAlpha = 0.35;

    const h = w.hazards;

    // ── THE BOOST TRAIL, UNDER THE AGENT AND BEHIND HIM ────────────────────
    //
    // Drawn BEFORE the body, so the bag — recognition cue #1 of the whole
    // character (see art/agent.ts) — paints over the streaks rather than being
    // striped by them. Offset against `face`, because a trail on the leading
    // side is not a trail, it is a thing he is about to run into.
    //
    // It blinks over the last HAZARD.turboWarnSec at the same 12Hz as the
    // invulnerability flash and the held shaker: three different states, one
    // vocabulary for "this is about to stop".
    if (h.turboLeft > 0 && !(h.turboWarn && Math.floor(simTime * 12) % 2 === 0)) {
      drawTurboTrailArt(ctx, x - a.face * 30, y - 18, this.px, Math.floor(simTime * 12));
    }

    // The run phase comes from the SIM position for the same reason the barrel's
    // does, and `moving` from vx so that a player pressed against a wall stands
    // still instead of running on the spot.
    const pose = agentPose(a.state, body.x, body.y, Math.abs(body.vx) > RUN_EPS);
    drawAgentArt(ctx, x, y, this.px, pose, a.face);

    // ── THE HELMET, BESIDE THE HEAD AND NEVER OVER IT ──────────────────────
    //
    // `helmetOn` is a BOOLEAN, not a timer: the guard is spent by a hit, not by
    // the clock, so there is nothing to warn about and this does not blink. It
    // is a BADGE — art/powerups.ts pre-scales it to half for exactly this — and
    // it sits on the leading side of the head, which is the one part of the
    // silhouette the bag never occupies.
    // ABOVE the shoulder, not level with the head: at head height the badge and
    // the rider's own helmet are two dark domes side by side and he reads as
    // having two heads (checked on level 5). Lifted clear, it reads as a status
    // pinned to him — and it still never crosses the bag, which is on the other
    // side of the body entirely.
    if (h.helmetOn) drawHelmetWornArt(ctx, x + a.face * 16, y - 50, this.px);

    // THE POWERUP IS VISIBLE ON THE PLAYER, NOT ONLY IN THE HUD.
    //
    // While the shaker is up, contact SMASHES instead of killing — the single
    // biggest rule change in the game — and a player who has to check a corner
    // of the screen to know which rule is in force will play the safe one and
    // waste the window. So he carries it, and it blinks over the last
    // HAZARD.shakerWarnSec exactly as the invulnerability blink does, at the
    // same 12Hz, because it is the same statement: this is about to stop.
    if (h.shakerLeft > 0 && !(h.shakerWarn && Math.floor(simTime * 12) % 2 === 0)) {
      drawShakerHeldArt(ctx, x + a.face * 15, y - 24, this.px, a.face);
    }
    ctx.restore();
  }

  /**
   * THE LOCKED GATE, LEGIBLE FROM FRAME ONE.
   *
   * A player who climbs six floors and finds a ladder that silently refuses them
   * has not been given a puzzle, they have been given a bug. The shutter states
   * the rule — this is shut, here is the count — at the moment the tower first
   * comes into view, and rolls up over MOTION.shutterRollSec when the sweep
   * completes so the reward is visible from anywhere on the stage.
   */
  private drawShutter(ctx: CanvasRenderingContext2D, w: World): void {
    const g = this.gate;
    if (!g) return;
    const openT = this.shutterT;
    const x = g.x - SHUTTER_W / 2;
    const top = g.yTop - 10;
    const h = SHUTTER_H * (1 - openT);

    if (openT >= 1) {
      // A one-off glow band where the shutter was, so the top of the tower reads
      // as open rather than as empty.
      drawShutterOpenArt(ctx, x, top, SHUTTER_W);
      return;
    }

    ctx.save();
    // The clip is the ROLL: the artwork is always drawn at full height and the
    // window over it shrinks. Scaling the artwork instead would squash the slats
    // into stripes of varying pitch, which reads as a stretch, not as a roll.
    ctx.beginPath();
    ctx.rect(x, top, SHUTTER_W, h);
    ctx.clip();

    drawShutterArt(ctx, x, top, SHUTTER_W, SHUTTER_H);

    const cx = g.x;
    // The icon is CENTRED on cy and the count sits 22 below it, so cy has to
    // leave room for both inside SHUTTER_H. At 0.42 the padlock's shackle and
    // the digits overlapped — a lock drawn through a number, which reads as a
    // rendering fault rather than as a rule.
    const cy = top + SHUTTER_H * 0.3;
    iconLock(ctx, cx, cy, 18);
    this.drawShutterCounts(ctx, w, cx, cy + 22);
    ctx.restore();
  }

  /**
   * ═══ BOTH TOTALS, ONE LINE, AND WHICH ONE IS OUTSTANDING ═══════════════════
   *
   * THE FAILURE THIS PREVENTS: a shut door with no reason on it. The gate now
   * needs the collectibles AND the dishes, so a single count satisfied at 3/3
   * beside a ladder that still refuses the player is worse than no count at all —
   * it is a number that says "you are done" over a door that says "you are not",
   * and the player concludes the game is broken. Whatever else this drawing gets
   * wrong, it has to answer WHICH.
   *
   * It answers with EMPHASIS, not with a word: a satisfied pair is dimmed and the
   * outstanding pair stays at full strength, so the bright half of the line is
   * always the thing still owed. That needs no legend and survives being 40 units
   * wide on a phone, which "Rakhis 3/3 · Order 1/4" does not.
   *
   * ONE LINE, NEVER TWO. `cy` is `top + SHUTTER_H * 0.3` and the padlock is
   * centred on it — see the note at the call site. A second line at +40 leaves
   * the 62-unit box, and buying the room by moving cy to ~0.22 puts the digits
   * back through the shackle, which is the exact bug that comment records.
   *
   * The digits START at TEXT.label and drop to TEXT.micro only if the assembled
   * group would not fit SHUTTER_W — measured rather than assumed, because the
   * group's width depends on the numerals the level happens to have. A level with
   * no dishes keeps the original single count at full size.
   */
  private drawShutterCounts(
    ctx: CanvasRenderingContext2D,
    w: World,
    cx: number,
    cy: number,
  ): void {
    const s = w.session;
    const rakhiText = `${s.rakhiCount}/${s.rakhiTotal}`;
    const foodText = `${s.foodCount}/${s.foodTotal}`;
    const showFood = s.foodTotal > 0;

    // Glyph widths and the gaps around them. The collectible is a PLAIN DISC —
    // the tracker pip's own silhouette, which is where the player learnt it — and
    // not a miniature of the pickup: at 10 units the medallion's two threads are
    // three pixels of noise either side of the disc that carries the whole read,
    // and the first attempt at this line drew a squiggle rather than a rakhi.
    const gR = 10;
    const gF = 13;
    const tight = 2;
    const mid = 8;

    ctx.textBaseline = 'middle';
    const groupW = (size: number): number => {
      ctx.font = font(size, WEIGHT.display);
      const wr = gR + tight + ctx.measureText(rakhiText).width;
      return showFood ? wr + mid + gF + tight + ctx.measureText(foodText).width : wr;
    };

    // 4 units of slack inside the clip, so a glyph edge never touches the slats.
    const fit = SHUTTER_W - 4;
    let total = groupW(TEXT.label);
    if (total > fit) total = groupW(TEXT.micro);

    const full = COLORS.shutterLockIcon;
    const done = withAlpha(COLORS.shutterLockIcon, 0.45);

    let px = cx - total / 2;
    const rakhiColor = s.rakhiCount >= s.rakhiTotal ? done : full;
    disc(ctx, px + gR / 2, cy, gR / 2, rakhiColor);
    px += gR + tight;
    ctx.fillStyle = rakhiColor;
    px += trackedText(ctx, rakhiText, px, cy, 0, 'left');
    if (!showFood) return;

    px += mid;
    // `iconOrderBag`, NOT `drawFoodIconArt`: that drawing is a silhouette in the
    // HUD's ink with a cuff knocked out in the HUD's paper, and on these slats it
    // is an invisible bag with a pale scratch through it — which is precisely how
    // this shipped the first time. See the note on iconOrderBag in render/ui.ts.
    const foodColor = s.foodCount >= s.foodTotal ? done : full;
    iconOrderBag(ctx, px + gF / 2, cy, gF, foodColor);
    px += gF + tight;
    ctx.fillStyle = foodColor;
    trackedText(ctx, foodText, px, cy, 0, 'left');
  }

  // ── Masthead ──────────────────────────────────────────────────────────────

  private drawMasthead(ctx: CanvasRenderingContext2D): void {
    const r = this.head;
    ctx.fillStyle = COLORS.masthead;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = COLORS.mastheadRule;
    ctx.fillRect(r.x, r.y + r.h - 2, r.w, 2);

    // drawEmblem, NOT drawMark: the mark has a 56-unit minimum clear size and
    // throws below it, and a masthead this short cannot honour it.
    //
    // And NOT knocked out to paper, which is what this did first. The emblem is
    // plated artwork, so tinting its alpha paints a blank white tile — the mark
    // vanishes and nothing complains. AssetRef.opaque now makes that throw. On
    // this orange ground the emblem needs a paper plate under it, exactly as on
    // the boot overlay and the splash.
    const size = r.h - SPACE.lg * 2;
    const pad = 4;
    fillRound(
      ctx,
      rect(r.x + SPACE.lg - pad, r.y + SPACE.lg - pad, size + pad * 2, size + pad * 2),
      COLORS.surface,
      RADIUS.chip,
    );
    drawEmblem(ctx, r.x + SPACE.lg, r.y + SPACE.lg, size);

    // ── THE WORDMARK, UNDER THE PLATE ────────────────────────────────────────
    //
    // The band is 96 units and the plate ends at 76, with the rule at 94 — so
    // there are ~18 free units and every number below is chosen to fit them
    // rather than to look nice in isolation.
    //
    // WHY THE WORDMARK CUT AT EXACTLY 56 UNITS, AND WHY A KNOCKOUT IS LEGAL:
    //
    // · `wordmark` declares aspect 611/177 ≈ 3.452, so at w = 56 it is 16.2
    //   units tall. That fits the 18-unit gap AND its width is exactly the
    //   plate's 56, so the two stack as one left-aligned column.
    // · 56 is precisely MARK_MIN_W. drawMark throws below it with nothing to
    //   spare, so this must not be shaved: if the gap ever has to shrink, use
    //   drawEmblem (no minimum) instead of a smaller mark.
    // · `wordmark` is the ONLY cut that is not AssetRef.opaque — it is line art
    //   on transparency — which is what makes `knockout: 'paper'` legal here and
    //   a throw for every other cut. See the comment on AssetRef.opaque in
    //   src/brand/types.ts: a knockout tints ALPHA, so on a plated cut it paints
    //   a blank white tile with nothing logged. Knocked out to paper, the
    //   wordmark sits white directly on the orange masthead and needs no second
    //   paper plate under it.
    // · NOT the brand name set as type. src/scenes/splash.ts:134 records why:
    //   the mark above already says "Swiggy", and setting the brand's name twice
    //   in one eyeline is a known failure — and the wordmark is modified Futura,
    //   which Poppins would visibly miss.
    //
    // If the gap ever needs more room, shave the emblem (size -= 6). BANDS must
    // keep summing to REF.H — there is a module-load assertion in
    // src/render/layout.ts — and the stage band must not give up units.
    const wordW = MARK_MIN_W;
    const wordH = markHeight(wordW, 'wordmark');
    const gapTop = r.y + SPACE.lg + size + pad;
    const gapBot = r.y + r.h - 2;
    drawMark(
      ctx,
      r.x + SPACE.lg - pad,
      gapTop + (gapBot - gapTop - wordH) / 2,
      wordW,
      { cut: 'wordmark', knockout: 'paper' },
    );

    label(
      ctx,
      COPY.levelNames[this.level - 1] ?? '',
      r.x + SPACE.lg + size + SPACE.md,
      r.y + r.h / 2,
      { size: TEXT.sub, weight: WEIGHT.display, color: COLORS.mastheadText, track: TRACK.display },
    );

    const b = this.pauseBtn;
    fillRound(
      ctx,
      b,
      this.pausePressed ? withAlpha(COLORS.mastheadText, 0.28) : withAlpha(COLORS.mastheadText, 0.14),
      RADIUS.chip,
    );
    ctx.fillStyle = COLORS.mastheadText;
    const barW = 5;
    const barH = b.h * 0.42;
    ctx.fillRect(b.x + b.w / 2 - barW - 3, b.y + (b.h - barH) / 2, barW, barH);
    ctx.fillRect(b.x + b.w / 2 + 3, b.y + (b.h - barH) / 2, barW, barH);
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  private drawHud(ctx: CanvasRenderingContext2D, w: World): void {
    const box = inset(this.hud, SPACE.lg, SPACE.sm);
    card(ctx, box, { tone: 'surface' });

    const s = w.session;
    const colW = box.w / 3;
    const top = box.y + SPACE.md;
    const mid = box.y + box.h * 0.62;

    // ── Left: the sweep tracker, BOTH HALVES OF THE ORDER ───────────────────
    //
    // ONE LABEL over two readouts, and the label is `hudFood` ("ORDER") rather
    // than `hudRakhi` ("RAKHIS"). Two micro labels in a 224-unit column would
    // each get ~100 units and neither would be a word at 12 units — and the
    // combined label is the TRUER one anyway: what the gate weighs is the whole
    // order, which is exactly what `doorLocked` and `gateOpenToast` call it.
    // The player learns one noun in the HUD, on the shutter and in the toast.
    const trackX = box.x + SPACE.lg;
    label(ctx, t(COPY.hudFood).toUpperCase(), trackX, top, {
      size: TEXT.micro,
      color: COLORS.hudLabel,
      track: TRACK.micro,
    });
    for (let i = 0; i < s.rakhiTotal; i++) {
      // The punch is a SCALE on pickup, not a colour change: the colour already
      // carries "collected", and a second signal on the same channel is noise.
      const p = this.punch[i] ?? 0;
      const grow = 1 + (p / MOTION.pipPunchSec) * (PUNCH_MAX - 1);
      iconPip(ctx, trackX + PIP_R + i * (PIP_R * 2 + SPACE.sm), mid, PIP_R * grow, s.rakhiTaken[i] === true);
    }

    // ── The dishes: one glyph and a numeral, beside the pips ─────────────────
    //
    // A NUMERAL RATHER THAN A SECOND PIP STRIP. Two strips of dots in one
    // eyeline is how the count the gate depends on becomes unreadable, and a
    // level can carry four dishes to three collectibles — eight dots across a
    // column this wide would be a bar chart, not a counter. The glyph is the
    // takeaway BAG (art/food.ts): the one mark in the set that is not a dish,
    // which is what makes it read as a total rather than as a sixth item.
    if (s.foodTotal > 0) {
      const iconX = trackX + s.rakhiTotal * (PIP_R * 2 + SPACE.sm) + COUNTER_GAP + FOOD_ICON / 2;
      const fp = this.punch[this.foodSlot] ?? 0;
      const grow = 1 + (fp / MOTION.pipPunchSec) * (PUNCH_MAX - 1);
      ctx.save();
      // The punch is a TRANSFORM around a glyph baked once at its peak size —
      // see PUNCH_MAX on why a size driven by a timer must not reach `bake`.
      ctx.translate(iconX, mid);
      ctx.scale(grow, grow);
      drawFoodIconArt(ctx, 0, 0, this.px * PUNCH_MAX, FOOD_ICON);
      ctx.restore();
      label(
        ctx,
        `${s.foodCount}/${s.foodTotal}`,
        iconX + FOOD_ICON / 2 + SPACE.xs,
        mid,
        {
          size: TEXT.label,
          weight: WEIGHT.display,
          color: COLORS.hudValue,
          track: TRACK.display,
        },
      );
    }

    // ── Centre: the delivery clock ──────────────────────────────────────────
    const cx = box.x + colW * 1.5;
    const urgent = s.timeLeft <= TIMER.urgentSec;
    label(ctx, COPY.hudTimer, cx, top, {
      size: TEXT.micro,
      align: 'center',
      color: COLORS.hudLabel,
      track: TRACK.micro,
    });
    label(ctx, `${Math.ceil(Math.max(s.timeLeft, 0))}`, cx, mid - 4, {
      size: TEXT.head,
      weight: WEIGHT.display,
      align: 'center',
      color: urgent ? COLORS.timerFillUrgent : COLORS.timerText,
      track: TRACK.display,
    });
    const barW = colW - SPACE.lg * 2;
    const barX = cx - barW / 2;
    const barY = box.y + box.h - SPACE.md - 6;
    ctx.fillStyle = COLORS.timerTrack;
    ctx.fillRect(barX, barY, barW, 6);
    ctx.fillStyle = urgent ? COLORS.timerFillUrgent : COLORS.timerFill;
    ctx.fillRect(barX, barY, barW * clamp(s.timeLeft / w.params.timerSec, 0, 1), 6);

    // ── Right: tries and score ──────────────────────────────────────────────
    const rx = box.x + box.w - SPACE.lg;
    label(ctx, COPY.hudScore, rx, top, {
      size: TEXT.micro,
      align: 'right',
      color: COLORS.hudLabel,
      track: TRACK.micro,
    });
    label(ctx, `${s.score}`, rx, mid - 4, {
      size: TEXT.sub,
      weight: WEIGHT.display,
      align: 'right',
      color: COLORS.hudValue,
      track: TRACK.display,
    });
    const lifeR = 6;
    for (let i = 0; i < AGENT.lives; i++) {
      disc(
        ctx,
        rx - lifeR - i * (lifeR * 2 + SPACE.xs),
        barY + 3,
        lifeR,
        i < s.lives ? COLORS.lifeFull : COLORS.lifeSpent,
      );
    }
    label(ctx, COPY.hudLives, rx - AGENT.lives * (lifeR * 2 + SPACE.xs) - SPACE.sm, barY + 3, {
      size: TEXT.micro,
      align: 'right',
      color: COLORS.hudLabel,
      track: TRACK.micro,
    });
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  private drawControls(ctx: CanvasRenderingContext2D): void {
    const band = padBandRect(this.vp, 'play');
    const pad = this.controls.pad;
    const jump = this.controls.jump;

    ctx.save();
    // Dimmed, not hidden, whenever input is dead. A control that vanishes during
    // the respawn beat reads as a crash; one that greys out reads as a wait.
    ctx.globalAlpha = this.live ? 1 : 0.45;

    // The cluster's backing plate, CLIPPED TO THE PAD BAND. padBandRect is the
    // one place that knows the ad slides out during play; deriving the plate
    // from the cluster alone would let it run under the banner on a menu-height
    // band the day this scene is reused for a tutorial.
    const reach = UI.padSize * 1.5 + UI.padGap;
    const top = Math.max(band.y, pad.cy - reach);
    fillRound(
      ctx,
      {
        x: pad.cx - reach,
        y: top,
        w: reach * 2,
        h: Math.min(band.y + band.h, pad.cy + reach) - top,
      },
      COLORS.padPlate,
      RADIUS.card,
    );

    for (let d = PAD.UP; d <= PAD.RIGHT; d++) {
      const r = pad.rects[d]!;
      const down = pad.pressedPad === d;
      fillRound(ctx, r, down ? COLORS.padFacePressed : COLORS.padFace, RADIUS.chip);
      chevron(ctx, r, d, COLORS.padChevron);
    }
    disc(ctx, pad.cx, pad.cy, UI.padSize * 0.22, COLORS.padHub);

    disc(ctx, jump.cx, jump.cy, jump.r, jump.pressed ? COLORS.jumpFacePressed : COLORS.jumpFace);
    ctx.strokeStyle = COLORS.jumpRing;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(jump.cx, jump.cy, jump.r - 2, 0, Math.PI * 2);
    ctx.stroke();
    // The jump glyph: an up arrow made of a triangle over a bar. Two primitives.
    ctx.fillStyle = COLORS.jumpGlyph;
    ctx.beginPath();
    ctx.moveTo(jump.cx, jump.cy - 22);
    ctx.lineTo(jump.cx + 20, jump.cy + 2);
    ctx.lineTo(jump.cx - 20, jump.cy + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(jump.cx - 8, jump.cy + 2, 16, 18);

    ctx.restore();
  }

  // ── Overlays ──────────────────────────────────────────────────────────────

  private drawOverlays(ctx: CanvasRenderingContext2D, w: World): void {
    const b = this.band;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;

    switch (this.state) {
      case 'ready':
        banner(ctx, b, COPY.ready, TEXT.hero);
        break;

      case 'unlocked': {
        ctx.save();
        // Fades out across the beat rather than cutting, so the flash is a
        // punctuation mark and not a frame that looks like a glitch.
        const k = 1 - clamp(this.stateT / (RAKHI.unlockHoldSec + RAKHI.unlockHitStopSec), 0, 1);
        ctx.globalAlpha = k * 0.5;
        ctx.fillStyle = COLORS.unlockFlash;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.restore();
        banner(ctx, b, t(COPY.gateOpenToast), TEXT.sub);
        break;
      }

      case 'dying':
        ctx.save();
        ctx.globalAlpha = clamp(1 - this.stateT / AGENT.deathFreezeSec, 0, 1);
        ctx.fillStyle = COLORS.deathFlash;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.restore();
        break;

      case 'respawn':
        ctx.save();
        ctx.globalAlpha = clamp(1 - this.stateT / AGENT.respawnFadeSec, 0, 1) * 0.5;
        scrim(ctx, this.vp.fieldW, this.vp.fieldH);
        ctx.restore();
        break;

      case 'timeup':
        scrim(ctx, this.vp.fieldW, this.vp.fieldH, 0.7);
        label(ctx, w.session.lives > 0 ? COPY.timeUp : COPY.gameOverTitle, cx, cy, {
          size: TEXT.title,
          weight: WEIGHT.display,
          align: 'center',
          tone: 'inverse',
          track: TRACK.display,
        });
        break;

      case 'delivered':
        scrim(ctx, this.vp.fieldW, this.vp.fieldH, 0.7);
        label(ctx, COPY.deliveredTitle, cx, cy, {
          size: TEXT.title,
          weight: WEIGHT.display,
          align: 'center',
          tone: 'inverse',
          track: TRACK.display,
        });
        break;

      case 'paused':
        this.drawPause(ctx);
        break;

      default:
        break;
    }
  }

  private drawPause(ctx: CanvasRenderingContext2D): void {
    scrim(ctx, this.vp.fieldW, this.vp.fieldH);

    const resume = this.sheet[R_RESUME]!;
    const home = this.sheet[R_HOME]!;
    const panel: Rect = {
      x: resume.x - SPACE.lg,
      y: resume.y - SPACE.xxl - SPACE.lg,
      w: resume.w + SPACE.lg * 2,
      h: home.y + home.h + SPACE.lg - (resume.y - SPACE.xxl - SPACE.lg),
    };
    ctx.fillStyle = COLORS.pausePanel;
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, RADIUS.card);
    ctx.fill();
    strokeRound(ctx, panel, COLORS.border, RADIUS.card, 1);

    label(ctx, COPY.paused, panel.x + panel.w / 2, panel.y + SPACE.xl, {
      size: TEXT.head,
      weight: WEIGHT.display,
      align: 'center',
      track: TRACK.display,
    });

    button(ctx, resume, COPY.resume, { variant: 'hero', pressed: this.pressed === R_RESUME });
    button(ctx, this.sheet[R_RESTART]!, COPY.restart, {
      variant: 'secondary',
      pressed: this.pressed === R_RESTART,
      size: TEXT.body,
    });
    button(ctx, home, COPY.quit, {
      variant: 'ghost',
      pressed: this.pressed === R_HOME,
      size: TEXT.body,
    });
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  onPointer(kind: PointerKind, _id: number, x: number, y: number, _t: number): void {
    if (this.state === 'paused') {
      this.sheetPointer(kind, x, y);
      return;
    }

    // Only the pause button. Everything else in the play scene is a control, and
    // controls are claimed by the pad and the jump button before a pointer ever
    // reaches a scene — see input/controls.ts.
    if (kind === 'down') {
      this.pausePressed = hitTest([this.pauseBtn], x, y) === 0;
      return;
    }
    if (kind === 'cancel') {
      this.pausePressed = false;
      return;
    }
    if (kind !== 'up') return;
    const was = this.pausePressed;
    this.pausePressed = false;
    if (was && hitTest([this.pauseBtn], x, y) === 0) {
      this.sfx.play('uiTap');
      this.pause();
    }
  }

  private sheetPointer(kind: PointerKind, x: number, y: number): void {
    if (kind === 'down') {
      this.pressed = hitTest(this.sheet, x, y);
      return;
    }
    if (kind === 'cancel') {
      this.pressed = -1;
      return;
    }
    if (kind !== 'up') return;

    const hit = hitTest(this.sheet, x, y);
    const was = this.pressed;
    this.pressed = -1;
    if (hit === -1 || hit !== was) return;

    this.sfx.play('uiTap');
    haptic(HAPTIC.tap);
    if (hit === R_RESUME) this.resume();
    // A restart is a fresh enter() on the same level — one construction path for
    // a round, so a restarted level cannot differ from a started one.
    else if (hit === R_RESTART) this.enter({ level: this.level });
    else if (hit === R_HOME) this.cb.onQuit();
  }
}

// ─── Primitives ─────────────────────────────────────────────────────────────

/** The d-pad's arrow, pointing out from the cluster along the pad's own axis. */
function chevron(ctx: CanvasRenderingContext2D, r: Rect, dir: number, fill: string): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const s = r.w * 0.22;
  const dx = dir === PAD.LEFT ? -1 : dir === PAD.RIGHT ? 1 : 0;
  const dy = dir === PAD.UP ? -1 : dir === PAD.DOWN ? 1 : 0;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(cx + dx * s, cy + dy * s);
  ctx.lineTo(cx - dx * s + dy * s, cy - dy * s + dx * s);
  ctx.lineTo(cx - dx * s - dy * s, cy - dy * s - dx * s);
  ctx.closePath();
  ctx.fill();
}

/** A centred word over the stage, on a plate so it survives any backdrop. */
function banner(ctx: CanvasRenderingContext2D, band: Rect, text: string, size: number): void {
  const cx = band.x + band.w / 2;
  const cy = band.y + band.h * 0.42;
  label(ctx, text, cx, cy, {
    size,
    weight: WEIGHT.display,
    align: 'center',
    color: COLORS.text,
    track: TRACK.display,
  });
}

function place(dst: Rect, x: number, y: number, w: number, h: number): void {
  dst.x = x;
  dst.y = y;
  dst.w = w;
  dst.h = h;
}
