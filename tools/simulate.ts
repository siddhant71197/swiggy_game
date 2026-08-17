/**
 * ══════════════════════════════════════════════════════════════════════════
 *  SIMULATE — the real engine, played by a bot, with no browser in the room.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: SHIPPING A DIFFICULTY CURVE NOBODY MEASURED.
 * "Level 1 must be clearable first-try by a casual player" is a hard design
 * requirement, and the only honest way to hold a build to it is to have
 * something play the level and report. A human playtest measures the human as
 * much as the level, takes an afternoon, and cannot be re-run on every commit.
 * This takes half a second and re-runs on every commit.
 *
 * It imports the REAL src/game/world.ts. Not a copy, not a model — the same
 * step() the phone runs. That is only possible because nothing under src/game/
 * touches the DOM, a wall clock, or unseeded randomness, and it is the entire
 * reason those rules exist. If this file ever stops running, the cause is
 * something that was added to the sim, not something that broke here.
 *
 * It must never import src/render/, src/scenes/ or src/ui/.
 *
 * Usage:  node --experimental-strip-types tools/simulate.ts [level] [runs]
 */

import { register } from 'node:module';

// The hook must be installed BEFORE any src/ module is loaded, which is why
// every game import below is dynamic. See tools/ts-resolve.mjs.
register(new URL('./ts-resolve.mjs', import.meta.url));

const { createWorld, step } = await import('../src/game/world.ts');
const { drain } = await import('../src/core/events.ts');
const { CLIMB, PHYS, BARREL } = await import('../src/config/tuning.ts');
const { LEVELS } = await import('../src/config/levels.ts');

type World = ReturnType<typeof createWorld>;

/** The sim's fixed step. Never a real frame time — this is not a real frame. */
const DT = 1 / 60;
/** Give up on a run rather than spinning forever if the bot gets stuck. */
const MAX_SECONDS = 240;

/**
 * The DESIGN target clear time per level, in seconds — what a competent human is
 * expected to take, not what the bot takes.
 *
 * It is here and not in config/levels.ts on purpose: it is a claim ABOUT a level
 * rather than a property OF one, nothing in the shipping game reads it, and a
 * number the sim could read is a number someone would eventually balance against
 * instead of measuring. Levels 1–2 predate the target table and are inferred
 * from their timers.
 */
const TARGET_SEC = [24, 26, 32, 36, 42, 40, 46, 50, 40, 62] as const;

// ─── The bot ────────────────────────────────────────────────────────────────
//
// Deliberately a MEDIOCRE player, not an optimal one. It walks to things, climbs
// what is in front of it, and jumps when a barrel is close — the same three
// verbs a first-time player has. An optimal bot would clear level 1 with a
// frame-perfect route and prove nothing about whether a human can.

interface Objective {
  x: number;
  /** What to press once we arrive. */
  act: 'up' | 'none';
  /** The rail this objective is, when `act` is 'up'. Else -1. */
  ladderId: number;
}

/**
 * The bot's own floor, as an infinite LINE rather than a segment.
 *
 * A girder is a line segment and `surfaceYAt` correctly answers NaN off the end
 * of one — which is exactly right for the sim and exactly wrong for the bot's
 * "is that on my floor?" question, because on the split-floor layouts the other
 * half of the same floor is a DIFFERENT segment on the SAME line. Extending the
 * line is safe here for the one reason the whole tower is built around: adjacent
 * floors are never closer than 78 units, so two floors' lines cannot be confused
 * at any x.
 */
function lineY(g: { y0: number; slope: number; x0: number }, x: number): number {
  return g.y0 + g.slope * (x - g.x0);
}

/** The authored floor the bot is standing on, or null while riding a lift car. */
function floorOf(w: World): { y0: number; slope: number; x0: number; x1: number } | null {
  const b = w.agent.body;
  const authored = w.stage.liftBase >= 0 ? w.stage.liftBase : w.stage.girders.length;
  if (b.segId >= 0 && b.segId < authored) return w.stage.girders[b.segId]!;

  // AIRBORNE, OR ABOARD A CAR: the floor UNDER the bot, not the one nearest it.
  //
  // This is the difference between the bot clearing a 48-unit gap and never
  // clearing one. Mid-jump `segId` is -1, so without a fallback the bot has no
  // objective, `dir` goes to 0, and `airSteer` bleeds its 150-unit horizontal
  // speed away at 1320 units/sec² — it stops in mid-air over the gap and drops
  // straight into it, every single time. The symptom is a bot that climbs to the
  // cut floor, falls, climbs again, forever; the cause is four frames of missing
  // intent.
  let best: (typeof w.stage.girders)[number] | null = null;
  let bestD = 110;
  for (let i = 0; i < authored; i++) {
    const g = w.stage.girders[i]!;
    // THE LINE, not the segment — and this is the half of the fix that matters.
    // Mid-gap there is no segment under the bot AT ALL, so a `surfaceYAt` lookup
    // answers NaN for every candidate and hands back exactly the same "no
    // objective, no dir" state, one frame later and over the middle of the hole.
    const d = lineY(g, b.x) - (b.y - 8);
    // At or below the feet only — the floor above is not the one being aimed at.
    if (d >= 0 && d <= bestD) {
      bestD = d;
      best = g;
    }
  }
  return best;
}

