/**
 * ══════════════════════════════════════════════════════════════════════════
 *  DELIVERED — the receipt, and the last screen of the run.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): the results screen that shows a total. A
 * single big number tells the player what they scored and nothing about WHY, so
 * the bonuses the game spent ten levels teaching — the perfect delivery, the
 * clean sweep, the time left on the clock — are invisible at the one moment they
 * would be read. The rows are the feedback loop; the total is just where it
 * lands.
 *
 * THE FAILURE THIS FILE PREVENTS (2): the results panel that is a results panel.
 * This is a game about delivering an order, so the payout is A RECEIPT — torn
 * paper, dashed rules, label on the left and figure on the right, the brand's
 * own mark at the head of it. That is not decoration: it is the single cheapest
 * moment of brand fit in the build, it costs one path and two loops, and it is
 * the frame players screenshot. A generic card would work exactly as well and
 * mean nothing.
 *
 * THE FAILURE THIS FILE PREVENTS (3): the run that just stops. Level 10 is the
 * end of the game and it must not hand back an AGLA ORDER button pointing at a
 * level that does not exist. `final` on the payload switches this scene to the
 * completion state — which is the same screen's job (you delivered; here is what
 * it came to) rather than a sixth scene with its own layout, its own buttons and
 * its own way of being wrong.
 *
 * ─── THE VERDICT IS HANDED IN, NEVER RE-DERIVED ────────────────────────────
 *
 * `perfect` and `rescued` are decided by the sim. A results screen that inferred
 * "perfect" from a score threshold is a results screen that eventually disagrees
 * with the game about what the player just did, and the player believes the game.
 * The ONE thing computed here is the clean sweep, and only because it is not a
 * judgement: it is `rakhis + food === rakhisTotal + foodTotal` — the numbers
 * already printed on the receipt, said once more with a name. Both halves,
 * because the door needed both; see the note beside the rows.
 *
 * Like every scene here it NAVIGATES NOTHING: `onNext` and `onHome`, and main.ts
 * decides what the next level is.
 */

import type { PointerKind } from '../core/types';
import { BRAND_COPY, COLORS, IDENTITY, withAlpha } from '../brand';
import { COPY, tSentence, tUpper } from '../config/copy';
import { RADIUS, SPACE, TEXT, TRACK, WEIGHT } from '../config/theme';
import { columnRect, menuContentRect, rect, type Rect } from '../render/layout';
import {
  BUTTON_H,
  BUTTON_H_SM,
  button,
  card,
  ctaRect,
  dashedDivider,
  hitTest,
  iconStar,
  label,
  valueRow,
} from '../render/ui';
import { drawMarkCentered, markHeight } from '../render/mark';
import { motionReduced } from '../render/fx';
import { clamp } from '../core/math';
import { drawAgentArt } from '../render/art/agent';
import { drawCustomerArt } from '../render/art/customer';
import { drawMonkeyArt } from '../render/art/monkey';
import { drawRakhiArt } from '../render/art/rakhi';
import type { Viewport } from '../render/canvas';
import type { GameScene, SceneId } from './director';

export interface DeliveredPayload {
  level: number;
  score: number;
  /**
   * Collected / required, BROKEN OUT BY KIND under the headline row.
   *
   * Both halves are carried rather than only their sum, because "Items delivered
   * 3/4" over a locked door the player never opened tells them nothing about
   * which half they missed — and the receipt is where a player works out what to
   * do differently on the retry. The headline adds them; these two name them.
   */
  rakhis: number;
  rakhisTotal: number;
  food: number;
  foodTotal: number;
  barrelsJumped: number;
  /** Whole seconds left on the delivery clock. */
  timeLeft: number;
  perfect: boolean;
  /** True when the level was reached through the rescue/skip path. */
  rescued: boolean;

  /**
   * THE RUN IS OVER. Set by main.ts when the level just cleared was the last
   * one, because this scene must not be the thing that knows how many levels
   * there are — that is the level table's business, and it is being edited.
   *
   * Absent is false, so a build whose main.ts has not been wired yet shows the
   * ordinary receipt with a next-level button rather than throwing.
   */
  final?: boolean;

