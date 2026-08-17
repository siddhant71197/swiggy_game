/**
 * ══════════════════════════════════════════════════════════════════════════
 *  VALIDATE-LEVELS — the build fails before the player finds it.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: THE UNWINNABLE LEVEL, FOUND BY A PLAYER.
 *
 * Every level in this game gates its exit on a full sweep of the rakhis. That
 * single rule has one catastrophic failure mode and it is invisible in every
 * screenshot, every code review and every playtest that happens to go well: put
 * ONE rakhi behind the gated ladder and the level cannot be finished, because
 * the gate needs the rakhi and the rakhi needs the gate. The author does not see
 * it — they placed it while thinking about the barrel lanes. The reviewer does
 * not see it — the diff is four numbers. The tester does not see it unless they
 * happen to be the one who leaves that rakhi for last.
 *
 * A player sees it. On level 8, ninety seconds in, with three lives spent.
 *
 * So the geometry is CHECKED, mechanically, against a nav graph built from the
 * same girder and ladder tables the sim runs on — not against a description of
 * them. The graph knows what the player knows: ladders connect floors, lifts
 * connect floors, and a gap narrower than the jump reach is a gap you can cross.
 *
 * EVERY FAILURE IS REPORTED, ALWAYS. Never first-failure-only. A validator you
 * have to run eleven times to see eleven problems is a validator people start
 * running once and then stop running at all — see tools/gate.mjs, which learned
 * the same lesson.
 *
 * Usage:  node --experimental-strip-types tools/validate-levels.ts
 */

import { register } from 'node:module';

register(new URL('./ts-resolve.mjs', import.meta.url));

const { LEVELS } = await import('../src/config/levels.ts');
const { buildStage, surfaceYAt } = await import('../src/game/stage.ts');
const { PHYS } = await import('../src/config/tuning.ts');

type StageDef = (typeof LEVELS)[number];

// ─── The two derived constants every rule is measured against ───────────────

/**
 * Horizontal jump reach at a full run: airtime × runSpeed.
 *
 * Derived, never typed. The whole point of this file is that it cannot disagree
 * with the physics — a hand-entered 70 here would keep passing a build in which
 * someone lowered `jumpV`, and the levels it passed would be the ones with the
 * gaps that no longer clear.
 */
const REACH = ((2 * Math.abs(PHYS.jumpV)) / PHYS.gravity) * PHYS.runSpeed;

/**
 * The barrel-speed ceiling: 1.35 × runSpeed.
 *
 * Past this a barrel crosses the agent's own hitbox width inside two frames, so
 * the jump window closes below human reaction time and the level stops being
 * hard and starts being random. Levels 7–10 deliberately sit ABOVE runSpeed —
 * that is the design — and this is the line they may not cross.
 */
const SPEED_CEILING = 1.35 * PHYS.runSpeed;

/** Route-ratio budget by level. Later levels are allowed a longer detour. */
function ratioBudget(level: number): number {
  if (level <= 4) return 1.35;
  if (level <= 8) return 1.55;
  return 1.75;
}

/** Required DOWNWARD ladder traversals allowed on the sweep route. */
function downBudget(level: number): number {
  return level <= 7 ? 0 : 1;
}

// ─── Reporting ──────────────────────────────────────────────────────────────

interface Failure {
  level: number;
  rule: string;
  message: string;
}

const failures: Failure[] = [];
const notes: string[] = [];

function fail(level: number, rule: string, message: string): void {
  failures.push({ level, rule, message });
}

// ─── The nav graph ──────────────────────────────────────────────────────────

interface GNode {
  id: number;
  gid: number;
  x: number;
  y: number;
  label: string;
}

interface GEdge {
  to: number;
  cost: number;
  kind: 'walk' | 'ladder' | 'lift' | 'jump';
  gated: boolean;
}

interface Graph {
  nodes: GNode[];
  adj: GEdge[][];
}

type Stage = ReturnType<typeof buildStage>;