function objectiveFor(w: World): Objective | null {
  const b = w.agent.body;

  // On a rail: keep going. The climb has exactly one direction that helps.
  if (w.agent.state === 'climb') return null;

  const g = floorOf(w);
  if (!g) return null;

  // 1. An uncollected rakhi on THIS floor.
  const rakhis = w.params.def.rakhis;
  for (let i = 0; i < rakhis.length; i++) {
    if (w.session.rakhiTaken[i]) continue;
    const p = rakhis[i]!;
    if (Math.abs(lineY(g, p.x) - p.y) > 40) continue;
    return { x: p.x, act: 'none', ladderId: -1 };
  }

  // 1a. AN UNCOLLECTED DISH ON THIS FLOOR, AND UNCONDITIONALLY.
  //
  //     No proximity guard, unlike the shaker below. The order is a GATE
  //     condition: a bot that walked past a dish because it was 160 units the
  //     wrong way would climb to the top, find the gated ladder shut, have no
  //     objective left that leads anywhere, and burn the clock until MAX_SECONDS.
  //     That reports as a level the bot could not clear, which is a false failure
  //     and — worse — a false failure that looks exactly like a hard level. Every
  //     required pickup the bot can see, it goes and gets.
  const foods = w.params.def.foods;
  for (let i = 0; i < foods.length; i++) {
    if (w.session.foodTaken[i]) continue;
    const p = foods[i]!;
    if (Math.abs(lineY(g, p.x) - p.y) > 40) continue;
    return { x: p.x, act: 'none', ladderId: -1 };
  }

  // 1b. An unpushed order pin on this floor. The door refuses the delivery until
  //     every pin is down, so a bot that ignored them would measure a level it
  //     is not allowed to finish.
  for (const pin of w.hazards.pins) {
    if (pin.taken) continue;
    if (Math.abs(lineY(g, pin.x) - pin.y) > 40) continue;
    return { x: pin.x, act: 'none', ladderId: -1 };
  }

  // 1c. A shaker on this floor, but only while it is genuinely on the way. The
  //     bot is a mediocre player, not a min-maxer: it picks up what it walks
  //     past, it does not plan powerup windows.
  //     The helmet and the turbo get the SAME guard and the same reasoning. All
  //     three are optional, so a detour for one is a choice a mediocre player does
  //     not make — and measuring the levels against a bot that hoovered up every
  //     powerup on the map would report a difficulty curve no human plays.
  for (const s of [...w.hazards.shakers, ...w.hazards.helmets, ...w.hazards.turbos]) {
    if (s.taken) continue;
    if (Math.abs(lineY(g, s.x) - s.y) > 40) continue;
    if (Math.abs(s.x - b.x) > 150) continue;
    return { x: s.x, act: 'none', ladderId: -1 };
  }

  // 2. The delivery, once the gate is open and we are on the customer's floor.
  const cust = w.params.def.customerAt;
  if (w.session.gateOpen && Math.abs(lineY(g, cust.x) - cust.y) < 40) {
    return { x: cust.x, act: 'none', ladderId: -1 };
  }

  // 3. The ladder up from this floor. The gated one is skipped until it opens,
  //    which is the bot exercising the same single condition the player does.
  for (const l of w.stage.ladders) {
    if (l.gated && !w.session.gateOpen) continue;
    if (Math.abs(lineY(g, l.x) - l.yBottom) > CLIMB.dismountY) continue;
    return { x: l.x, act: 'up', ladderId: l.id };
  }

  return null;
}