  /**
   * WHOLE-RUN FIGURES, for the completion state only. Optional for the same
   * reason `final` is: they are accumulated across levels and this scene sees
   * one level at a time, so they can only come from the owner of the session.
   * Missing fields fall back to what this level alone can prove.
   */
  totals?: {
    /** Levels cleared this run. */
    levels: number;
    /** Collectibles taken across the run. */
    rakhis: number;
    /** Food items taken across the run. */
    food: number;
    /** Longest streak of levels cleared without losing a try. */
    streak: number;
    /** How many of them were perfect. */
    perfect: number;
    /** The run's score. Distinct from this level's `score`. */
    score: number;
  };
}

export interface DeliveredCallbacks {
  onNext(level: number): void;
  onHome(): void;
}

const R_NEXT = 0;
const R_HOME = 1;

// ─── The completion tableau, in named seconds ───────────────────────────────
//
// The beat: the monkey climbs down sheepish and holds out his wrist, the agent
// ties a rakhi on him, and then the customer ties one on the AGENT — the courier
// who delivered everyone else's rakhi finally gets his own. That last half
// second is the whole ending, so it is the one that is given room.

/** The agent's rakhi lands on the monkey's wrist — after a beat long enough for
 *  the player to have read the title and found the three figures. */
const TIE_MONKEY_SEC = 1.0;
/** The customer arrives. */
const CUSTOMER_IN_SEC = 1.7;
/** The agent gets his own. */
const TIE_AGENT_SEC = 2.35;
/** How long a tied rakhi takes to pop into place. */
const TIE_POP_SEC = 0.3;
/** How far the customer slides in from the right, in reference units. */
const CUSTOMER_SLIDE = 70;

export class DeliveredScene implements GameScene {
  readonly id: SceneId = 'delivered';

  private data: DeliveredPayload = {
    level: 1,
    score: 0,
    rakhis: 0,
    rakhisTotal: 0,
    food: 0,
    foodTotal: 0,
    barrelsJumped: 0,
    timeLeft: 0,
    perfect: false,
    rescued: false,
  };

