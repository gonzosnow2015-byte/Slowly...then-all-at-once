/** Side-view runner simulation. Art-free so it can be stepped in tests. */

export type Gear = "shell" | "skates" | "robo" | "jet" | "bluejet";
export type Phase = "title" | "ready" | "run" | "dead";
export type Cause = "barrier" | "rock" | "cone" | "gap" | "air" | "seagull" | "rat" | "coyote" | null;

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
  /** Third deck, above the second. 0 = none. */
  plat3W: number;
  plat3Off: number;
  plat3Drop: number;
  /** Fourth deck, above the third. Stages 3–4 only. 0 = none. */
  plat4W: number;
  plat4Off: number;
  plat4Drop: number;
  /** Feet height above the ground. 0 means the obstacle sits on the road. */
  barrierDrop: number;
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
  /**
   * Stage 5 flyer between the gates. 0 none, 1 bird, 2 mouch.
   * Sprites can replace the placeholders later. Not a gate.
   */
  flyKind: number;
  /** Left edge of the flyer body, inside this chunk. */
  flyOff: number;
  /** Bottom of the flyer, above the ground. */
  flyDrop: number;
};

export type Cloud = { x: number; y: number; r: number; v: number };

export type Rat = {
  x: number;
  dir: number;
  home: number;
  reach: number;
  /** World y of the feet. The road, or the top of a platform. */
  feet: number;
  /** Prefer a nearby platform when one is generated. */
  wantPlat: boolean;
  /** Already moved onto a deck. */
  seated: boolean;
  /** Seconds left stunned after a stomp. 0 means it is patrolling. */
  stun: number;
};

export type Coyote = Rat & {
  speed: number;
  /** Seconds left standing still before the turn. */
  pause: number;
  /** How long the next pause lasts. */
  wait: number;
  /** Walk-cycle time. Frozen while paused so the pose holds. */
  anim: number;
};

export type Events = {
  jump: boolean;
  land: boolean;
  die: boolean;
  gear: Gear | null;
  collect: boolean;
  /** Set when a ground enemy was stomped this frame. */
  stomp: "rat" | "coyote" | "both" | null;
  /** Shell slide just started. */
  slide: boolean;
};