function botIntent(w: World): { dir: -1 | 0 | 1; up: boolean; down: boolean; jump: boolean } {
  if (w.agent.state === 'climb') {
    return { dir: 0, up: true, down: false, jump: false };
  }

  const b = w.agent.body;
  const obj = objectiveFor(w);

  let dir: -1 | 0 | 1 = 0;
  let up = false;

  if (obj) {
    const dx = obj.x - b.x;
    if (Math.abs(dx) > 3) dir = dx > 0 ? 1 : -1;
    else if (obj.act === 'up') up = true;
  }

  // ── LOOK BEFORE YOU CLIMB ────────────────────────────────────────────────
  //
  // The rail is the ONLY place in this game with no dodge: no jump, no turn,
  // 96 units a second for a second and a half. Every human learns within two
  // deaths to wait at the foot of a ladder until the rail is clear, and a bot
  // that mounted blindly would attribute those deaths to barrel speed when they
  // are actually the cost of a mistake no player makes twice — which is exactly
  // the wrong conclusion for a difficulty pass to draw.
  if (up && obj && obj.ladderId >= 0) {
    const l = w.stage.ladders[obj.ladderId]!;
    let clear = true;
    w.barrels.pool.forEach((bar) => {
      if (!clear || !bar.live) return;
      const bb = bar.body;
      if (Math.abs(bb.x - l.x) > 30) return;
      if (bb.y < l.yTop - 24 || bb.y > l.yBottom + 24) return;
      clear = false;
    });
    for (const f of w.hazards.flames) {
      if (!f.live) continue;
      if (Math.abs(f.body.x - l.x) > 34) continue;
      if (f.body.y < l.yTop - 24 || f.body.y > l.yBottom + 24) continue;
      clear = false;
    }
    if (!clear) {
      up = false;
      // Step back off the rail's foot rather than standing on it: waiting ON the
      // ladder's x is waiting exactly where the descending barrel lands.
      dir = l.x > b.x ? -1 : 1;
    }
  }

  // Dodging. Two situations, and they call for OPPOSITE verbs.
  //
  // Head-on, a barrel closes at up to 350 units a second and the only answer is
  // the jump. Caught from behind — the player walking downhill faster than the
  // barrel rolling downhill — the answer is to STOP, because the barrel is
  // leaving on its own and the gap only closes because the player keeps pushing
  // into it. Jumping there is the classic beginner death: you clear the barrel,
  // land in front of it, and it rolls into your back. A bot that jumped in both
  // cases would measure the game as far harder than a human finds it, from a
  // fifth floor of the tower onward, on every level with a leftward sweep.
  let jump = false;
  let hold = false;
  if (w.agent.state === 'run') {
    w.barrels.pool.forEach((bar) => {
      if (!bar.live) return;
      const bb = bar.body;
      if (Math.abs(bb.y - b.y) > 30) return;
      const gap = bb.x - b.x;
      const towardUs = Math.sign(bb.vx) !== 0 && Math.sign(bb.vx) === -Math.sign(gap);
      const ahead = dir !== 0 && Math.sign(gap) === dir;
      const d = Math.abs(gap);
      // And a THIRD, which only exists from level 7: a barrel rolling the same
      // way you are, from behind, FASTER than you can run. Levels 1–6 keep
      // barrels under runSpeed precisely so this case cannot arise; from level 7
      // it is the signature death, and stopping — the right answer to a barrel
      // you are outrunning — is the wrong one here.
      const behind = dir !== 0 && Math.sign(gap) === -dir;
      const chasing = behind && Math.sign(bb.vx) === dir && Math.abs(bb.vx) > PHYS.runSpeed;
      if (towardUs && d > 26 && d < 74) jump = true;
      else if (chasing && d > 22 && d < 70) jump = true;
      else if (ahead && d < 52) hold = true;
    });

    // Flames are 30 units tall against a 65-unit apex, so a player jumps them
    // exactly as they jump a barrel. The bot does the same — modelling the
    // flame as unjumpable would measure a hazard the game does not have.
    for (const f of w.hazards.flames) {
      if (jump || !f.live) continue;
      if (Math.abs(f.body.y - b.y) > 30) continue;
      const d = Math.abs(f.body.x - b.x);
      if (d > 24 && d < 60) jump = true;
    }

    // Scooters get the same two windows. A mediocre player treats anything
    // rolling at them as a barrel, and measuring the level against that
    // assumption is the honest test of whether the scooter reads differently.
    w.hazards.scooters.forEach((sc) => {
      if (jump || !sc.live) return;
      const sb = sc.body;
      if (Math.abs(sb.y - b.y) > 34) return;
      const d = Math.abs(sb.x - b.x);
      if (d > 24 && d < 70) jump = true;
    });
  }

  // ── The gap ──────────────────────────────────────────────────────────────
  // On a cut floor the objective is on the far piece. Jump only from ACTUALLY
  // near the lip: an early jump on a 48-unit gap lands in it, and the whole
  // point of a 70-unit reach against a 48-unit gap is that the margin is for
  // the player's timing rather than for the bot's.
  const seg = w.stage.girders[b.segId];
  if (w.agent.state === 'run' && obj && seg) {
    if (dir > 0 && !seg.solidRight && obj.x > seg.x1 && seg.x1 - b.x < 14) jump = true;
    if (dir < 0 && !seg.solidLeft && obj.x < seg.x0 && b.x - seg.x0 < 14) jump = true;
  }

  // ── The lane ─────────────────────────────────────────────────────────────
  // A falling tiffin is the one hazard with a telegraph long enough that even a
  // mediocre player steps out of the lane, so the bot does too — anything less
  // would measure a hazard nobody plays that way.
  let laneDodge = false;
  w.hazards.tiffins.forEach((t) => {
    if (!t.live) return;
    const tb = t.body;
    const dx = tb.x - b.x;
    if (Math.abs(dx) > 30) return;
    if (tb.y > b.y || tb.y < b.y - 260) return;
    dir = dx > 0 ? -1 : 1;
    laneDodge = true;
  });

  // The hold is applied LAST and loses to the lane dodge: standing still to let
  // a barrel roll away is only correct if nothing is falling on your head.
  if (hold && !jump && !laneDodge) dir = 0;

  return { dir, up, down: false, jump };
}

