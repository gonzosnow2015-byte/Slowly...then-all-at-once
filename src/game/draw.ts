/**
 * Course art is still shapes. Monchel is a sprite sheet.
 * Stage 1 uses the 3-frame run. Air holds frame 1.
 * Stage 2 uses the 4-frame rollerskate cycle. Air holds the top-left frame.
 * Stage 3 uses the 4-frame robo-leg run. Air holds frame 1 of that sheet.
 * Anchor: feet on sim.y, shell centered on playerX, facing right.
 * Sprite height is 0.8 of the collision height so he matches the old shell.
 */
import { crowMotionDrop, lettuceWorldY, METER_K, ROBO_M, JET_M, BLUE_M, WARP_M, SKATES_M, JOHN_M, SEAGULL_SCALE, SHELL_SLIDE_SCALE, speedRange, speedAt, FLY_BIRD, FLY_MOUCH, FLY_BODY_W, FLY_BODY_H, eachChunk, chogStandFrame, chogRideFrame, chogDownFrame, chogFallFrame, chogWaveFrame, chogDeathFrame, metersOf, type Chunk, type Events, type Gear, type Layout, type Sim } from "./sim";

const RUN_FPS = 10;
const BANNER_IN = 0.34;
const BANNER_HOLD = 0.95;
const BANNER_OUT = 0.28;
const BANNER_LIFE = BANNER_IN + BANNER_HOLD + BANNER_OUT;
const BANNER_FONT = '700 {size}px "East Sea Dokdo", Outfit, system-ui, sans-serif';

function bannerFont(size: number): string {
  return BANNER_FONT.replace("{size}", String(size));
}

if (typeof document !== "undefined") {
  void document.fonts.load('700 64px "East Sea Dokdo"');
}

const STAGE_BANNER: Partial<Record<Gear | "warp", string>> = {
  skates: "Skates!",
  robo: "Robo-Legs!",
  jet: "Jetpack!",
  bluejet: "Afterburner!",
  warp: "Stage 6!",
};

const BANNER_NOTE: Partial<Record<Gear, string>> = {
  robo: "Double jump activated",
  jet: "Triple Boost activated",
};

type Sheet = {
  frames: number;
  air: number;
  fallbackW: number;
  fallbackH: number;
  img: HTMLImageElement | null;
  ready: boolean;
  cache: Array<HTMLCanvasElement | null>;
  cacheW: number;
  cacheH: number;
};

function loadSheet(href: string, frames: number, fallbackW: number, fallbackH: number): Sheet {
  const sheet: Sheet = {
    frames,
    air: 0,
    fallbackW,
    fallbackH,
    img: null,
    ready: false,
    cache: Array.from({ length: frames }, () => null),
    cacheW: 0,
    cacheH: 0,
  };
  if (typeof Image === "undefined") return sheet;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    sheet.cacheW = 0;
    sheet.cacheH = 0;
    sheet.ready = true;
  };
  img.src = href;
  sheet.img = img;
  if (img.complete && img.naturalWidth > 0) sheet.ready = true;
  return sheet;
}

function isReady(sheet: Sheet): boolean {
  const img = sheet.img;
  if (sheet.ready) return true;
  if (img && img.complete && img.naturalWidth > 0) {
    sheet.ready = true;
    return true;
  }
  return false;
}

const runSheet = loadSheet(`${new URL("./monchel-run.png", import.meta.url).href}?v=9`, 3, 534, 384);
runSheet.air = 0;
const skateSheet = loadSheet(`${new URL("./monchel-skates.png", import.meta.url).href}?v=5`, 4, 692, 440);
skateSheet.air = 0;
const roboSheet = loadSheet(
  `${new URL("./monchel-robo.png", import.meta.url).href}?v=3`,
  4,
  560,
  346,
);
const jetOffSheet = loadSheet(`${new URL("./monchel-jet-off.png", import.meta.url).href}?v=2`, 1, 858, 686);
const jetOnSheet = loadSheet(`${new URL("./monchel-jet-on.png", import.meta.url).href}?v=2`, 1, 858, 686);
const ratSheet = loadSheet(`${new URL("./rat.png", import.meta.url).href}?v=1`, 4, 679, 442);
const coyoteSheet = loadSheet(`${new URL("./coyote.png", import.meta.url).href}?v=1`, 5, 502, 482);
const shellSlideSheet = loadSheet(`${new URL("./shell-slide.png", import.meta.url).href}?v=1`, 1, 699, 457);
const deathShellImg = loadStill(`${new URL("./death-shell.png", import.meta.url).href}?v=1`);

function loadStill(url: string, urgent = false): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.decoding = urgent ? "sync" : "async";
  if (urgent) img.setAttribute("fetchpriority", "high");
  img.src = url;
  if (urgent) void img.decode().catch(() => {});
  return img;
}

const rockSm = loadStill(new URL("./rock-sm.png", import.meta.url).href);
const rockMd = loadStill(new URL("./rock-md.png", import.meta.url).href);
const rockLg = loadStill(new URL("./rock-lg.png", import.meta.url).href);
const coneImg = loadStill(`${new URL("./cone.png", import.meta.url).href}?v=1`);
const streetImg = loadStill(`${new URL("./street.png", import.meta.url).href}?v=4`);
const treesDay = loadStill(`${new URL("./trees-day.jpg", import.meta.url).href}?v=3`, true);
const treesDusk = loadStill(`${new URL("./trees-dusk.jpg", import.meta.url).href}?v=1`);
const labsImg = loadStill(`${new URL("./labs-edge.webp", import.meta.url).href}?v=1`, true);
const lightspeedImg = loadStill(`${new URL("./lightspeed.png", import.meta.url).href}?v=1`);
const emoImg = loadStill(`${new URL("./emo.png", import.meta.url).href}?v=1`);
const vanImg = loadStill(`${new URL("./van.png", import.meta.url).href}?v=1`);
const camperImg = loadStill(`${new URL("./camper.png", import.meta.url).href}?v=4`);
const sealImg = loadStill(`${new URL("./seal.png", import.meta.url).href}?v=1`);
const johnBackImg = loadStill(`${new URL("./john-back.png", import.meta.url).href}?v=2`);
const johnFrontImg = loadStill(`${new URL("./john-front.png", import.meta.url).href}?v=2`);
const chogStandImg = loadStill(`${new URL("./chog-stand.png", import.meta.url).href}?v=1`);
const chogRideImg = loadStill(`${new URL("./chog-ride.png", import.meta.url).href}?v=1`);
const chogDownImg = loadStill(`${new URL("./chog-down.png", import.meta.url).href}?v=2`);
const chogFallImg = loadStill(`${new URL("./chog-fall.png", import.meta.url).href}?v=1`);
const chogWaveImg = loadStill(`${new URL("./chog-wave.png", import.meta.url).href}?v=1`);
/** Monchel is drawn at 0.8 of playerH. The seal is a little taller. */
const SEAL_H = 0.96;
/** Glass Heart is the emo track. The cameo only exists while it is the active song. */
const EMO_TRACK = 2;
/** Monchel is drawn at 0.8 of playerH. This cameo stands a little taller. */
const EMO_H = 0.92 * 1.25 * 1.25;

let activeTrack = 0;
export function setActiveTrack(index: number): void {
  activeTrack = Number.isFinite(index) ? index : 0;
}

let emoLock: { seed: number; h: number; x: number } | null = null;
let sealLock: { seed: number; h: number; x: number } | null = null;

function stillReady(img: HTMLImageElement | null): img is HTMLImageElement {
  return !!img && img.complete && img.naturalWidth > 0;
}
const blueSheet = loadSheet(`${new URL("./monchel-bluejet.png", import.meta.url).href}?v=5`, 1, 1300, 729);

const CROW_FRAMES = 5;
let crowImg: HTMLImageElement | null = null;
let crowReady = false;
if (typeof Image !== "undefined") {
  const crow = new Image();
  crow.decoding = "async";
  crow.onload = () => {
    crowReady = true;
  };
  crow.src = new URL("./crow.png", import.meta.url).href;
  crowImg = crow;
}

const GULL_FRAMES = 5;
let gullImg: HTMLImageElement | null = null;
let gullReady = false;
if (typeof Image !== "undefined") {
  const gull = new Image();
  gull.decoding = "async";
  gull.onload = () => {
    gullReady = true;
  };
  gull.src = `${new URL("./seagull.png", import.meta.url).href}?v=2`;
  gullImg = gull;
}

function spriteFor(sim: Sim): { sheet: Sheet; frame: number } {
  const running = sim.phase === "run" && sim.grounded && sim.gear !== "jet" && sim.gear !== "bluejet";
  const thrusting = sim.phase !== "dead" && sim.gear === "jet" && !sim.grounded && sim.vy < 0;
  const want =
    sim.gear === "bluejet"
      ? blueSheet
      : sim.gear === "jet"
        ? thrusting
          ? jetOnSheet
          : jetOffSheet
        : sim.gear === "robo"
          ? roboSheet
          : sim.gear === "skates"
            ? skateSheet
            : runSheet;
  const sheet = isReady(want) || !isReady(runSheet) ? want : runSheet;
  const fps = sheet === runSheet ? 5 : RUN_FPS;
  const frame = running ? Math.floor(sim.anim * fps) % sheet.frames : sheet.air;
  return { sheet, frame };
}