  private readonly regions: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];
  private pressed = -1;

  /** Seconds since `enter`. Drives the tableau and nothing else. */
  private elapsed = 0;
  /** Set after a clipboard fallback, so the share button can confirm it did
   *  something. Completion state only. */
  private shared = false;
  private px = 1;

  constructor(
    private readonly vp: Viewport,
    private readonly cb: DeliveredCallbacks,
  ) {}

  enter(payload?: unknown): void {
    const p = payload as Partial<DeliveredPayload> | undefined;
    // Spread over the DEFAULT, not over the previous payload: carrying the last
    // level's numbers forward is how a level with no barrels shows the previous
    // level's barrel count, which nobody notices until it is in a store listing.
    this.data = {
      level: 1,
      score: 0,
      rakhis: 0,
      rakhisTotal: 0,
      food: 0,
      foodTotal: 0,
      barrelsJumped: 0,
      timeLeft: 0,
      perfect: false,
      rescued: false,
      ...(p ?? {}),
    };
    this.pressed = -1;
    this.elapsed = 0;
    this.shared = false;
  }

  exit(): void {
    this.pressed = -1;
  }

  update(dt: number, _simTime: number): void {
    this.elapsed += dt;
  }

  private get final(): boolean {
    return this.data.final === true;
  }

  private layout(): void {
    const content = menuContentRect(this.vp);
    const col = columnRect(this.vp, content.y, content.h);

    const homeY = content.y + content.h - SPACE.lg - BUTTON_H_SM;
    copyRect(
      this.regions[R_HOME]!,
      ctaRect(this.vp.fieldW, homeY, col.w * 0.5, BUTTON_H_SM),
    );
    copyRect(
      this.regions[R_NEXT]!,
      ctaRect(this.vp.fieldW, homeY - SPACE.md - BUTTON_H, col.w, BUTTON_H),
    );
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number, _simTime: number): void {
    this.layout();
    this.px = this.vp.refToDevice(1);

    ctx.fillStyle = COLORS.surfaceTinted;
    ctx.fillRect(0, 0, this.vp.fieldW, this.vp.fieldH);

    if (this.final) this.renderComplete(ctx);
    else this.renderReceipt(ctx);
  }

  // ── The ordinary level payout ─────────────────────────────────────────────

  private renderReceipt(ctx: CanvasRenderingContext2D): void {
    const content = menuContentRect(this.vp);
    const col = columnRect(this.vp, content.y, content.h);
    const cx = this.vp.fieldW / 2;
    const d = this.data;

    label(ctx, COPY.deliveredTitle, cx, content.y + SPACE.lg, {
      size: TEXT.title,
      weight: WEIGHT.display,
      align: 'center',
      tone: 'primary',
      track: TRACK.display,
    });

    // Perfect beats rescued beats the level's own line: the most specific true
    // statement wins, which is the only ordering that never congratulates a
    // player for something they did not do — and `punchlineRescued` is written
    // so that the least specific case is still not a telling-off.
    const punchline = d.perfect
      ? COPY.punchlinePerfect
      : d.rescued
        ? COPY.punchlineRescued
        : (COPY.levelPunchline[d.level - 1] ?? '');
    label(ctx, punchline, cx, content.y + SPACE.lg + SPACE.xl, {
      size: TEXT.body,
      align: 'center',
      tone: 'secondary',
    });

    // ── THE ORDER, AS A HEADLINE AND ITS TWO PARTS ──────────────────────────
    //
    // "Items delivered 3/3" is the line that matches what the game asked for:
    // the gate weighs the collectibles and the dishes together, so the receipt
    // has to total them the same way or the player is reading a different job
    // from the one they just did. The two rows under it are the itemisation —
    // which is what a receipt is, and it costs nothing here because `rowH`
    // absorbs extra rows down to a 36-unit floor (see below).
    const items = d.rakhis + d.food;
    const itemsTotal = d.rakhisTotal + d.foodTotal;
    const rows: [string, string, boolean][] = [
      [COPY.receiptItems, `${items}/${itemsTotal}`, false],
      [tSentence(COPY.receiptRakhis), `${d.rakhis}/${d.rakhisTotal}`, false],
      [tSentence(COPY.receiptFood), `${d.food}/${d.foodTotal}`, false],
      [COPY.receiptBarrels, String(d.barrelsJumped), false],
      [COPY.receiptOnTime, formatSeconds(d.timeLeft), false],
      [COPY.receiptClear, String(d.level), false],
    ];
    // The two bonuses. `perfect` is the sim's verdict; the sweep is arithmetic
    // on numbers already printed above it — see the header.
    if (d.perfect) rows.push([COPY.receiptPerfect, '', true]);
    // BOTH sweeps, because the door needed both. A "clean sweep" awarded for the
    // collectibles alone would print on a receipt that says 3/4 items two rows
    // above it — a bonus contradicting its own evidence, which costs the whole
    // receipt its credibility and not just that line.
    if (itemsTotal > 0 && items >= itemsTotal) {
      rows.push([COPY.receiptSweep, '', true]);
    }

    const headH = 108;
    const totalH = SPACE.lg * 2 + TEXT.head;
    const top = content.y + SPACE.xxl + SPACE.md;
    const bottom = this.regions[R_NEXT]!.y - SPACE.lg;

    // THE ROWS ABSORB THE SLACK, up to a ceiling. A receipt sized to its own
    // content leaves a third of a phone screen empty under it, and a receipt
    // stretched without a cap turns into six labels floating a thumb apart. The
    // floor is the standard row; the ceiling is where a row stops reading as a
    // line on a bill and starts reading as a list item.
    const fixed = headH + totalH + SPACE.lg;
    const rowH = clamp((bottom - top - fixed) / rows.length, SPACE.xl, 52);
    const paperH = Math.min(fixed + rows.length * rowH, bottom - top);
    // CENTRED in the band, not pinned to its top. The receipt is five rows on
    // one level and seven on another, and a paper anchored under the punchline
    // leaves a visibly different hole above the buttons depending on how well
    // the player did — which reads as a layout bug rather than as a shorter bill.
    const paper = rect(col.x, top + (bottom - top - paperH) / 2, col.w, paperH);

    drawReceiptPaper(ctx, paper);

    const innerX = paper.x + SPACE.xl;
    const innerW = paper.w - SPACE.xl * 2;

    // The mark heads the receipt, exactly as it heads a real one. Used as
    // supplied — the plated cuts carry their own opaque plate, so a knockout
    // here would paint a white squircle where the emblem is.
    const markW = Math.min(148, innerW * 0.42);
    const markH = markHeight(markW, 'mark');
    drawMarkCentered(ctx, paper.x + paper.w / 2, paper.y + SPACE.xl + markH / 2, markW);
    dashedDivider(
      ctx,
      innerX,
      paper.y + SPACE.xl + markH + SPACE.md,
      innerW,
      COLORS.borderStrong,
    );

    let y = paper.y + headH;
    for (const [name, value, bonus] of rows) {
      const r = rect(innerX, y, innerW, rowH);
      if (bonus) {
        // A bonus row is a STAR and a name, not a name and a tick. The tick
        // needs a value column to live in and says only "true"; the star is the
        // same object the game uses for a rating and reads as "you earned this".
        iconStar(ctx, r.x + 8, r.y + r.h / 2, 9, true);
        label(ctx, name, r.x + 24, r.y + r.h / 2, {
          size: TEXT.body,
          weight: WEIGHT.mid,
          color: COLORS.btnHero,
          track: TRACK.label,
        });
      } else {
        valueRow(ctx, r, name, value);
      }
      y += rowH;
    }

    dashedDivider(ctx, innerX, y + SPACE.sm, innerW, COLORS.borderStrong);
    valueRow(
      ctx,
      rect(innerX, y + SPACE.md, innerW, rowH),
      COPY.receiptTotal,
      String(d.score),
      { size: TEXT.label, valueSize: TEXT.head },
    );

    button(ctx, this.regions[R_NEXT]!, COPY.nextLevel, {
      variant: 'hero',
      pressed: this.pressed === R_NEXT,
    });
    button(ctx, this.regions[R_HOME]!, COPY.quit, {
      variant: 'ghost',
      pressed: this.pressed === R_HOME,
      size: TEXT.body,
    });
  }

  // ── The end of the run ────────────────────────────────────────────────────

  private renderComplete(ctx: CanvasRenderingContext2D): void {
    const content = menuContentRect(this.vp);
    const col = columnRect(this.vp, content.y, content.h);
    const cx = this.vp.fieldW / 2;
    const d = this.data;
    const totals = d.totals;

    // The mark heads the completion screen too — this is the frame a player who
    // finished the whole run is most likely to keep, and it is the one screen
    // where the brand has unambiguously earned the credit.
    const markW = Math.min(150, col.w * 0.34);
    const markH = markHeight(markW, 'mark');
    const markY = content.y + SPACE.sm;
    drawMarkCentered(ctx, cx, markY + markH / 2, markW);

    const titleY = markY + markH + SPACE.lg;
    label(ctx, tUpper(COPY.completeTitle), cx, titleY, {
      size: TEXT.head,
      weight: WEIGHT.display,
      align: 'center',
      tone: 'primary',
      track: TRACK.display,
    });
    label(ctx, BRAND_COPY.winLine, cx, titleY + SPACE.xl, {
      size: TEXT.body,
      align: 'center',
      tone: 'secondary',
    });

    // The tableau and the figures under it are CENTRED AS ONE GROUP in the band
    // between the header and the buttons. Pinning the tableau to the header
    // instead leaves the dead space at the bottom, directly above the CTA, which
    // is the one place on the screen it is impossible not to notice.
    const groupTop = titleY + SPACE.xl + SPACE.xl;
    const groupBottom = this.regions[R_NEXT]!.y - SPACE.lg;
    const tabH = 168;
    const rowH = SPACE.xl;
    const panelH = SPACE.lg * 2 + 4 * rowH + SPACE.xl + TEXT.title;
    const slack = Math.max(0, groupBottom - groupTop - tabH - SPACE.lg - panelH);
    const tabTop = groupTop + slack / 2;
    const tableau = rect(col.x, tabTop, col.w, tabH);
    card(ctx, tableau, { tone: 'quiet', radius: RADIUS.card });
    ctx.save();
    ctx.beginPath();
    ctx.rect(tableau.x, tableau.y, tableau.w, tableau.h);
    ctx.clip();
    this.drawTableau(ctx, tableau);
    ctx.restore();

    const rows: [string, string][] = [
      [COPY.completeLevels, String(totals?.levels ?? d.level)],
      // ITEMS, not just collectibles — the run delivered both halves of every
      // order, and reporting only the rakhis would under-count the player's
      // whole game. Swapped in place rather than added as a fifth row: this
      // panel uses a FIXED rowH, unlike the per-level receipt whose rows are
      // clamped, so a fifth row would overrun it.
      [
        COPY.receiptItems,
        String((totals?.rakhis ?? d.rakhis) + (totals?.food ?? d.food)),
      ],
      [COPY.completeStreak, String(totals?.streak ?? 0)],
      [COPY.completePerfect, String(totals?.perfect ?? (d.perfect ? 1 : 0))],
    ];

    const top = tableau.y + tableau.h + SPACE.lg;
    const panel = rect(col.x, top, col.w, Math.min(panelH, groupBottom - top));
    card(ctx, panel, { tone: 'surface', elevated: true });

    const innerX = panel.x + SPACE.xl;
    const innerW = panel.w - SPACE.xl * 2;
    let y = panel.y + SPACE.lg;
    for (const [name, value] of rows) {
      valueRow(ctx, rect(innerX, y, innerW, rowH), name, value);
      y += rowH;
    }
    dashedDivider(ctx, innerX, y + SPACE.sm, innerW, COLORS.borderStrong);
    // The final score is the biggest type on the screen, and it is on its own
    // line rather than in a row: it is the number that gets screenshotted.
    label(ctx, COPY.completeScore, innerX, y + SPACE.lg + SPACE.sm, {
      size: TEXT.label,
      tone: 'secondary',
      track: TRACK.label,
    });
    label(
      ctx,
      String(totals?.score ?? d.score),
      innerX + innerW,
      y + SPACE.lg + SPACE.xl + SPACE.sm,
      {
        size: TEXT.title,
        weight: WEIGHT.display,
        align: 'right',
        tone: 'primary',
        track: TRACK.display,
      },
    );

    // SHARE is the hero here, not PLAY AGAIN: a player who has just finished the
    // whole run is far more likely to tell somebody than to start again, and the
    // screen should ask for the thing it actually wants.
    button(ctx, this.regions[R_NEXT]!, COPY.shareBtn, {
      variant: this.shared ? 'secondary' : 'hero',
      pressed: this.pressed === R_NEXT,
    });
    button(ctx, this.regions[R_HOME]!, COPY.playAgain, {
      variant: 'ghost',
      pressed: this.pressed === R_HOME,
      size: TEXT.body,
    });
  }

  /**
   * THE ENDING, DRAWN WITH THE GAME'S OWN FIGURES.
   *
   * Every body here is the same art the play scene blits — the monkey who spent
   * ten levels throwing drums, the agent who dodged them, the customer at the
   * top of the last one. A bespoke illustration would look better for a week and
   * then look like a different game.
   *
   * The wrists are approximate offsets from each figure's anchor, tuned against
   * the drawings rather than read out of them: the art modules expose a foot
   * anchor and nothing else, and exporting a wrist point from each of them for
   * one screen would be three new public constants that the poses would then
   * have to keep true.
   */
  private drawTableau(ctx: CanvasRenderingContext2D, r: Rect): void {
    const px = this.px;
    const ground = r.y + r.h - SPACE.lg;
    const cx = r.x + r.w / 2;

    // The floor they are standing on: one flat fill in the girder's own face
    // colour. Not a real girder — a sloped parallelogram under a still tableau
    // reads as a mistake rather than as a floor.
    ctx.fillStyle = withAlpha(COLORS.girderFace, 0.5);
    ctx.fillRect(r.x + SPACE.lg, ground, r.w - SPACE.lg * 2, 4);

    const monkeyX = cx - 96;
    const agentX = cx - 4;
    const customerX = cx + 92;

    drawMonkeyArt(ctx, monkeyX, ground, px, 'idle');
    // Facing LEFT, toward the monkey he is tying: -1 is the mirror, and the
    // whole gesture is unreadable if both figures face the same way.
    drawAgentArt(ctx, agentX, ground, px, 'deliver', -1);

    const inK = this.beat(CUSTOMER_IN_SEC, 0.4);
    if (inK > 0) {
      ctx.save();
      ctx.globalAlpha = inK;
      drawCustomerArt(ctx, customerX + (1 - inK) * CUSTOMER_SLIDE, ground, px, 'happy');
      ctx.restore();
    }

    // The rakhis go in the GAPS BETWEEN the figures, at wrist height, not on
    // their chests. At the game's own scale a medallion is two thirds as wide as
    // the agent, so one centred on a torso reads as a shield rather than as a
    // band — and the whole beat depends on it reading as something handed over.
    this.tiedRakhi(ctx, monkeyX + 38, ground - 30, TIE_MONKEY_SEC, px);
    this.tiedRakhi(ctx, agentX + 36, ground - 28, TIE_AGENT_SEC, px);
  }

  /** A rakhi that pops into place at `at` seconds and then stays. */
  private tiedRakhi(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    at: number,
    px: number,
  ): void {
    const k = this.beat(at, TIE_POP_SEC);
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha = k;
    // The shine index is fixed rather than driven by sim time: this is a still
    // frame of a ceremony, and a medallion strobing through eight highlights
    // during it looks like a pickup waiting to be collected.
    drawRakhiArt(ctx, x, y, px, 2);
    ctx.restore();
  }

  /** 0 before `at`, easing to 1 over `dur`. 1 immediately under reduced motion. */
  private beat(at: number, dur: number): number {
    if (motionReduced()) return 1;
    if (this.elapsed < at) return 0;
    const k = clamp((this.elapsed - at) / dur, 0, 1);
    return 1 - (1 - k) ** 2;
  }

  onPointer(kind: PointerKind, _id: number, x: number, y: number, _t: number): void {
    if (kind === 'down') {
      this.pressed = hitTest(this.regions, x, y);
      return;
    }
    if (kind === 'cancel') {
      this.pressed = -1;
      return;
    }
    if (kind !== 'up') return;

    const hit = hitTest(this.regions, x, y);
    const was = this.pressed;
    this.pressed = -1;
    if (hit === -1 || hit !== was) return;

    if (this.final) {
      // Fired from inside the pointerup handler, NOT from a later frame: both
      // `navigator.share` and the async clipboard API require a transient user
      // activation, and that activation is gone by the next rAF tick.
      if (hit === R_NEXT) void shareRun(this.data).then((ok) => (this.shared = ok));
      else this.cb.onHome();
      return;
    }

    if (hit === R_NEXT) this.cb.onNext(this.data.level + 1);
    else if (hit === R_HOME) this.cb.onHome();
  }
}