// ─── One run ────────────────────────────────────────────────────────────────

interface Result {
  level: number;
  cleared: boolean;
  failed: boolean;
  seconds: number;
  deaths: number;
  rakhis: number;
  rakhiTotal: number;
  foods: number;
  foodTotal: number;
  score: number;
  timeLeft: number;
  peakBarrels: number;
  jumps: number;
  hits: number;
  /** Deaths attributed to each hazard family. See `blame`. */
  causes: Record<string, number>;
}

/**
 * WHAT KILLED THE BOT, by proximity at the moment of the hit.
 *
 * Not emitted by the sim, and it must not be: the sim's job is to say a life was
 * lost, not to editorialise about why, and an event carrying a cause would be a
 * field that exists only for this file. Attribution by nearest live hazard is
 * approximate and completely sufficient for the question it answers, which is
 * "is level 4 a barrel level or a flame level?" — a question a difficulty pass
 * cannot proceed without and that the clear rate alone never answers.
 */
function blame(w: World): string {
  const b = w.agent.body;
  let best = 'barrel';
  let bestD = Number.POSITIVE_INFINITY;
  const test = (x: number, y: number, what: string): void => {
    const dx = x - b.x;
    const dy = y - b.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = what;
    }
  };
  w.barrels.pool.forEach((bar) => {
    if (bar.live) test(bar.body.x, bar.body.y, 'barrel');
  });
  for (const f of w.hazards.flames) if (f.live) test(f.body.x, f.body.y, 'flame');
  w.hazards.tiffins.forEach((t) => {
    if (t.live) test(t.body.x, t.body.y, 'tiffin');
  });
  w.hazards.scooters.forEach((sc) => {
    if (sc.live) test(sc.body.x, sc.body.y, 'scooter');
  });
  return bestD < 60 * 60 ? best : 'fall';
}

function playOnce(level: number, seed?: number): Result {
  const w = seed === undefined ? createWorld(level) : createWorld(level, { seed });

  let peakBarrels = 0;
  let jumps = 0;
  let hits = 0;
  let heldJump = false;
  let t = 0;
  const causes: Record<string, number> = {};

  let prevState = w.agent.state;
  while (!w.done && t < MAX_SECONDS) {
    prevState = w.agent.state;
    const want = botIntent(w);
    // The bot must release the button between jumps: jump is a PRESS EDGE in
    // src/game/agent.ts, and a bot that holds it would silently test a game
    // rule that does not exist.
    const jump = want.jump && !heldJump;
    heldJump = want.jump;

    step(w, { dir: want.dir, up: want.up, down: want.down, jump }, DT);
    t += DT;

    if (w.barrels.pool.activeCount > peakBarrels) peakBarrels = w.barrels.pool.activeCount;
    drain((e) => {
      if (e.type === 'BarrelJumped') jumps++;
      else if (e.type === 'AgentHit') {
        hits++;
        // A death taken ON A RAIL is a different design fact from a death taken
        // on a deck: the climb is the one place the player has no dodge, so a
        // level whose deaths are mostly on ladders is a level whose
        // `barrelLadderChance` is doing the killing, not its barrel speed.
        const c = `${blame(w)}${prevState === 'climb' ? '@ladder' : ''}`;
        causes[c] = (causes[c] ?? 0) + 1;
      }
    });
  }

  return {
    level,
    cleared: w.session.cleared,
    failed: w.session.failed,
    seconds: t,
    deaths: w.session.deaths,
    rakhis: w.session.rakhiCount,
    rakhiTotal: w.session.rakhiTotal,
    foods: w.session.foodCount,
    foodTotal: w.session.foodTotal,
    score: w.session.score,
    timeLeft: Math.max(w.session.timeLeft, 0),
    peakBarrels,
    jumps,
    hits,
    causes,
  };
}