/**
 * The surface height of an AUTHORED floor at x, or NaN.
 *
 * Lift scratch girders are excluded deliberately: a car is a surface that is
 * only there some of the time, and a route that depends on one being at the top
 * of its travel is not a route, it is a coincidence. Lifts enter the graph as
 * EDGES below, with their full travel as the cost, which is the honest model —
 * you can get there, and it costs you the wait.
 */
function authoredCount(stage: Stage): number {
  return stage.liftBase >= 0 ? stage.liftBase : stage.girders.length;
}

/** Closest authored girder whose surface at `x` is within `tol` of `y`, or -1. */
function floorAt(stage: Stage, x: number, y: number, tol: number): number {
  let best = -1;
  let bestD = tol;
  const n = authoredCount(stage);
  for (let i = 0; i < n; i++) {
    const g = stage.girders[i]!;
    const sy = surfaceYAt(g, x);
    const d = Math.abs(sy - y);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

class GraphBuilder {
  nodes: GNode[] = [];
  adj: GEdge[][] = [];
  private key = new Map<string, number>();

  node(gid: number, x: number, label: string, stage: Stage): number {
    const k = `${gid}:${Math.round(x * 100)}`;
    const seen = this.key.get(k);
    if (seen !== undefined) return seen;
    const id = this.nodes.length;
    this.nodes.push({ id, gid, x, y: surfaceYAt(stage.girders[gid]!, x), label });
    this.adj.push([]);
    this.key.set(k, id);
    return id;
  }

  link(a: number, b: number, cost: number, kind: GEdge['kind'], gated: boolean): void {
    this.adj[a]!.push({ to: b, cost, kind, gated });
    this.adj[b]!.push({ to: a, cost, kind, gated });
  }
}

interface BuiltGraph {
  graph: Graph;
  start: number;
  customer: number;
  /** One node per required objective — rakhis, then pins. */
  targets: number[];
  rakhiNodes: number[];
}

function buildGraph(stage: Stage, def: StageDef, level: number): BuiltGraph {
  const b = new GraphBuilder();
  const n = authoredCount(stage);

  // ── Jump gaps, and rule 5 ───────────────────────────────────────────────
  // A gap is two authored girders whose FACING ends are at nearly the same
  // height. Anything with a real height difference between the ends is two
  // different floors, and the 78-unit floor gap already guarantees no jump
  // reaches those.
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const a = stage.girders[i]!;
      const c = stage.girders[j]!;
      if (a.x1 > c.x0) continue;
      const dx = c.x0 - a.x1;
      if (dx <= 0) continue;
      if (Math.abs(a.y1 - c.y0) > 24) continue;
      if (dx > REACH * 0.9) {
        fail(
          level,
          'R5 gap',
          `girders ${i}→${j} leave a ${dx.toFixed(1)}-unit gap at x≈${a.x1.toFixed(0)}; ` +
            `the jump reach is ${REACH.toFixed(1)} and the budget is ${(REACH * 0.9).toFixed(1)}`,
        );
        continue;
      }
      const na = b.node(i, a.x1, 'edge', stage);
      const nc = b.node(j, c.x0, 'edge', stage);
      b.link(na, nc, dx, 'jump', false);
    }
  }

  // ── Ladders, and rule 1 ─────────────────────────────────────────────────
  for (let i = 0; i < stage.ladders.length; i++) {
    const l = stage.ladders[i]!;
    const bot = floorAt(stage, l.x, l.yBottom, 6);
    const top = floorAt(stage, l.x, l.yTop, 6);
    if (bot < 0 || top < 0) {
      fail(
        level,
        'R1 ladder',
        `ladder ${i} at x=${l.x} has ${bot < 0 ? 'a foot' : 'a head'} more than 6 units from any ` +
          `girder surface (foot y=${l.yBottom.toFixed(1)}, head y=${l.yTop.toFixed(1)}) — ` +
          `a mount that fails at CLIMB.mountY and is invisible in the data`,
      );
      continue;
    }
    // A BROKEN rail is not an edge. Half a ladder is scenery, and a graph that
    // counted it would call an unreachable rakhi reachable.
    if (l.hasGap) {
      notes.push(`L${level}: ladder ${i} is broken and carries no route.`);
      continue;
    }
    const nb = b.node(bot, l.x, 'ladder', stage);
    const nt = b.node(top, l.x, 'ladder', stage);
    b.link(nb, nt, l.yBottom - l.yTop, 'ladder', l.gated);
  }

  // ── Lift cars ───────────────────────────────────────────────────────────
  for (const lf of def.lifts ?? []) {
    const bot = floorAt(stage, lf.x, lf.yBottom, 10);
    const top = floorAt(stage, lf.x, lf.yTop, 10);
    if (bot < 0 || top < 0) {
      fail(
        level,
        'R1 lift',
        `lift at x=${lf.x} does not terminate on a girder at one or both ends ` +
          `(bottom y=${lf.yBottom.toFixed(1)}, top y=${lf.yTop.toFixed(1)})`,
      );
      continue;
    }
    const nb = b.node(bot, lf.x, 'lift', stage);
    const nt = b.node(top, lf.x, 'lift', stage);
    b.link(nb, nt, lf.yBottom - lf.yTop, 'lift', false);
  }

  // ── Start, objectives, door ─────────────────────────────────────────────
  const sGid = floorAt(stage, def.agentStart.x, def.agentStart.y, 10);
  if (sGid < 0) fail(level, 'R1 start', `agentStart is not on a girder surface`);
  const start = b.node(sGid < 0 ? 0 : sGid, def.agentStart.x, 'start', stage);

  const cGid = floorAt(stage, def.customerAt.x, def.customerAt.y, 30);
  if (cGid < 0) fail(level, 'R1 door', `customerAt is not on a girder surface`);
  const customer = b.node(cGid < 0 ? 0 : cGid, def.customerAt.x, 'door', stage);

  const rakhiNodes: number[] = [];
  for (let i = 0; i < def.rakhis.length; i++) {
    const p = def.rakhis[i]!;
    const gid = rakhiGirder(stage, p.x, p.y);
    if (gid < 0) {
      fail(
        level,
        'R2 rakhi',
        `rakhi ${i} at (${p.x.toFixed(0)}, ${p.y.toFixed(0)}) is not within 24 units above any ` +
          `girder surface and is not inside a lift's column — nothing can stand under it`,
      );
      continue;
    }
    rakhiNodes.push(b.node(gid, p.x, `rakhi${i}`, stage));
  }

  const targets = rakhiNodes.slice();
  // Pins are a REQUIRED objective on the levels that carry them (the door
  // refuses the delivery until every one is pushed), so the route ratio has to
  // include them or it measures a route the player is not allowed to take.
  for (let i = 0; i < (def.pins ?? []).length; i++) {
    const p = def.pins![i]!;
    const gid = rakhiGirder(stage, p.x, p.y);
    if (gid < 0) {
      fail(level, 'R2 pin', `order pin ${i} is not within 24 units above any girder surface`);
      continue;
    }
    targets.push(b.node(gid, p.x, `pin${i}`, stage));
  }

  // ── Walking, last, so every node on a girder is chained in x order ───────
  const byGirder = new Map<number, GNode[]>();
  for (const nd of b.nodes) {
    const list = byGirder.get(nd.gid);
    if (list) list.push(nd);
    else byGirder.set(nd.gid, [nd]);
  }
  for (const list of byGirder.values()) {
    list.sort((p, q) => p.x - q.x);
    for (let i = 1; i < list.length; i++) {
      b.link(list[i - 1]!.id, list[i]!.id, Math.abs(list[i]!.x - list[i - 1]!.x), 'walk', false);
    }
  }

  return { graph: { nodes: b.nodes, adj: b.adj }, start, customer, targets, rakhiNodes };
}