/**
 * THE PAPER. A card with a TORN BOTTOM EDGE, which is the whole joke and costs
 * one path.
 *
 * Drawn as a single filled path rather than a card plus a decorative strip: two
 * shapes would need the same fill, the same shadow offset and the same radius to
 * stay one object, and the day one of the three drifts the receipt grows a seam
 * across it. The shadow is the usual stacked fill — `shadowBlur` is banned under
 * src/render and this file is held to the same rule.
 */
function drawReceiptPaper(ctx: CanvasRenderingContext2D, r: Rect): void {
  const teeth = 14;
  const toothW = r.w / teeth;
  const toothH = 9;

  const path = (c: CanvasRenderingContext2D, dy: number): void => {
    const top = r.y + dy;
    const base = r.y + r.h - toothH + dy;
    c.beginPath();
    c.moveTo(r.x, top + RADIUS.card);
    c.quadraticCurveTo(r.x, top, r.x + RADIUS.card, top);
    c.lineTo(r.x + r.w - RADIUS.card, top);
    c.quadraticCurveTo(r.x + r.w, top, r.x + r.w, top + RADIUS.card);
    c.lineTo(r.x + r.w, base);
    // The teeth run right to left so the path closes back at the left edge.
    for (let i = teeth; i > 0; i--) {
      c.lineTo(r.x + (i - 0.5) * toothW, base + toothH);
      c.lineTo(r.x + (i - 1) * toothW, base);
    }
    c.closePath();
  };

  ctx.save();
  ctx.fillStyle = withAlpha(COLORS.text, 0.12);
  path(ctx, 4);
  ctx.fill();
  ctx.fillStyle = COLORS.surface;
  path(ctx, 0);
  ctx.fill();
  ctx.restore();
}