/** Trace a few seconds of positions, so a stuck bot is diagnosable, not mysterious. */
function trace(level: number): void {
  const w = createWorld(level);
  let heldJump = false;
  console.log('  t     x       y       state   seg  barrels  rakhis  order');
  for (let i = 0; i < 60 * 12; i++) {
    if (w.done) break;
    const want = botIntent(w);
    const jump = want.jump && !heldJump;
    heldJump = want.jump;
    step(w, { dir: want.dir, up: want.up, down: want.down, jump }, DT);
    drain(() => {});
    if (i % 60 === 0) {
      const b = w.agent.body;
      console.log(
        `  ${(i / 60).toFixed(0).padStart(3)}   ${b.x.toFixed(1).padStart(6)}  ${b.y
          .toFixed(1)
          .padStart(6)}  ${w.agent.state.padEnd(7)} ${String(b.segId).padStart(3)}  ${String(
          w.barrels.pool.activeCount,
        ).padStart(7)}  ${w.session.rakhiCount}/${w.session.rakhiTotal}     ${
          w.session.foodCount
        }/${w.session.foodTotal}`,
      );
    }
  }
}

// ─── One level, many runs ───────────────────────────────────────────────────

interface LevelReport {
  level: number;
  runs: number;
  clears: number;
  /** Mean seconds over CLEARED runs only — a failed run's clock means nothing. */
  meanClearSec: number;
  deathsPerRun: number;
  peakBarrels: number;
  rakhiFrac: number;
  /**
   * Fraction of the ORDER collected, reported separately from the rakhis.
   *
   * Two columns rather than one combined sweep number, because they fail for
   * different reasons: a short rakhi count means the bot could not survive a
   * floor, a short food count on a level it CLEARED would be impossible (the gate
   * counts both), so anything under 100% here on a cleared run is a bug in this
   * file rather than a fact about the level. It is a cheap invariant to watch.
   */
  foodFrac: number;
  causes: Record<string, number>;
}

function playLevel(level: number, runs: number, verbose: boolean): LevelReport {
  let clears = 0;
  let totalDeaths = 0;
  let clearSec = 0;
  let peak = 0;
  let rakhis = 0;
  let rakhiTotal = 0;
  let foods = 0;
  let foodTotal = 0;
  const causes: Record<string, number> = {};

  for (let i = 0; i < runs; i++) {
    // Seed 0 is the shipping seed for this level; the rest vary the barrel
    // jitter so one lucky pattern cannot pass for a clearable level.
    const r = i === 0 ? playOnce(level) : playOnce(level, 1000 + i);
    if (r.cleared) {
      clears++;
      clearSec += r.seconds;
    }
    totalDeaths += r.deaths;
    if (r.peakBarrels > peak) peak = r.peakBarrels;
    rakhis += r.rakhis;
    rakhiTotal += r.rakhiTotal;
    foods += r.foods;
    foodTotal += r.foodTotal;
    for (const [k, v] of Object.entries(r.causes)) causes[k] = (causes[k] ?? 0) + v;

    if (verbose) {
      console.log(
        `  run ${String(i + 1).padStart(2)}  ${r.cleared ? 'CLEAR' : r.failed ? 'FAIL ' : 'STUCK'}` +
          `  ${r.seconds.toFixed(1).padStart(6)}s` +
          `  deaths ${r.deaths}` +
          `  rakhis ${r.rakhis}/${r.rakhiTotal}` +
          `  order ${r.foods}/${r.foodTotal}` +
          `  peak barrels ${r.peakBarrels}` +
          `  jumped ${r.jumps}` +
          `  hits ${r.hits}` +
          `  score ${r.score}` +
          `  time left ${r.timeLeft.toFixed(1)}s`,
      );
    }
  }

  return {
    level,
    runs,
    clears,
    meanClearSec: clears > 0 ? clearSec / clears : Number.NaN,
    deathsPerRun: totalDeaths / runs,
    peakBarrels: peak,
    rakhiFrac: rakhiTotal > 0 ? rakhis / rakhiTotal : 0,
    foodFrac: foodTotal > 0 ? foods / foodTotal : 0,
    causes,
  };
}

