/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE TWO POWER-UPS — a helmet that absorbs a hit, a scooter that goes fast.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: A POWER-UP THAT LOOKS LIKE A HAZARD. This
 * tower already has a dark round tiffin drum rolling down it, a dark chute head
 * and a dark shaker; every hazard in the game is a dark object with a keyline.
 * Drawn carelessly, a dark helmet shell IS a barrel and a scooter IS whatever is
 * about to hit you — and a player who dodges the thing that would have saved
 * them never learns the mechanic exists, they just lose.
 *
 * So both drawings lean on the ONE cue that is already established as friendly
 * in this game: the agent's own reflective white band (`agentBand`) — see the
 * note in src/render/art/agent.ts, where the same white is the separator that
 * keeps an orange rider legible on an orange girder. Nothing hostile in this
 * build carries it. On top of that:
 *
 *   HELMET  is drawn as the rider's OWN open-face helmet — same shell/stripe/
 *           visor token trio as agent.ts — so the pickup is a picture of the
 *           thing it does. A helmet you recognise off the player character is
 *           read as protective gear without a tutorial line.
 *   TURBO   is a scooter with GREEN chevrons behind it. Green, not orange, and
 *           that is a hard constraint rather than taste: flames are the only
 *           pure-orange MOVING objects on the field by design (`flameBody` is
 *           the brand primary), so an orange flare leaving a moving pickup would
 *           be reading as fire from the one glance the player can spare.
 *           `timerFill` is the brand's positive green and it is the nearest
 *           existing token to a traffic-light GO.
 *
 * ─── HELD ART IS SMALLER THAN PICKUP ART, ALWAYS ────────────────────────────
 *
 * `drawShakerHeldArt` in hazards.ts had to drop from 0.78 to 0.62 because at
 * pickup size the canister covered the rider's helmet and visor. The indicators
 * here start from that lesson rather than rediscovering it: the worn helmet is
 * drawn at 0.5 and is a BADGE beside the head, never an overlay on it — the
 * agent is already wearing a helmet, so drawing a second one over his own would
 * erase the face that tells the player which way he is looking.
 *
 * ─── BAKE COUNTS ───────────────────────────────────────────────────────────
 *
 * Helmet: one, plus the held one reusing the same bake through a transform.
 * Turbo: one for the scooter, and the trail is quantised into TRAIL_STEPS the way
 * the rakhi quantises its shine — a continuous trail would rebuild a dozen paths
 * per frame for an effect that lasts a few seconds.
 */

import { COLORS, withAlpha } from '../../brand';
import { bake, blit } from '../prerender';
import { roundRect } from '../shapes';

/** One keyline weight across both pickups, matching the hazard art's. */
const LINE = 1.6;

// ─── The helmet ─────────────────────────────────────────────────────────────

const HELM_W = 32;
const HELM_H = 30;

/** The pickup, centred at (x, y) in stage units. */
export function drawHelmetArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
): void {
  const canvas = bake('helmet', HELM_W, HELM_H, HELM_W * px, HELM_H * px, paintHelmet);
  blit(ctx, canvas, x - HELM_W / 2, y - HELM_H / 2, HELM_W, HELM_H);
}

/**
 * THE INDICATOR WHILE HELD. Half size, and NOT drawn over the rider's head.
 *
 * The caller places this beside or above the agent's shoulder; see the file
 * header for why an overlay on the head is the wrong answer even though it is
 * the obvious one. Half rather than the shaker's 0.62 because this drawing is
 * wider than the canister and would otherwise reach across the bag — which is
 * cue #1 of the whole character and may not be covered by anything.
 */
export function drawHelmetWornArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
): void {
  const canvas = bake('helmet', HELM_W, HELM_H, HELM_W * px, HELM_H * px, paintHelmet);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.5, 0.5);
  blit(ctx, canvas, -HELM_W / 2, -HELM_H / 2, HELM_W, HELM_H);
  ctx.restore();
}

/**
 * An open-face helmet in three-quarter view: dome, brim, visor lip, one stripe.
 *
 * Same construction and the same tokens as `head()` in agent.ts, at twice the
 * size. Repeated rather than shared because that one is a costume detail sized
 * to a 30×44 figure and this is a pickup — coupling them would mean tuning the
 * pickup silently restyled the rider, which is the same reasoning agent.ts gives
 * for not sharing the mark's pin geometry.
 */