/**
 * Seconds, as a figure and a unit.
 *
 * The unit is DRAWN INTO the number rather than stored in COPY because "s" is
 * not copy — it is the SI symbol, it is the same in every language this game
 * would ship in, and a COPY key holding one letter is a key nobody maintains.
 */
function formatSeconds(sec: number): string {
  const whole = Math.max(0, Math.round(sec));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * The OS share sheet, falling back to the clipboard. Resolves true when the text
 * actually went somewhere.
 *
 * Both paths are wrapped: `navigator.share` is absent on desktop and throws in a
 * cross-origin iframe without a transient activation — which is exactly where an
 * ad unit lives — and an AbortError from the player dismissing the sheet is a
 * choice, not a failure, so it must not reach the console as one.
 */
async function shareRun(d: DeliveredPayload): Promise<boolean> {
  const text = `${BRAND_COPY.shareText} ${d.totals?.score ?? d.score}`;
  const url = IDENTITY.href;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: IDENTITY.fullTitle, text, url });
      return true;
    } catch {
      return false;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return true;
  } catch {
    // No clipboard permission, or an insecure origin. Nothing left to try, and
    // nothing worth interrupting the player with.
    return false;
  }
}

function copyRect(dst: Rect, src: Rect): void {
  dst.x = src.x;
  dst.y = src.y;
  dst.w = src.w;
  dst.h = src.h;
}