/**
 * The girder a pickup sits above, or -1.
 *
 * The lift-column fallback is what lets a level place a collectible in a shaft:
 * a car passes under it on every cycle, so something CAN stand under it, just
 * not all the time. Routed from the shaft's top, which is the pessimistic
 * reading — the player waits for the car rather than being given the pickup free.
 */
function rakhiGirder(stage: Stage, x: number, y: number): number {
  const n = authoredCount(stage);
  let best = -1;
  let bestD = 24;
  for (let i = 0; i < n; i++) {
    const g = stage.girders[i]!;
    const sy = surfaceYAt(g, x);
    const d = sy - y;
    if (d >= 0 && d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best >= 0) return best;

  for (const lf of stage.def.lifts ?? []) {
    if (Math.abs(lf.x - x) > lf.w + 8) continue;
    if (y < lf.yTop - 24 || y > lf.yBottom) continue;
    return floorAt(stage, lf.x, lf.yTop, 10);
  }
  return -1;
}

// ─── Shortest paths ─────────────────────────────────────────────────────────

interface Paths {
  dist: number[];
  prev: number[];
  prevEdge: (GEdge | null)[];
}

function dijkstra(g: Graph, from: number, allowGated: boolean): Paths {
  const n = g.nodes.length;
  const dist = new Array<number>(n).fill(Number.POSITIVE_INFINITY);
  const prev = new Array<number>(n).fill(-1);
  const prevEdge = new Array<GEdge | null>(n).fill(null);
  const done = new Array<boolean>(n).fill(false);
  dist[from] = 0;

  // Linear scan rather than a heap. Sixty nodes; a priority queue here would be
  // more code than the whole rule set it serves.
  for (;;) {
    let u = -1;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      if (!done[i] && dist[i]! < bestD) {
        bestD = dist[i]!;
        u = i;
      }
    }
    if (u < 0) break;
    done[u] = true;
    for (const e of g.adj[u]!) {
      if (e.gated && !allowGated) continue;
      const nd = dist[u]! + e.cost;
      if (nd >= dist[e.to]!) continue;
      dist[e.to] = nd;
      prev[e.to] = u;
      prevEdge[e.to] = e;
    }
  }

  return { dist, prev, prevEdge };
}