function paintHelmet(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(HELM_W / 2, HELM_H / 2);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // The shell: a dome with a flat base and a short brim forward.
  ctx.beginPath();
  ctx.arc(0, 1, 11, Math.PI, Math.PI * 2);
  ctx.lineTo(11, 5.5);
  ctx.quadraticCurveTo(11, 7.5, 8.5, 7.5);
  ctx.lineTo(-8.5, 7.5);
  ctx.quadraticCurveTo(-11, 7.5, -11, 5.5);
  ctx.closePath();
  ctx.fillStyle = COLORS.agentHelmet;
  ctx.fill();
  ctx.strokeStyle = COLORS.agentOutline;
  ctx.lineWidth = LINE;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 1, 11, Math.PI, Math.PI * 2);
  ctx.lineTo(11, 5.5);
  ctx.lineTo(-11, 5.5);
  ctx.closePath();
  ctx.clip();

  // The brand stripe over the crown. One unit of orange, exactly as on the
  // rider — any more and a dark shell with a wide orange band starts reading as
  // the wild barrel.
  ctx.fillStyle = COLORS.agentHelmetStripe;
  ctx.fillRect(-12, -4.2, 24, 3.2);

  // The open face: a pale wedge where a face would be, which is what makes this
  // an OPEN-face helmet and not a bowling ball. Drawn in the visor's translucent
  // paper so it introduces no colour the palette does not have.
  ctx.fillStyle = COLORS.agentVisor;
  ctx.beginPath();
  ctx.moveTo(2, 0.5);
  ctx.quadraticCurveTo(10.5, 0.5, 10.5, 5.5);
  ctx.lineTo(2, 5.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // The visor lip, forward only — the ledge that gives the shell a front.
  ctx.beginPath();
  roundRect(ctx, 2.5, 2.2, 9, 3.2, 1.6);
  ctx.fillStyle = COLORS.agentBand;
  ctx.fill();
  ctx.strokeStyle = COLORS.agentOutline;
  ctx.lineWidth = 1;
  ctx.stroke();

  // The chin strap, hanging off the near side. It breaks the dome's silhouette,
  // which is the one thing that stops a dark half-circle from reading as the top
  // of a barrel coming over a ledge.
  ctx.strokeStyle = COLORS.agentBand;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-6.5, 7);
  ctx.quadraticCurveTo(-7.5, 11.5, -3.5, 12.5);
  ctx.stroke();
  ctx.strokeStyle = COLORS.agentOutline;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-6.5, 7);
  ctx.quadraticCurveTo(-7.5, 11.5, -3.5, 12.5);
  ctx.stroke();

  ctx.restore();
}

// ─── The turbo scooter ──────────────────────────────────────────────────────

const TURBO_W = 40;
const TURBO_H = 28;

/** The pickup, centred at (x, y) in stage units. */
export function drawTurboArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
): void {
  const canvas = bake('turbo', TURBO_W, TURBO_H, TURBO_W * px, TURBO_H * px, paintTurbo);
  blit(ctx, canvas, x - TURBO_W / 2, y - TURBO_H / 2, TURBO_W, TURBO_H);
}

/**
 * A scooter in profile, facing right, with three green chevrons behind it.
 *
 * The chevrons are what make it a GO sign rather than a vehicle parked on a
 * girder: a scooter alone is just another object, three chevrons stacked behind
 * it are motion. They are green for the reason in the file header, and they sit
 * BEHIND the body so the read is "this thing is already moving" rather than
 * "this thing is on fire".
 */