const SKY_TOP = "#2c1e44";
const SKY_MID = "#a84462";
const SKY_HORIZON = "#d85a2e";
const SUN = "#ffb15a";
const HILL_FAR = "#7a3d58";
const HILL_NEAR = "#c46b4a";
const GRASS = "#3f5a2e";
const GRASS_DARK = "#2a3e1e";
const DIRT = "#5a3d2c";
const DIRT_DARK = "#3a261c";
const PIT = "#10161e";
const ROAD = "#d7dde8";
const ROAD_STAGE3 = "#b7c1d0";
const ROAD_DARK = "#2c3340";
const ROAD_CURB = "#eef2f7";
const ROAD_CURB_STAGE3 = "#d5dce6";
const NEON = ["#ff2d95", "#00f0ff", "#d06bff", "#ff9a00", "#39ff8a", "#ff5a1f"];
const SHELL_LITE = "#b79ae6";
const HOLE_BITS = ["#ff4d12", "#ff7a18", "#ff2a1a", "#ffb033"];
const BARRIER = "#ffe14a";
const BARRIER_DARK = "#e0a800";
const BARRIER_LITE = "#fff6b0";
const FLAME = "#ffb15a";
const FLAME_CORE = "#fff1c9";
const BLUE_FLAME = "#1f6dff";
const BLUE_CORE = "#7ec8ff";
const FLOATER = "#2a2144";
const FLOATER_EDGE = "#d9c6ff";

/** Nearest-neighbor frame at the on-screen size. Later draws only translate it. */
function frameBitmap(sheet: Sheet, frame: number, dw: number, dh: number): HTMLCanvasElement | null {
  const img = sheet.img;
  if (!img || typeof document === "undefined") return null;
  if (sheet.cacheW !== dw || sheet.cacheH !== dh) {
    for (let i = 0; i < sheet.frames; i++) sheet.cache[i] = null;
    sheet.cacheW = dw;
    sheet.cacheH = dh;
  }
  const cached = sheet.cache[frame];
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const c = canvas.getContext("2d");
  if (!c) return null;
  c.imageSmoothingEnabled = false;
  const pixel = c as CanvasRenderingContext2D & { webkitImageSmoothingEnabled?: boolean };
  pixel.webkitImageSmoothingEnabled = false;
  const fw = img.width / sheet.frames;
  c.drawImage(img, Math.round(frame * fw), 0, fw, img.height, 0, 0, dw, dh);
  sheet.cache[frame] = canvas;
  return canvas;
}

export type Particle = {
  on: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  kind: "dust" | "flame" | "bit";
  color: string;
};

export type Fx = {
  particles: Particle[];
  trauma: number;
  flash: number;
  land: number;
  dustAcc: number;
  reduced: boolean;
  banner: Gear | "warp" | null;
  bannerT: number;
  hint: string | null;
  hintT: number;
  warpOn: boolean;
};

export type View = { cssW: number; cssH: number; dpr: number };

export function createFx(reduced: boolean): Fx {
  return {
    particles: Array.from({ length: 80 }, () => ({
      on: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      max: 1,
      size: 2,
      kind: "dust" as const,
      color: "",
    })),
    trauma: 0,
    flash: 0,
    land: 0,
    dustAcc: 0,
    reduced,
    banner: null,
    bannerT: 0,
    hint: null,
    hintT: 0,
    warpOn: false,
  };
}

function emit(
  fx: Fx,
  kind: Particle["kind"],
  x: number,
  y: number,
  vx: number,
  vy: number,
  life: number,
  size: number,
  color = "",
): void {
  for (const p of fx.particles) {
    if (p.on) continue;
    p.on = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.size = size;
    p.color = color;
    return;
  }
}

export function pumpFx(fx: Fx, dt: number, sim: Sim, events: Events): void {
  if (events.land && !events.jump) {
    fx.land = 1;
    if (!fx.reduced) fx.trauma = Math.min(1, fx.trauma + 0.2);
    for (let i = 0; i < 7; i++) {
      emit(
        fx,
        "dust",
        sim.worldX + sim.shift + (Math.random() - 0.3) * sim.layout.playerW,
        sim.y,
        (Math.random() - 0.7) * 80,
        -40 - Math.random() * 70,
        0.35 + Math.random() * 0.2,
        2 + Math.random() * 3,
      );
    }
  }
  if (events.slide) {
    for (let i = 0; i < 8; i++) {
      emit(
        fx,
        "dust",
        sim.worldX + sim.shift - sim.layout.playerW * 0.2,
        sim.y,
        -50 - Math.random() * 90,
        -16 - Math.random() * 24,
        0.28,
        2 + Math.random() * 2.4,
      );
    }
  }
  if (events.die) {
    fx.flash = 1;
    if (!fx.reduced) fx.trauma = 1;
    const hole = sim.cause === "gap";
    for (let i = 0; i < 12; i++) {
      emit(
        fx,
        "bit",
        sim.worldX + sim.shift,
        sim.y - sim.layout.playerH * 0.4,
        (Math.random() - 0.5) * 220,
        -80 - Math.random() * 160,
        0.45 + Math.random() * 0.3,
        2 + Math.random() * 3,
        hole ? HOLE_BITS[(Math.random() * HOLE_BITS.length) | 0] : "",
      );
    }
  }

  fx.land = Math.max(0, fx.land - dt * 5.5);
  fx.trauma = Math.max(0, fx.trauma - dt * 1.7);
  fx.flash = Math.max(0, fx.flash - dt * 2.4);

  if (sim.phase === "run" && sim.grounded) {
    fx.dustAcc += dt;
    const rate = sim.gear === "shell" ? 0.09 : sim.gear === "bluejet" ? 0.02 : 0.045;
    while (fx.dustAcc > rate) {
      fx.dustAcc -= rate;
      emit(
        fx,
        "dust",
        sim.worldX + sim.shift - sim.layout.playerW * 0.35,
        sim.y,
        -30 - Math.random() * (sim.gear === "bluejet" ? 90 : 40),
        -20 - Math.random() * 30,
        0.28,
        2 + Math.random() * 2,
      );
    }
  } else {
    fx.dustAcc = 0;
  }

  if (events.gear === "bluejet" && !fx.reduced) fx.trauma = Math.min(1, fx.trauma + 0.65);

  if (sim.phase !== "run" || sim.gear === "shell") {
    fx.banner = null;
  } else if (events.gear && STAGE_BANNER[events.gear]) {
    fx.banner = events.gear;
    fx.bannerT = 0;
  }
  if (fx.banner) {
    fx.bannerT += dt;
    if (fx.bannerT >= BANNER_LIFE) fx.banner = null;
  }
  if (sim.phase === "run" && metersOf(sim) >= WARP_M) {
    if (!fx.warpOn) {
      fx.warpOn = true;
      fx.banner = "warp";
      fx.bannerT = 0;
    }
  } else {
    fx.warpOn = false;
  }
  if (events.gear === "bluejet") {
    const touch =
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(hover: none)").matches);
    fx.hint = touch ? "Press and hold - up or down" : "Use cursor/mouse - up or down";
    fx.hintT = 0;
  }
  if (fx.hint) {
    fx.hintT += dt;
    if (fx.hintT >= 2.9) fx.hint = null;
  }

  if (sim.phase === "run" && (sim.gear === "jet" || sim.gear === "bluejet")) {
    const blue = sim.gear === "bluejet";
    emit(
      fx,
      "flame",
      sim.worldX + sim.shift - sim.layout.playerW * 0.55,
      sim.y - sim.layout.playerH * 0.5,
      -(blue ? 140 : 80) - Math.random() * (blue ? 120 : 60),
      (Math.random() - 0.5) * (blue ? 50 : 30),
      blue ? 0.22 : 0.16,
      (blue ? 4 : 3) + Math.random() * (blue ? 4 : 3),
    );
  }

  for (const p of fx.particles) {
    if (!p.on) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.on = false;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.kind === "flame" ? -20 : 90) * dt;
  }
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function streetMix(sim: Sim): number {
  const meters = sim.worldX / (sim.layout.playerH * METER_K);
  return Math.max(0, Math.min(1, (meters - ROBO_M) / 8));
}

function chunkOnStreet(sim: Sim, x: number): boolean {
  return Math.max(0, x) / (sim.layout.playerH * METER_K) >= ROBO_M;
}

function worldToScreen(sim: Sim, x: number): number {
  return x - sim.worldX + sim.layout.playerX;
}