/** Downward ladder/lift traversals along the reconstructed path `from → to`. */
function downsAlong(g: Graph, p: Paths, from: number, to: number): number {
  let downs = 0;
  let cur = to;
  while (cur !== from && p.prev[cur]! >= 0) {
    const e = p.prevEdge[cur];
    const par = p.prev[cur]!;
    if (e && (e.kind === 'ladder' || e.kind === 'lift')) {
      // Screen space: down is MORE y. Walked parent → cur, so cur below parent
      // is a descent the route requires.
      if (g.nodes[cur]!.y > g.nodes[par]!.y) downs++;
    }
    cur = par;
  }
  return downs;
}

/**
 * Shortest tour from `start`, through every target, ending at `customer`.
 *
 * Held-Karp over the targets. Ten objectives is 2^10 × 10 × 10, which is
 * instant, and the exact answer matters: a greedy nearest-neighbour tour would
 * report a route ratio that is worse than the one the player can actually find,
 * and the rule would then fail levels that are fine.
 */
function bestTour(
  g: Graph,
  start: number,
  customer: number,
  targets: number[],
  allowGated: boolean,
): { cost: number; order: number[] } {
  const keys = [start, ...targets, customer];
  const paths = new Map<number, Paths>();
  for (const k of keys) paths.set(k, dijkstra(g, k, allowGated));

  const m = targets.length;
  if (m === 0) {
    return { cost: paths.get(start)!.dist[customer]!, order: [] };
  }

  const size = 1 << m;
  const dp: number[][] = [];
  const back: number[][] = [];
  for (let i = 0; i < size; i++) {
    dp.push(new Array<number>(m).fill(Number.POSITIVE_INFINITY));
    back.push(new Array<number>(m).fill(-1));
  }
  for (let i = 0; i < m; i++) dp[1 << i]![i] = paths.get(start)!.dist[targets[i]!]!;

  for (let mask = 1; mask < size; mask++) {
    for (let i = 0; i < m; i++) {
      if (!(mask & (1 << i))) continue;
      const cur = dp[mask]![i]!;
      if (!Number.isFinite(cur)) continue;
      for (let j = 0; j < m; j++) {
        if (mask & (1 << j)) continue;
        const nm = mask | (1 << j);
        const nd = cur + paths.get(targets[i]!)!.dist[targets[j]!]!;
        if (nd >= dp[nm]![j]!) continue;
        dp[nm]![j] = nd;
        back[nm]![j] = i;
      }
    }
  }

  const full = size - 1;
  let best = Number.POSITIVE_INFINITY;
  let last = -1;
  for (let i = 0; i < m; i++) {
    const total = dp[full]![i]! + paths.get(targets[i]!)!.dist[customer]!;
    if (total < best) {
      best = total;
      last = i;
    }
  }

  const order: number[] = [];
  let mask = full;
  let cur = last;
  while (cur >= 0) {
    order.unshift(targets[cur]!);
    const p = back[mask]![cur]!;
    mask ^= 1 << cur;
    cur = p;
  }
  return { cost: best, order };
}