function paintTurbo(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(TURBO_W / 2, TURBO_H / 2);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // The chevrons, tallest nearest the scooter.
  ctx.strokeStyle = COLORS.powerupGo;
  for (let i = 0; i < 3; i++) {
    const cx = -12 - i * 3.6;
    const h = 6.5 - i * 1.4;
    ctx.lineWidth = 2.6 - i * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - 2.6, -h);
    ctx.lineTo(cx + 1.4, 0);
    ctx.lineTo(cx - 2.6, h);
    ctx.stroke();
  }

  // The deck and the body — dark, keylined, with the rider's white band along
  // the flank so the vehicle belongs to the same set as the agent.
  ctx.beginPath();
  ctx.moveTo(-9, 3);
  ctx.lineTo(-3, 3);
  ctx.lineTo(-1, -2);
  ctx.quadraticCurveTo(0, -5, 3.5, -5);
  ctx.lineTo(9, -5);
  ctx.quadraticCurveTo(12, -5, 12, -2);
  ctx.lineTo(12, 3);
  ctx.lineTo(9, 3);
  ctx.lineTo(4, 5.5);
  ctx.lineTo(-6, 5.5);
  ctx.closePath();
  ctx.fillStyle = COLORS.agentHelmet;
  ctx.fill();
  ctx.strokeStyle = COLORS.agentOutline;
  ctx.lineWidth = LINE;
  ctx.stroke();

  ctx.fillStyle = COLORS.agentBand;
  ctx.beginPath();
  roundRect(ctx, 1.5, -1.5, 9.5, 2.4, 1.2);
  ctx.fill();

  // The handlebar and the front apron — the two lines that make a profile blob
  // into a scooter.
  ctx.strokeStyle = COLORS.agentOutline;
  ctx.lineWidth = LINE;
  ctx.beginPath();
  ctx.moveTo(9.5, -5);
  ctx.lineTo(11, -10.5);
  ctx.lineTo(15, -10.5);
  ctx.stroke();

  // The headlamp. Paper, small, and the only bright point forward — it is what
  // gives the whole drawing a direction of travel.
  ctx.beginPath();
  ctx.arc(13, -6.5, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.agentBand;
  ctx.fill();
  ctx.strokeStyle = COLORS.agentOutline;
  ctx.lineWidth = 1;
  ctx.stroke();

  wheel(ctx, -5.5, 7.5);
  wheel(ctx, 10, 7.5);

  ctx.restore();
}

function wheel(ctx: CanvasRenderingContext2D, wx: number, wy: number): void {
  ctx.beginPath();
  ctx.arc(wx, wy, 4.6, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.agentHelmet;
  ctx.fill();
  ctx.strokeStyle = COLORS.agentOutline;
  ctx.lineWidth = LINE;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(wx, wy, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.agentBand;
  ctx.fill();
}

// ─── The turbo trail ────────────────────────────────────────────────────────

/** Distinct trail drawings. Quantised for the reason `rakhiShine` is. */
const TRAIL_STEPS = 4;
const TRAIL_W = 34;
const TRAIL_H = 24;

/**
 * A short speed trail, drawn BEHIND the boosted agent by the caller.
 *
 * `phase` is any integer; it is wrapped into TRAIL_STEPS, so the caller can pass
 * `Math.floor(simTime * 12)` without knowing how many drawings exist. Three
 * streaks whose lengths cycle: the eye reads changing length as speed, and it
 * costs four bakes rather than one per frame.
 */
export function drawTurboTrailArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  phase: number,
): void {
  const s = ((Math.floor(phase) % TRAIL_STEPS) + TRAIL_STEPS) % TRAIL_STEPS;
  const canvas = bake(`turboTrail:${s}`, TRAIL_W, TRAIL_H, TRAIL_W * px, TRAIL_H * px, (c) =>
    paintTrail(c, s),
  );
  blit(ctx, canvas, x - TRAIL_W / 2, y - TRAIL_H / 2, TRAIL_W, TRAIL_H);
}

function paintTrail(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.save();
  ctx.translate(TRAIL_W / 2, TRAIL_H / 2);
  ctx.lineCap = 'round';

  // Green over white: the green says GO, the white is the agent's own band and
  // is what keeps the streak visible when it crosses an orange girder.
  for (let i = 0; i < 3; i++) {
    const ty = -6 + i * 6;
    // The cycle: each streak grows and shrinks on its own offset, so the group
    // never pulses in unison — which reads as a blink rather than as motion.
    const grow = ((s + i) % TRAIL_STEPS) / (TRAIL_STEPS - 1);
    const len = 8 + grow * 8;
    ctx.strokeStyle = withAlpha(COLORS.agentBand, 0.5);
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(2, ty);
    ctx.lineTo(2 - len, ty);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(COLORS.powerupGo, 0.85);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(2, ty);
    ctx.lineTo(2 - len, ty);
    ctx.stroke();
  }

  ctx.restore();
}