function emoWorldX(sim: Sim): number | null {
  const L = sim.layout;
  if (emoLock && emoLock.seed === sim.seed && emoLock.h === L.playerH) return emoLock.x;
  const unit = L.playerH * METER_K;
  const meters = 14 + hash(sim.seed * 19 + 7) * (SKATES_M - 26);
  const want = unit * meters;
  const metersOf = (x: number) => Math.max(0, x) / unit;
  const found: { c: Chunk | null } = { c: null };
  eachChunk(sim, (c) => {
    if (!found.c && want >= c.x && want < c.x + c.w) found.c = c;
  });
  const cover = found.c;
  if (!cover) return null;
  let x = want;
  if (cover.gap) {
    const nearest: { c: Chunk | null; d: number } = { c: null, d: Infinity };
    eachChunk(sim, (c) => {
      if (c.gap) return;
      const mid = c.x + c.w * 0.5;
      const m = metersOf(mid);
      if (m < 8 || m >= SKATES_M) return;
      const d = Math.abs(mid - want);
      if (d < nearest.d) {
        nearest.d = d;
        nearest.c = c;
      }
    });
    const best = nearest.c;
    if (!best || nearest.d > unit * 16) return null;
    x = best.x + Math.min(best.w * 0.75, Math.max(best.w * 0.25, want - best.x));
  } else if (cover.barrierH > 0) {
    const barL = cover.x + cover.barrierOff;
    const barR = barL + Math.max(cover.barrierW, 8);
    if (x > barL - 12 && x < barR + 12) {
      const left = barL - cover.x;
      const right = cover.x + cover.w - barR;
      x = left >= right ? cover.x + Math.max(18, left * 0.55) : barR + Math.max(18, right * 0.45);
    }
  }
  if (metersOf(x) < 4 || metersOf(x) >= SKATES_M) return null;
  emoLock = { seed: sim.seed, h: L.playerH, x };
  return x;
}

function drawEmoCameo(ctx: CanvasRenderingContext2D, sim: Sim): void {
  if (activeTrack !== EMO_TRACK || !stillReady(emoImg)) return;
  const x = emoWorldX(sim);
  if (x == null) return;
  const L = sim.layout;
  const h = L.playerH * EMO_H;
  const w = h * (emoImg.naturalWidth / emoImg.naturalHeight);
  const sx = worldToScreen(sim, x);
  if (sx < -w || sx > L.w + w) return;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(emoImg, sx - w / 2, L.groundY - h, w, h);
  ctx.restore();
}

/** Whole van sprite, including the roof critter. A little over twice Monchel's height. */
const VAN_H = 2.4;
const VAN_LEAD = 5;
const VAN_APPROACH = 2.5;

function secondsAcross(layout: Layout, x0: number, x1: number): number {
  if (x1 <= x0) return 0;
  const steps = 10;
  const dx = (x1 - x0) / steps;
  let t = 0;
  let x = x0;
  for (let i = 0; i < steps; i++) {
    t += dx / Math.max(40, speedAt(x, layout));
    x += dx;
  }
  return t;
}

/** Screen X of the van center. Null when it is not in the stage 3→4 cameo. */
export function vanScreenX(layout: Layout, worldX: number, vanW: number): number | null {
  const jetX = JET_M * layout.playerH * METER_K;
  const v3 = speedAt(Math.max(0, jetX - 8), layout);
  const beside = layout.playerX + layout.playerH * 1.15 + vanW * 0.5;
  const off = layout.w + vanW * 0.55;
  if (worldX < jetX) {
    const remain = secondsAcross(layout, worldX, jetX);
    if (remain > VAN_LEAD) return null;
    const u = VAN_LEAD - remain;
    if (u < VAN_APPROACH) {
      const t = u / VAN_APPROACH;
      const e = t * t * (3 - 2 * t);
      return off + (beside - off) * e;
    }
    return beside;
  }
  const after = secondsAcross(layout, jetX, worldX);
  const sx = beside + v3 * after - (worldX - jetX);
  if (sx < -vanW * 0.75) return null;
  return sx;
}

function drawVan(ctx: CanvasRenderingContext2D, sim: Sim): void {
  if (sim.phase !== "run" && sim.phase !== "dead") return;
  if (!stillReady(vanImg)) return;
  const L = sim.layout;
  const h = L.playerH * VAN_H;
  const w = h * (vanImg.naturalWidth / vanImg.naturalHeight);
  const sx = vanScreenX(L, sim.worldX, w);
  if (sx == null) return;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(vanImg, sx - w / 2, L.groundY - h * 0.96, w, h);
  ctx.restore();
}

const CAMPER_M = 65;

function drawCamper(ctx: CanvasRenderingContext2D, sim: Sim): void {
  if (sim.phase !== "run" && sim.phase !== "dead") return;
  if (!stillReady(camperImg)) return;
  const L = sim.layout;
  const h = L.playerH * VAN_H * 0.75;
  const w = h * (camperImg.naturalWidth / camperImg.naturalHeight);
  const sx = worldToScreen(sim, L.playerH * METER_K * CAMPER_M);
  if (sx < -w || sx > L.w + w) return;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(camperImg, sx - w / 2, L.groundY - h * 0.96, w, h);
  ctx.restore();
}

export function sealWorldX(sim: Sim): number | null {
  const L = sim.layout;
  if (sealLock && sealLock.seed === sim.seed && sealLock.h === L.playerH) return sealLock.x;
  const unit = L.playerH * METER_K;
  const meters = 10 + hash(sim.seed * 41 + 3) * (SKATES_M - 18);
  const want = unit * meters;
  const metersOf = (x: number) => Math.max(0, x) / unit;
  const found: { c: Chunk | null } = { c: null };
  eachChunk(sim, (c) => {
    if (!found.c && want >= c.x && want < c.x + c.w) found.c = c;
  });
  if (!found.c) return null;
  const pad = L.playerH * 0.5;
  const blocked = (c: Chunk, x: number) => {
    if (c.gap || x < c.x || x >= c.x + c.w) return true;
    const spans: Array<[number, number]> = [];
    if (c.barrierH > 0) spans.push([c.x + c.barrierOff, c.x + c.barrierOff + Math.max(c.barrierW, 8)]);
    const decks: Array<[number, number]> = [
      [c.platOff, c.platW],
      [c.plat2Off, c.plat2W],
      [c.plat3Off, c.plat3W],
      [c.plat4Off, c.plat4W],
    ];
    for (const [off, w] of decks) {
      if (w > 0) spans.push([c.x + off, c.x + off + w]);
    }
    for (const [a, b] of spans) {
      if (x > a - pad && x < b + pad) return true;
    }
    return false;
  };
  const open = (c: Chunk, x: number) => {
    const m = metersOf(x);
    return m >= 8 && m < SKATES_M - 2 && !blocked(c, x);
  };
  let bestX: number | null = null;
  let bestD = Infinity;
  const consider = (c: Chunk, x: number) => {
    if (!open(c, x)) return;
    const d = Math.abs(x - want);
    if (d < bestD) {
      bestD = d;
      bestX = x;
    }
  };
  consider(found.c, want);
  eachChunk(sim, (c) => {
    if (c.gap) return;
    const mid = metersOf(c.x + c.w * 0.5);
    if (mid < 8 || mid >= SKATES_M) return;
    for (let i = 1; i < 7; i++) consider(c, c.x + (c.w * i) / 7);
  });
  if (bestX == null || bestD > unit * 18) return null;
  sealLock = { seed: sim.seed, h: L.playerH, x: bestX };
  return bestX;
}

/** True once Monchel's body has gone past the seal. */
export function sealPassed(sim: Sim): boolean {
  const x = sealWorldX(sim);
  return x != null && sim.worldX + sim.shift >= x;
}

function drawSeal(ctx: CanvasRenderingContext2D, sim: Sim): void {
  if ((sim.phase !== "run" && sim.phase !== "dead") || !stillReady(sealImg)) return;
  const x = sealWorldX(sim);
  if (x == null) return;
  const L = sim.layout;
  const sx = worldToScreen(sim, x);
  const h = L.playerH * SEAL_H;
  const w = h * (sealImg.naturalWidth / sealImg.naturalHeight);
  if (sx < -w || sx > L.w + w) return;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.translate(sx, L.groundY);
  if (!sealPassed(sim)) ctx.scale(-1, 1);
  ctx.drawImage(sealImg, -w / 2, -h, w, h);
  ctx.restore();
}

function johnWorldX(sim: Sim): number {
  return sim.layout.playerH * METER_K * JOHN_M;
}

/** Full sprite, sign included. The body ends up a little taller than Monchel. */
const JOHN_H = 1.5 * 1.15;
const JOHN_NEAR_M = 2.2;

function drawJohn(ctx: CanvasRenderingContext2D, sim: Sim): void {
  if (sim.phase !== "ready" && sim.phase !== "run" && sim.phase !== "dead") return;
  const near = sim.worldX + sim.shift >= johnWorldX(sim) - sim.layout.playerH * METER_K * JOHN_NEAR_M;
  const img = near ? johnFrontImg : johnBackImg;
  if (!stillReady(img)) return;
  const L = sim.layout;
  const sx = worldToScreen(sim, johnWorldX(sim));
  const h = L.playerH * JOHN_H;
  const w = h * (img.naturalWidth / img.naturalHeight);
  if (sx < -w || sx > L.w + w) return;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, sx - w / 2, L.groundY - h, w, h);
  ctx.restore();
}