// ─── The rules ──────────────────────────────────────────────────────────────

function validate(def: StageDef, level: number): void {
  const stage = buildStage(def);
  const { graph, start, customer, targets, rakhiNodes } = buildGraph(stage, def, level);

  const open = dijkstra(graph, start, true);
  const shut = dijkstra(graph, start, false);

  // ── R3 · No objective may hide behind the gate ──────────────────────────
  // Without this a level ships in which the gate needs the rakhi and the rakhi
  // needs the gate. See the header — this is the whole reason the file exists.
  for (let i = 0; i < rakhiNodes.length; i++) {
    const nd = rakhiNodes[i]!;
    if (!Number.isFinite(open.dist[nd]!)) {
      fail(level, 'R3 gate', `rakhi ${i} is unreachable even with the gate open`);
      continue;
    }
    if (!Number.isFinite(shut.dist[nd]!)) {
      fail(
        level,
        'R3 gate',
        `rakhi ${i} at (${graph.nodes[nd]!.x.toFixed(0)}, ${graph.nodes[nd]!.y.toFixed(0)}) is ` +
          `reachable ONLY through the gated ladder — the gate needs the rakhi and the rakhi ` +
          `needs the gate, so this level cannot be finished`,
      );
    }
  }
  for (const nd of targets) {
    if (!Number.isFinite(shut.dist[nd]!)) {
      const label = graph.nodes[nd]!.label;
      if (label.startsWith('pin')) {
        fail(level, 'R3 gate', `order ${label} is reachable only through the gated ladder`);
      }
    }
  }

  // ── R4 · The gate must actually gate ────────────────────────────────────
  if (Number.isFinite(shut.dist[customer]!)) {
    fail(
      level,
      'R4 door',
      `the customer is reachable WITHOUT the gated ladder — the sweep is optional and the ` +
        `level's entire objective is decorative`,
    );
  }
  if (!Number.isFinite(open.dist[customer]!)) {
    fail(level, 'R4 door', `the customer is unreachable even with the gate open`);
  }

  // ── R10 · Nothing is placed past the door ───────────────────────────────
  const doorGid = graph.nodes[customer]!.gid;
  for (let i = 0; i < def.rakhis.length; i++) {
    const nd = rakhiNodes[i];
    if (nd === undefined) continue;
    if (graph.nodes[nd]!.gid === doorGid) {
      fail(
        level,
        'R10 past the door',
        `rakhi ${i} sits on the delivery platform — a collectible past the goal is one the ` +
          `player can only take by refusing to finish`,
      );
    }
  }

  // ── R6 · Route ratio, and R7 · the downward budget ──────────────────────
  const direct = open.dist[customer]!;
  const tour = bestTour(graph, start, customer, targets, true);
  if (Number.isFinite(direct) && direct > 0 && Number.isFinite(tour.cost)) {
    const ratio = tour.cost / direct;
    const budget = ratioBudget(level);
    if (ratio > budget) {
      fail(
        level,
        'R6 route',
        `sweep route is ${ratio.toFixed(2)}× the direct climb (${tour.cost.toFixed(0)} vs ` +
          `${direct.toFixed(0)} units); the budget for this level is ${budget.toFixed(2)}× — ` +
          `tension is meant to come from which side the barrel is on, not from distance`,
      );
    } else {
      notes.push(`L${level}: route ratio ${ratio.toFixed(2)}× (budget ${budget.toFixed(2)}×).`);
    }

    let downs = 0;
    let from = start;
    for (const stop of [...tour.order, customer]) {
      downs += downsAlong(graph, dijkstra(graph, from, true), from, stop);
      from = stop;
    }
    const dBudget = downBudget(level);
    if (downs > dBudget) {
      fail(
        level,
        'R7 descent',
        `the sweep requires ${downs} downward ladder traversal(s); the budget for this level ` +
          `is ${dBudget} — climbing back down through the barrels you just climbed past is ` +
          `rework, not difficulty`,
      );
    }
  }

  // ── R8 · The barrel-speed ceiling ───────────────────────────────────────
  if (def.barrelSpeed >= SPEED_CEILING) {
    fail(
      level,
      'R8 speed',
      `barrelSpeed ${def.barrelSpeed} is at or above the ${SPEED_CEILING.toFixed(0)} ceiling ` +
        `(1.35 × runSpeed) — the jump window closes below human reaction time`,
    );
  }

  // ── R9 · A free collectible on the archetypes that can offer one ────────
  // On a belt or lift level at least one rakhi must cost ZERO seconds: taken off
  // a moving car, or carried into by a conveyor. Those are what make "collect
  // them all" read as generous rather than as a tax on the clock.
  if (def.kind === 'kitchen' || def.kind === 'lifts') {
    let free = false;
    for (const p of def.rakhis) {
      const gid = rakhiGirder(stage, p.x, p.y);
      if (gid >= 0 && stage.girders[gid]!.belt !== 0) free = true;
      for (const lf of def.lifts ?? []) {
        if (Math.abs(lf.x - p.x) <= lf.w + 12 && p.y >= lf.yTop - 24 && p.y <= lf.yBottom + 24) {
          free = true;
        }
      }
    }
    if (!free) {
      fail(
        level,
        'R9 free pickup',
        `a ${def.kind} level with no rakhi on a belt or in a lift column — every pickup on this ` +
          `level costs the player seconds, which turns the sweep into a tax`,
      );
    }
  }
}

// ─── Entry ──────────────────────────────────────────────────────────────────

console.log('');
console.log('══ VALIDATE ═══════════════════════════════════════════════════════');
console.log(`  levels          : ${LEVELS.length}`);
console.log(`  jump reach      : ${REACH.toFixed(1)} units   (gap budget ${(REACH * 0.9).toFixed(1)})`);
console.log(`  speed ceiling   : ${SPEED_CEILING.toFixed(0)}  (1.35 × runSpeed ${PHYS.runSpeed})`);
console.log('');

for (let i = 0; i < LEVELS.length; i++) validate(LEVELS[i]!, i + 1);

for (const n of notes) console.log(`  note  ${n}`);
console.log('');

if (failures.length === 0) {
  console.log(`[levels] ${LEVELS.length} levels, 10 rules — clean`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  process.exit(0);
}

console.error(`[levels] ${failures.length} failure(s):\n`);
for (const f of failures.sort((a, b) => a.level - b.level)) {
  console.error(`  LEVEL ${f.level}  ${f.rule}`);
  console.error(`    ${f.message}\n`);
}
process.exit(1);