export type Control = {
  held: boolean;
  /** Stage 5 stick. -1..1, +x right, +y down the screen. */
  flyX: number;
  flyY: number;
  /** A new press this frame. Counts even if an older touch never released. */
  edge?: boolean;
  /** Hold down / pull down. Stages 1–4 shell slide. Ignored in flight. */
  slide?: boolean;
  /**
   * Upward flick as the slide ends, 0..1. 0 stays on the ground.
   * 1 matches a fully held jump. Ignored in stage 5.
   */
  slidePop?: number;
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
  /** World-x before which stage 5 hazards stay hidden. 0 until Afterburner starts. */
  blueClear: number;
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
  /** Tucked into the shell sprite and sliding. Stages 1–4 only. */
  shelling: boolean;
  /** Shell slides left this run. */
  shellsLeft: number;
  jumpedOnce: boolean;
  clouds: Cloud[];
  /** Ground rats in stages 3 and 4. */
  rats: Rat[];
  /** Ground coyotes in stages 1 and 2. */
  coyotes: Coyote[];
  /** Course seed. Restarts keep it; re-roll replaces it. */
  seed: number;
  /** World-x of each planned lettuce. Same list every run for a given layout and seed. */
  letMarks: number[];
  /** Parallel to letMarks. True when that lettuce is on the ground. */
  letLows: boolean[];
  /** Parallel to letMarks. True once a platform has claimed that air lettuce. */
  letParked: boolean[];
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
export const RAMP_METERS = 349;
export const SKATES_M = 100;
export const ROBO_M = 200;
export const JET_M = 300;
export const BLUE_M = 400;
/** Stage 5 flyer slots. 1 is the later bird sprite, 2 is Mouch. */
export const FLY_BIRD = 1;
export const FLY_MOUCH = 2;
/** Drawn body, as a fraction of the player height. The hitbox is tighter. */
export const FLY_BODY_W = 0.36;
export const FLY_BODY_H = 0.22;
export const FLY_HIT_W = 0.2;
export const FLY_HIT_H = 0.11;
/** Shell slides available each run. */
export const SHELL_SLIDES = 3;
/** Slide art and hitbox, relative to the first tuck. Keeps him under low floaters. */
export const SHELL_SLIDE_SCALE = 1.18;
/** How much faster a shell slide is than the normal run. */
const SLIDE_SPEED = 1.2;
/** Same count in stages 1–4. Stage 5 has no lettuce. */
export const LETTUCE_PER_STAGE = 10;
/** Stages 1–4. Half again the original count. */
export const LETTUCE_RUN_STAGE = 15;

export function lettuceQuota(stage: number): number {
  return stage < 4 ? LETTUCE_RUN_STAGE : 0;
}
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
    plat3W: 0,
    plat3Off: 0,
    plat3Drop: 0,
    plat4W: 0,
    plat4Off: 0,
    plat4Drop: 0,
    barrierDrop: 0,
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
    flyKind: 0,
    flyOff: 0,
    flyDrop: 0,
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
    blueClear: 0,
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
    shelling: false,
    shellsLeft: SHELL_SLIDES,
    jumpedOnce: false,
    clouds: [],
    rats: [],
    coyotes: [],
    seed: opts.seed || LAYOUT_SEED,
    letMarks: [],
    letLows: [],
    letParked: [],
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

/** Temporary test start. Set to ROBO_M for stage 3, JET_M for stage 4, BLUE_M for stage 5. 0 starts at stage 1. */
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
  if (sim.gear === "bluejet") {
    sim.y = clamp(L.groundY - L.playerH * 1.2, L.playerH * 0.55, L.groundY - 8);
    sim.vy = 0;
    sim.shift = 0;
    sim.grounded = false;
    sim.lifting = false;
    sim.airJumps = 0;
    const ahead = L.w - L.playerX;
    sim.blueClear = sim.worldX + sim.speed * 3 + ahead;
    sim.grace = 3;
  }
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

function openJetClear(sim: Sim): void {
  if (sim.jetGate) return;
  const jetX = sim.layout.playerH * METER_K * JET_M;
  if (sim.cursor < jetX) return;
  sim.jetGate = true;
  sim.motifI = sim.motifN;
  const L = sim.layout;
  const speed = speedAt(sim.cursor, L);
  const clearW = Math.max(L.w * 0.95, speed * 1.15);
  const c = alloc(sim);
  if (!c) return;
  c.x = sim.cursor;
  c.w = Math.max(8, clearW);
  c.gap = false;
  c.barrierH = 0;
  c.barrierW = 0;
  c.barrierOff = 0;
  c.platW = 0;
  c.platOff = 0;
  c.platDrop = 0;
  c.plat2W = 0;
  c.plat2Off = 0;
  c.plat2Drop = 0;
  c.plat3W = 0;
  c.plat3Off = 0;
  c.plat3Drop = 0;
  c.plat4W = 0;
  c.plat4Off = 0;
  c.plat4Drop = 0;
  c.barrierDrop = 0;
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
  c.flyKind = 0;
  c.flyOff = 0;
  c.flyDrop = 0;
  sim.cursor += c.w;
  maybeLettuce(sim, c, 1, { count: 2, drop: L.playerH * 1.22 });
}

function pushChunk(
  sim: Sim,
  w: number,
  gap: boolean,
  barrierH = 0,
  barrierW = 0,
  barrierOff = 0,
): Chunk | null {
  openJetClear(sim);
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
  c.plat3W = 0;
  c.plat3Off = 0;
  c.plat3Drop = 0;
  c.plat4W = 0;
  c.plat4Off = 0;
  c.plat4Drop = 0;
  c.barrierDrop = 0;
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
  c.flyKind = 0;
  c.flyOff = 0;
  c.flyDrop = 0;
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
  sim.letParked = plan.marks.map(() => false);
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
  sim.rats = placeRats(sim);
  sim.coyotes = placeCoyotes(sim);
  eachChunk(sim, (c) => seatEnemies(sim, c));
  shiftEnemiesOffHazards(sim);
  spaceEnemies(sim);
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

/** Stages 1–4. Stage 5 is endless and has no lettuce. */
function lettucePlan(layout: Layout, seed: number): { marks: number[]; lows: boolean[] } {
  const px = layout.playerH * METER_K;
  const starts = [0, SKATES_M, ROBO_M, JET_M];
  const ends = [SKATES_M, ROBO_M, JET_M, BLUE_M];
  const marks: number[] = [];
  const lows: boolean[] = [];
  for (let s = 0; s < starts.length; s++) {
    const a = starts[s]!;
    const span = ends[s]! - a;
    const n = lettuceQuota(s);
    if (seed === LAYOUT_SEED) {
      const groundN = s >= 4 ? 3 + Math.floor(hash01(seed * 5 + s * 11) * 3) : 4 + Math.floor(hash01(seed * 5 + s * 11) * 2);
      const shift = Math.floor(hash01(seed * 9 + s * 7) * n);
      for (let k = 0; k < n; k++) {
        const slot = (k + 0.5) / n;
        const jitter = (hash01(seed * 17 + s * 100 + k * 13) - 0.5) * 0.5 / n;
        const m = a + span * clamp(slot + jitter, 0.03, 0.97);
        marks.push(m * px);
        lows.push((k + shift) % n < groundN);
      }
      continue;
    }
    const stageLows: boolean[] = [];
    let ground = 0;
    const groundChance = s >= 4 ? 45 : 32;
    for (let k = 0; k < n; k++) {
      const u = (k + mix01(mix32(seed, s + 1), k + 3)) / n;
      marks.push((a + span * clamp(u, 0.04, 0.96)) * px);
      const low = mix32(seed, s * 20 + k + 5) % 100 < groundChance;
      stageLows.push(low);
      if (low) ground++;
    }
    if (ground === 0) stageLows[mix32(seed, s + 8) % n] = true;
    if (ground === n) stageLows[mix32(seed, s + 4) % n] = false;
    lows.push(...stageLows);
  }
  return { marks, lows };
}

function placeRats(sim: Sim): Rat[] {
  const L = sim.layout;
  const px = L.playerH * METER_K;
  const stages = [
    { a: ROBO_M, b: JET_M, salt: 3 },
    { a: JET_M, b: BLUE_M, salt: 4 },
  ];
  const rats: Rat[] = [];
  for (const s of stages) {
    const base = 4 + (mix32(sim.seed, s.salt) % 2);
    const n = Math.round(base * 1.5);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const j = (mix01(sim.seed, s.salt * 20 + i + 1) - 0.5) * 0.16;
      const m = s.a + (s.b - s.a) * clamp(u + j, 0.12, 0.88);
      const x = m * px;
      const reach = L.playerH * (1.7 + mix01(sim.seed, s.salt * 40 + i + 2) * 1.15);
      const dir = mix32(sim.seed, s.salt * 9 + i + 3) % 2 === 0 ? 1 : -1;
      const wantPlat = mix01(sim.seed, s.salt * 31 + i + 8) < 0.82;
      rats.push({ x, dir, home: x, reach, feet: L.groundY, wantPlat, seated: false, stun: 0 });
    }
  }
  return rats;
}

function placeCoyotes(sim: Sim): Coyote[] {
  const L = sim.layout;
  const px = L.playerH * METER_K;
  const stages = [
    { a: 10, b: SKATES_M - 3, salt: 11, n: 4, extra: 2, speed: L.playerH * 0.48, wait: 2.7 },
    { a: SKATES_M + 8, b: ROBO_M - 6, salt: 12, n: 4, extra: 3, speed: L.playerH * 0.78, wait: 2.1 },
  ];
  const coyotes: Coyote[] = [];
  for (const s of stages) {
    for (let i = 0; i < s.n; i++) {
      const u = (i + 0.5) / s.n;
      const j = (mix01(sim.seed, s.salt * 20 + i + 1) - 0.5) * 0.12;
      const m = s.a + (s.b - s.a) * clamp(u + j, 0.08, 0.92);
      const x = m * px;
      const reach = L.playerH * (1.5 + mix01(sim.seed, s.salt * 40 + i + 2) * 0.9);
      const dir = mix32(sim.seed, s.salt * 9 + i + 3) % 2 === 0 ? 1 : -1;
      const wait = s.wait + mix01(sim.seed, s.salt * 15 + i) * (s.wait > 2.4 ? 0.3 : 0.5);
      const wantPlat = mix01(sim.seed, s.salt * 31 + i + 8) < 0.82;
      coyotes.push({
        x,
        dir,
        home: x,
        reach,
        speed: s.speed,
        pause: 0,
        wait,
        anim: i * 0.2,
        feet: L.groundY,
        wantPlat,
        seated: false,
        stun: 0,
      });
    }
    // A few more, always on the road. Stage 1 gets fewer than stage 2.
    for (let i = 0; i < s.extra; i++) {
      const u = (i + 0.5) / s.extra;
      const shifted = (u + 0.5 / s.n) % 1;
      const j = (mix01(sim.seed, s.salt * 70 + i + 4) - 0.5) * 0.08;
      const m = s.a + (s.b - s.a) * clamp(shifted + j, 0.12, 0.88);
      let x = m * px;
      const reach = L.playerH * (1.4 + mix01(sim.seed, s.salt * 80 + i) * 0.7);
      const lo = s.a * px;
      const hi = s.b * px;
      for (const other of coyotes) {
        if (Math.abs(other.x - x) >= L.playerH * 1.6) continue;
        const nudged = x + L.playerH * 1.8;
        x = nudged <= hi ? nudged : Math.max(lo, x - L.playerH * 1.8);
      }
      const dir = mix32(sim.seed, s.salt * 90 + i) % 2 === 0 ? 1 : -1;
      const wait = s.wait + mix01(sim.seed, s.salt * 60 + i) * 0.4;
      coyotes.push({
        x,
        dir,
        home: x,
        reach,
        speed: s.speed,
        pause: 0,
        wait,
        anim: 0.4 + i * 0.15,
        feet: L.groundY,
        wantPlat: false,
        seated: false,
        stun: 0,
      });
    }
  }
  return coyotes;
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
  let onDeck = false;
  eachDeck(c, (off, w, deckDrop) => {
    if (local < off - 6 || local > off + w + 6) return;
    if (!onDeck || deckDrop > drop) {
      drop = deckDrop + L.playerH * (0.22 + hsh * 0.1);
      onDeck = true;
    }
  });
  if (!onDeck && gear === "bluejet") {
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
  c.letDrop = onDeck ? Math.max(L.playerH * 0.35, drop) : Math.min(cap, Math.max(L.playerH * 0.35, drop));
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
  const order = sim.letMarks.map((_, i) => i).sort((a, b) => sim.letMarks[a]! - sim.letMarks[b]!);
  sim.letMarks = order.map((i) => sim.letMarks[i]!);
  sim.letLows = order.map((i) => sim.letLows[i]!);
  sim.letParked = order.map((i) => sim.letParked[i]!);
  const pending: Chunk[] = [];
  eachChunk(sim, (c) => {
    if (c.x + c.w <= sim.letPlacedUntil) return;
    pending.push(c);
  });
  pending.sort((a, b) => a.x - b.x);
  if (pending.length === 0) return;
  const start = pending[0]!.x;
  sim.letMarkI = 0;
  while (sim.letMarkI < sim.letMarks.length && sim.letMarks[sim.letMarkI]! < start) sim.letMarkI++;
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

/** A few decks in stage 1. Low, mid, and an occasional third step. */
function attachShellPlat(sim: Sim, c: Chunk): void {
  if (metersAt(sim, c.x) < 8) return;
  const seeded = sim.seed !== LAYOUT_SEED;
  if ((seeded ? mix01(sim.seed, c.x) : hash01(c.x * 0.013 + sim.seed)) > 0.78) return;
  attachDecks(sim, c);
}

function attachPlat(sim: Sim, c: Chunk): void {
  const gear = gearFor(Math.max(0, c.x) / (sim.layout.playerH * METER_K));
  if (gear === "bluejet") {
    attachFlightPlat(sim, c);
    return;
  }
  attachDecks(sim, c);
}

function attachFlightPlat(sim: Sim, c: Chunk): void {
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

type Deck = { off: number; w: number; drop: number };

function eachDeck(c: Chunk, fn: (off: number, w: number, drop: number) => void): void {
  if (c.platW > 0 && c.platDrop > 0) fn(c.platOff, c.platW, c.platDrop);
  if (c.plat2W > 0 && c.plat2Drop > 0) fn(c.plat2Off, c.plat2W, c.plat2Drop);
  if (c.plat3W > 0 && c.plat3Drop > 0) fn(c.plat3Off, c.plat3W, c.plat3Drop);
  if (c.plat4W > 0 && c.plat4Drop > 0) fn(c.plat4Off, c.plat4W, c.plat4Drop);
}

/** Three bands in stages 1–2. Stages 3–4 add a fourth hop above the old high deck. */
function deckBands(gear: Gear): Array<[number, number]> {
  if (gear === "shell" || gear === "skates") return [[0.62, 0.86], [1.32, 1.56], [1.9, 2.1]];
  if (gear === "robo") return [[0.7, 1.05], [1.58, 1.95], [2.22, 2.62], [2.95, 3.32]];
  return [[0.76, 1.12], [1.72, 2.12], [2.48, 2.92], [3.35, 3.85]];
}

function attachDecks(sim: Sim, c: Chunk): void {
  const L = sim.layout;
  const gear = gearFor(Math.max(0, c.x) / (L.playerH * METER_K));
  if (gear === "bluejet" || c.gap) return;
  const early = gear === "shell" || gear === "skates";
  const late = gear === "robo" || gear === "jet";
  const r = sim.rand();
  let count = 1;
  let start = 0;
  // Mix of solo steps and Mario-style stairs. The high band shows up often, but not on every pad.
  if (early) {
    if (r < 0.1) { count = 1; start = 0; }
    else if (r < 0.2) { count = 1; start = 1; }
    else if (r < 0.36) { count = 2; start = 0; }
    else if (r < 0.64) { count = 2; start = 1; }
    else { count = 3; start = 0; }
  } else if (r < 0.34) { count = 4; start = 0; }
  else if (r < 0.52) { count = 3; start = 0; }
  else if (r < 0.7) { count = 3; start = 1; }
  else if (r < 0.82) { count = 2; start = 0; }
  else if (r < 0.91) { count = 2; start = 1; }
  else { count = 2; start = 2; }
  const bands = deckBands(gear);
  const heights: number[] = [];
  let prev = 0;
  for (let i = 0; i < count; i++) {
    const [a, b] = bands[start + i]!;
    let h = a + sim.rand() * (b - a);
    if (prev > 0 && h < prev + 0.42) h = prev + 0.42 + sim.rand() * 0.12;
    heights.push(h);
    prev = h;
  }
  if (late) {
    const ceiling = (L.groundY - L.playerH * 1.15) / L.playerH;
    for (let i = heights.length - 1; i >= 0; i--) {
      const cap = ceiling - (heights.length - 1 - i) * 0.46;
      if (heights[i]! > cap) heights[i] = Math.max(0.58, cap);
    }
    for (let i = 1; i < heights.length; i++) {
      if (heights[i]! < heights[i - 1]! + 0.42) heights[i] = heights[i - 1]! + 0.42;
    }
    const top = heights[heights.length - 1]!;
    if (top > ceiling) {
      const over = top - ceiling;
      for (let i = 0; i < heights.length; i++) heights[i] = Math.max(0.55, heights[i]! - over);
    }
  }
  const lead = L.playerW * 0.28;
  const maxW = c.w * (heights.length === 1 ? 1.2 : heights.length === 2 ? 1.65 : 2.05);
  const tail = L.playerW * 0.42;
  const budget = Math.max(L.playerW * 1.2, maxW - lead - tail);
  let weight = 0;
  const spans: number[] = [];
  for (let i = 0; i < heights.length; i++) {
    const span = !late
      ? i === 0
        ? 1.35 + sim.rand() * 1.15
        : 1.05 + sim.rand() * 0.85
      : sim.rand() < 0.28
        ? 0.95 + sim.rand() * 0.4
        : sim.rand() < 0.55
          ? 1.4 + sim.rand() * 0.85
          : 2.35 + sim.rand() * 1.45;
    spans.push(span);
    weight += span;
    if (i > 0) weight += 0.28;
  }
  const scale = weight * L.playerW > budget ? budget / (weight * L.playerW) : 1;
  let cursor = lead;
  const decks: Deck[] = [];
  for (let i = 0; i < heights.length; i++) {
    const w = Math.max(L.playerW * 0.95, L.playerW * spans[i]! * scale);
    if (i > 0) {
      const prev = decks[i - 1]!;
      if (late) {
        const gap = L.playerW * (0.8 + sim.rand() * 1.7);
        cursor = prev.off + prev.w + gap;
      } else {
        const overlap = sim.rand() < 0.55;
        const gap = overlap ? -prev.w * (0.18 + sim.rand() * 0.32) : L.playerW * (0.22 + sim.rand() * 0.85) * scale;
        cursor = Math.max(prev.off + L.playerW * 0.5, prev.off + prev.w + gap);
      }
    }
    decks.push({ off: cursor, w, drop: L.playerH * heights[i]! });
    cursor += w;
  }
  const boundary = (gear === "robo" ? JET_M : gear === "jet" ? BLUE_M : Infinity) * L.playerH * METER_K;
  while (decks.length > 1 && c.x + decks[decks.length - 1]!.off + decks[decks.length - 1]!.w + tail > boundary) {
    decks.pop();
  }
  cursor = decks[decks.length - 1]!.off + decks[decks.length - 1]!.w;
  const fit = cursor + tail;
  if (fit > c.w) {
    const room = Math.max(c.w, boundary - c.x);
    const extra = Math.min(fit, room) - c.w;
    if (extra > 0) {
      c.w += extra;
      sim.cursor += extra;
    }
  }
  const ordered = [...decks].sort((a, b) => a.drop - b.drop);
  const slots = ordered;
  if (slots[0]) {
    c.platOff = slots[0].off;
    c.platW = slots[0].w;
    c.platDrop = slots[0].drop;
  }
  if (slots[1]) {
    c.plat2Off = slots[1].off;
    c.plat2W = slots[1].w;
    c.plat2Drop = slots[1].drop;
  }
  if (slots[2]) {
    c.plat3Off = slots[2].off;
    c.plat3W = slots[2].w;
    c.plat3Drop = slots[2].drop;
  }
  if (slots[3]) {
    c.plat4Off = slots[3].off;
    c.plat4W = slots[3].w;
    c.plat4Drop = slots[3].drop;
  }
  ensureRunoff(sim, c);
  maybeRockOnDeck(sim, c);
  seatEnemies(sim, c);
  if (late && c.airW <= 0 && sim.rand() < 0.72) {
    attachHighAir(sim, c, sim.rand() < 0.5 ? "low" : "high");
    if (c.airW > 0) {
      let drop = c.airDrop;
      for (const deck of [c.platDrop, c.plat2Drop, c.plat3Drop, c.plat4Drop]) {
        if (deck <= 0) continue;
        if (drop + c.airH > deck - L.playerH * 0.08 && drop < deck + L.playerH * 0.2) drop = deck + L.playerH * 0.3;
      }
      const maxDrop = Math.max(L.playerH * 0.35, L.groundY - L.playerH * 0.4 - c.airH);
      c.airDrop = Math.min(Math.max(L.playerH * 0.22, drop), maxDrop);
    }
  }
}

/** A rock or cone on a deck. Single-jump stages only use the top step, so a ground jump cannot land on it. */
function maybeRockOnDeck(sim: Sim, c: Chunk): void {
  if (c.barrierH > 0 || sim.rand() > 0.42) return;
  const L = sim.layout;
  const gear = gearFor(Math.max(0, c.x) / (L.playerH * METER_K));
  if (gear === "bluejet") return;
  const bw = L.playerH * 0.2;
  const placeTop = () => {
    let slot: "plat2" | "plat3" | "plat4" | null = null;
    let topDrop = 0;
    let off = 0;
    let w = 0;
    if (c.plat2W > 0 && c.plat2Drop > topDrop) {
      slot = "plat2";
      topDrop = c.plat2Drop;
      off = c.plat2Off;
      w = c.plat2W;
    }
    if (c.plat3W > 0 && c.plat3Drop > topDrop) {
      slot = "plat3";
      topDrop = c.plat3Drop;
      off = c.plat3Off;
      w = c.plat3W;
    }
    if (c.plat4W > 0 && c.plat4Drop > topDrop) {
      slot = "plat4";
      topDrop = c.plat4Drop;
      off = c.plat4Off;
      w = c.plat4W;
    }
    if (!slot || topDrop < L.playerH * 1.72) return false;
    const front = L.playerW * 0.72;
    const tail = L.playerW * 0.28;
    const needW = front + bw + tail;
    if (w < needW) {
      w = needW;
      if (slot === "plat4") c.plat4W = w;
      else if (slot === "plat3") c.plat3W = w;
      else c.plat2W = w;
      const end = off + w + L.playerW * 0.12;
      if (end > c.w) {
        const extra = end - c.w;
        c.w += extra;
        sim.cursor += extra;
      }
    }
    c.barrierH = L.playerH * (0.24 + sim.rand() * 0.08);
    c.barrierW = bw;
    c.barrierOff = off + Math.max(front, w - tail - bw);
    c.barrierDrop = topDrop;
    return true;
  };
  if (gear === "shell" || gear === "skates") {
    placeTop();
    return;
  }
  if (c.platW > 0 && c.platDrop > 0 && c.platDrop <= L.playerH * 1.15 && c.plat2W <= 0 && c.plat3W <= 0 && c.plat4W <= 0) {
    const speed = Math.max(40, speedAt(Math.max(0, c.x), L));
    const boundary = (gear === "robo" ? JET_M : BLUE_M) * L.playerH * METER_K;
    let rockX = Math.max(c.platOff + L.playerW * 1.1, speed * 1.35);
    let end = rockX + bw + speed * 0.62;
    if (c.x + end > boundary - 8) {
      end = boundary - c.x - 8;
      rockX = Math.min(rockX, end - bw - 4);
    }
    if (rockX < c.platOff + 4 || end <= c.platOff + L.playerW) {
      placeTop();
      return;
    }
    if (c.platOff + c.platW < end) c.platW = end - c.platOff;
    const need = c.platOff + c.platW + L.playerW * 0.16;
    if (need > c.w && c.x + need <= boundary) {
      const extra = need - c.w;
      c.w += extra;
      sim.cursor += extra;
    }
    c.barrierH = L.playerH * (0.26 + sim.rand() * 0.1);
    c.barrierW = bw;
    c.barrierOff = rockX;
    c.barrierDrop = c.platDrop;
    return;
  }
  placeTop();
}

function seatEnemies(sim: Sim, c: Chunk): void {
  const L = sim.layout;
  const decks: Deck[] = [];
  eachDeck(c, (off, w, drop) => {
    if (w >= L.playerW * 1.2) decks.push({ off, w, drop });
  });
  if (decks.length === 0) return;
  const all: Rat[] = [...sim.rats, ...sim.coyotes];
  for (const enemy of all) {
    if (!enemy.wantPlat || enemy.seated) continue;
    let best: Deck | null = null;
    let bestD = Infinity;
    let bestLeft = 0;
    for (const deck of decks) {
      const left = c.x + deck.off;
      const right = left + deck.w;
      const d = enemy.x < left ? left - enemy.x : enemy.x > right ? enemy.x - right : 0;
      if (d < bestD) {
        bestD = d;
        best = deck;
        bestLeft = left;
      }
    }
    if (!best || bestD > L.playerW * 4.2) continue;
    const margin = L.playerW * 0.28;
    const span = Math.max(8, best.w - margin * 2);
    const u = mix01(sim.seed, Math.round(enemy.home) + 3);
    enemy.x = bestLeft + margin + u * span;
    enemy.home = enemy.x;
    enemy.reach = Math.min(enemy.reach, span * 0.46);
    enemy.feet = L.groundY - best.drop;
    enemy.seated = true;
  }
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
  let extra = speed * (need - have);
  const gear = gearFor(Math.max(0, c.x) / (L.playerH * METER_K));
  if (gear === "robo" || gear === "jet") {
    const boundary = (gear === "robo" ? JET_M : BLUE_M) * L.playerH * METER_K;
    extra = Math.min(extra, Math.max(0, boundary - (c.x + c.w)));
  }
  if (extra <= 0) return;
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
  if (metersAt(sim, c.x) >= BLUE_M) return;
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
  const meters = metersAt(sim, c.x);
  const bobRoll = mix01(sim.seed, Math.round(c.x) + 77);
  const stage2Slot = Math.floor((meters - SKATES_M) / 8);
  const bobbing = meters >= ROBO_M ? bobRoll < 0.5 : meters >= SKATES_M && stage2Slot % 3 === 1;
  if (bobbing) {
    c.airBob = L.playerH * 1.62;
    c.airPhase = mix01(sim.seed, Math.round(c.x) + 91) * Math.PI * 2;
  }
  if (metersAt(sim, c.x + c.airOff) >= BLUE_M) {
    c.airW = 0;
    c.airH = 0;
    c.airBob = 0;
  }
}

function maybeLettuce(sim: Sim, c: Chunk, chance: number, opts?: { drop?: number; count?: number }): void {
  if (c.letN > 0) return;
  if (metersAt(sim, c.x) >= BLUE_M) return;
  const stacked = c.plat2W > 0 || c.plat3W > 0 || c.plat4W > 0;
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

  const finish = (count: number, off: number, drop: number, onDeck = false) => {
    c.letN = count;
    c.letOff = off;
    c.letDrop = onDeck ? Math.max(L.playerH * 0.35, drop) : Math.min(cap, Math.max(L.playerH * 0.35, drop));
  };

  if (opts?.drop != null) {
    while (n > 1 && gap * (n - 1) > c.w * 0.74) n--;
    if (n < 1 || c.w < 16) return;
    const row = gap * Math.max(0, n - 1);
    finish(n, Math.max(4, (c.w - row) * (0.2 + sim.rand() * 0.6)), opts.drop);
    return;
  }

  const decks: Deck[] = [];
  eachDeck(c, (off, w, drop) => decks.push({ off, w, drop }));
  const deck = decks.length
    ? sim.rand() < 0.62
      ? decks.reduce((a, b) => (b.drop > a.drop ? b : a))
      : decks[Math.floor(sim.rand() * decks.length)]!
    : null;

  if (deck && !c.gap && (stacked || sim.rand() < 0.8)) {
    const obscure = sim.rand() < 0.14;
    if (obscure) {
      const lip = deck.off + deck.w + L.playerW * (0.1 + sim.rand() * 0.32);
      finish(1, Math.max(4, Math.min(lip, c.w - 10)), deck.drop + L.playerH * (0.2 + sim.rand() * 0.16), true);
      return;
    }
    while (n > 1 && gap * (n - 1) > deck.w * 0.82) n--;
    const row = gap * Math.max(0, n - 1);
    const off = deck.off + Math.max(0, (deck.w - row) * (0.1 + sim.rand() * 0.75));
    finish(Math.max(1, n), off, deck.drop + L.playerH * 0.28, true);
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
  const open = L.playerH * (1.4 + sim.rand() * 0.34);
  const half = open * 0.5;
  const yMin = L.playerH * 0.42;
  const yMax = L.groundY - L.playerH * 0.18;
  const lo = yMin + half;
  const hi = Math.max(lo, yMax - half);
  const prefer = sim.gateY > 0 ? sim.gateY : L.groundY - L.playerH * 1.55;
  const maxShift = first ? 0 : L.playerH * 1.15;
  const center = clamp(prefer + (sim.rand() * 2 - 1) * maxShift, lo, hi);
  sim.gateY = center;

  if (!first) {
    // Open beat between gates. Reserved for a later pickup — nothing here yet.
    const reserve = pushChunk(sim, Math.max(L.playerW, speed * 0.52), false);
    if (reserve && sim.rand() < 0.55) {
      const platFeet = center + L.playerH * 0.35;
      const want = L.playerW * platSpan(sim);
      reserve.platW = Math.min(want, reserve.w * 0.72);
      reserve.platOff = Math.max(0, (reserve.w - reserve.platW) * sim.rand() * 0.35);
      reserve.platDrop = L.groundY - platFeet;
      if (reserve.platDrop < L.playerH * 0.5 || reserve.platW < L.playerW * 1.1) reserve.platW = 0;
    }
    const highFirst = sim.rand() < 0.5;
    placeFlyer(sim, highFirst, FLY_BIRD);
    pushChunk(sim, Math.max(L.playerW * 0.8, speed * 0.36), false);
    placeFlyer(sim, !highFirst, FLY_MOUCH);
    if (sim.rand() < 0.45) {
      pushChunk(sim, Math.max(L.playerW * 0.7, speed * 0.28), false);
      placeFlyer(sim, highFirst, sim.rand() < 0.5 ? FLY_BIRD : FLY_MOUCH);
    }
    pushChunk(sim, Math.max(L.playerW * 0.7, speed * 0.26), false);
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

function placeFlyer(sim: Sim, high: boolean, kind: number): void {
  const L = sim.layout;
  const speed = speedAt(sim.cursor, L);
  const bodyW = L.playerH * FLY_BODY_W;
  const bodyH = L.playerH * FLY_BODY_H;
  const c = pushChunk(sim, Math.max(bodyW + 18, speed * 0.2), false);
  if (!c) return;
  c.flyKind = kind;
  c.flyOff = Math.max(4, (c.w - bodyW) * 0.5);
  const drop = high ? L.playerH * (2.05 + sim.rand() * 0.4) : L.playerH * (0.78 + sim.rand() * 0.32);
  const maxDrop = Math.max(L.playerH * 0.7, L.groundY - L.playerH * 0.42 - bodyH);
  c.flyDrop = clamp(drop, L.playerH * 0.5, maxDrop);
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
    if (gear === "robo" && roll < 0.92) attachPlat(sim, c);
    else if (gear === "skates" && roll < 0.76) attachPlat(sim, c);
    else if (gear === "jet" && roll < 0.88) attachPlat(sim, c);
    else if (gear === "bluejet" && roll > 0.82) attachPlat(sim, c);
    if ((gear === "robo" || gear === "jet") && c.platW <= 0 && mix01(sim.seed, Math.round(c.x) + 55) < 0.55) {
      attachHighAir(sim, c, "high");
      const j = mix01(sim.seed, Math.round(c.x) + 71);
      c.airDrop = L.playerH * Math.max(0.18, 2.45 + j * 0.25 - c.airH / L.playerH / 2);
    }
    maybeLettuce(sim, c, kind === "recovery" ? 0.48 : 0.64);
  } else {
    if ((gear === "robo" || gear === "jet") && sim.rand() < 0.72) attachPlat(sim, c);
    if (sim.rand() < 0.18) maybeLettuce(sim, c, 1);
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
  if (gear === "shell" && sim.shellCrows >= 8) return;
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
    if (metersAt(sim, beat.x) < SKATES_M) {
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

/** Clear space between an enemy's body and a rock, cone, or barrier on the same surface. */
const THREAT_GAP = 0.72;

function enemyHalf(layout: Layout, enemy: Rat): number {
  return layout.playerH * ("speed" in enemy ? 0.16 : 0.12);
}

function inRunStages(sim: Sim, x: number): boolean {
  return Math.max(0, x) / (sim.layout.playerH * METER_K) < BLUE_M;
}

function atHome(layout: Layout, enemy: Rat): boolean {
  return Math.abs(enemy.x - enemy.home) <= layout.playerH * 0.45;
}

/** About one enemy in five may sit next to a blocker. The rest keep a modest gap. */
function keepClosePair(sim: Sim, index: number): boolean {
  return mix32(sim.seed, index * 17 + 3) % 5 === 0;
}

type HardSpan = {
  left: number;
  right: number;
  kind: "gap" | "barrier";
  chunk: Chunk | null;
  barH: number;
};

function hardSpans(sim: Sim): HardSpan[] {
  const spans: HardSpan[] = [];
  const L = sim.layout;
  eachChunk(sim, (c) => {
    if (!inRunStages(sim, c.x)) return;
    if (c.gap) {
      spans.push({ left: c.x, right: c.x + c.w, kind: "gap", chunk: c, barH: 0 });
      return;
    }
    if (c.barrierH <= 0 || c.barrierDrop > 0) return;
    const span = barrierSpan(sim, c);
    if (!span) return;
    const meters = Math.max(0, span.left) / (L.playerH * METER_K);
    const cone = meters >= ROBO_M && meters < BLUE_M;
    spans.push({
      left: span.left,
      right: span.right,
      kind: "barrier",
      chunk: c,
      barH: cone ? L.playerH * 0.68 : c.barrierH,
    });
  });
  spans.sort((a, b) => a.left - b.left);
  return spans;
}

/** Seconds a skilled jump stays high enough to clear a tall rock. Extra jumps chain. */
function clearWindow(gear: Gear): number {
  const jumps = 1 + maxAirJumps(gear);
  if (jumps >= 3) return 1.75;
  if (jumps === 2) return 1.22;
  return 0.66;
}

function lettuceLocked(sim: Sim, c: Chunk): boolean {
  return c.x + c.w <= sim.letPlacedUntil;
}

function slideBarrier(sim: Sim, span: HardSpan, need: number, dir: 1 | -1): boolean {
  const c = span.chunk;
  if (!c || span.kind !== "barrier" || c.barrierH <= 0 || c.barrierDrop > 0) return false;
  if (!inRunStages(sim, c.x) || lettuceLocked(sim, c)) return false;
  const tail = sim.layout.playerW * 0.16;
  let shift = 0;
  if (dir > 0) {
    const slack = c.w - (c.barrierOff + c.barrierW) - tail;
    shift = Math.min(need, Math.max(0, slack));
    c.barrierOff += shift;
  } else {
    shift = Math.min(need, Math.max(0, c.barrierOff - 4));
    c.barrierOff -= shift;
  }
  if (shift <= 0.5) return false;
  span.left += dir * shift;
  span.right += dir * shift;
  return true;
}

function crowSeals(sim: Sim, crow: Chunk, span: HardSpan): boolean {
  if (crow.airBob > 0 || crow.air2W > 0 || crow.airW <= 0 || crow.airH <= 0) return false;
  if (!inRunStages(sim, crow.x + crow.airOff)) return false;
  const L = sim.layout;
  const meters = Math.max(0, crow.x + crow.airOff) / (L.playerH * METER_K);
  const gull = meters >= ROBO_M ? SEAGULL_SCALE : 1;
  const box = crowHitBox(L, crow.x + crow.airOff, crow.airDrop, crow.airW, crow.airH, gull);
  if (box.right < span.left - 4 || box.left > span.right + 4) return false;
  const botH = (L.groundY - box.bottom) / L.playerH;
  const topH = (L.groundY - box.top) / L.playerH;
  const barTop = span.barH / L.playerH;
  const jumps = 1 + maxAirJumps(gearFor(meters));
  const peak = jumps >= 3 ? 4.4 : jumps === 2 ? 2.9 : 1.45;
  const under = botH > barTop + 0.22;
  const over = topH < peak - 0.2;
  return !under && !over;
}

function nudgeCrow(sim: Sim, crow: Chunk, span: HardSpan): void {
  if (lettuceLocked(sim, crow)) return;
  const L = sim.layout;
  const meters = Math.max(0, crow.x + crow.airOff) / (L.playerH * METER_K);
  const gull = meters >= ROBO_M ? SEAGULL_SCALE : 1;
  const box = crowHitBox(L, crow.x + crow.airOff, crow.airDrop, crow.airW, crow.airH, gull);
  const pad = 6;
  if (box.right < span.left - pad || box.left > span.right + pad) return;
  const shiftLeft = box.right - (span.left - pad);
  const shiftRight = span.right + pad - box.left;
  const roomLeft = crow.airOff;
  const roomRight = crow.w - crow.airOff - crow.airW;
  let shift = 0;
  if (shiftLeft <= roomLeft + 0.5 && (shiftRight > roomRight + 0.5 || shiftLeft <= shiftRight)) shift = -shiftLeft;
  else if (shiftRight <= roomRight + 0.5) shift = shiftRight;
  if (Math.abs(shift) < 0.5 || Math.abs(shift) > L.playerW * 1.25) return;
  crow.airOff = Math.max(0, Math.min(crow.w - crow.airW, crow.airOff + shift));
}

/**
 * Stages 1–4 only. If a normal, double, or triple jump cannot clear a pair of
 * ground hazards and the landing between them is too short, nudge a barrier.
 * A crow that seals the arc over a rock is nudged aside the same way.
 */
function openBlockedSpans(sim: Sim): void {
  const L = sim.layout;
  const spans = hardSpans(sim);
  for (let i = 1; i < spans.length; i++) {
    const a = spans[i - 1]!;
    const b = spans[i]!;
    if (b.left <= a.right + 1) continue;
    const mid = (a.right + b.left) / 2;
    if (!inRunStages(sim, mid)) continue;
    const gear = gearFor(Math.max(0, mid) / (L.playerH * METER_K));
    const speed = Math.max(40, speedAt(mid, L));
    const run = b.left - a.right;
    const span = b.right - a.left;
    const clearX = speed * clearWindow(gear);
    const minLand = L.playerW * 0.72 + speed * 0.08;
    if (span <= clearX || run >= minLand) continue;
    const need = Math.min(minLand - run, L.playerW * 1.15);
    if (need > 1) slideBarrier(sim, b, need, 1) || slideBarrier(sim, a, need, -1);
  }
  eachChunk(sim, (crow) => {
    if (crow.air2W > 0 || crow.airW <= 0 || crow.airBob > 0) return;
    for (const span of spans) {
      if (span.kind !== "barrier") continue;
      if (!crowSeals(sim, crow, span)) continue;
      nudgeCrow(sim, crow, span);
    }
  });
}

function nearestBarrier(
  sim: Sim,
  x: number,
  half: number,
  feet: number,
): { left: number; right: number; gap: number } | null {
  let best: { left: number; right: number; gap: number } | null = null;
  eachChunk(sim, (c) => {
    if (c.barrierH <= 0 || !inRunStages(sim, c.x)) return;
    const span = barrierSpan(sim, c);
    if (!span || Math.abs(span.feet - feet) > 14) return;
    const gap =
      x + half <= span.left ? span.left - (x + half) : x - half >= span.right ? x - half - span.right : 0;
    if (!best || gap < best.gap) best = { left: span.left, right: span.right, gap };
  });
  return best;
}

function placeEnemy(sim: Sim, enemy: Rat, x: number): boolean {
  const feet = enemy.feet || sim.layout.groundY;
  if (!inRunStages(sim, x) || !surfaceOk(sim, x, feet)) return false;
  enemy.x = x;
  enemy.home = x;
  return true;
}

/** Home positions already given a gap. Patrol can still walk up to a rock and turn. */
const gapChecked = new WeakMap<Rat, number>();

function gapFresh(enemy: Rat): boolean {
  return gapChecked.get(enemy) !== enemy.home;
}

function markGap(enemy: Rat): void {
  gapChecked.set(enemy, enemy.home);
}

function enemyLoaded(sim: Sim, enemy: Rat): boolean {
  let loaded = false;
  eachChunk(sim, (c) => {
    if (loaded) return;
    if (enemy.x >= c.x - 8 && enemy.x < c.x + c.w + 8) loaded = true;
  });
  return loaded;
}

/**
 * Keep most enemies a short step off rocks, cones, and barriers. A few close
 * pairs stay. If an enemy is standing in the only landing a skilled jump can
 * use, move that one even when it was a close pair.
 */
function spaceEnemies(sim: Sim): void {
  const L = sim.layout;
  const minClear = L.playerW * THREAT_GAP;
  const all: Rat[] = [...sim.coyotes, ...sim.rats];
  const spans = hardSpans(sim);
  for (let i = 1; i < spans.length; i++) {
    const a = spans[i - 1]!;
    const b = spans[i]!;
    const mid = (a.right + b.left) / 2;
    if (!inRunStages(sim, mid) || b.left <= a.right) continue;
    const gear = gearFor(Math.max(0, mid) / (L.playerH * METER_K));
    const speed = Math.max(40, speedAt(mid, L));
    const run = b.left - a.right;
    const span = b.right - a.left;
    if (span <= speed * clearWindow(gear)) continue;
    const shoulder = L.playerW * 0.7;
    if (run < shoulder) continue;
    for (const enemy of all) {
      if (!gapFresh(enemy) || !atHome(L, enemy) || !enemyLoaded(sim, enemy)) continue;
      const feet = enemy.feet || L.groundY;
      if (Math.abs(feet - L.groundY) > 10) continue;
      const half = enemyHalf(L, enemy);
      if (enemy.x + half <= a.right || enemy.x - half >= b.left) continue;
      const freeL = enemy.x - half - a.right;
      const freeR = b.left - (enemy.x + half);
      if (freeL >= shoulder || freeR >= shoulder) continue;
      const pad = half + L.playerW * 0.2;
      const spots = [a.right - pad, b.left + pad].sort((p, q) => Math.abs(p - enemy.x) - Math.abs(q - enemy.x));
      for (const x of spots) {
        if (Math.abs(x - enemy.x) > L.playerW * 1.5) continue;
        if (placeEnemy(sim, enemy, x)) break;
      }
    }
  }
  all.forEach((enemy, index) => {
    if (!gapFresh(enemy) || !atHome(L, enemy) || !enemyLoaded(sim, enemy)) return;
    if (keepClosePair(sim, index)) {
      markGap(enemy);
      return;
    }
    const feet = enemy.feet || L.groundY;
    const half = enemyHalf(L, enemy);
    for (let n = 0; n < 2; n++) {
      const near = nearestBarrier(sim, enemy.x, half, feet);
      if (!near || near.gap >= minClear) {
        markGap(enemy);
        return;
      }
      const leftX = near.left - half - minClear;
      const rightX = near.right + half + minClear;
      const order = Math.abs(enemy.x - leftX) <= Math.abs(enemy.x - rightX) ? [leftX, rightX] : [rightX, leftX];
      let moved = false;
      for (const x of order) {
        if (Math.abs(x - enemy.x) > L.playerW * 1.6) continue;
        const other = nearestBarrier(sim, x, half, feet);
        if (other && other.gap < minClear - 0.5) continue;
        if (placeEnemy(sim, enemy, x)) {
          moved = true;
          break;
        }
      }
      if (!moved) {
        markGap(enemy);
        return;
      }
    }
    markGap(enemy);
  });
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
  openBlockedSpans(sim);
  applyLettucePlan(sim);
  shiftEnemiesOffHazards(sim);
  spaceEnemies(sim);
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

const RAT_HIT_W = 0.22;
const RAT_HIT_H = 0.3;

function ratBox(sim: Sim, rat: Rat): { left: number; right: number; top: number; bottom: number } {
  const L = sim.layout;
  const body = rat.x + rat.dir * L.playerH * 0.1;
  const hw = L.playerH * RAT_HIT_W * 0.5;
  const feet = rat.feet || L.groundY;
  return {
    left: body - hw,
    right: body + hw,
    top: feet - L.playerH * RAT_HIT_H,
    bottom: feet,
  };
}

function barrierSpan(sim: Sim, c: Chunk): { left: number; right: number; feet: number } | null {
  if (c.barrierH <= 0) return null;
  const L = sim.layout;
  const meters = Math.max(0, c.x + c.barrierOff) / (L.playerH * METER_K);
  const cone = meters >= ROBO_M && meters < BLUE_M;
  const bw = cone ? L.playerH * 0.3 : c.barrierW;
  const mid = c.x + c.barrierOff + c.barrierW / 2;
  const left = cone ? mid - bw / 2 : c.x + c.barrierOff;
  return { left, right: left + bw, feet: L.groundY - c.barrierDrop };
}

function hazardAt(sim: Sim, x: number, feet: number): boolean {
  const pad = sim.layout.playerH * 0.18;
  let hit = false;
  eachChunk(sim, (c) => {
    if (hit) return;
    const span = barrierSpan(sim, c);
    if (!span || Math.abs(span.feet - feet) > 14) return;
    if (x > span.left - pad && x < span.right + pad) hit = true;
  });
  return hit;
}

function surfaceOk(sim: Sim, x: number, feet: number): boolean {
  const L = sim.layout;
  if (hazardAt(sim, x, feet)) return false;
  if (Math.abs(feet - L.groundY) < 8) return solidAt(sim, x);
  let on = false;
  eachChunk(sim, (c) => {
    if (on) return;
    eachDeck(c, (off, w, drop) => {
      if (on || Math.abs(feet - (L.groundY - drop)) > 8) return;
      const left = c.x + off;
      if (x >= left + 4 && x <= left + w - 4) on = true;
    });
  });
  return on;
}

/** Slide a ground enemy off a rock, cone, or barrier onto nearby clear ground or deck. */
function shiftEnemiesOffHazards(sim: Sim): void {
  const L = sim.layout;
  const all: Rat[] = [...sim.rats, ...sim.coyotes];
  for (const enemy of all) {
    const feet = enemy.feet || L.groundY;
    let loaded = false;
    eachChunk(sim, (c) => {
      if (enemy.x >= c.x - 8 && enemy.x < c.x + c.w + 8) loaded = true;
    });
    if (!loaded || !hazardAt(sim, enemy.x, feet)) continue;
    const step = L.playerH * 0.3;
    let moved = false;
    for (let i = 1; i <= 16 && !moved; i++) {
      for (const dir of [1, -1]) {
        const x = enemy.x + dir * step * i;
        if (!surfaceOk(sim, x, feet)) continue;
        enemy.x = x;
        enemy.home = x;
        moved = true;
        break;
      }
    }
    if (moved) continue;
    eachChunk(sim, (c) => {
      if (moved) return;
      const span = barrierSpan(sim, c);
      if (!span || Math.abs(span.feet - feet) > 14) return;
      if (enemy.x <= span.left || enemy.x >= span.right) return;
      const pad = L.playerH * 0.28;
      for (const x of [span.right + pad, span.left - pad]) {
        if (!surfaceOk(sim, x, feet)) continue;
        enemy.x = x;
        enemy.home = x;
        moved = true;
        return;
      }
    });
  }
}

function hitsBarrier(sim: Sim, x0: number, x1: number, feetY = sim.layout.groundY): boolean {
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  let hit = false;
  eachChunk(sim, (c) => {
    if (hit) return;
    const span = barrierSpan(sim, c);
    if (!span || Math.abs(span.feet - feetY) > 14) return;
    if (right > span.left && left < span.right) hit = true;
  });
  return hit;
}

/** True when the next ground step would fall off the road or hit a rock. */
function edgeAhead(sim: Sim, x: number, dir: number): boolean {
  const lead = x + dir * Math.max(8, sim.layout.playerH * 0.12);
  if (!solidAt(sim, x) || !solidAt(sim, lead)) return true;
  return hitsBarrier(sim, x, lead);
}

function ratBlocked(sim: Sim, enemy: Rat): boolean {
  const L = sim.layout;
  const onDeck = Math.abs((enemy.feet || L.groundY) - L.groundY) > 6;
  if (!onDeck) return edgeAhead(sim, enemy.x, enemy.dir);
  const lead = enemy.x + enemy.dir * Math.max(8, L.playerH * 0.12);
  let on = false;
  let leaving = false;
  eachChunk(sim, (c) => {
    if (leaving) return;
    eachDeck(c, (off, w, drop) => {
      if (w <= 0 || Math.abs(enemy.feet - (L.groundY - drop)) > 8) return;
      const left = c.x + off;
      const right = left + w;
      if (enemy.x >= left && enemy.x <= right) {
        on = true;
        if (lead < left || lead > right) leaving = true;
      }
    });
  });
  if (hitsBarrier(sim, enemy.x, lead, enemy.feet)) return true;
  return !on || leaving;
}

type Pace = { flips: number; anchor: number };
const pace = new WeakMap<Rat, Pace>();

/** Slide a stuck patroller onto the longest clear bit of the surface under them. */
function relocatePatrol(sim: Sim, enemy: Rat): boolean {
  const L = sim.layout;
  const feet = enemy.feet || L.groundY;
  const step = L.playerH * 0.22;
  const max = L.playerH * 1.7;
  const pts: number[] = [];
  for (let d = -max; d <= max + 0.1; d += step) {
    const x = enemy.x + d;
    if (surfaceOk(sim, x, feet)) pts.push(x);
  }
  let bestA = 0;
  let bestN = 0;
  let start = 0;
  for (let i = 1; i <= pts.length; i++) {
    const broken = i === pts.length || pts[i]! - pts[i - 1]! > step * 1.6;
    if (!broken) continue;
    const n = i - start;
    if (n > bestN) {
      bestN = n;
      bestA = start;
    }
    start = i;
  }
  if (bestN < 2) return false;
  const run = pts.slice(bestA, bestA + bestN);
  const left = run[0]!;
  const right = run[run.length - 1]!;
  const mid = (left + right) * 0.5;
  enemy.x = mid;
  enemy.home = mid;
  enemy.reach = clamp((right - left) * 0.42, L.playerH * 0.38, L.playerH * 1.25);
  enemy.dir = right - mid >= mid - left ? 1 : -1;
  if ("pause" in enemy) (enemy as Coyote).pause = 0;
  return true;
}

/**
 * A normal turn if they have actually walked. Repeated reversals inside a
 * few pixels means they are stuck, so move them onto open ground instead.
 */
function turnOrRecover(sim: Sim, enemy: Rat): void {
  const tiny = sim.layout.playerH * 0.2;
  let paceState = pace.get(enemy);
  if (!paceState) {
    paceState = { flips: 0, anchor: enemy.x - enemy.dir * sim.layout.playerH };
    pace.set(enemy, paceState);
  }
  if (Math.abs(enemy.x - paceState.anchor) > tiny) {
    paceState.flips = 0;
    paceState.anchor = enemy.x;
  }
  paceState.flips++;
  if (paceState.flips >= 3 && relocatePatrol(sim, enemy)) {
    paceState.flips = 0;
    paceState.anchor = enemy.x;
    return;
  }
  enemy.dir = -enemy.dir;
  paceState.anchor = enemy.x;
}

/** Stop at a rock, cone, or barrier and face the other way before the body overlaps it. */
function reverseFromObstacle(sim: Sim, enemy: Rat): boolean {
  const L = sim.layout;
  const feet = enemy.feet || L.groundY;
  const nose = enemy.x + enemy.dir * L.playerH * 0.36;
  const inside = hazardAt(sim, enemy.x, feet);
  if (!inside && !hitsBarrier(sim, enemy.x, nose, feet)) return false;
  if (inside) {
    const options: { x: number; dir: number; d: number }[] = [];
    eachChunk(sim, (c) => {
      const span = barrierSpan(sim, c);
      if (!span || Math.abs(span.feet - feet) > 14) return;
      if (enemy.x <= span.left || enemy.x >= span.right) return;
      const pad = L.playerH * 0.22;
      for (const opt of [
        { x: span.left - pad, dir: -1 },
        { x: span.right + pad, dir: 1 },
      ]) {
        if (hazardAt(sim, opt.x, feet)) continue;
        options.push({ x: opt.x, dir: opt.dir, d: Math.abs(opt.x - enemy.x) });
      }
    });
    let best: { x: number; dir: number; d: number } | null = null;
    for (const opt of options) {
      if (!best || opt.d < best.d) best = opt;
    }
    if (best) {
      enemy.x = best.x;
      enemy.dir = best.dir;
    } else turnOrRecover(sim, enemy);
  } else turnOrRecover(sim, enemy);
  if ("pause" in enemy) (enemy as Coyote).pause = 0;
  return true;
}

function nudgeRat(sim: Sim, rat: Rat): void {
  if (solidAt(sim, rat.x)) return;
  const step = sim.layout.playerH * 0.4;
  for (let i = 1; i <= 6; i++) {
    for (const dir of [1, -1]) {
      const x = rat.home + dir * step * i;
      if (Math.abs(x - rat.home) > rat.reach) continue;
      if (solidAt(sim, x) && !ratBlocked(sim, { ...rat, x, dir })) {
        rat.x = x;
        rat.home = x;
        return;
      }
    }
  }
}

function stepRats(sim: Sim, dt: number): void {
  const speed = sim.layout.playerH * 0.9;
  for (const rat of sim.rats) {
    if (rat.stun > 0) {
      rat.stun = Math.max(0, rat.stun - dt);
      continue;
    }
    if (rat.x < sim.worldX - sim.layout.w || rat.x > sim.worldX + sim.layout.w * 1.5) continue;
    let loaded = false;
    eachChunk(sim, (c) => {
      if (rat.x >= c.x && rat.x < c.x + c.w) loaded = true;
    });
    if (!loaded) continue;
    nudgeRat(sim, rat);
    if (reverseFromObstacle(sim, rat)) continue;
    const next = rat.x + rat.dir * speed * dt;
    const past = Math.abs(next - rat.home) > rat.reach;
    if (past || ratBlocked(sim, rat)) turnOrRecover(sim, rat);
    else rat.x = next;
  }
}

const STUN_TIME = 1.25;

function noteStomp(events: Events, kind: "rat" | "coyote"): void {
  if (events.stomp == null) events.stomp = kind;
  else if (events.stomp !== kind) events.stomp = "both";
}

/** Falling onto a ground enemy's head. Side and rising hits are not stomps. */
function stompGrounded(sim: Sim, prevY: number, events: Events): void {
  if (sim.grounded || sim.vy <= 0) return;
  const L = sim.layout;
  const foot = footX(sim);
  const left = foot - L.playerW * 0.28;
  const right = foot + L.playerW * 0.36;
  let perch: number | null = null;
  const landOn = (top: number, boxLeft: number, boxRight: number, kind: "rat" | "coyote", enemy: Rat) => {
    if (right <= boxLeft || left >= boxRight) return;
    if (prevY > top + 10) return;
    if (sim.y < top - 6) return;
    if (enemy.stun > 0) return;
    enemy.stun = STUN_TIME;
    noteStomp(events, kind);
    if (perch == null || top < perch) perch = top;
  };
  for (const rat of sim.rats) {
    const box = ratBox(sim, rat);
    landOn(box.top, box.left, box.right, "rat", rat);
  }
  for (const coyote of sim.coyotes) {
    const hw = L.playerH * 0.15;
    const body = coyote.x + coyote.dir * L.playerH * 0.08;
    const feet = coyote.feet || L.groundY;
    landOn(feet - L.playerH * 0.34, body - hw, body + hw, "coyote", coyote);
  }
  if (perch == null) return;
  sim.y = Math.min(sim.y, perch);
  const hold = clamp(sim.jumpT / JUMP_HOLD, 0, 1);
  // Tap bounce stays a small hop. A full jump reaches 2.5× that height.
  const smallH = 0.34;
  const bounceH = smallH * (1 + 1.5 * hold);
  sim.vy = -L.playerH * Math.sqrt(2 * GRAVITY_K * bounceH);
  sim.grounded = false;
  sim.lifting = false;
  sim.jumpT = JUMP_HOLD;
  sim.coyote = 0;
}

function overlapsRat(sim: Sim): boolean {
  const L = sim.layout;
  const foot = footX(sim);
  const shelled = sim.shelling ? shellBox(sim) : null;
  const hitLeft = shelled ? shelled.left : foot - L.playerW * 0.28;
  const hitRight = shelled ? shelled.right : foot + L.playerW * 0.36;
  const hitTop = shelled ? shelled.top : sim.y - L.playerH * 0.62;
  const hitBot = shelled ? shelled.bot : sim.y - L.playerH * 0.08;
  for (const rat of sim.rats) {
    if (rat.stun > 0) continue;
    const box = ratBox(sim, rat);
    if (hitRight > box.left && hitLeft < box.right && hitBot > box.top && hitTop < box.bottom) return true;
  }
  return false;
}

function stepCoyotes(sim: Sim, dt: number): void {
  for (const coyote of sim.coyotes) {
    if (coyote.stun > 0) {
      coyote.stun = Math.max(0, coyote.stun - dt);
      continue;
    }
    if (coyote.x < sim.worldX - sim.layout.w || coyote.x > sim.worldX + sim.layout.w * 1.5) continue;
    let loaded = false;
    eachChunk(sim, (c) => {
      if (coyote.x >= c.x && coyote.x < c.x + c.w) loaded = true;
    });
    if (!loaded) continue;
    nudgeRat(sim, coyote);
    if (reverseFromObstacle(sim, coyote)) continue;
    if (coyote.pause > 0) {
      coyote.pause = Math.max(0, coyote.pause - dt);
      if (coyote.pause > 0) continue;
      turnOrRecover(sim, coyote);
    }
    const next = coyote.x + coyote.dir * coyote.speed * dt;
    const past = Math.abs(next - coyote.home) > coyote.reach;
    if (past || ratBlocked(sim, coyote)) coyote.pause = coyote.wait;
    else {
      coyote.x = next;
      coyote.anim += dt;
    }
  }
}

function overlapsCoyote(sim: Sim): boolean {
  const L = sim.layout;
  const foot = footX(sim);
  const shelled = sim.shelling ? shellBox(sim) : null;
  const hitLeft = shelled ? shelled.left : foot - L.playerW * 0.28;
  const hitRight = shelled ? shelled.right : foot + L.playerW * 0.36;
  const hitTop = shelled ? shelled.top : sim.y - L.playerH * 0.62;
  const hitBot = shelled ? shelled.bot : sim.y - L.playerH * 0.08;
  const hw = L.playerH * 0.15;
  for (const coyote of sim.coyotes) {
    if (coyote.stun > 0) continue;
    const feet = coyote.feet || L.groundY;
    const top = feet - L.playerH * 0.34;
    const body = coyote.x + coyote.dir * L.playerH * 0.08;
    if (hitRight > body - hw && hitLeft < body + hw && hitBot > top && hitTop < feet) return true;
  }
  return false;
}

function eachPlat(sim: Sim, fn: (top: number, left: number, right: number) => void): void {
  const ground = sim.layout.groundY;
  eachChunk(sim, (c) => {
    if (sim.blueClear > 0 && c.x < sim.blueClear) return;
    eachDeck(c, (off, w, drop) => {
      const left = c.x + off;
      fn(ground - drop, left, left + w);
    });
  });
}

function overlapsBarrier(sim: Sim, prevY: number): Cause {
  const L = sim.layout;
  const foot = footX(sim);
  const shelled = sim.shelling ? shellBox(sim) : null;
  const hitLeft = shelled ? shelled.left : foot - L.playerW * 0.28;
  const hitRight = shelled ? shelled.right : foot + L.playerW * 0.36;
  const hitTop = shelled ? shelled.top : sim.y - L.playerH * 0.62;
  const hitBot = shelled ? shelled.bot : sim.y - L.playerH * 0.08;
  const len = sim.slots.length;
  for (let i = 0; i < sim.count; i++) {
    const c = sim.slots[(sim.head + i) % len]!;
    if (sim.blueClear > 0 && c.x < sim.blueClear) continue;
    if (c.barrierH <= 0) continue;
    if (c.barrierDrop > 0) {
      const deck = L.groundY - c.barrierDrop;
      const onDeck = sim.grounded && Math.abs(sim.y - deck) < 8;
      const fallingOnto = sim.vy >= 0 && prevY <= deck + 4 && sim.y >= deck - 4;
      if (!onDeck && !fallingOnto) continue;
    }
    const inset = L.playerH * 0.05;
    const meters = metersAt(sim, c.x + c.barrierOff);
    const cone = meters >= ROBO_M && meters < BLUE_M;
    const bw = cone ? L.playerH * 0.3 : c.barrierW;
    const bh = cone ? L.playerH * 0.68 : c.barrierH;
    const cx = c.x + c.barrierOff + c.barrierW / 2;
    const bl = (cone ? cx - bw / 2 : c.x + c.barrierOff) + inset;
    const br = (cone ? cx + bw / 2 : c.x + c.barrierOff + c.barrierW) - inset;
    const feet = L.groundY - c.barrierDrop;
    const bt = feet - bh + inset;
    const bb = feet;
    if (hitRight > bl && hitLeft < br && hitBot > bt && hitTop < bb) {
      if (meters < ROBO_M) return "rock";
      if (cone) return "cone";
      return "barrier";
    }
  }
  return null;
}

/** Smallest floater the course used to spawn, as a fraction of the player height. */
export const CROW_HIT_W = 0.34;
export const CROW_HIT_H = 0.18;
/** Stages 3–4 seagulls are drawn and collided 20% larger than crows. */
export const SEAGULL_SCALE = 1.2;
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
  scale = 1,
): { left: number; right: number; top: number; bottom: number } {
  const bw = layout.playerH * CROW_HIT_W * scale;
  const bh = layout.playerH * CROW_HIT_H * scale;
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

export function flyHitBox(
  layout: Layout,
  chunk: { x: number; flyOff: number; flyDrop: number },
): { left: number; right: number; top: number; bottom: number } {
  const bodyW = layout.playerH * FLY_BODY_W;
  const bodyH = layout.playerH * FLY_BODY_H;
  const midX = chunk.x + chunk.flyOff + bodyW / 2;
  const midY = layout.groundY - chunk.flyDrop - bodyH / 2;
  const bw = layout.playerH * FLY_HIT_W;
  const bh = layout.playerH * FLY_HIT_H;
  const inset = layout.playerH * 0.015;
  return {
    left: midX - bw / 2 + inset,
    right: midX + bw / 2 - inset,
    top: midY - bh / 2 + inset,
    bottom: midY + bh / 2 - inset,
  };
}

function overlapsAir(sim: Sim): Cause {
  const L = sim.layout;
  const foot = footX(sim);
  const shelled = sim.shelling ? shellBox(sim) : null;
  const hitLeft = shelled ? shelled.left : foot - L.playerW * 0.26;
  const hitRight = shelled ? shelled.right : foot + L.playerW * 0.32;
  const hitTop = shelled ? shelled.top : sim.y - L.playerH * 0.6;
  const hitBot = shelled ? shelled.bot : sim.y - L.playerH * 0.1;
  const inset = L.playerH * 0.04;
  let hit: Cause = null;
  eachChunk(sim, (c) => {
    if (hit) return;
    if (sim.blueClear > 0 && c.x < sim.blueClear) return;
    if (c.flyKind > 0) {
      const box = flyHitBox(L, c);
      if (hitRight > box.left && hitLeft < box.right && hitBot > box.top && hitTop < box.bottom) {
        hit = "air";
        return;
      }
    }
    const gate = c.air2W > 0 && c.air2H > 0;
    if (!gate) {
      if (c.airW <= 0 || c.airH <= 0) return;
      const meters = Math.max(0, c.x + c.airOff) / (L.playerH * METER_K);
      if (meters >= BLUE_M) return;
      const drop = crowMotionDrop(c, sim.runT, L.playerH);
      const gull = meters >= ROBO_M;
      const box = crowHitBox(L, c.x + c.airOff, drop, c.airW, c.airH, gull ? SEAGULL_SCALE : 1);
      if (hitRight > box.left && hitLeft < box.right && hitBot > box.top && hitTop < box.bottom) {
        hit = gull ? "seagull" : "air";
      }
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
        hit = "air";
        return;
      }
    }
  });
  return hit;
}

function die(sim: Sim, cause: Cause, events: Events): void {
  if (sim.phase !== "run" || cause == null) return;
  sim.shelling = false;
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

/** Map an upward swipe into the same 0..1 range as holding the jump button. */
export function swipePopStrength(upPx: number, upPxPerSec: number): number {
  const distN = clamp((upPx - 12) / 100, 0, 1);
  const speedN = clamp((upPxPerSec - 180) / 1080, 0, 1);
  if (upPx < 12 && upPxPerSec < 180) return 0;
  return Math.max(distN, speedN);
}

/** Apex of a normal jump held for `holdSec`, in player heights. */
function jumpApex(holdSec: number): number {
  const dt = 1 / 60;
  const g = GRAVITY_K;
  let y = 0;
  let vy = -jumpVyK(0);
  let jumpT = 0;
  let t = 0;
  let peak = 0;
  const hold = Math.max(0, holdSec);
  while (t < 3) {
    const held = t < hold;
    const lifting = held && jumpT < JUMP_HOLD && vy <= 0;
    if (lifting) {
      jumpT = Math.min(JUMP_HOLD, jumpT + dt);
      vy = -jumpVyK(jumpT);
    } else {
      vy += g * dt;
    }
    y += vy * dt;
    if (-y > peak) peak = -y;
    t += dt;
    if (t > 0.08 && y >= 0 && vy > 0) break;
  }
  return peak;
}

function launchSlidePop(sim: Sim, strength: number, dt: number, events: Events): void {
  const apex = jumpApex(clamp(strength, 0, 1) * JUMP_HOLD);
  const speed = Math.sqrt(Math.max(0, 2 * GRAVITY_K * apex));
  sim.shelling = false;
  sim.lifting = false;
  sim.jumpT = JUMP_HOLD;
  sim.vy = -sim.layout.playerH * speed;
  sim.y += sim.vy * dt;
  sim.grounded = false;
  sim.coyote = 0;
  sim.buffer = 0;
  sim.jumpedOnce = true;
  events.jump = true;
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
  if (sim.phase !== "run" || sim.gear === "bluejet" || sim.shelling) return "blocked";
  const L = sim.layout;
  const onGround =
    sim.grounded ||
    sim.coyote > 0 ||
    (sim.vy >= 0 && Math.abs(sim.y - L.groundY) <= Math.max(10, L.playerH * 0.08));
  const events: Events = { jump: false, land: false, die: false, gear: null, collect: false, stomp: null, slide: false };
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
      const ahead = L.w - L.playerX;
      sim.blueClear = sim.worldX + sim.speed * 3 + ahead;
      sim.grace = 3;
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
  const flownInto = overlapsAir(sim);
  if (flownInto) {
    die(sim, flownInto, events);
    return;
  }
  finishStep(sim, events);
}

function shellBox(sim: Sim): { left: number; right: number; top: number; bot: number } {
  const L = sim.layout;
  const foot = footX(sim);
  const s = SHELL_SLIDE_SCALE;
  return {
    left: foot - L.playerW * 0.22 * s,
    right: foot + L.playerW * 0.3 * s,
    top: sim.y - L.playerH * 0.34 * s,
    bot: sim.y - L.playerH * 0.04 * s,
  };
}

/** Ground, or a deck, if he is on it or only just left it in a jump. */
function shellSurface(sim: Sim): number | null {
  const L = sim.layout;
  if (sim.grounded) return sim.y;
  if (sim.vy >= 0) return null;
  const foot = footX(sim);
  const maxRise = L.playerH * 0.4;
  if (solidAt(sim, foot) && sim.y <= L.groundY + 2 && L.groundY - sim.y <= maxRise) return L.groundY;
  let best: number | null = null;
  eachPlat(sim, (top, left, right) => {
    if (foot < left || foot > right) return;
    const rise = top - sim.y;
    if (rise < -6 || rise > maxRise) return;
    if (best == null || Math.abs(top - sim.y) < Math.abs(best - sim.y)) best = top;
  });
  return best;
}

function syncShell(sim: Sim, slide: boolean, events: Events, starting: boolean): void {
  if (sim.gear === "bluejet" || sim.phase !== "run") {
    sim.shelling = false;
    return;
  }
  if (sim.shelling) {
    if (!slide) sim.shelling = false;
    return;
  }
  if (!starting || !slide || sim.shellsLeft <= 0) return;
  const surf = shellSurface(sim);
  if (surf == null) return;
  sim.y = surf;
  sim.vy = 0;
  sim.grounded = true;
  sim.lifting = false;
  sim.coyote = 0;
  sim.buffer = 0;
  sim.shelling = true;
  sim.shellsLeft -= 1;
  events.slide = true;
}

/** Sliding into a ground enemy stuns it the same way a head bounce does. */
function stunWithShell(sim: Sim, events: Events): void {
  if (!sim.shelling) return;
  const box = shellBox(sim);
  const bump = (enemy: Rat, kind: "rat" | "coyote", top: number, left: number, right: number, bottom: number) => {
    if (enemy.stun > 0) return;
    if (box.right <= left || box.left >= right || box.bot <= top || box.top >= bottom) return;
    enemy.stun = STUN_TIME;
    noteStomp(events, kind);
  };
  for (const rat of sim.rats) {
    const b = ratBox(sim, rat);
    bump(rat, "rat", b.top, b.left, b.right, b.bottom);
  }
  for (const coyote of sim.coyotes) {
    const L = sim.layout;
    const hw = L.playerH * 0.15;
    const feet = coyote.feet || L.groundY;
    const body = coyote.x + coyote.dir * L.playerH * 0.08;
    bump(coyote, "coyote", feet - L.playerH * 0.34, body - hw, body + hw, feet);
  }
}

function step(sim: Sim, dt: number, jumpEdge: boolean, held: boolean, flyX: number, flyY: number, slide: boolean, pop: number, events: Events): void {
  if (sim.gear === "bluejet") {
    sim.shelling = false;
    stepFlight(sim, dt, flyX, flyY, events);
    return;
  }

  const L = sim.layout;
  const g = L.playerH * GRAVITY_K;
  const fullV = L.playerH * JUMP_V_K;
  const prevY = sim.y;
  const wasShelling = sim.shelling;

  syncShell(sim, slide, events, true);

  sim.speed = speedAt(sim.worldX, L);
  sim.worldX += sim.speed * (sim.shelling ? SLIDE_SPEED : 1) * dt;

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
  stompGrounded(sim, prevY, events);
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

  if (sim.shelling) {
    sim.buffer = 0;
    sim.lifting = false;
  } else if (jumpEdge) sim.buffer = BUFFER;
  else sim.buffer = Math.max(0, sim.buffer - dt);

  const popping = pop > 0 && (wasShelling || sim.grounded || sim.coyote > 0) && (sim.grounded || sim.coyote > 0);
  if (popping) {
    launchSlidePop(sim, pop, dt, events);
  } else if (!sim.shelling) {
    const canGround = sim.grounded || sim.coyote > 0;
    // A fresh press on the ground always jumps, even if air jumps were left at zero.
    if (canGround && (jumpEdge || sim.buffer > 0)) {
      sim.airJumps = extraJumps(sim.gear);
      launch(sim, held, dt, events);
    } else if (jumpEdge && sim.airJumps > 0 && extraJumps(sim.gear) > 0) {
      sim.airJumps -= 1;
      launch(sim, held, dt, events);
    }
  }

  syncShell(sim, popping ? false : slide, events, true);

  collectLettuce(sim, events);

  stepRats(sim, dt);
  stepCoyotes(sim, dt);
  stunWithShell(sim, events);
  if (overlapsRat(sim)) {
    die(sim, "rat", events);
    return;
  }
  if (overlapsCoyote(sim)) {
    die(sim, "coyote", events);
    return;
  }
  const groundHit = overlapsBarrier(sim, prevY);
  const airHit = overlapsAir(sim);
  if (groundHit || airHit) {
    die(sim, airHit && !groundHit ? airHit : groundHit, events);
    return;
  }
  if (sim.y > L.groundY + L.playerH * 0.48) {
    die(sim, "gap", events);
    return;
  }

  finishStep(sim, events);
}

function controlOf(input: boolean | Control): Control {
  if (typeof input === "boolean") return { held: input, flyX: 0, flyY: 0, slide: false, slidePop: 0 };
  return input;
}

export function tick(sim: Sim, frameDt: number, input: boolean | Control): Events {
  const events: Events = { jump: false, land: false, die: false, gear: null, collect: false, stomp: null, slide: false };
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
  let pop = clamp(control.slidePop ?? 0, 0, 1);
  while (sim.acc >= STEP && n++ < 5) {
    step(sim, STEP, edge, held, control.flyX, control.flyY, control.slide === true, pop, events);
    edge = false;
    pop = 0;
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
    if (c.barrierH <= 0 || c.barrierDrop > 0) return;
    const start = c.x + c.barrierOff;
    const end = start + c.barrierW;
    if (end < sim.worldX) return;
    const dist = start - sim.worldX;
    if (!best || dist < best.dist) best = { dist, kind: "barrier", w: c.barrierW };
  });
  return best;
}