function drawChogFrame(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  img: HTMLImageElement | null,
  frame: { cx: number; top: number; w: number; h: number } | null,
): void {
  if (!frame || !stillReady(img)) return;
  const sx = worldToScreen(sim, frame.cx);
  if (sx < -frame.w || sx > sim.layout.w + frame.w) return;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, sx - frame.w / 2, frame.top, frame.w, frame.h);
  ctx.restore();
}

function drawChogWorld(ctx: CanvasRenderingContext2D, sim: Sim): void {
  if (sim.phase !== "run" && sim.phase !== "dead") return;
  drawChogFrame(ctx, sim, chogStandImg, chogStandFrame(sim));
  drawChogFrame(ctx, sim, chogFallImg, chogFallFrame(sim));
  drawChogFrame(ctx, sim, chogDownImg, chogDownFrame(sim));
  drawChogFrame(ctx, sim, chogWaveImg, chogWaveFrame(sim));
  drawChogFrame(ctx, sim, chogDownImg, chogDeathFrame(sim));
}

function drawChogRider(ctx: CanvasRenderingContext2D, sim: Sim): void {
  if (sim.phase !== "run" && sim.phase !== "dead") return;
  drawChogFrame(ctx, sim, chogRideImg, chogRideFrame(sim));
}

function drawNeonSky(ctx: CanvasRenderingContext2D, sim: Sim): void {
  const L = sim.layout;
  const sky = ctx.createLinearGradient(0, 0, 0, L.groundY);
  sky.addColorStop(0, "#3a2d72");
  sky.addColorStop(0.34, "#5c4a98");
  sky.addColorStop(0.62, "#7e6cb4");
  sky.addColorStop(0.84, "#b7a6dc");
  sky.addColorStop(1, "#f0c6d8");
  ctx.fillStyle = sky;
  ctx.fillRect(-40, -80, L.w + 80, L.groundY + 80);
  ctx.fillStyle = "rgba(186, 230, 255, 0.7)";
  ctx.beginPath();
  ctx.arc(L.w * 0.16, L.groundY * 0.2, L.playerH * 0.26, 0, Math.PI * 2);
  ctx.fill();
}

function drawBuildings(ctx: CanvasRenderingContext2D, sim: Sim): void {
  const L = sim.layout;
  const shift = sim.worldX * 0.15;
  const cell = 112;
  const start = Math.floor(shift / cell) - 1;
  const end = start + Math.ceil(L.w / cell) + 3;
  for (let i = start; i <= end; i++) {
    const n = hash(i * 3.1);
    const n2 = hash(i * 7.7 + 2);
    const bw = 58 + n * 40;
    const bh = L.groundY * (0.26 + n2 * 0.32);
    const x = i * cell - shift + (1 - n) * 10;
    const y = L.groundY - 6 - bh;
    ctx.fillStyle = n > 0.55 ? "#3c4864" : "#4a5674";
    ctx.fillRect(x, y, bw, bh + 20);
    ctx.fillStyle = "rgba(255, 168, 72, 0.72)";
    const cols = 2 + Math.floor(n * 2);
    const rows = 2 + Math.floor(n2 * 3);
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        if (hash(i * 13 + col * 5 + row) < 0.35) continue;
        ctx.fillRect(x + 8 + col * 14, y + 10 + row * 16, 7, 8);
      }
    }
    const sign = NEON[Math.floor(hash(i * 1.7 + 4) * NEON.length)]!;
    const sw = bw * (0.5 + hash(i + 4) * 0.38);
    const sh = 10 + hash(i + 5) * 12;
    const sx = x + (bw - sw) * 0.5;
    const sy = y + 12 + hash(i + 6) * Math.max(8, bh * 0.28);
    ctx.save();
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = sign;
    ctx.fillRect(sx - 8, sy - 6, sw + 16, sh + 12);
    ctx.restore();
    ctx.fillStyle = sign;
    ctx.fillRect(sx, sy, sw, sh);
    if (hash(i + 9) > 0.45) {
      const sign2 = NEON[Math.floor(hash(i * 2.3 + 1) * NEON.length)]!;
      const vx = x + bw - 14;
      const vy = sy + sh + 10;
      const vh = 18 + hash(i + 3) * 22;
      ctx.save();
      ctx.globalAlpha *= 0.45;
      ctx.fillStyle = sign2;
      ctx.fillRect(vx - 4, vy - 3, 16, vh + 6);
      ctx.restore();
      ctx.fillStyle = sign2;
      ctx.fillRect(vx, vy, 8, vh);
    }
  }
}

/** Horizon in the tree strips, and the sidewalk in the labs plate, as fractions of height. */
const TREE_LINE = 573 / 816;
const LABS_LINE = 1340 / 1728;
/** Extra lift so the tree canopy meets the foliage on the Labs plate. */
const TREE_RAISE = 84 / 816;
const EARLY_PARALLAX = 0.46;

function drawLoopStrip(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  img: HTMLImageElement,
  lineFrac: number,
  scroll: number,
  raise = 0,
): { drawH: number; drawW: number; top: number } | null {
  if (!stillReady(img)) return null;
  const L = sim.layout;
  const line = L.groundY - 8;
  const drawH = line / lineFrac;
  const top = line - lineFrac * drawH - raise;
  const drawW = drawH * (img.naturalWidth / img.naturalHeight);
  let x = -(scroll % drawW);
  if (x > 0) x -= drawW;
  while (x < L.w + 2) {
    ctx.drawImage(img, x, top, drawW, drawH);
    x += drawW;
  }
  return { drawH, drawW, top };
}

function drawEarlyBackdrop(ctx: CanvasRenderingContext2D, sim: Sim): boolean {
  const L = sim.layout;
  const meters = sim.worldX / (L.playerH * METER_K);
  if (meters >= ROBO_M) return false;
  const stage2 = meters >= SKATES_M;
  const trees = stage2 ? treesDusk : treesDay;
  if (!stillReady(trees)) return false;
  if (!stage2 && !stillReady(labsImg)) return false;
  const scroll = sim.worldX * EARLY_PARALLAX;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  drawLoopStrip(ctx, sim, trees, TREE_LINE, scroll, (L.groundY - 8) / TREE_LINE * TREE_RAISE);
  if (!stage2 && stillReady(labsImg)) {
    const line = L.groundY - 8;
    const drawH = line / LABS_LINE;
    const drawW = drawH * (labsImg.naturalWidth / labsImg.naturalHeight);
    const x = -scroll;
    if (x < L.w && x + drawW > -4) {
      ctx.drawImage(labsImg, x, line - LABS_LINE * drawH, drawW, drawH);
    }
  }
  ctx.restore();
  return true;
}

/** Left-edge fade baked into lightspeed.png, as a fraction of its width. */
const LIGHT_FADE = 220 / 2128;

function drawLightspeed(ctx: CanvasRenderingContext2D, sim: Sim): void {
  if (!stillReady(lightspeedImg)) return;
  const L = sim.layout;
  const top = -80;
  const drawH = L.groundY - top + 8;
  const drawW = drawH * (lightspeedImg.naturalWidth / lightspeedImg.naturalHeight);
  const step = Math.max(8, drawW * (1 - LIGHT_FADE));
  const scroll = sim.worldX;
  let x = -((scroll % step) + step) % step - step;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "#000";
  ctx.fillRect(-40, top, L.w + 80, drawH);
  while (x < L.w + 4) {
    ctx.drawImage(lightspeedImg, x, top, drawW, drawH);
    x += step;
  }
  ctx.restore();
}

function streetBand(sim: Sim): number {
  const meters = sim.worldX / (sim.layout.playerH * METER_K);
  const inn = Math.max(0, Math.min(1, (meters - ROBO_M) / 8));
  const out = Math.max(0, Math.min(1, (BLUE_M - meters) / 10));
  return inn * out;
}

/** Sidewalk/curb line in street.png, as a fraction of the strip height. */
const STREET_CURB = 804 / 912;

function drawStreetStrip(ctx: CanvasRenderingContext2D, sim: Sim, band: number): void {
  if (band <= 0 || !stillReady(streetImg)) return;
  const L = sim.layout;
  const img = streetImg;
  const curb = L.groundY - 8;
  const drawH = L.groundY * 0.985;
  const top = curb - STREET_CURB * drawH;
  const drawW = drawH * (img.naturalWidth / img.naturalHeight);
  const span = drawW;
  let x = -(sim.worldX * 0.5) % span;
  if (x > 0) x -= span;
  ctx.save();
  ctx.globalAlpha *= band;
  ctx.imageSmoothingEnabled = true;
  while (x < L.w + 2) {
    ctx.drawImage(img, x, top, drawW, drawH);
    x += span;
  }
  ctx.restore();
}