// ─── Entry ──────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const single = argv[0] !== undefined && argv[0] !== 'all';
const runs = Number(argv[1] ?? (single ? 5 : 8)) || (single ? 5 : 8);

console.log('');
console.log('══ SIM ════════════════════════════════════════════════════════════');
console.log(`  levels in build : ${LEVELS.length}`);
console.log(`  fixed step      : ${(DT * 1000).toFixed(2)} ms`);
console.log(`  run speed ${PHYS.runSpeed}  jump apex ${((PHYS.jumpV * PHYS.jumpV) / (2 * PHYS.gravity)).toFixed(1)}  climb ${CLIMB.speed}  barrel r ${BARREL.r}`);
console.log('');

let level1Clean = true;

if (single) {
  const level = Number(argv[0]) || 1;
  console.log(`── LEVEL ${level} — first-frame trace ─────────────────────────────`);
  trace(level);
  console.log('');
  console.log(`── LEVEL ${level} — ${runs} runs ──────────────────────────────────`);
  const rep = playLevel(level, runs, true);
  console.log('');
  console.log(`  cleared ${rep.clears}/${runs}   deaths/run ${rep.deathsPerRun.toFixed(2)}`);
  if (level === 1) level1Clean = rep.clears === runs;
} else {
  // ─── THE TABLE THIS TOOL EXISTS FOR ───────────────────────────────────
  //
  // Clear rate and clear time against the DESIGN TARGET, every level, every
  // build. The bot is deliberately mediocre, so a hard late level it cannot
  // clear is a MEASUREMENT, not automatically a bug — what would be a bug is a
  // late level it clears as easily as level 1, or an early level it cannot.
  //
  // Read the `vs target` column as the bot's route efficiency, not as a
  // playtime estimate: the bot never hesitates, never reads a telegraph and
  // never plans, so it walks the route faster than a human and dies more.
  console.log(`── ALL ${LEVELS.length} LEVELS — ${runs} runs each ────────────────────────`);
  console.log('');
  console.log('   lvl  clear    time     target   vs target   deaths/run  peak  rakhi  order');
  console.log('   ───  ─────    ──────   ──────   ─────────   ──────────  ────  ─────  ─────');

  const reports: LevelReport[] = [];
  for (let l = 1; l <= LEVELS.length; l++) reports.push(playLevel(l, runs, false));

  for (const r of reports) {
    const target = TARGET_SEC[r.level - 1] ?? 0;
    const time = Number.isNaN(r.meanClearSec) ? '     —' : `${r.meanClearSec.toFixed(1).padStart(5)}s`;
    const vs = Number.isNaN(r.meanClearSec)
      ? '        —'
      : `${((r.meanClearSec / target) * 100).toFixed(0).padStart(7)}%`;
    console.log(
      `   ${String(r.level).padStart(3)}  ${String(r.clears).padStart(2)}/${r.runs}   ` +
        `${time}   ${String(target).padStart(4)}s    ${vs}   ` +
        `${r.deathsPerRun.toFixed(2).padStart(10)}  ${String(r.peakBarrels).padStart(4)}  ` +
        `${(r.rakhiFrac * 100).toFixed(0).padStart(4)}%  ` +
        `${(r.foodFrac * 100).toFixed(0).padStart(4)}%`,
    );
  }

  console.log('');
  console.log('   deaths by cause');
  for (const r of reports) {
    const parts = Object.entries(r.causes)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`);
    console.log(`   ${String(r.level).padStart(3)}  ${parts.length ? parts.join('  ') : '—'}`);
  }

  const l1 = reports[0];
  level1Clean = l1 !== undefined && l1.clears === l1.runs;
}

console.log('═══════════════════════════════════════════════════════════════════');
console.log('');

// A level 1 that the mediocre bot cannot clear is a level 1 that a casual player
// cannot clear. That is the hard design requirement, so it is an exit code.
if (!level1Clean) process.exitCode = 1;
