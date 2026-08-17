/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE BARREL — a tiffin drum, in slate, that visibly ROLLS.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): THE SLIDING DISC. A hazard drawn as a
 * rotationally symmetric circle does not rotate no matter how fast it moves —
 * it slides, and a sliding hazard reads as a bug in the physics rather than as
 * a thing rolling downhill at you. The four phases below exist so that the
 * barrel's own artwork disagrees with itself frame to frame, which is the only
 * cue the eye needs.
 *
 * THE FAILURE THIS FILE PREVENTS (2): THE RED BARREL. Red is the intuitive
 * colour for "the thing that kills you" and it is the wrong one here, because
 * this game's girders are saturated orange — see the note on `barrelBody` in
 * the derivation. The normal barrel is SLATE. `barrelWildBody` is the alarm
 * red and it is spent on the one barrel that has earned it.
 *
 * ─── THE ROTATION IS A FUNCTION OF POSITION, NOT A COUNTER ─────────────────
 *
 * `barrelPhase` derives the roll angle from the body's x. Rolling without
 * slipping means angle = distance / radius, so position IS the rotation; there
 * is no spin field to add to the sim, no state to reset on respawn, and a
 * barrel that reverses direction on the next floor reverses its roll for free.
 * A per-barrel accumulator would need all three of those and would drift out of
 * step with the render lerp.
 */

import { COLORS } from '../../brand';
import { BARREL } from '../../config/tuning';
import { bake, blit } from '../prerender';
import { roundRect } from '../shapes';

/** Phases around a full turn. Four is where the roll stops flickering and starts turning. */
const PHASES = 4;

/** Half the baked cell. The keyline and the lid lip both live outside `r`. */
const HALF = BARREL.r + 3;
const BOX = HALF * 2;

/**
 * Which of the four drawings this barrel is showing.
 *
 * Uses the SIM position, not the interpolated one: the phase must not jitter
 * back and forth as the lerp alpha walks, and one whole phase is ~6 units of
 * travel so the difference is invisible.
 */
export function barrelPhase(x: number): number {
  const turns = x / (Math.PI * 2 * BARREL.r);
  const p = Math.floor(turns * PHASES) % PHASES;
  return p < 0 ? p + PHASES : p;
}

/** Draw a barrel centred at (x, y) in stage units. */
export function drawBarrelArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  phase: number,
  wild: boolean,
): void {
  const kind = wild ? 'wild' : 'normal';
  const canvas = bake(`barrel:${kind}:${phase}`, BOX, BOX, BOX * px, BOX * px, (c) =>
    paint(c, phase, wild),
  );
  blit(ctx, canvas, x - HALF, y - HALF, BOX, BOX);
}

function paint(ctx: CanvasRenderingContext2D, phase: number, wild: boolean): void {
  const r = BARREL.r;
  const body = wild ? COLORS.barrelWildBody : COLORS.barrelBody;

  ctx.save();
  ctx.translate(HALF, HALF);

  // The drum, keylined. `barrelOutline` is ink: against an orange girder a slate
  // barrel would otherwise share an edge with its own shadow.
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  // Everything that turns is inside the drum's clip, so no detail ever escapes
  // the silhouette and the barrel stays exactly BARREL.r wide however it spins.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();

  // A single shade step down the lower-right. Flat, one step, no gradient — a
  // gradient here would have to be rebuilt per phase for a difference nobody
  // sees on a 30-unit object.
  // Kept to a BOTTOM CRESCENT, not a half. Swept from -0.35 to 0.9π it covered
  // most of the disc, and everything drawn on top of it — the cap, the rim, the
  // clasp — lost most of its value separation to a translucent black wash. A
  // shade step is supposed to describe a light direction, not tint the object.
  ctx.beginPath();
  ctx.arc(0, 0, r, 0.5, Math.PI - 0.5);
  ctx.closePath();
  // The same shade for both kinds, at low alpha: it darkens whatever body is
  // under it, so the wild barrel keeps its red instead of turning slate.
  ctx.fillStyle = COLORS.barrelBodyShade;
  ctx.globalAlpha = 0.4;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.rotate((phase / PHASES) * Math.PI * 2);

  // ─── TWO FEATURES, NOT FIVE ───────────────────────────────────────────────
  //
  // The first version of this drawing had a lid ellipse AND two hoop bands, and
  // at 30 units they resolved into three parallel grey stripes of similar
  // value: a barcode, unreadable, and worst of all rotationally ambiguous.
  // What makes a roll legible is ONE large asymmetric light mass plus ONE dark
  // rib — a shape with a definite "up" — so that is all there is now.

  // THE LID CAP: the chord region above -0.34r. Big enough to be the thing the
  // eye tracks around the rim.
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI + 0.35, -0.35);
  ctx.closePath();
  ctx.fillStyle = COLORS.barrelLid;
  ctx.fill();

  // THE RIM, IN `barrelBand`, AND THE ORDER OF THESE TWO TOKENS BY VALUE IS THE
  // WHOLE REASON THIS READS.
  //
  // `barrelLid` is the body lightened a quarter of the way to paper; `barrelBand`
  // is the palette's mid grey and is LIGHTER still. Painting the cap in the lid
  // colour alone put two slates within a few points of each other side by side,
  // and the barrel resolved into a featureless dark disc at phone size. The band
  // arc is the bright note that separates them, and it rides the cap's outer
  // edge so it also traces which way the drum is facing.
  //
  // Set INBOARD of the keyline's own band. At r-2 with a 3.2 stroke it sat
  // under the 2-unit ink ring drawn at r-1 and only a sliver survived — a
  // highlight painted underneath the outline is a highlight that does not
  // exist, and it looks exactly like having drawn nothing.
  ctx.beginPath();
  ctx.arc(0, 0, r - 4.6, Math.PI + 0.45, -0.45);
  ctx.strokeStyle = COLORS.barrelBand;
  ctx.lineWidth = 3.6;
  ctx.stroke();

  // The chord itself, keylined, so the cap has a hard edge rather than fading
  // into the body at the two points where it meets it.
  ctx.beginPath();
  ctx.moveTo(-r * 0.94, -r * 0.34);
  ctx.lineTo(r * 0.94, -r * 0.34);
  ctx.strokeStyle = COLORS.barrelOutline;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // The clasp — DARK on the light cap. Off-centre on purpose: a centred clasp is
  // symmetric, and a symmetric detail tells you nothing about which way the drum
  // turned.
  ctx.fillStyle = COLORS.barrelBodyShade;
  ctx.beginPath();
  roundRect(ctx, r * 0.14, -r * 0.9, 3.6, 5, 1.4);
  ctx.fill();

  // ONE rib across the belly, dark, well clear of the cap.
  ctx.fillStyle = COLORS.barrelBodyShade;
  ctx.beginPath();
  roundRect(ctx, -r, r * 0.3, r * 2, 3.4, 1.4);
  ctx.fill();

  ctx.restore();

  // The keyline goes on LAST and OUTSIDE the clip, so it is a full-strength
  // 2-unit ring rather than a half-width one clipped by its own path.
  ctx.beginPath();
  ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.barrelOutline;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}
