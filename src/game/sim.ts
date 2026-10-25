/** Side-view runner simulation. Art-free so it can be stepped in tests. */

export type Gear = "shell" | "skates" | "robo" | "jet" | "bluejet";
export type Phase = "title" | "ready" | "run" | "dead";
export type Cause = "barrier" | "gap" | "air" | null;

export type Layout = {
  w: number;
  h: number;
  groundY: number;
  playerX: number;
  playerH: number;
  playerW: number;
};

export type Chunk = {
  x: number;
  w: number;
  gap: boolean;
  barrierH: number;
  barrierW: number;
  barrierOff: number;
  /** One-way platform. platDrop is the top, above the ground. 0 = none. */
  platW: number;
  platOff: number;
  platDrop: number;
  /** Second deck, above the first. 0 = none. */
  plat2W: number;
  plat2Off: number;
  plat2Drop: number;
  /** Floating hazards. airDrop is the bottom, above the ground. 0 = none. */
  airW: number;
  airH: number;
  airOff: number;
  airDrop: number;
  air2W: number;
  air2H: number;
  air2Off: number;
  air2Drop: number;
  /** Vertical travel for stage 3+ crows. 0 keeps the crow still. */
  airBob: number;
  airPhase: number;
  /** Lettuce row. letDrop is the base height above the ground. 0 = none. */
  letN: number;
  letOff: number;
  letGap: number;
  letDrop: number;
  /** Extra height on the middle lettuce so a row is not always flat. */
  letStagger: number;
  /** Bitmask of collected lettuces in this row. */
  letGot: number;
  /** Bitmask of lettuces that sit on the ground instead of letDrop. */
  letLow: number;
};

export type Cloud = { x: number; y: number; r: number; v: number };

export type Events = {
  jump: boolean;
  land: boolean;
  die: boolean;
  gear: Gear | null;
  collect: boolean;
};

export type Control = {
  held: boolean;
  /** Stage 5 stick. -1..1, +x right, +y down the screen. */
  flyX: number;
  flyY: number;
  /** A new press this frame. Counts even if an older touch never released. */
  edge?: boolean;
};

type Motif = "single" | "hopGap" | "twins" | "stairs" | "rush";
type BarH = "low" | "mid" | "high";
type GapW = "narrow" | "mid" | "wide";
type PadK = "rest" | "link" | "recovery";

export type Sim = {
  layout: Layout;
  phase: Phase;
  rand: () => number;
  slots: Chunk[];
  head: number;
  count: number;
  cursor: number;
  script: number;
  motif: Motif;
  motifI: number;
  motifN: number;
  jetGate: boolean;
  blueGate: boolean;
  /** High crows already placed in stage 1. */
  shellCrows: number;
  /** Crows placed so far, so heights alternate instead of stacking one band. */
  crowSeq: number;
  /** Next distance, in meters, that should grow a crow. */
  crowAt: number;
  worldX: number;
  y: number;
  vy: number;
  speed: number;
  grounded: boolean;
  coyote: number;
  buffer: number;
  jumpWasDown: boolean;
  lifting: boolean;
  jumpT: number;
  /** Extra mid-air jump. Refilled on the ground in the robo and jet stages. */
  airJumps: number;
  /** Screen-space dodge offset while flying. */
  shift: number;
  /** Last flight-gate center, in screen y. 0 until the first gate. */
  gateY: number;
  /** Seconds of floater immunity after the blue jet starts. */
  grace: number;
  acc: number;
  anim: number;
  deathT: number;
  /** Distance, in meters. The live readout during a run. */
  score: number;
  /** Seconds spent in the current run. */
  runT: number;
  lettuces: number;
  /** Combined end-of-run score. 0 until the run ends. */
  points: number;
  best: number;
  newBest: boolean;
  cause: Cause;
  gear: Gear;
  jumpedOnce: boolean;
  clouds: Cloud[];
  /** Course seed. Restarts keep it; re-roll replaces it. */
  seed: number;
  /** World-x of each planned lettuce. Same list every run for a given layout and seed. */
  letMarks: number[];
  /** Parallel to letMarks. True when that lettuce is on the ground. */
  letLows: boolean[];
  letMarkI: number;
  letPlacedUntil: number;
};

export const JUMP_V_K = 5.4;
export const GRAVITY_K = 13.5;
/** Fraction of full launch speed at the start of a jump, before the hold ramps. */
export const MIN_JUMP_K = 0.34;
/** How long the button must be held to reach a full jump. */
export const JUMP_HOLD = 0.2;
export const METER_K = 0.85;
export const RAMP_METERS = 240;
export const SKATES_M = 40;
export const ROBO_M = 110;
export const JET_M = 185;
export const BLUE_M = 275;
/** Same lettuce count in every stage, including the flight stage. */
export const LETTUCE_PER_STAGE = 10;
/** Restarts reuse this seed so the course can be learned. */
export const LAYOUT_SEED = 1;
export const STEP = 1 / 60;
const COYOTE = 0.12;
const BUFFER = 0.13;
const POOL = 64;

export const GEAR_LABEL: Record<Gear, string> = {
  shell: "On foot",
  skates: "Skates",
  robo: "Robo legs",
  jet: "Jet",
  bluejet: "Blue jet",
};

export const GEAR_CALLOUT: Record<Gear, string> = {
  shell: "",
  skates: "Skates on",
  robo: "Double jump",
  jet: "Triple jump",
  bluejet: "Fly",
};

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/** Upward speed in player-heights / second at a moment in the hold window. */
export function jumpVyK(jumpT: number): number {
  const u = clamp(jumpT / JUMP_HOLD, 0, 1);
  const eased = u * u;
  return JUMP_V_K * (MIN_JUMP_K + (1 - MIN_JUMP_K) * eased);
}

/**
 * Air time if the jump button is held for `holdSec`. Gravity is suspended
 * during the lift window so a full hold still crests, then falls under GRAVITY_K.
 * Independent of player size because launch speed and gravity both scale with it.
 */
export function holdAirTime(holdSec: number): number {
  const dt = 1 / 600;
  const g = GRAVITY_K;
  let y = 0;
  let vy = -jumpVyK(0);
  let jumpT = 0;
  let t = 0;
  const hold = Math.max(0, holdSec);
  while (t < 6) {
    const held = t < hold;
    const lifting = held && jumpT < JUMP_HOLD && vy <= 0;
    if (lifting) {
      jumpT = Math.min(JUMP_HOLD, jumpT + dt);
      vy = -jumpVyK(jumpT);
    } else {
      vy += g * dt;
    }
    y += vy * dt;
    t += dt;
    if (t > dt * 2 && y >= 0 && vy > 0) return t;
  }
  return t;
}

export const AIR_TIME = holdAirTime(JUMP_HOLD);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function layoutFrom(w: number, h: number): Layout {
  const playerH = clamp(Math.min(w * 0.14, h * 0.2), 72, 148);
  const playerW = playerH * 0.92;
  const playerX = clamp(w * 0.2, playerW, w * 0.32);
  const groundY = clamp(h * 0.78, playerH + 28, h - 16);
  return { w, h, groundY, playerX, playerH, playerW };
}

export function speedRange(layout: Layout): { base: number; max: number } {
  const ahead = Math.max(180, layout.w - layout.playerX);
  return { base: ahead / 2.4, max: ahead / 1.08 };
}

export function speedAt(x: number, layout: Layout): number {
  const { base, max } = speedRange(layout);
  const meters = Math.max(0, x) / (layout.playerH * METER_K);
  if (meters >= BLUE_M) {
    const over = clamp((meters - BLUE_M) / 50, 0, 1);
    // Still a hard jump from the jet, but slow enough to fly a short stretch.
    return widePace(layout, max * (1.82 + 0.38 * over));
  }
  const t = clamp(meters / RAMP_METERS, 0, 1);
  const s = t * t * (3 - 2 * t);
  let v = base + (max - base) * s;
  if (meters >= JET_M) v *= 1.16;
  else if (meters >= ROBO_M) v *= 1.08;
  else if (meters >= SKATES_M) v *= 1.09;
  return widePace(layout, v);
}