function drawStreetTrees(ctx: CanvasRenderingContext2D, sim: Sim): void {
  const L = sim.layout;
  const shift = sim.worldX * 0.34;
  const cell = 240;
  const start = Math.floor(shift / cell) - 1;
  const end = start + Math.ceil(L.w / cell) + 2;
  for (let i = start; i <= end; i++) {
    const n = hash(i * 4.2 + 11);
    if (n < 0.28) continue;
    const x = i * cell + (n - 0.5) * 50 - shift;
    const h = L.playerH * (0.85 + hash(i + 8) * 0.7);
    const base = L.groundY - 2;
    ctx.fillStyle = "#4e8a68";
    ctx.fillRect(x - 4, base - h * 0.5, 8, h * 0.5);
    ctx.beginPath();
    ctx.ellipse(x, base - h * 0.62, h * 0.34, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (hash(i + 2) > 0.55) {
      ctx.beginPath();
      ctx.ellipse(x + h * 0.16, base - h * 0.78, h * 0.2, h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function draw(ctx: CanvasRenderingContext2D, view: View, sim: Sim, fx: Fx): void {
  const L = sim.layout;
  const { cssW, cssH, dpr } = view;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (sim.phase === "title") {
    ctx.clearRect(0, 0, cssW * dpr, cssH * dpr);
    return;
  }
  ctx.fillStyle = streetMix(sim) > 0.5 ? "#3a2d72" : SKY_TOP;
  ctx.fillRect(0, 0, cssW * dpr, cssH * dpr);

  let scale = cssW / L.w;
  let drawnH = L.h * scale;
  let ox = 0;
  let oy = 0;
  if (drawnH > cssH) {
    scale = cssH / L.h;
    ox = (cssW - L.w * scale) / 2;
    oy = 0;
  } else {
    oy = cssH - drawnH;
  }

  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);

  if (!fx.reduced && fx.trauma > 0) {
    const mag = 12 * fx.trauma * fx.trauma;
    ctx.translate(Math.sin(sim.anim * 73) * mag, Math.cos(sim.anim * 61) * mag);
  }

  const sky = ctx.createLinearGradient(0, 0, 0, L.groundY);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(0.38, "#5a3568");
  sky.addColorStop(0.68, SKY_MID);
  sky.addColorStop(1, SKY_HORIZON);
  ctx.fillStyle = sky;
  ctx.fillRect(-40, -80, L.w + 80, L.groundY + 80);

  const metersNow = sim.worldX / (L.playerH * METER_K);
  const lightspeed = metersNow >= BLUE_M;
  const early = !lightspeed && drawEarlyBackdrop(ctx, sim);
  const stage1 = metersNow < SKATES_M;
  if (lightspeed) {
    drawLightspeed(ctx, sim);
  } else if (!early) {
    ctx.fillStyle = SUN;
    ctx.beginPath();
    ctx.arc(L.w * 0.74, L.groundY * 0.42, L.playerH * 0.42, 0, Math.PI * 2);
    ctx.fill();
    hills(ctx, sim, HILL_FAR, L.playerH * 0.55, 0.0045, 0.18, L.groundY * 0.72);
    hills(ctx, sim, HILL_NEAR, L.playerH * 0.38, 0.007, 0.36, L.groundY * 0.86);
  } else if (!stage1) {
    ctx.fillStyle = SUN;
    ctx.beginPath();
    ctx.arc(L.w * 0.74 - sim.worldX * 0.12, L.groundY * 0.42, L.playerH * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!lightspeed) clouds(ctx, sim, stage1 && early);

  const mix = lightspeed ? 0 : streetMix(sim);
  const band = streetBand(sim);
  if (mix > 0) {
    ctx.save();
    ctx.globalAlpha = mix;
    drawNeonSky(ctx, sim);
    clouds(ctx, sim);
    const far = mix * (1 - band);
    if (far > 0.02) {
      ctx.globalAlpha = far;
      drawBuildings(ctx, sim);
      drawStreetTrees(ctx, sim);
    }
    ctx.restore();
  }
  drawStreetStrip(ctx, sim, band);

  eachVisible(sim, (c) => {
    if (!c.gap || (sim.blueClear > 0 && c.x < sim.blueClear)) return;
    const street = chunkOnStreet(sim, c.x);
    const sx = worldToScreen(sim, c.x);
    ctx.fillStyle = street ? "#3a4254" : PIT;
    ctx.fillRect(sx, L.groundY, c.w, L.h - L.groundY + 80);
    ctx.fillStyle = street ? "#2a3142" : "#0a0e14";
    ctx.fillRect(sx + 8, L.groundY + 14, Math.max(0, c.w - 16), L.h);
    const glowH = Math.min((L.h - L.groundY) * 0.58, L.playerH * 2.6);
    const glowTop = L.h - glowH;
    const glow = ctx.createLinearGradient(0, glowTop, 0, L.h);
    glow.addColorStop(0, "rgba(255, 72, 16, 0)");
    glow.addColorStop(0.55, "rgba(255, 64, 12, 0.16)");
    glow.addColorStop(0.84, "rgba(255, 72, 10, 0.42)");
    glow.addColorStop(1, "rgba(255, 140, 32, 0.72)");
    ctx.fillStyle = glow;
    ctx.fillRect(sx, glowTop, c.w, glowH + 48);
    ctx.fillStyle = street ? ROAD_DARK : GRASS_DARK;
    ctx.fillRect(sx - 3, L.groundY - 6, 8, 10);
    ctx.fillRect(sx + c.w - 5, L.groundY - 6, 8, 10);
  });

  eachVisible(sim, (c) => {
    if (c.gap && !(sim.blueClear > 0 && c.x < sim.blueClear)) return;
    const sx = worldToScreen(sim, c.x);
    if (chunkOnStreet(sim, c.x)) {
      const stage3 = chunkStage(sim, c.x) === 3;
      ctx.fillStyle = ROAD_DARK;
      ctx.fillRect(sx, L.groundY, c.w, L.h - L.groundY + 80);
      ctx.fillStyle = stage3 ? ROAD_STAGE3 : ROAD;
      ctx.fillRect(sx, L.groundY - 10, c.w, 16);
      ctx.fillStyle = stage3 ? ROAD_CURB_STAGE3 : ROAD_CURB;
      ctx.fillRect(sx, L.groundY - 10, c.w, 3);
      return;
    }
    ctx.fillStyle = DIRT;
    ctx.fillRect(sx, L.groundY, c.w, L.h - L.groundY + 80);
    ctx.fillStyle = DIRT_DARK;
    ctx.fillRect(sx, L.groundY + 18, c.w, 10);
    ctx.fillStyle = GRASS;
    ctx.fillRect(sx, L.groundY - 10, c.w, 12);
    ctx.fillStyle = GRASS_DARK;
    ctx.fillRect(sx, L.groundY - 4, c.w, 4);

    const start = Math.max(c.x, sim.worldX - L.playerX - 20);
    const end = Math.min(c.x + c.w, sim.worldX + L.w);
    for (let wx = Math.floor(start / 16) * 16; wx < end; wx += 16) {
      const n = hash(Math.floor(wx * 0.25));
      if (n < 0.55) continue;
      const sxg = worldToScreen(sim, wx);
      ctx.fillStyle = n > 0.82 ? "#8b9a48" : "#314a24";
      ctx.fillRect(sxg, L.groundY - 10 - n * 10, 2, 6 + n * 8);
    }
  });

  drawVan(ctx, sim);
  drawCamper(ctx, sim);
  drawSeal(ctx, sim);
  drawJohn(ctx, sim);

  eachVisible(sim, (c) => {
    if (sim.blueClear > 0 && c.x < sim.blueClear) return;
    drawPlatform(ctx, sim, c.x + c.platOff, c.platDrop, c.platW);
    drawPlatform(ctx, sim, c.x + c.plat2Off, c.plat2Drop, c.plat2W);
    drawPlatform(ctx, sim, c.x + c.plat3Off, c.plat3Drop, c.plat3W);
    drawPlatform(ctx, sim, c.x + c.plat4Off, c.plat4Drop, c.plat4W);
  });

  eachVisible(sim, (c) => {
    if (sim.blueClear > 0 && c.x < sim.blueClear) return;
    if (c.barrierH <= 0) return;
    const sx = worldToScreen(sim, c.x + c.barrierOff);
    const feet = L.groundY - c.barrierDrop;
    const by = feet - c.barrierH;
    const meters = Math.max(0, c.x) / (L.playerH * METER_K);
    if (meters < ROBO_M && drawRock(ctx, sx, c.barrierW, c.barrierH, feet, L.playerH)) return;
    if (meters >= ROBO_M && meters < BLUE_M) {
      const bw = L.playerH * 0.3;
      const bh = L.playerH * 0.68;
      const csx = sx + c.barrierW / 2 - bw / 2;
      if (drawCone(ctx, csx, bw, bh, feet)) return;
    }
    ctx.fillStyle = BARRIER_DARK;
    round(ctx, sx + 3, by + 4, c.barrierW, c.barrierH);
    ctx.fill();
    ctx.fillStyle = BARRIER;
    round(ctx, sx, by, c.barrierW, c.barrierH);
    ctx.fill();
    ctx.fillStyle = BARRIER_LITE;
    ctx.fillRect(sx + 3, by + 3, c.barrierW - 6, Math.max(3, c.barrierH * 0.18));
  });

  drawRats(ctx, sim);
  drawCoyotes(ctx, sim);

  eachVisible(sim, (c) => {
    if (sim.blueClear > 0 && c.x < sim.blueClear) return;
    if (c.flyKind > 0) drawFlightFoe(ctx, sim, c);
    const gate = c.air2W > 0 && c.air2H > 0;
    if (gate) {
      drawFloater(ctx, sim, c.x + c.airOff, c.airDrop, c.airW, c.airH);
      drawFloater(ctx, sim, c.x + c.air2Off, c.air2Drop, c.air2W, c.air2H);
    } else {
      const drop = crowMotionDrop(c, sim.runT, L.playerH);
      const meters = Math.max(0, c.x + c.airOff) / (L.playerH * METER_K);
      if (meters >= BLUE_M) return;
      if (meters >= ROBO_M) drawSeagull(ctx, sim, c.x + c.airOff, drop, c.airW, c.airH);
      else drawCrow(ctx, sim, c.x + c.airOff, drop, c.airW, c.airH);
    }
  });

  drawLettuce(ctx, sim);
  drawEmoCameo(ctx, sim);
  drawChogWorld(ctx, sim);

  drawParticles(ctx, sim, fx, false);
  drawMonchel(ctx, sim, fx);
  drawChogRider(ctx, sim);
  drawParticles(ctx, sim, fx, true);

  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(244, 239, 228, ${fx.flash * 0.35})`;
    ctx.fillRect(-30, -40, L.w + 60, L.h + 80);
  }

  const { base, max } = speedRange(L);
  const ratio = max <= base ? 0 : (sim.speed - base) / (max - base);
  const hot = sim.gear === "bluejet" && sim.phase === "run" && metersOf(sim) < BLUE_M;
  if (sim.phase === "run" && metersOf(sim) < BLUE_M && (ratio > 0.55 || hot) && !fx.reduced) {
    const streaks = hot ? 8 : 4;
    ctx.strokeStyle = hot
      ? "rgba(150, 214, 255, 0.45)"
      : `rgba(244, 239, 228, ${0.15 + Math.min(1, ratio) * 0.2})`;
    ctx.lineWidth = hot ? 2.4 : 2;
    for (let i = 0; i < streaks; i++) {
      const y = L.groundY * (0.22 + i * (hot ? 0.08 : 0.12));
      const x = ((sim.anim * (180 + i * 40) * (hot ? 1.8 : 1) + i * 80) % (L.w + 80)) - 40;
      ctx.beginPath();
      ctx.moveTo(L.w - x, y);
      ctx.lineTo(L.w - x - 18 - Math.min(1.4, ratio) * (hot ? 70 : 30), y);
      ctx.stroke();
    }
  }

  drawStageBanner(ctx, sim, fx);
  drawFlightHint(ctx, sim, fx);
}

function drawStageBanner(ctx: CanvasRenderingContext2D, sim: Sim, fx: Fx): void {
  if (!fx.banner) return;
  const label = STAGE_BANNER[fx.banner];
  if (!label) return;
  const L = sim.layout;
  const t = fx.bannerT;
  let alpha = 1;
  let scale = 1;
  if (t < BANNER_IN) {
    const u = t / BANNER_IN;
    alpha = Math.min(1, u * 2);
    if (fx.reduced) {
      scale = 0.86 + 0.14 * u;
    } else if (u < 0.7) {
      const p = u / 0.7;
      scale = 0.32 + 0.92 * (1 - (1 - p) ** 3);
    } else {
      const p = (u - 0.7) / 0.3;
      scale = 1.24 - 0.24 * (1 - (1 - p) ** 2);
    }
  } else if (t > BANNER_IN + BANNER_HOLD) {
    const u = Math.min(1, (t - BANNER_IN - BANNER_HOLD) / BANNER_OUT);
    const ease = u * u;
    alpha = 1 - ease;
    scale = 1 - ease * 0.45;
  }
  if (alpha <= 0) return;

  // Just above a full jump, which lands in the upper part of the play field.
  const y = Math.max(L.playerH * 0.9, L.groundY - L.playerH * 3.25);
  let size = L.playerH * 1.05;
  ctx.save();
  ctx.font = bannerFont(size);
  const wide = ctx.measureText(label).width;
  const limit = L.w * 0.88;
  if (wide > limit) size *= limit / wide;
  ctx.translate(L.w * 0.5, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const shimmer0 = BANNER_IN + BANNER_HOLD - 0.42;
  const shimmer = t >= shimmer0 && t <= BANNER_IN + BANNER_HOLD ? (t - shimmer0) / 0.42 : -1;
  strokeBanner(ctx, label, 0, size, shimmer);
  const note = fx.banner === "warp" ? undefined : BANNER_NOTE[fx.banner];
  if (note) {
    const noteSize = size * 0.38;
    strokeBanner(ctx, note, size * 0.78, noteSize, shimmer);
  }
  ctx.restore();
}

function strokeBanner(ctx: CanvasRenderingContext2D, text: string, y: number, size: number, shimmer: number): void {
  ctx.font = bannerFont(size);
  const wide = ctx.measureText(text).width;
  const purple = Math.max(7, size * 0.1);
  const black = Math.max(2.2, size * 0.038);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = purple;
  ctx.strokeStyle = "#7c3aed";
  ctx.shadowColor = "rgba(168, 85, 247, 0.9)";
  ctx.shadowBlur = size * 0.2;
  ctx.strokeText(text, 0, y);
  if (shimmer >= 0) {
    const pad = size * 0.35;
    const span = wide + pad * 2;
    const band = Math.max(size * 0.42, 18);
    const x = -wide / 2 - pad - band + (span + band) * shimmer;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(x, y - size * 1.2, band, size * 2.4);
    ctx.clip();
    ctx.lineWidth = purple;
    ctx.strokeStyle = "#f3e8ff";
    ctx.shadowColor = "#d8b4fe";
    ctx.shadowBlur = size * 0.28;
    ctx.strokeText(text, 0, y);
    ctx.restore();
  }
  ctx.shadowBlur = 0;
  ctx.lineWidth = black;
  ctx.strokeStyle = "#0a0a0a";
  ctx.strokeText(text, 0, y);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, 0, y);
  ctx.restore();
}

function drawFlightHint(ctx: CanvasRenderingContext2D, sim: Sim, fx: Fx): void {
  if (!fx.hint) return;
  const L = sim.layout;
  const t = fx.hintT;
  const fadeIn = 0.18;
  const hold = 2.25;
  let alpha = 1;
  let scale = 1;
  if (t < fadeIn) {
    const u = t / fadeIn;
    alpha = u;
    scale = 0.92 + 0.08 * u;
  } else if (t > fadeIn + hold) {
    const u = Math.min(1, (t - fadeIn - hold) / 0.45);
    alpha = 1 - u;
    scale = 1 - u * 0.04;
  }
  if (alpha <= 0) return;
  let size = L.playerH * 0.42;
  ctx.save();
  ctx.font = `700 ${size}px Outfit, "Avenir Next", system-ui, sans-serif`;
  const wide = ctx.measureText(fx.hint).width;
  const limit = L.w * 0.9;
  if (wide > limit) size *= limit / wide;
  ctx.translate(L.w * 0.5, L.h * 0.16);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.font = `700 ${size}px Outfit, "Avenir Next", system-ui, sans-serif`;
  ctx.lineWidth = Math.max(4, size * 0.16);
  ctx.strokeStyle = "#121820";
  ctx.strokeText(fx.hint, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(fx.hint, 0, 0);
  ctx.restore();
}

function drawStunHalo(ctx: CanvasRenderingContext2D, spriteH: number, stun: number, spin: number): void {
  const r = spriteH * 0.36;
  const alpha = Math.min(0.9, (stun / 0.3) * 0.75);
  ctx.save();
  ctx.translate(0, -spriteH - spriteH * 0.12);
  ctx.rotate(spin);
  ctx.scale(0.42 + 0.58 * Math.abs(Math.cos(spin)), 0.34);
  ctx.strokeStyle = `rgba(255, 214, 64, ${alpha})`;
  ctx.lineWidth = Math.max(1.25, spriteH * 0.04);
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r, 0, 0.2, Math.PI * 1.65);
  ctx.stroke();
  ctx.restore();
}

function drawRats(ctx: CanvasRenderingContext2D, sim: Sim): void {
  if (!isReady(ratSheet) || !ratSheet.img) return;
  const L = sim.layout;
  const h = L.playerH * 0.52;
  const aspect = 679 / 442;
  const w = h * aspect;
  const frame = Math.floor(sim.runT * 8) % 4;
  const m = ctx.getTransform();
  const dw = Math.max(1, Math.round(Math.abs(m.a) * w));
  const dh = Math.max(1, Math.round(Math.abs(m.d) * h));
  const bitmap = frameBitmap(ratSheet, frame, dw, dh);
  if (!bitmap) return;
  for (const rat of sim.rats) {
    const sx = worldToScreen(sim, rat.x);
    if (sx < -w || sx > L.w + w) continue;
    const anchorX = Math.round(sx);
    const anchorY = Math.round(rat.feet || L.groundY);
    const feetX = m.a * anchorX + m.c * anchorY + m.e;
    const feetY = m.b * anchorX + m.d * anchorY + m.f;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.floor(feetX), Math.floor(feetY));
    if (rat.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(bitmap, Math.floor(-dw / 2), -dh);
    if (rat.stun > 0) drawStunHalo(ctx, dh, rat.stun, sim.runT * 9);
    ctx.restore();
  }
}

function chunkStage(sim: Sim, x: number): number {
  const meters = Math.max(0, x) / (sim.layout.playerH * METER_K);
  if (meters >= BLUE_M) return 5;
  if (meters >= JET_M) return 4;
  if (meters >= ROBO_M) return 3;
  if (meters >= SKATES_M) return 2;
  return 1;
}

function drawCone(
  ctx: CanvasRenderingContext2D,
  sx: number,
  bw: number,
  bh: number,
  groundY: number,
): boolean {
  if (!stillReady(coneImg)) return false;
  const dh = bh;
  const dw = dh * (coneImg.naturalWidth / coneImg.naturalHeight);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(coneImg, sx + bw / 2 - dw / 2, groundY - dh, dw, dh);
  ctx.restore();
  return true;
}

function drawRock(
  ctx: CanvasRenderingContext2D,
  sx: number,
  bw: number,
  bh: number,
  groundY: number,
  playerH: number,
): boolean {
  const k = bh / playerH;
  const img = k < 0.44 ? rockSm : k < 0.6 ? rockMd : rockLg;
  const rock = stillReady(img) ? img : stillReady(rockSm) ? rockSm : null;
  if (!rock) return false;
  const dh = bh;
  const dw = dh * (rock.naturalWidth / rock.naturalHeight);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(rock, sx + bw / 2 - dw / 2, groundY - dh, dw, dh);
  ctx.restore();
  return true;
}

function drawCoyotes(ctx: CanvasRenderingContext2D, sim: Sim): void {
  if (!isReady(coyoteSheet) || !coyoteSheet.img) return;
  const L = sim.layout;
  const h = L.playerH * 0.816;
  const aspect = 502 / 482;
  const w = h * aspect;
  const m = ctx.getTransform();
  const dw = Math.max(1, Math.round(Math.abs(m.a) * w));
  const dh = Math.max(1, Math.round(Math.abs(m.d) * h));
  for (const coyote of sim.coyotes) {
    const sx = worldToScreen(sim, coyote.x);
    if (sx < -w || sx > L.w + w) continue;
    const frame = Math.floor(coyote.anim * 8) % 5;
    const bitmap = frameBitmap(coyoteSheet, frame, dw, dh);
    if (!bitmap) continue;
    const anchorX = Math.round(sx);
    const anchorY = Math.round(coyote.feet || L.groundY);
    const feetX = m.a * anchorX + m.c * anchorY + m.e;
    const feetY = m.b * anchorX + m.d * anchorY + m.f;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.floor(feetX), Math.floor(feetY));
    if (coyote.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(bitmap, Math.floor(-dw / 2), -dh);
    if (coyote.stun > 0) drawStunHalo(ctx, dh, coyote.stun, sim.runT * 9);
    ctx.restore();
  }
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  x: number,
  drop: number,
  w: number,
): void {
  if (w <= 0 || drop <= 0) return;
  const L = sim.layout;
  const sx = worldToScreen(sim, x);
  const top = L.groundY - drop;
  const h = Math.max(10, L.playerH * 0.12);
  ctx.fillStyle = "rgba(12, 16, 24, 0.25)";
  ctx.fillRect(sx + 4, top + h + 3, w, 4);
  if (chunkOnStreet(sim, x)) {
    ctx.fillStyle = ROAD_DARK;
    round(ctx, sx, top, w, h);
    ctx.fill();
    const cap = Math.max(4, Math.round(h * 0.42));
    ctx.fillStyle = ROAD;
    ctx.fillRect(sx, top, w, cap);
    ctx.fillStyle = ROAD_CURB;
    ctx.fillRect(sx, top, w, Math.min(3, cap));
    if (chunkStage(sim, x) === 3) {
      ctx.save();
      ctx.shadowColor = "#b44dff";
      ctx.shadowBlur = 7;
      ctx.fillStyle = "#d9a6ff";
      ctx.fillRect(sx + 1, top, Math.max(0, w - 2), 2);
      ctx.restore();
    }
    return;
  }
  ctx.fillStyle = DIRT;
  round(ctx, sx, top, w, h);
  ctx.fill();
  ctx.fillStyle = DIRT_DARK;
  ctx.fillRect(sx, top + h * 0.62, w, Math.max(3, h * 0.38));
  const cap = Math.max(4, Math.round(h * 0.45));
  ctx.fillStyle = GRASS;
  ctx.fillRect(sx, top, w, cap);
  ctx.fillStyle = GRASS_DARK;
  ctx.fillRect(sx, top + Math.max(0, cap - 2), w, 2);
  for (let i = 8; i < w - 4; i += 16) {
    const n = hash(Math.floor((x + i) * 0.25));
    if (n < 0.55) continue;
    ctx.fillStyle = n > 0.82 ? "#8b9a48" : "#314a24";
    ctx.fillRect(sx + i, top - n * 6, 2, 4 + n * 5);
  }
}

function crowImage(): HTMLImageElement | null {
  const img = crowImg;
  if (!img) return null;
  if (!crowReady && img.complete && img.naturalWidth > 0) crowReady = true;
  return crowReady && img.naturalWidth > 0 ? img : null;
}

function gullImage(): HTMLImageElement | null {
  const img = gullImg;
  if (!img) return null;
  if (!gullReady && img.complete && img.naturalWidth > 0) gullReady = true;
  return gullReady && img.naturalWidth > 0 ? img : null;
}

function drawSeagull(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  x: number,
  drop: number,
  w: number,
  h: number,
): void {
  if (w <= 0 || h <= 0 || drop <= 0) return;
  const img = gullImage();
  if (!img) return;
  const L = sim.layout;
  const bottom = L.groundY - drop;
  const midX = worldToScreen(sim, x) + w / 2;
  const midY = bottom - h / 2;
  const drawH = L.playerH * 1.05 * 0.64 * SEAGULL_SCALE * 1.2;
  const frameW = img.width / GULL_FRAMES;
  const drawW = drawH * (frameW / img.height);
  const spin = Math.floor(sim.anim * 8 + Math.abs(x) * 0.013);
  const frame = ((spin % GULL_FRAMES) + GULL_FRAMES) % GULL_FRAMES;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    img,
    Math.round(frame * frameW),
    0,
    frameW,
    img.height,
    Math.round(midX - drawW / 2),
    Math.round(midY - drawH / 2),
    Math.round(drawW),
    Math.round(drawH),
  );
  ctx.restore();
}

function drawCrow(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  x: number,
  drop: number,
  w: number,
  h: number,
): void {
  if (w <= 0 || h <= 0 || drop <= 0) return;
  const img = crowImage();
  if (!img) {
    drawFloater(ctx, sim, x, drop, w, h);
    return;
  }
  const L = sim.layout;
  const bottom = L.groundY - drop;
  const midX = worldToScreen(sim, x) + w / 2;
  const midY = bottom - h / 2;
  const drawH = L.playerH * 1.05 * 0.64;
  const frameW = img.width / CROW_FRAMES;
  const drawW = drawH * (frameW / img.height);
  const spin = Math.floor(sim.anim * 8 + Math.abs(x) * 0.013);
  const frame = ((spin % CROW_FRAMES) + CROW_FRAMES) % CROW_FRAMES;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    img,
    Math.round(frame * frameW),
    0,
    frameW,
    img.height,
    Math.round(midX - drawW / 2),
    Math.round(midY - drawH / 2),
    Math.round(drawW),
    Math.round(drawH),
  );
  ctx.restore();
}

function drawFloater(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  x: number,
  drop: number,
  w: number,
  h: number,
): void {
  if (w <= 0 || h <= 0 || drop <= 0) return;
  const sx = worldToScreen(sim, x);
  const bottom = sim.layout.groundY - drop;
  const top = bottom - h;
  ctx.fillStyle = "rgba(80, 60, 140, 0.35)";
  round(ctx, sx + 3, top + 4, w, h, 8);
  ctx.fill();
  ctx.fillStyle = FLOATER;
  round(ctx, sx, top, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = FLOATER_EDGE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = FLOATER_EDGE;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(sx + w * 0.5, top + 4);
  ctx.lineTo(sx + w - 5, top + h * 0.5);
  ctx.lineTo(sx + w * 0.5, top + h - 4);
  ctx.lineTo(sx + 5, top + h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Placeholder until the bird and Mouch sprites arrive. */
function drawFlightFoe(ctx: CanvasRenderingContext2D, sim: Sim, c: Sim["slots"][number]): void {
  const L = sim.layout;
  const bodyW = L.playerH * FLY_BODY_W;
  const bodyH = L.playerH * FLY_BODY_H;
  const sx = worldToScreen(sim, c.x + c.flyOff);
  const bottom = L.groundY - c.flyDrop;
  const midX = sx + bodyW / 2;
  const midY = bottom - bodyH / 2;
  const flap = Math.sin(sim.anim * 14 + c.x * 0.01);
  ctx.save();
  if (c.flyKind === FLY_BIRD) {
    ctx.fillStyle = "#8aa0ad";
    ctx.beginPath();
    ctx.moveTo(midX - bodyW * 0.02, midY);
    ctx.lineTo(midX - bodyW * 0.62, midY - bodyH * (0.2 + flap * 0.7));
    ctx.lineTo(midX + bodyW * 0.2, midY + bodyH * 0.05);
    ctx.fill();
    ctx.fillStyle = "#e7eef1";
    ctx.beginPath();
    ctx.ellipse(midX, midY, bodyW * 0.38, bodyH * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e2b15a";
    ctx.beginPath();
    ctx.moveTo(midX - bodyW * 0.34, midY - bodyH * 0.02);
    ctx.lineTo(midX - bodyW * 0.62, midY + bodyH * 0.08);
    ctx.lineTo(midX - bodyW * 0.34, midY + bodyH * 0.18);
    ctx.fill();
  } else if (c.flyKind === FLY_MOUCH) {
    const lift = bodyH * (0.2 + flap * 0.35);
    ctx.fillStyle = "rgba(198, 164, 255, 0.9)";
    ctx.beginPath();
    ctx.ellipse(midX - bodyW * 0.24, midY - lift, bodyW * 0.3, bodyH * 0.2, -0.5, 0, Math.PI * 2);
    ctx.ellipse(midX + bodyW * 0.24, midY - lift, bodyW * 0.3, bodyH * 0.2, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6a45c8";
    ctx.beginPath();
    ctx.ellipse(midX, midY + bodyH * 0.06, bodyW * 0.26, bodyH * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4f1ff";
    ctx.beginPath();
    ctx.arc(midX - bodyW * 0.08, midY, bodyH * 0.14, 0, Math.PI * 2);
    ctx.arc(midX + bodyW * 0.1, midY, bodyH * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLettuce(ctx: CanvasRenderingContext2D, sim: Sim): void {
  const L = sim.layout;
  const size = Math.max(20, L.playerH * 0.36);
  ctx.save();
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  eachVisible(sim, (c) => {
    if (c.letN <= 0) return;
    for (let i = 0; i < c.letN; i++) {
      if (c.letGot & (1 << i)) continue;
      const x = worldToScreen(sim, c.x + c.letOff + i * c.letGap);
      const y = lettuceWorldY(L.groundY, c, i, L.playerH);
      ctx.fillText("🥬", x, y);
    }
  });
  ctx.restore();
}

function eachVisible(sim: Sim, fn: (c: Sim["slots"][number]) => void): void {
  const L = sim.layout;
  const len = sim.slots.length;
  for (let i = 0; i < sim.count; i++) {
    const c = sim.slots[(sim.head + i) % len]!;
    if (c.x + c.w < sim.worldX - L.playerX - 40) continue;
    if (c.x > sim.worldX + L.w) break;
    fn(c);
  }
}

function hills(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  color: string,
  amp: number,
  freq: number,
  parallax: number,
  baseY: number,
): void {
  const { w, h } = sim.layout;
  const shift = sim.worldX * parallax;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h + 20);
  ctx.lineTo(0, baseY);
  for (let x = 0; x <= w; x += 16) {
    const wx = x + shift;
    const n = Math.sin(wx * freq) * 0.65 + Math.sin(wx * freq * 2.2 + 1.4) * 0.35;
    ctx.lineTo(x, baseY - amp * (0.35 + n * 0.5));
  }
  ctx.lineTo(w, h + 20);
  ctx.closePath();
  ctx.fill();
}

function clouds(ctx: CanvasRenderingContext2D, sim: Sim, hideLowest = false): void {
  const w = sim.layout.w;
  let skip: (typeof sim.clouds)[number] | null = null;
  if (hideLowest) {
    for (const c of sim.clouds) {
      if (!skip || c.y > skip.y) skip = c;
    }
  }
  ctx.fillStyle = "rgba(255, 236, 214, 0.78)";
  for (const c of sim.clouds) {
    if (c === skip) continue;
    const span = w + c.r * 4;
    let x = (c.x - sim.anim * c.v) % span;
    if (x < -c.r * 2) x += span;
    ctx.beginPath();
    ctx.ellipse(x, c.y, c.r, c.r * 0.46, 0, 0, Math.PI * 2);
    ctx.ellipse(x + c.r * 0.6, c.y + 2, c.r * 0.7, c.r * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  fx: Fx,
  front: boolean,
): void {
  for (const p of fx.particles) {
    if (!p.on) continue;
    const isFront = p.kind !== "dust";
    if (isFront !== front) continue;
    const t = p.life / p.max;
    const sx = worldToScreen(sim, p.x);
    if (p.kind === "flame") {
      const blue = sim.gear === "bluejet";
      ctx.fillStyle = t > 0.5 ? (blue ? BLUE_CORE : FLAME_CORE) : blue ? BLUE_FLAME : FLAME;
    } else if (p.kind === "bit") {
      ctx.fillStyle = p.color || SHELL_LITE;
    } else {
      ctx.fillStyle = `rgba(217, 196, 164, ${t})`;
    }
    ctx.globalAlpha = p.kind === "dust" ? t : 1;
    ctx.beginPath();
    ctx.arc(sx, p.y, p.size * (p.kind === "flame" ? 0.6 + t : 1), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawMonchel(ctx: CanvasRenderingContext2D, sim: Sim, fx: Fx): void {
  const L = sim.layout;
  const tucked = sim.shelling && sim.phase !== "dead";
  const posed = spriteFor(sim);
  const sheet = tucked && isReady(shellSlideSheet) ? shellSlideSheet : posed.sheet;
  const frame = tucked && isReady(shellSlideSheet) ? 0 : posed.frame;
  const deadShell = sim.phase === "dead" && sim.cause !== "gap" && stillReady(deathShellImg);
  const img = deadShell ? deathShellImg : isReady(sheet) ? sheet.img : null;
  const px = L.playerX + sim.shift;
  const stageScale = sim.gear === "skates" || sim.gear === "robo" || sim.gear === "jet" ? 1.1025 : 1;
  const h = (tucked ? L.playerH * 0.42 * SHELL_SLIDE_SCALE : L.playerH * 0.8 * stageScale) * (deadShell ? 0.8 : 1);
  const frameW = deadShell ? deathShellImg.naturalWidth : img && img.height > 0 ? img.width / sheet.frames : sheet.fallbackW;
  const frameH = deadShell ? deathShellImg.naturalHeight : img && img.height > 0 ? img.height : sheet.fallbackH;
  const aspect = frameW / frameH;
  const w = h * aspect;
  const airborne = sim.phase !== "dead" && !sim.grounded;
  const shadowY = sim.grounded ? sim.y : L.groundY;
  const shadowW = w * (airborne ? 0.28 : 0.42);

  ctx.save();
  if (!sim.pitFall) {
    ctx.translate(px, shadowY + 3);
    ctx.scale(1, 0.28);
    ctx.fillStyle = airborne ? "rgba(12, 16, 24, 0.16)" : "rgba(12, 16, 24, 0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 0, shadowW, shadowW, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  let extraY = 0;
  if (sim.phase === "dead") {
    const t = Math.min(1, sim.deathT / 0.5);
    extraY = t * t * L.playerH * 0.55;
  }

  if (!img) {
    ctx.fillStyle = "#6d4cb8";
    ctx.beginPath();
    ctx.ellipse(px, sim.y - h * (tucked ? 0.35 : 0.45), w * 0.28, h * (tucked ? 0.28 : 0.32), 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Whole pixels and nearest-neighbor. A fractional Y while jumping was resampling
  // the shell into horizontal tears.
  const m = ctx.getTransform();
  const dw = Math.max(1, Math.round(Math.abs(m.a) * w));
  const dh = Math.max(1, Math.round(Math.abs(m.d) * h));
  const anchorX = Math.round(px);
  const anchorY = Math.round(sim.y + extraY);
  const feetX = m.a * anchorX + m.c * anchorY + m.e;
  const feetY = m.b * anchorX + m.d * anchorY + m.f;
  const left = Math.floor(feetX - dw / 2);
  const top = Math.floor(feetY - dh);
  const bitmap = frameBitmap(sheet, frame, dw, dh);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = tucked || deadShell;
  const pixelCtx = ctx as CanvasRenderingContext2D & { webkitImageSmoothingEnabled?: boolean };
  pixelCtx.webkitImageSmoothingEnabled = !(tucked || deadShell);
  if (deadShell) ctx.drawImage(deathShellImg, left, top, dw, dh);
  else if (tucked && img) ctx.drawImage(img, 0, 0, img.width, img.height, left, top, dw, dh);
  else if (bitmap) ctx.drawImage(bitmap, left, top);
  else if (img) {
    const fw = img.width / sheet.frames;
    ctx.drawImage(img, Math.round(frame * fw), 0, fw, img.height, left, top, dw, dh);
  }
  ctx.restore();
}

function round(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 4,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