/** Wide windows scroll faster in body-lengths than a phone. Match the phone's stage-1 pace. */
function widePace(layout: Layout, speed: number): number {
  if (layout.w < 1024) return speed;
  const phone = layoutFrom(390, 844);
  const phonePace = speedRange(phone).base / phone.playerH;
  const pace = speedRange(layout).base / layout.playerH;
  if (pace <= phonePace) return speed;
  return speed * (phonePace / pace);
}

export function gearFor(meters: number): Gear {
  if (meters >= BLUE_M) return "bluejet";
  if (meters >= JET_M) return "jet";
  if (meters >= ROBO_M) return "robo";
  if (meters >= SKATES_M) return "skates";
  return "shell";
}

export function metersOf(sim: Sim): number {
  return sim.worldX / (sim.layout.playerH * METER_K);
}

/**
 * End-of-run score.
 * Distance is the main term (10 per meter), time survived adds a steady
 * 20 per second, and each lettuce is worth 100 — about ten meters, or
 * five seconds. Longer, farther, and greedier runs all score higher.
 */
export function runScore(meters: number, seconds: number, lettuces: number): number {
  const m = Math.max(0, meters);
  const s = Math.max(0, seconds);
  const n = Math.max(0, Math.floor(lettuces));
  return Math.round(m * 10 + s * 20 + n * 100);
}

function canDouble(gear: Gear): boolean {
  return gear === "robo" || gear === "jet";
}

/** Jumps still available after leaving the ground. Stage 4 gets two, so three in total. */
export function maxAirJumps(gear: Gear): number {
  if (gear === "jet") return 2;
  if (gear === "robo") return 1;
  return 0;
}

function extraJumps(gear: Gear): number {
  return maxAirJumps(gear);
}

function blankChunk(): Chunk {
  return {
    x: 0,
    w: 0,
    gap: false,
    barrierH: 0,
    barrierW: 0,
    barrierOff: 0,
    platW: 0,
    platOff: 0,
    platDrop: 0,
    plat2W: 0,
    plat2Off: 0,
    plat2Drop: 0,
    airW: 0,
    airH: 0,
    airOff: 0,
    airDrop: 0,
    air2W: 0,
    air2H: 0,
    air2Off: 0,
    air2Drop: 0,
    airBob: 0,
    airPhase: 0,
    letN: 0,
    letOff: 0,
    letGap: 0,
    letDrop: 0,
    letStagger: 0,
    letGot: 0,
    letLow: 0,
  };
}

export function createSim(layout: Layout, opts: { seed: number; best: number }): Sim {
  const sim: Sim = {
    layout,
    phase: "title",
    rand: mulberry32(opts.seed || 1),
    slots: Array.from({ length: POOL }, blankChunk),
    head: 0,
    count: 0,
    cursor: 0,
    script: 0,
    motif: "single",
    motifI: 0,
    motifN: 0,
    jetGate: false,
    blueGate: false,
    shellCrows: 0,
    crowSeq: 0,
    crowAt: 11,
    worldX: 0,
    y: layout.groundY,
    vy: 0,
    speed: speedAt(0, layout),
    grounded: true,
    coyote: 0,
    buffer: 0,
    jumpWasDown: false,
    lifting: false,
    jumpT: 0,
    airJumps: 0,
    shift: 0,
    gateY: 0,
    grace: 0,
    acc: 0,
    anim: 0,
    deathT: 0,
    score: 0,
    runT: 0,
    lettuces: 0,
    points: 0,
    best: opts.best,
    newBest: false,
    cause: null,
    gear: "shell",
    jumpedOnce: false,
    clouds: [],
    seed: opts.seed || LAYOUT_SEED,
    letMarks: [],
    letLows: [],
    letMarkI: 0,
    letPlacedUntil: Number.NEGATIVE_INFINITY,
  };
  const n = 5;
  for (let i = 0; i < n; i++) {
    sim.clouds.push({
      x: sim.rand() * layout.w,
      y: layout.groundY * (0.12 + sim.rand() * 0.28),
      r: 18 + sim.rand() * 36,
      v: 8 + sim.rand() * 16,
    });
  }
  buildTrack(sim);
  return sim;
}

/** Temporary test start. Set to JET_M to begin in stage 4. 0 starts at stage 1. */
export const TEST_START_M = 0;

/** Jump the shell to a later stage without changing stage rules. */
export function applyTestStart(sim: Sim): void {
  if (!(TEST_START_M > 0)) return;
  const L = sim.layout;
  const jetX = L.playerH * METER_K * TEST_START_M;
  sim.worldX = jetX;
  sim.speed = speedAt(jetX, L);
  let guard = 0;
  while (sim.cursor < jetX + L.w * 1.5 && guard++ < 100) {
    const before = sim.cursor;
    recycle(sim);
    ensure(sim);
    if (sim.cursor <= before) {
      if (sim.count <= 0) break;
      sim.head = (sim.head + 1) % sim.slots.length;
      sim.count--;
    }
  }
  let stand = jetX;
  let found = false;
  eachChunk(sim, (c) => {
    if (found || c.gap || c.barrierH > 0 || c.airW > 0) return;
    if (c.x + c.w < jetX + 12) return;
    const inset = Math.min(36, c.w * 0.2);
    stand = Math.max(c.x + inset, Math.min(c.x + c.w - 16, Math.max(jetX, c.x) + inset));
    found = true;
  });
  sim.worldX = stand;
  sim.speed = speedAt(stand, L);
  sim.gear = gearFor(metersOf(sim));
  sim.y = L.groundY;
  sim.vy = 0;
  sim.grounded = true;
  sim.lifting = false;
  sim.airJumps = extraJumps(sim.gear);
  sim.score = Math.floor(metersOf(sim));
}

export function beginRun(sim: Sim): void {
  sim.phase = "run";
}

export function resetToRun(prev: Sim, seed = LAYOUT_SEED): Sim {
  prev.slots.length = 0;
  prev.count = 0;
  const sim = createSim(prev.layout, {
    seed: seed || LAYOUT_SEED,
    best: prev.best,
  });
  sim.phase = "run";
  return sim;
}

export function eachChunk(sim: Sim, fn: (c: Chunk) => void): void {
  const len = sim.slots.length;
  for (let i = 0; i < sim.count; i++) fn(sim.slots[(sim.head + i) % len]!);
}

function alloc(sim: Sim): Chunk | null {
  if (sim.count >= sim.slots.length) return null;
  const c = sim.slots[(sim.head + sim.count) % sim.slots.length]!;
  sim.count++;
  return c;
}

function pushChunk(
  sim: Sim,
  w: number,
  gap: boolean,
  barrierH = 0,
  barrierW = 0,
  barrierOff = 0,
): Chunk | null {
  const c = alloc(sim);
  if (!c) return null;
  c.x = sim.cursor;
  c.w = Math.max(8, w);
  c.gap = gap;
  c.barrierH = barrierH;
  c.barrierW = barrierW;
  c.barrierOff = barrierOff;
  c.platW = 0;
  c.platOff = 0;
  c.platDrop = 0;
  c.plat2W = 0;
  c.plat2Off = 0;
  c.plat2Drop = 0;
  c.airW = 0;
  c.airH = 0;
  c.airOff = 0;
  c.airDrop = 0;
  c.air2W = 0;
  c.air2H = 0;
  c.air2Off = 0;
  c.air2Drop = 0;
  c.airBob = 0;
  c.airPhase = 0;
  c.letN = 0;
  c.letOff = 0;
  c.letGap = 0;
  c.letDrop = 0;
  c.letStagger = 0;
  c.letGot = 0;
  c.letLow = 0;
  sim.cursor += c.w;
  return c;
}

function buildTrack(sim: Sim): void {
  sim.head = 0;
  sim.count = 0;
  sim.script = 0;
  sim.motif = "single";
  sim.motifI = 0;
  sim.motifN = 0;
  sim.jetGate = false;
  sim.blueGate = false;
  const plan = lettucePlan(sim.layout, sim.seed);
  sim.letMarks = plan.marks;
  sim.letLows = plan.lows;
  sim.letMarkI = 0;
  sim.letPlacedUntil = Number.NEGATIVE_INFINITY;
  const ahead = Math.max(180, sim.layout.w - sim.layout.playerX);
  const first = ahead * 0.9;
  const back = sim.layout.w;
  sim.cursor = -back;
  // The learned start is a fixed runway. A re-roll moves that runway so the
  // first barrier or hole is not in the same place as the last course.
  const runway = sim.seed === LAYOUT_SEED ? first : first * (0.42 + sim.rand() * 0.9);
  pushChunk(sim, back + runway, false);
  ensure(sim);
}

function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function mix32(a: number, b: number): number {
  let x = (a >>> 0) ^ Math.imul(Math.round(b) >>> 0, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

function mix01(a: number, b: number): number {
  return mix32(a, b) / 4294967296;
}

/** Stage 5 is endless, so its ten lettuces fill a stretch the same length as stage 4. */
function lettucePlan(layout: Layout, seed: number): { marks: number[]; lows: boolean[] } {
  const px = layout.playerH * METER_K;
  const starts = [0, SKATES_M, ROBO_M, JET_M, BLUE_M];
  const span4 = BLUE_M - JET_M;
  const ends = [SKATES_M, ROBO_M, JET_M, BLUE_M, BLUE_M + span4];
  const marks: number[] = [];
  const lows: boolean[] = [];
  for (let s = 0; s < starts.length; s++) {
    const a = starts[s]!;
    const span = ends[s]! - a;
    if (seed === LAYOUT_SEED) {
      const groundN = 3 + Math.floor(hash01(seed * 5 + s * 11) * 3);
      const shift = Math.floor(hash01(seed * 9 + s * 7) * LETTUCE_PER_STAGE);
      for (let k = 0; k < LETTUCE_PER_STAGE; k++) {
        const slot = (k + 0.5) / LETTUCE_PER_STAGE;
        const jitter = (hash01(seed * 17 + s * 100 + k * 13) - 0.5) * 0.5 / LETTUCE_PER_STAGE;
        const m = a + span * clamp(slot + jitter, 0.03, 0.97);
        marks.push(m * px);
        lows.push((k + shift) % LETTUCE_PER_STAGE < groundN);
      }
      continue;
    }
    const stageLows: boolean[] = [];
    let ground = 0;
    for (let k = 0; k < LETTUCE_PER_STAGE; k++) {
      const u = (k + mix01(mix32(seed, s + 1), k + 3)) / LETTUCE_PER_STAGE;
      marks.push((a + span * clamp(u, 0.04, 0.96)) * px);
      const low = mix32(seed, s * 20 + k + 5) % 100 < 45;
      stageLows.push(low);
      if (low) ground++;
    }
    if (ground === 0) stageLows[mix32(seed, s + 8) % LETTUCE_PER_STAGE] = true;
    if (ground === LETTUCE_PER_STAGE) stageLows[mix32(seed, s + 4) % LETTUCE_PER_STAGE] = false;
    lows.push(...stageLows);
  }
  return { marks, lows };
}

function stampLettuce(sim: Sim, c: Chunk, marks: number[], lows: boolean[]): void {
  const L = sim.layout;
  const first = marks[0]!;
  const last = marks[marks.length - 1]!;
  const gear = gearFor(first / (L.playerH * METER_K));
  const hsh = sim.seed === LAYOUT_SEED ? hash01(Math.round(first)) : mix01(sim.seed, first);
  let local = first - c.x;
  if (c.barrierH > 0) {
    const barL = c.barrierOff;
    const barR = c.barrierOff + c.barrierW;
    if (local > barL - 8 && local < barR + 8) {
      const before = barL - L.playerW * 0.45;
      const after = barR + 10;
      local = before >= 4 ? before : Math.min(c.w - 8, after);
    }
  }
  let drop = L.playerH * (1.12 + hsh * 0.4);
  if (c.plat2W > 0 && local >= c.plat2Off - 6 && local <= c.plat2Off + c.plat2W + 6) {
    drop = c.plat2Drop + L.playerH * (0.22 + hsh * 0.1);
  } else if (c.platW > 0 && local >= c.platOff - 6 && local <= c.platOff + c.platW + 6) {
    drop = c.platDrop + L.playerH * (0.22 + hsh * 0.1);
  } else if (gear === "bluejet") {
    drop = L.playerH * (1.2 + hsh * 0.55);
  }
  if (c.airH > 0 && c.air2H > 0) {
    const ceilBottom = L.groundY - c.airDrop;
    const floorTop = L.groundY - c.air2Drop - c.air2H;
    if (floorTop > ceilBottom + 8) drop = L.groundY - (ceilBottom + floorTop) / 2;
  }
  const cap = L.playerH * (gear === "bluejet" ? 2.3 : canDouble(gear) ? 2.4 : 1.58);
  let low = 0;
  if (!c.gap) {
    for (let i = 0; i < lows.length && i < 16; i++) if (lows[i]) low |= 1 << i;
  }
  c.letN = marks.length;
  c.letOff = Math.max(4, Math.min(c.w - 8, local));
  c.letGap = marks.length > 1 ? Math.max(8, (last - first) / (marks.length - 1)) : L.playerW;
  c.letDrop = Math.min(cap, Math.max(L.playerH * 0.35, drop));
  c.letStagger =
    marks.length > 1
      ? ((sim.seed === LAYOUT_SEED ? hash01(Math.round(marks[1]! + 9)) : mix01(sim.seed, marks[1]! + 9)) - 0.5) *
        L.playerH *
        0.28
      : 0;
  c.letGot = 0;
  c.letLow = low;
}

/** Replace the random heads with the fixed per-stage plan. One pass per chunk. */
function applyLettucePlan(sim: Sim): void {
  const pending: Chunk[] = [];
  eachChunk(sim, (c) => {
    if (c.x + c.w <= sim.letPlacedUntil) return;
    pending.push(c);
  });
  pending.sort((a, b) => a.x - b.x);
  for (const c of pending) {
    const marks: number[] = [];
    const lows: boolean[] = [];
    while (sim.letMarkI < sim.letMarks.length && sim.letMarks[sim.letMarkI]! < c.x) sim.letMarkI++;
    while (sim.letMarkI < sim.letMarks.length && sim.letMarks[sim.letMarkI]! < c.x + c.w) {
      marks.push(sim.letMarks[sim.letMarkI]!);
      lows.push(sim.letLows[sim.letMarkI] ?? false);
      sim.letMarkI++;
    }
    if (marks.length === 0) c.letN = 0;
    else stampLettuce(sim, c, marks, lows);
    sim.letPlacedUntil = Math.max(sim.letPlacedUntil, c.x + c.w);
  }
}

function metersAt(sim: Sim, x = sim.cursor): number {
  return Math.max(0, x) / (sim.layout.playerH * METER_K);
}

function pickMotif(sim: Sim, gear: Gear): Motif {
  const r = sim.rand();
  if (gear === "bluejet") return "single";
  if (gear === "shell") {
    if (r < 0.64) return "single";
    return "twins";
  }
  if (gear === "skates") {
    if (r < 0.48) return "single";
    return "twins";
  }
  if (gear === "robo") {
    if (r < 0.3) return "single";
    if (r < 0.54) return "twins";
    if (r < 0.76) return "stairs";
    return "hopGap";
  }
  if (gear === "jet") {
    if (r < 0.16) return "single";
    if (r < 0.4) return "twins";
    if (r < 0.62) return "stairs";
    if (r < 0.8) return "hopGap";
    return "rush";
  }
  return "single";
}

function motifLength(motif: Motif, gear: Gear): number {
  if (motif === "single") return 1;
  if (motif === "stairs") return gear === "jet" ? 3 : 2;
  if (motif === "rush") return gear === "jet" ? 3 : 4;
  return 2;
}

function platSpan(sim: Sim): number {
  const r = sim.rand();
  if (r < 0.34) return 1.15 + sim.rand() * 0.6;
  if (r < 0.72) return 2.15 + sim.rand() * 1.05;
  return 3.5 + sim.rand() * 1.7;
}

/** A few low, short decks in stage 1. Sized from the chunk position so the rest of the course is unchanged. */
function attachShellPlat(sim: Sim, c: Chunk): void {
  const L = sim.layout;
  if (metersAt(sim, c.x) < 8) return;
  const seeded = sim.seed !== LAYOUT_SEED;
  if ((seeded ? mix01(sim.seed, c.x) : hash01(c.x * 0.013 + sim.seed)) > 0.5) return;
  const h2 = seeded ? mix01(sim.seed, c.x * 0.11 + 9) : hash01(c.x * 0.11 + 9);
  const leadIn = L.playerW * 0.42;
  const tail = L.playerW * 0.55;
  const room = c.w - leadIn - tail;
  if (room < L.playerW * 0.95) return;
  const want = Math.min(L.playerW * (0.95 + h2 * 1.35), room);
  c.platW = want;
  c.platOff = leadIn + (room - want) * (seeded ? mix01(sim.seed, c.x * 0.05 + 2) : hash01(c.x * 0.05 + 2));
  c.platDrop = L.playerH * (0.56 + (seeded ? mix01(sim.seed, c.x * 0.09 + 4) : hash01(c.x * 0.09 + 4)) * 0.28);
}

function attachPlat(sim: Sim, c: Chunk): void {
  const L = sim.layout;
  const speed = Math.max(L.playerH * 2.2, speedAt(Math.max(0, c.x), L));
  const tail = Math.max(L.playerW * 0.9, speed * 0.42);
  const usable = c.w - tail;
  if (usable < L.playerW * 1.15) return;
  c.platW = Math.min(L.playerW * platSpan(sim), usable, L.playerW * 5.4);
  c.platOff = Math.max(0, (usable - c.platW) * sim.rand());
  c.platDrop = L.playerH * (0.72 + sim.rand() * 0.4);
  attachUpper(sim, c);
  ensureRunoff(sim, c);
}

/** Seconds to fall `dropH` player-heights from a standstill. */
function fallSeconds(dropH: number): number {
  return Math.sqrt((2 * Math.max(0.05, dropH)) / GRAVITY_K);
}

/**
 * A deck that ends in the middle of the pad dumps a running shell into the
 * next barrier: coyote has expired, but there is not yet time to land and
 * jump. Lengthen that pad until the fall plus a normal lead fit.
 */
function ensureRunoff(sim: Sim, c: Chunk): void {
  if (c.platW <= 0 || c.platDrop <= 0) return;
  const L = sim.layout;
  const speed = Math.max(L.playerH * 2.2, speedAt(Math.max(0, c.x), L));
  const end = c.platOff + c.platW;
  const have = (c.w - end) / speed;
  const lead = 0.2 + (L.playerW * 0.36) / speed;
  const need = fallSeconds(c.platDrop / L.playerH) + lead + 0.1;
  if (have >= need) return;
  const extra = speed * (need - have);
  c.w += extra;
  sim.cursor += extra;
}

/** A shorter deck above the low one. Single-jump stages stay under a full hop; robo and jet can sit higher. */
function attachUpper(sim: Sim, c: Chunk): void {
  const L = sim.layout;
  if (sim.rand() > 0.58 || c.platW < L.playerW * 1.1) return;
  const gear = gearFor(Math.max(0, c.x) / (L.playerH * METER_K));
  const ceiling = canDouble(gear) ? 2.15 : 1.5;
  let low = c.platDrop / L.playerH;
  const maxLow = ceiling - 0.58;
  if (low > maxLow) low = maxLow - sim.rand() * 0.06;
  const floor = low + 0.46;
  if (floor > ceiling - 0.05) return;
  const high = floor + (ceiling - floor) * (0.62 + sim.rand() * 0.38);
  c.platDrop = L.playerH * low;
  const speed = Math.max(L.playerH * 2.2, speedAt(Math.max(0, c.x), L));
  const fallT = Math.sqrt((2 * Math.max(0.2, high - low)) / GRAVITY_K);
  const runway = speed * (fallT + 0.24);
  const want = L.playerW * (1.2 + sim.rand() * 0.7);
  c.platW = Math.max(c.platW, want + runway);
  const end = c.platOff + c.platW;
  const minTail = L.playerW * 0.3;
  if (end + minTail > c.w) {
    const extra = end + minTail - c.w;
    c.w += extra;
    sim.cursor += extra;
  }
  c.plat2W = want;
  c.plat2Off = c.platOff;
  c.plat2Drop = L.playerH * high;
}

function crowBand(sim: Sim, n: number): "low" | "high" {
  const flip = sim.seed === LAYOUT_SEED ? hash01(41) >= 0.5 : mix01(sim.seed, 41) >= 0.5;
  return (n % 2 === 0) === flip ? "high" : "low";
}

function crowUnit(sim: Sim, salt: number): number {
  const n = (Math.round(sim.cursor) ^ Math.imul(sim.crowSeq + 1, 1103515245) ^ salt * 97) >>> 0;
  return sim.seed === LAYOUT_SEED ? hash01(n) : mix01(sim.seed, n);
}

function attachHighAir(sim: Sim, c: Chunk, tier: "low" | "mid" | "high"): void {
  const L = sim.layout;
  const h = tier === "low" ? 0.18 + crowUnit(sim, 2) * 0.1 : tier === "mid" ? 0.24 + crowUnit(sim, 3) * 0.16 : 0.28 + crowUnit(sim, 4) * 0.18;
  c.airH = L.playerH * h;
  const wide = tier === "low" ? 0.34 + crowUnit(sim, 5) * 0.18 : 0.46 + crowUnit(sim, 6) * 0.28;
  c.airW = Math.min(L.playerH * wide, c.w * 0.42);
  const room = Math.max(0, c.w - c.airW);
  const back = tier === "low" ? 0.8 : tier === "mid" ? 0.5 : 0.42;
  c.airOff = room * (back + crowUnit(sim, 7) * Math.max(0.05, 0.96 - back));
  const band = crowBand(sim, sim.crowSeq++);
  const j = sim.seed === LAYOUT_SEED ? hash01(c.x * 0.19 + 5) : mix01(sim.seed, Math.round(c.x) + 5);
  const early = metersAt(sim, c.x) < ROBO_M;
  const center = band === "low" ? 0.4 + j * 0.16 : early ? 1.02 + j * 0.36 : 2.45 + j * 0.3;
  c.airDrop = L.playerH * Math.max(0.18, center - h / 2);
  c.airBob = 0;
  c.airPhase = 0;
  if (metersAt(sim, c.x) >= ROBO_M && mix01(sim.seed, Math.round(c.x) + 77) < 0.5) {
    c.airBob = L.playerH * 1.62;
    c.airPhase = mix01(sim.seed, Math.round(c.x) + 91) * Math.PI * 2;
  }
}

function maybeLettuce(sim: Sim, c: Chunk, chance: number, opts?: { drop?: number; count?: number }): void {
  if (c.letN > 0) return;
  const stacked = c.plat2W > 0 && c.plat2Drop > 0;
  let gate = chance;
  if (opts?.drop == null && opts?.count == null) {
    if (stacked) gate = Math.max(chance, 0.94);
    else if (!(c.platW > 0)) gate = chance * 0.42;
  }
  if (opts?.count == null && sim.rand() > gate) return;
  const L = sim.layout;
  const roll = sim.rand();
  let n = opts?.count ?? (roll < 0.55 ? 1 : roll < 0.86 ? 2 : 3);
  const gap = L.playerW * (0.55 + sim.rand() * 0.32);
  const gear = gearFor(Math.max(0, c.x) / (L.playerH * METER_K));
  const cap = L.playerH * (canDouble(gear) ? 2.4 : 1.58);
  c.letGot = 0;
  c.letStagger = 0;
  c.letGap = gap;

  const finish = (count: number, off: number, drop: number) => {
    c.letN = count;
    c.letOff = off;
    c.letDrop = Math.min(cap, Math.max(L.playerH * 0.35, drop));
  };

  if (opts?.drop != null) {
    while (n > 1 && gap * (n - 1) > c.w * 0.74) n--;
    if (n < 1 || c.w < 16) return;
    const row = gap * Math.max(0, n - 1);
    finish(n, Math.max(4, (c.w - row) * (0.2 + sim.rand() * 0.6)), opts.drop);
    return;
  }

  const deck =
    c.plat2Drop > 0
      ? { off: c.plat2Off, w: c.plat2W, drop: c.plat2Drop }
      : c.platDrop > 0
        ? { off: c.platOff, w: c.platW, drop: c.platDrop }
        : null;

  if (deck && !c.gap && (stacked || sim.rand() < 0.8)) {
    const obscure = sim.rand() < 0.14;
    if (obscure) {
      const lip = deck.off + deck.w + L.playerW * (0.1 + sim.rand() * 0.32);
      finish(1, Math.max(4, Math.min(lip, c.w - 10)), deck.drop + L.playerH * (0.2 + sim.rand() * 0.16));
      return;
    }
    while (n > 1 && gap * (n - 1) > deck.w * 0.82) n--;
    const row = gap * Math.max(0, n - 1);
    const off = deck.off + Math.max(0, (deck.w - row) * (0.1 + sim.rand() * 0.75));
    finish(Math.max(1, n), off, deck.drop + L.playerH * 0.28);
    return;
  }

  while (n > 1 && gap * (n - 1) > c.w * 0.7) n--;
  if (n < 1 || c.w < 16) return;
  const row = gap * Math.max(0, n - 1);
  const hi = c.gap ? 1.42 : canDouble(gear) ? 1.7 : 1.48;
  const lo = 1.16;
  const obscure = sim.rand() < 0.14;
  const t = obscure ? Math.min(hi, hi - 0.04 + sim.rand() * 0.06) : lo + sim.rand() * Math.max(0.05, hi - lo - 0.1);
  finish(n, Math.max(4, (c.w - row) * sim.rand()), L.playerH * t);
}

function spawnFlight(sim: Sim): void {
  const L = sim.layout;
  const speed = speedAt(sim.cursor, L);
  const first = sim.gateY <= 0;
  const approach = first ? 0.45 : 0.4 + sim.rand() * 0.18;
  const open = L.playerH * (1.4 + sim.rand() * 0.34);
  const half = open * 0.5;
  const yMin = L.playerH * 0.42;
  const yMax = L.groundY - L.playerH * 0.18;
  const lo = yMin + half;
  const hi = Math.max(lo, yMax - half);
  const prefer = sim.gateY > 0 ? sim.gateY : L.groundY - L.playerH * 1.55;
  const maxShift = first ? 0 : L.playerH * Math.min(1.35, 6.6 * approach * 0.7);
  const center = clamp(prefer + (sim.rand() * 2 - 1) * maxShift, lo, hi);
  sim.gateY = center;

  if (!first) {
    const sky = pushChunk(sim, Math.max(L.playerW, speed * approach), false);
    if (sky && sim.rand() < 0.62) {
      const platFeet = center + L.playerH * 0.35;
      const want = L.playerW * platSpan(sim);
      sky.platW = Math.min(want, sky.w * 0.78);
      sky.platOff = Math.max(0, (sky.w - sky.platW) * sim.rand() * 0.35);
      sky.platDrop = L.groundY - platFeet;
      if (sky.platDrop < L.playerH * 0.5 || sky.platW < L.playerW * 1.1) sky.platW = 0;
    }
    if (sky) maybeLettuce(sim, sky, 0.55, { drop: L.groundY - center });
    if (sky && mix01(sim.seed, Math.round(sky.x) + 13) < 0.4) {
      sky.airW = Math.min(L.playerH * 0.42, sky.w * 0.42);
      sky.airH = L.playerH * 0.22;
      sky.airOff = Math.max(8, sky.w * 0.28);
      sky.airDrop = L.playerH * 1.15;
      sky.airBob = L.playerH * 1.62;
      sky.airPhase = mix01(sim.seed, Math.round(sky.x) + 29) * Math.PI * 2;
    }
  }

  const gateW = Math.max(L.playerH * 0.85, speed * (0.16 + sim.rand() * 0.08));
  const c = pushChunk(sim, gateW, false);
  if (!c) return;
  const openTop = center - half;
  const openBot = center + half;
  c.airW = gateW;
  c.airOff = 0;
  c.airDrop = L.groundY - openTop;
  c.airH = Math.max(8, openTop);
  c.air2W = gateW;
  c.air2Off = 0;
  c.air2Drop = 6;
  c.air2H = Math.max(8, L.groundY - 6 - openBot);
}

function spawnGap(sim: Sim, gear: Gear, kind: GapW): boolean {
  const L = sim.layout;
  const speed = speedAt(sim.cursor, L);
  const cover = Math.max(L.playerH, speed * AIR_TIME);
  const band: Record<Gear, [number, number]> = {
    shell: [0.28, 0.48],
    skates: [0.3, 0.52],
    robo: [0.34, 0.56],
    jet: [0.42, 0.66],
    bluejet: [0.5, 0.74],
  };
  let [lo, hi] = band[gear];
  if (kind === "narrow") hi = lo + (hi - lo) * 0.4;
  if (kind === "wide") lo = lo + (hi - lo) * 0.55;
  hi = Math.min(hi, 0.75);
  const minGap = Math.max(24, L.playerH * (kind === "narrow" ? 0.26 : 0.34));
  const maxGap = Math.max(minGap, cover * hi);
  const min = Math.min(maxGap, Math.max(minGap, cover * lo));
  const w = min + sim.rand() * Math.max(0, maxGap - min);
  const c = pushChunk(sim, Math.min(w, cover * 0.75), true);
  if (c) maybeLettuce(sim, c, gear === "shell" ? 0.22 : gear === "skates" ? 0.32 : 0.4);
  return c != null;
}

function spawnBarrier(sim: Sim, gear: Gear, height: BarH): boolean {
  const L = sim.layout;
  const speed = speedAt(sim.cursor, L);
  const cover = speed * AIR_TIME;
  const early = gear === "shell" || gear === "skates";
  const use: BarH = early && height === "high" ? "mid" : height;
  const band: Record<BarH, [number, number]> = {
    low: [0.3, 0.42],
    mid: [0.46, 0.58],
    high: [0.6, 0.68],
  };
  const [a, b] = band[use];
  const bh = L.playerH * (a + sim.rand() * (b - a));
  const bwWant = L.playerH * (use === "low" ? 0.16 : 0.2 + sim.rand() * 0.1);
  const off = L.playerH * (use === "low" ? 0.1 : 0.16);
  const nose = L.playerW * 0.36;
  const tail = L.playerW * 0.28;
  const lead = nose + speed * 0.1;
  const maxBw = Math.max(L.playerH * 0.14, cover - lead - tail - speed * 0.06);
  const bw = Math.min(bwWant, maxBw);
  const w = off + bw + L.playerH * (use === "low" ? 0.38 : 0.55);
  const c = pushChunk(sim, w, false, bh, bw, off);
  return c != null;
}

function spawnPad(sim: Sim, gear: Gear, kind: PadK): boolean {
  const L = sim.layout;
  const speed = speedAt(sim.cursor, L);
  const rest: Record<Gear, [number, number]> = {
    shell: [0.9, 1.08],
    skates: [1.08, 1.22],
    robo: [1.0, 1.24],
    jet: [0.96, 1.16],
    bluejet: [0.36, 0.5],
  };
  let [t0, t1] = rest[gear];
  if (gear === "bluejet") {
    const pressure = clamp((metersAt(sim) - BLUE_M) / 32, 0, 1);
    if (kind === "rest") {
      t0 = 0.4 - pressure * 0.18;
      t1 = 0.56 - pressure * 0.22;
    } else if (kind === "link") {
      t0 = 0.2 - pressure * 0.06;
      t1 = 0.32 - pressure * 0.08;
    } else {
      t0 = 0.95;
      t1 = 1.15;
    }
  } else if (kind === "link") {
    if (gear === "shell") {
      t0 = 1.0;
      t1 = 1.16;
    } else if (gear === "skates") {
      t0 = 1.1;
      t1 = 1.24;
    } else if (gear === "robo") {
      t0 = 0.26;
      t1 = 0.38;
    } else {
      t0 = 0.22;
      t1 = 0.34;
    }
  } else if (kind === "recovery") {
    t0 = 1.05;
    t1 = 1.28;
  }
  const w = speed * (t0 + sim.rand() * Math.max(0.04, t1 - t0));
  const c = pushChunk(sim, Math.max(L.playerW * 0.85, w), false);
  if (!c) return false;
  if (gear === "shell" && kind === "rest") attachShellPlat(sim, c);
  if (kind !== "link") {
    const roll = sim.rand();
    if (gear === "robo" && roll >= 0.52 && roll < 0.86) attachPlat(sim, c);
    else if (gear === "skates" && roll < 0.42) attachPlat(sim, c);
    else if ((gear === "jet" || gear === "bluejet") && roll > 0.82) attachPlat(sim, c);
    if ((gear === "robo" || gear === "jet") && c.platW <= 0 && mix01(sim.seed, Math.round(c.x) + 55) < 0.55) {
      attachHighAir(sim, c, "high");
      const j = mix01(sim.seed, Math.round(c.x) + 71);
      c.airDrop = L.playerH * Math.max(0.18, 2.45 + j * 0.25 - c.airH / L.playerH / 2);
    }
    maybeLettuce(sim, c, kind === "recovery" ? 0.48 : 0.64);
  } else if (sim.rand() < 0.18) {
    maybeLettuce(sim, c, 1);
  }
  return true;
}

function crowSpacing(gear: Gear): number {
  if (gear === "shell") return 11;
  if (gear === "skates") return 8;
  return 6.2;
}

function maybeDistanceCrow(sim: Sim): void {
  const gear = gearFor(metersAt(sim));
  if (gear === "bluejet") return;
  if (gear === "robo" && metersAt(sim) > JET_M - 14) return;
  if (gear === "jet" && metersAt(sim) > BLUE_M - 14) return;
  if (gear === "shell" && sim.shellCrows >= 3) return;
  const dueEarly = gear === "shell" && sim.shellCrows < 2 && metersAt(sim) > 28;
  if (metersAt(sim) < sim.crowAt && !dueEarly) return;
  const L = sim.layout;
  const speed = speedAt(sim.cursor, L);
  const place = () => {
    const band = crowBand(sim, sim.crowSeq);
    const approach = gear === "shell" || gear === "skates" || band === "low";
    if (approach) pushChunk(sim, speed * 0.6, false);
    const beat = pushChunk(sim, speed * (gear === "shell" ? 1.0 : 0.78), false);
    if (!beat) return;
    attachHighAir(sim, beat, band);
    if (metersAt(sim, beat.x) < ROBO_M) {
      beat.airBob = 0;
      beat.airPhase = 0;
    }
    if (approach) pushChunk(sim, speed * 0.65, false);
    if (gear === "shell") sim.shellCrows++;
  };
  place();
  sim.crowAt = metersAt(sim) + crowSpacing(gear);
}

function spawnOngoing(sim: Sim): void {
  const gear = gearFor(metersAt(sim));
  if (!sim.blueGate && gear === "bluejet") {
    sim.blueGate = true;
    sim.motifI = sim.motifN;
    const speed = speedAt(sim.cursor, sim.layout);
    pushChunk(sim, Math.max(sim.layout.playerW, speed * 0.45), false);
    return;
  }
  if (gear === "bluejet") {
    spawnFlight(sim);
    return;
  }
  if (!sim.jetGate && gear === "jet") {
    sim.jetGate = true;
    sim.motifI = sim.motifN;
    const L = sim.layout;
    const speed = speedAt(sim.cursor, L);
    const clearW = Math.max(L.w * 0.95, speed * 1.15);
    const c = pushChunk(sim, clearW, false);
    if (c) maybeLettuce(sim, c, 1, { count: 2, drop: L.playerH * 1.22 });
    return;
  }
  if (sim.script === 0) {
    if (sim.seed === LAYOUT_SEED) {
      spawnBarrier(sim, "shell", "mid");
      spawnPad(sim, "shell", "rest");
      sim.script = 1;
      return;
    }
    const roll = sim.rand();
    if (roll < 0.33) {
      spawnGap(sim, "shell", roll < 0.14 ? "narrow" : "mid");
      spawnPad(sim, "shell", "rest");
    } else if (roll < 0.72) {
      spawnBarrier(sim, "shell", roll < 0.5 ? "low" : "mid");
      spawnPad(sim, "shell", "rest");
    } else {
      spawnPad(sim, "shell", "rest");
      if (sim.rand() < 0.5) spawnGap(sim, "shell", "narrow");
      else spawnBarrier(sim, "shell", "low");
      spawnPad(sim, "shell", "rest");
    }
    sim.script = 2;
    return;
  }
  if (sim.script === 1) {
    spawnGap(sim, "shell", "mid");
    spawnPad(sim, "shell", "rest");
    sim.script = 2;
    return;
  }
  maybeDistanceCrow(sim);
  if (sim.motifI >= sim.motifN) {
    sim.motif = pickMotif(sim, gear);
    sim.motifN = motifLength(sim.motif, gear);
    sim.motifI = 0;
  }
  const i = sim.motifI++;
  const last = i >= sim.motifN - 1;
  const bigLanding = last && (sim.motif === "hopGap" || sim.motif === "stairs" || sim.motif === "rush");
  const pad: PadK = bigLanding ? "recovery" : last ? "rest" : "link";
  if (sim.motif === "single") {
    const roll = sim.rand();
    if (roll < (gear === "jet" ? 0.5 : 0.46)) {
      const kind: GapW = gear === "jet" && roll < 0.22 ? "wide" : "mid";
      spawnGap(sim, gear, kind);
      spawnPad(sim, gear, kind === "wide" ? "recovery" : "rest");
    } else {
      const h: BarH = gear === "jet" && roll > 0.78 ? "high" : gear === "jet" && roll > 0.64 ? "low" : "mid";
      spawnBarrier(sim, gear, h);
      spawnPad(sim, gear, h === "high" ? "recovery" : "rest");
    }
    return;
  }
  if (sim.motif === "twins") {
    const h: BarH = gear === "jet" && i === 1 && sim.rand() < 0.4 ? "mid" : "low";
    spawnBarrier(sim, gear, h);
    spawnPad(sim, gear, last ? "rest" : "link");
    return;
  }
  if (sim.motif === "hopGap") {
    if (i === 0) spawnBarrier(sim, gear, "low");
    else spawnGap(sim, gear, gear === "shell" || gear === "skates" ? "mid" : "wide");
    spawnPad(sim, gear, "recovery");
    return;
  }
  if (sim.motif === "stairs") {
    const hs: BarH[] = gear === "jet" ? ["low", "mid", "high"] : ["low", "mid"];
    spawnBarrier(sim, gear, hs[i] ?? "mid");
    spawnPad(sim, gear, pad);
    return;
  }
  spawnBarrier(sim, gear, i === sim.motifN - 1 && sim.rand() < 0.35 ? "mid" : "low");
  spawnPad(sim, gear, pad);
}

function endOfTrack(sim: Sim): number {
  return sim.cursor;
}

function ensure(sim: Sim): void {
  const target = sim.worldX + sim.layout.w + Math.max(480, sim.speed * 1.65);
  let n = 0;
  while (endOfTrack(sim) < target && n++ < 48) {
    const before = sim.count;
    spawnOngoing(sim);
    if (sim.count === before) break;
  }
  applyLettucePlan(sim);
}

export function extendCourse(sim: Sim, worldX: number): void {
  sim.worldX = worldX;
  let guard = 0;
  while (sim.cursor < worldX && guard++ < 12) ensure(sim);
}

function recycle(sim: Sim): void {
  const limit = sim.worldX - sim.layout.w;
  const len = sim.slots.length;
  while (sim.count > 0) {
    const c = sim.slots[sim.head]!;
    if (c.x + c.w >= limit) break;
    sim.head = (sim.head + 1) % len;
    sim.count--;
  }
}

function footX(sim: Sim): number {
  return sim.worldX + sim.shift;
}

function solidAt(sim: Sim, x: number): boolean {
  const len = sim.slots.length;
  for (let i = 0; i < sim.count; i++) {
    const c = sim.slots[(sim.head + i) % len]!;
    if (c.gap) continue;
    if (x >= c.x && x < c.x + c.w) return true;
  }
  return false;
}

function eachPlat(sim: Sim, fn: (top: number, left: number, right: number) => void): void {
  const ground = sim.layout.groundY;
  eachChunk(sim, (c) => {
    if (c.platW > 0 && c.platDrop > 0) {
      const left = c.x + c.platOff;
      fn(ground - c.platDrop, left, left + c.platW);
    }
    if (c.plat2W > 0 && c.plat2Drop > 0) {
      const left = c.x + c.plat2Off;
      fn(ground - c.plat2Drop, left, left + c.plat2W);
    }
  });
}

function overlapsBarrier(sim: Sim): boolean {
  const L = sim.layout;
  const foot = footX(sim);
  const hitLeft = foot - L.playerW * 0.28;
  const hitRight = foot + L.playerW * 0.36;
  const hitTop = sim.y - L.playerH * 0.62;
  const hitBot = sim.y - L.playerH * 0.08;
  const len = sim.slots.length;
  for (let i = 0; i < sim.count; i++) {
    const c = sim.slots[(sim.head + i) % len]!;
    if (c.barrierH <= 0) continue;
    const inset = L.playerH * 0.05;
    const bl = c.x + c.barrierOff + inset;
    const br = c.x + c.barrierOff + c.barrierW - inset;
    const bt = L.groundY - c.barrierH + inset;
    const bb = L.groundY;
    if (hitRight > bl && hitLeft < br && hitBot > bt && hitTop < bb) return true;
  }
  return false;
}

/** Smallest floater the course used to spawn, as a fraction of the player height. */
export const CROW_HIT_W = 0.34;
export const CROW_HIT_H = 0.18;
/** Radians per second. A full rise and fall takes about five and a half seconds. */
const CROW_BOB_SPEED = 1.15;

export function crowMotionDrop(
  chunk: { airDrop: number; airBob: number; airPhase: number },
  time: number,
  playerH: number,
): number {
  if (chunk.airBob <= 0) return chunk.airDrop;
  const wave = 0.5 - 0.5 * Math.cos(time * CROW_BOB_SPEED + chunk.airPhase);
  const low = playerH * 0.26;
  const high = Math.max(low + playerH * 0.4, chunk.airBob);
  return low + (high - low) * wave;
}

export function crowHitBox(
  layout: Layout,
  x: number,
  drop: number,
  w: number,
  h: number,
): { left: number; right: number; top: number; bottom: number } {
  const bw = layout.playerH * CROW_HIT_W;
  const bh = layout.playerH * CROW_HIT_H;
  const inset = layout.playerH * 0.04;
  const midX = x + w / 2;
  const midY = layout.groundY - drop - h / 2;
  return {
    left: midX - bw / 2 + inset,
    right: midX + bw / 2 - inset,
    top: midY - bh / 2 + inset,
    bottom: midY + bh / 2 - inset,
  };
}

function overlapsAir(sim: Sim): boolean {
  const L = sim.layout;
  const foot = footX(sim);
  const hitLeft = foot - L.playerW * 0.26;
  const hitRight = foot + L.playerW * 0.32;
  const hitTop = sim.y - L.playerH * 0.6;
  const hitBot = sim.y - L.playerH * 0.1;
  const inset = L.playerH * 0.04;
  let hit = false;
  eachChunk(sim, (c) => {
    if (hit) return;
    const gate = c.air2W > 0 && c.air2H > 0;
    if (!gate) {
      if (c.airW <= 0 || c.airH <= 0) return;
      const drop = crowMotionDrop(c, sim.runT, L.playerH);
      const box = crowHitBox(L, c.x + c.airOff, drop, c.airW, c.airH);
      if (hitRight > box.left && hitLeft < box.right && hitBot > box.top && hitTop < box.bottom) hit = true;
      return;
    }
    const boxes: Array<[number, number, number, number]> = [
      [c.airOff, c.airDrop, c.airW, c.airH],
      [c.air2Off, c.air2Drop, c.air2W, c.air2H],
    ];
    for (const [off, drop, w, h] of boxes) {
      if (w <= 0 || h <= 0) continue;
      const bl = c.x + off + inset;
      const br = c.x + off + w - inset;
      const bb = L.groundY - drop - inset;
      const bt = bb - h + inset * 2;
      if (hitRight > bl && hitLeft < br && hitBot > bt && hitTop < bb) {
        hit = true;
        return;
      }
    }
  });
  return hit;
}

function die(sim: Sim, cause: Cause, events: Events): void {
  if (sim.phase !== "run" || cause == null) return;
  sim.score = Math.floor(metersOf(sim));
  sim.points = runScore(sim.score, sim.runT, sim.lettuces);
  sim.newBest = sim.points > sim.best;
  if (sim.newBest) sim.best = sim.points;
  sim.cause = cause;
  sim.phase = "dead";
  sim.deathT = 0;
  events.die = true;
}

export function lettuceWorldY(groundY: number, c: Chunk, i: number, playerH: number): number {
  if (c.letLow & (1 << i)) return groundY - playerH * 0.32;
  const extra = i === 1 ? c.letStagger : 0;
  return groundY - c.letDrop - extra;
}

function collectLettuce(sim: Sim, events: Events): void {
  const L = sim.layout;
  const foot = footX(sim);
  const pad = L.playerH * 0.1;
  const hitLeft = foot - L.playerW * 0.34 - pad;
  const hitRight = foot + L.playerW * 0.4 + pad;
  const hitTop = sim.y - L.playerH * 0.7 - pad;
  const hitBot = sim.y - L.playerH * 0.02 + pad;
  eachChunk(sim, (c) => {
    if (c.letN <= 0 || c.letGot === (1 << c.letN) - 1) return;
    for (let i = 0; i < c.letN; i++) {
      const bit = 1 << i;
      if (c.letGot & bit) continue;
      const x = c.x + c.letOff + i * c.letGap;
      const y = lettuceWorldY(L.groundY, c, i, L.playerH);
      if (x < hitLeft || x > hitRight || y < hitTop || y > hitBot) continue;
      c.letGot |= bit;
      sim.lettuces++;
      events.collect = true;
    }
  });
}

function launch(sim: Sim, held: boolean, dt: number, events: Events): void {
  const L = sim.layout;
  const g = L.playerH * GRAVITY_K;
  sim.lifting = true;
  sim.jumpT = held ? Math.min(JUMP_HOLD, dt) : 0;
  sim.vy = -L.playerH * jumpVyK(sim.jumpT);
  if (!held) {
    sim.lifting = false;
    sim.vy += g * dt;
  }
  sim.y += sim.vy * dt;
  sim.grounded = false;
  sim.coyote = 0;
  sim.buffer = 0;
  sim.jumpedOnce = true;
  events.jump = true;
}

/** Desktop presses call this immediately. A grounded shell always jumps. */
export function jumpNow(sim: Sim): "ground" | "air" | "blocked" {
  if (sim.phase !== "run" || sim.gear === "bluejet") return "blocked";
  const L = sim.layout;
  const onGround =
    sim.grounded ||
    sim.coyote > 0 ||
    (sim.vy >= 0 && Math.abs(sim.y - L.groundY) <= Math.max(10, L.playerH * 0.08));
  const events: Events = { jump: false, land: false, die: false, gear: null, collect: false };
  if (onGround) {
    sim.grounded = true;
    sim.airJumps = maxAirJumps(sim.gear);
    sim.buffer = 0;
    sim.jumpWasDown = true;
    launch(sim, true, 1 / 60, events);
    return "ground";
  }
  if (sim.airJumps > 0 && maxAirJumps(sim.gear) > 0) {
    sim.airJumps -= 1;
    sim.buffer = 0;
    sim.jumpWasDown = true;
    launch(sim, true, 1 / 60, events);
    return "air";
  }
  return "blocked";
}

function finishStep(sim: Sim, events: Events): void {
  const L = sim.layout;
  sim.score = Math.floor(metersOf(sim));
  const gear = gearFor(metersOf(sim));
  if (gear !== sim.gear) {
    const prev = sim.gear;
    sim.gear = gear;
    events.gear = gear;
    if (gear === "bluejet" && prev !== "bluejet") {
      sim.y = clamp(L.groundY - L.playerH * 1.2, L.playerH * 0.55, L.groundY - 8);
      sim.vy = 0;
      sim.shift = 0;
      sim.grounded = false;
      sim.lifting = false;
      sim.airJumps = 0;
      sim.grace = 0.32;
    }
    if (!canDouble(gear)) sim.airJumps = 0;
  }
  recycle(sim);
  ensure(sim);
}

function stepFlight(sim: Sim, dt: number, flyX: number, flyY: number, events: Events): void {
  const L = sim.layout;
  sim.speed = speedAt(sim.worldX, L);
  sim.worldX += sim.speed * dt;
  const fly = L.playerH * 6.6;
  const mag = Math.hypot(flyX, flyY);
  let sx = flyX;
  let sy = flyY;
  if (mag > 1) {
    sx /= mag;
    sy /= mag;
  }
  sim.shift = clamp(sim.shift + sx * fly * dt, -L.playerX * 0.62, (L.w - L.playerX) * 0.58);
  const prevY = sim.y;
  const yMin = L.playerH * 0.48;
  const yMax = L.groundY - 2;
  sim.y = clamp(sim.y + sy * fly * dt, yMin, yMax);
  if (sy >= 0) {
    const foot = footX(sim);
    let perch: number | null = null;
    eachPlat(sim, (top, left, right) => {
      if (foot < left || foot > right) return;
      if (prevY <= top + 8 && sim.y >= top) {
        if (perch == null || top < perch) perch = top;
      }
    });
    if (perch != null) sim.y = clamp(perch, yMin, yMax);
  }
  sim.vy = sy * fly;
  sim.grounded = false;
  sim.lifting = false;
  sim.airJumps = 0;
  collectLettuce(sim, events);
  if (sim.grace > 0) sim.grace = Math.max(0, sim.grace - dt);
  else if (overlapsAir(sim)) {
    die(sim, "air", events);
    return;
  }
  finishStep(sim, events);
}

function step(sim: Sim, dt: number, jumpEdge: boolean, held: boolean, flyX: number, flyY: number, events: Events): void {
  if (sim.gear === "bluejet") {
    stepFlight(sim, dt, flyX, flyY, events);
    return;
  }

  const L = sim.layout;
  const g = L.playerH * GRAVITY_K;
  const fullV = L.playerH * JUMP_V_K;
  const prevY = sim.y;

  sim.speed = speedAt(sim.worldX, L);
  sim.worldX += sim.speed * dt;

  if (!sim.grounded) {
    if (sim.lifting && held && sim.jumpT < JUMP_HOLD && sim.vy <= 0) {
      sim.jumpT = Math.min(JUMP_HOLD, sim.jumpT + dt);
      sim.vy = -L.playerH * jumpVyK(sim.jumpT);
    } else {
      sim.lifting = false;
      sim.vy += g * dt;
      const maxFall = fullV * 1.35;
      if (sim.vy > maxFall) sim.vy = maxFall;
    }
    sim.y += sim.vy * dt;
  }

  const foot = footX(sim);
  if (!sim.grounded && sim.vy >= 0) {
    let land: number | null = null;
    if (solidAt(sim, foot) && prevY <= L.groundY + 6 && sim.y >= L.groundY - 2) land = L.groundY;
    eachPlat(sim, (top, left, right) => {
      if (foot < left || foot > right) return;
      if (prevY <= top + 8 && sim.y >= top - 2) {
        if (land == null || top < land) land = top;
      }
    });
    if (land != null) {
      sim.y = land;
      sim.vy = 0;
      sim.grounded = true;
      sim.coyote = 0;
      sim.lifting = false;
      sim.airJumps = extraJumps(sim.gear);
      if (!held) sim.jumpWasDown = false;
      events.land = true;
    }
  } else if (sim.grounded) {
    let still = Math.abs(sim.y - L.groundY) < 3 && solidAt(sim, foot);
    if (!still) {
      eachPlat(sim, (top, left, right) => {
        if (still) return;
        if (foot >= left && foot <= right && Math.abs(sim.y - top) < 4) still = true;
      });
    }
    if (!still) {
      sim.grounded = false;
      sim.coyote = COYOTE;
    } else {
      sim.vy = 0;
    }
  } else {
    sim.coyote = Math.max(0, sim.coyote - dt);
  }

  if (jumpEdge) sim.buffer = BUFFER;
  else sim.buffer = Math.max(0, sim.buffer - dt);

  const canGround = sim.grounded || sim.coyote > 0;
  // A fresh press on the ground always jumps, even if air jumps were left at zero.
  if (canGround && (jumpEdge || sim.buffer > 0)) {
    sim.airJumps = extraJumps(sim.gear);
    launch(sim, held, dt, events);
  } else if (jumpEdge && sim.airJumps > 0 && extraJumps(sim.gear) > 0) {
    sim.airJumps -= 1;
    launch(sim, held, dt, events);
  }

  collectLettuce(sim, events);

  if (overlapsBarrier(sim) || overlapsAir(sim)) {
    die(sim, overlapsAir(sim) && !overlapsBarrier(sim) ? "air" : "barrier", events);
    return;
  }
  if (sim.y > L.groundY + L.playerH * 0.48) {
    die(sim, "gap", events);
    return;
  }

  finishStep(sim, events);
}

function controlOf(input: boolean | Control): Control {
  if (typeof input === "boolean") return { held: input, flyX: 0, flyY: 0 };
  return input;
}

export function tick(sim: Sim, frameDt: number, input: boolean | Control): Events {
  const events: Events = { jump: false, land: false, die: false, gear: null, collect: false };
  const control = controlOf(input);
  const held = control.held;
  if (sim.phase === "run" || sim.phase === "dead") sim.anim += frameDt;
  if (sim.phase === "run") sim.runT += Math.min(frameDt, 0.05);
  if (sim.phase === "dead") sim.deathT += frameDt;
  if (sim.phase !== "run") {
    sim.jumpWasDown = false;
    return events;
  }
  const jumpEdge = control.edge === true || (held && !sim.jumpWasDown);
  sim.jumpWasDown = held;
  sim.acc += Math.min(frameDt, 0.05);
  let n = 0;
  let edge = jumpEdge;
  while (sim.acc >= STEP && n++ < 5) {
    step(sim, STEP, edge, held, control.flyX, control.flyY, events);
    edge = false;
    sim.acc -= STEP;
    if (sim.phase !== "run") break;
  }
  return events;
}

/** Next hazard in front of the shell. Used by tests and not by the player. */
export function nextHazard(
  sim: Sim,
): { dist: number; kind: "gap" | "barrier"; w: number } | null {
  let best: { dist: number; kind: "gap" | "barrier"; w: number } | null = null;
  eachChunk(sim, (c) => {
    if (c.gap) {
      const end = c.x + c.w;
      if (end < sim.worldX) return;
      const dist = c.x - sim.worldX;
      if (!best || dist < best.dist) best = { dist, kind: "gap", w: c.w };
      return;
    }
    if (c.barrierH <= 0) return;
    const start = c.x + c.barrierOff;
    const end = start + c.barrierW;
    if (end < sim.worldX) return;
    const dist = start - sim.worldX;
    if (!best || dist < best.dist) best = { dist, kind: "barrier", w: c.barrierW };
  });
  return best;
}
