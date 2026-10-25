/**
 * Course art is still shapes. Monchel is a sprite sheet.
 * Stage 1 (and stages without their own sheet) use the 5-frame run.
 * Stage 2 uses the 4-frame rollerskate cycle. Air holds the top-left frame.
 * Stage 3 uses the 4-frame robo-leg run. Air holds frame 1 of that sheet.
 * Anchor: feet on sim.y, shell centered on playerX, facing right.
 * Sprite height is 0.8 of the collision height so he matches the old shell.
 */
import { crowMotionDrop, lettuceWorldY, METER_K, ROBO_M, speedRange, type Events, type Gear, type Sim } from "./sim";

const RUN_FPS = 10;
const BANNER_IN = 0.26;
const BANNER_HOLD = 1.05;
const BANNER_OUT = 0.4;
const BANNER_LIFE = BANNER_IN + BANNER_HOLD + BANNER_OUT;

const STAGE_BANNER: Partial<Record<Gear, string>> = {
  skates: "Skates!",
  robo: "Robo-Legs!",
  jet: "Jet!",
  bluejet: "Afterburner!",
};

const BANNER_INK: Partial<Record<Gear, string>> = {
  skates: "#ffe7a3",
  robo: "#f3e6ff",
  jet: "#ffd7b0",
  bluejet: "#c9edff",
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

const runSheet = loadSheet(new URL("./monchel-run.png", import.meta.url).href, 5, 620, 389);
const skateSheet = loadSheet(new URL("./monchel-skates.png", import.meta.url).href, 4, 692, 440);
const roboSheet = loadSheet(
  `${new URL("./monchel-robo.png", import.meta.url).href}?v=3`,
  4,
  560,
  346,
);
const jetSheet = loadSheet(new URL("./monchel-jet.png", import.meta.url).href, 1, 899, 775);

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

function spriteFor(sim: Sim): { sheet: Sheet; frame: number } {
  const running = sim.phase === "run" && sim.grounded && sim.gear !== "jet";
  const want =
    sim.gear === "jet" ? jetSheet : sim.gear === "robo" ? roboSheet : sim.gear === "skates" ? skateSheet : runSheet;
  const sheet = isReady(want) || !isReady(runSheet) ? want : runSheet;
  const frame = running ? Math.floor(sim.anim * RUN_FPS) % sheet.frames : sheet.air;
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
const ROAD_DARK = "#2c3340";
const ROAD_CURB = "#eef2f7";
const NEON = ["#ff2d95", "#00f0ff", "#d06bff", "#ff9a00", "#39ff8a", "#ff5a1f"];
const SHELL_LITE = "#b79ae6";
const BARRIER = "#ffe14a";
const BARRIER_DARK = "#e0a800";
const BARRIER_LITE = "#fff6b0";
const FLAME = "#ffb15a";
const FLAME_CORE = "#fff1c9";
const BLUE_FLAME = "#4eb6ff";
const BLUE_CORE = "#eaf6ff";
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
};

export type Fx = {
  particles: Particle[];
  trauma: number;
  flash: number;
  land: number;
  dustAcc: number;
  reduced: boolean;
  banner: Gear | null;
  bannerT: number;
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
    })),
    trauma: 0,
    flash: 0,
    land: 0,
    dustAcc: 0,
    reduced,
    banner: null,
    bannerT: 0,
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
        sim.layout.groundY,
        (Math.random() - 0.7) * 80,
        -40 - Math.random() * 70,
        0.35 + Math.random() * 0.2,
        2 + Math.random() * 3,
      );
    }
  }
  if (events.die) {
    fx.flash = 1;
    if (!fx.reduced) fx.trauma = 1;
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
        sim.layout.groundY,
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

  ctx.fillStyle = SUN;
  ctx.beginPath();
  ctx.arc(L.w * 0.74, L.groundY * 0.42, L.playerH * 0.42, 0, Math.PI * 2);
  ctx.fill();

  hills(ctx, sim, HILL_FAR, L.playerH * 0.55, 0.0045, 0.18, L.groundY * 0.72);
  hills(ctx, sim, HILL_NEAR, L.playerH * 0.38, 0.007, 0.36, L.groundY * 0.86);
  clouds(ctx, sim);

  const mix = streetMix(sim);
  if (mix > 0) {
    ctx.save();
    ctx.globalAlpha = mix;
    drawNeonSky(ctx, sim);
    clouds(ctx, sim);
    drawBuildings(ctx, sim);
    drawStreetTrees(ctx, sim);
    ctx.restore();
  }

  eachVisible(sim, (c) => {
    if (!c.gap) return;
    const street = chunkOnStreet(sim, c.x);
    const sx = worldToScreen(sim, c.x);
    ctx.fillStyle = street ? "#3a4254" : PIT;
    ctx.fillRect(sx, L.groundY, c.w, L.h - L.groundY + 80);
    ctx.fillStyle = street ? "#2a3142" : "#0a0e14";
    ctx.fillRect(sx + 8, L.groundY + 14, Math.max(0, c.w - 16), L.h);
    ctx.fillStyle = street ? ROAD_DARK : GRASS_DARK;
    ctx.fillRect(sx - 3, L.groundY - 6, 8, 10);
    ctx.fillRect(sx + c.w - 5, L.groundY - 6, 8, 10);
  });

  eachVisible(sim, (c) => {
    if (c.gap) return;
    const sx = worldToScreen(sim, c.x);
    if (chunkOnStreet(sim, c.x)) {
      ctx.fillStyle = ROAD_DARK;
      ctx.fillRect(sx, L.groundY, c.w, L.h - L.groundY + 80);
      ctx.fillStyle = ROAD;
      ctx.fillRect(sx, L.groundY - 10, c.w, 16);
      ctx.fillStyle = ROAD_CURB;
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

  eachVisible(sim, (c) => {
    drawPlatform(ctx, sim, c.x + c.platOff, c.platDrop, c.platW);
    drawPlatform(ctx, sim, c.x + c.plat2Off, c.plat2Drop, c.plat2W);
  });

  eachVisible(sim, (c) => {
    if (c.barrierH <= 0) return;
    const sx = worldToScreen(sim, c.x + c.barrierOff);
    const by = L.groundY - c.barrierH;
    ctx.fillStyle = BARRIER_DARK;
    round(ctx, sx + 3, by + 4, c.barrierW, c.barrierH);
    ctx.fill();
    ctx.fillStyle = BARRIER;
    round(ctx, sx, by, c.barrierW, c.barrierH);
    ctx.fill();
    ctx.fillStyle = BARRIER_LITE;
    ctx.fillRect(sx + 3, by + 3, c.barrierW - 6, Math.max(3, c.barrierH * 0.18));
  });

  eachVisible(sim, (c) => {
    const gate = c.air2W > 0 && c.air2H > 0;
    if (gate) {
      drawFloater(ctx, sim, c.x + c.airOff, c.airDrop, c.airW, c.airH);
      drawFloater(ctx, sim, c.x + c.air2Off, c.air2Drop, c.air2W, c.air2H);
    } else {
      const drop = crowMotionDrop(c, sim.runT, L.playerH);
      drawCrow(ctx, sim, c.x + c.airOff, drop, c.airW, c.airH);
    }
  });

  drawLettuce(ctx, sim);

  drawParticles(ctx, sim, fx, false);
  drawMonchel(ctx, sim, fx);
  drawParticles(ctx, sim, fx, true);

  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(244, 239, 228, ${fx.flash * 0.35})`;
    ctx.fillRect(-30, -40, L.w + 60, L.h + 80);
  }

  const { base, max } = speedRange(L);
  const ratio = max <= base ? 0 : (sim.speed - base) / (max - base);
  const hot = sim.gear === "bluejet" && sim.phase === "run";
  if (sim.phase === "run" && (ratio > 0.55 || hot) && !fx.reduced) {
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
}

function drawStageBanner(ctx: CanvasRenderingContext2D, sim: Sim, fx: Fx): void {
  if (!fx.banner) return;
  const label = STAGE_BANNER[fx.banner];
  if (!label) return;
  const L = sim.layout;
  const t = fx.bannerT;
  let alpha = 1;
  let scale = 1;
  let rise = 0;
  if (t < BANNER_IN) {
    const u = t / BANNER_IN;
    const ease = 1 - (1 - u) ** 3;
    alpha = ease;
    const pop = fx.reduced ? 1 : 1 + Math.sin(u * Math.PI) * 0.14;
    scale = (0.55 + 0.45 * ease) * pop;
  } else if (t > BANNER_IN + BANNER_HOLD) {
    const u = Math.min(1, (t - BANNER_IN - BANNER_HOLD) / BANNER_OUT);
    alpha = 1 - u;
    scale = 1 - u * 0.08;
    rise = -L.playerH * 0.28 * u * u;
  }
  if (alpha <= 0) return;

  // Just above a full jump, which lands in the upper part of the play field.
  const y = Math.max(L.playerH * 0.95, L.groundY - L.playerH * 3.05) + rise;
  let size = L.playerH * 0.72;
  ctx.save();
  ctx.font = `700 ${size}px Outfit, "Avenir Next", system-ui, sans-serif`;
  const wide = ctx.measureText(label).width;
  const limit = L.w * 0.88;
  if (wide > limit) size *= limit / wide;
  ctx.translate(L.w * 0.5, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.font = `700 ${size}px Outfit, "Avenir Next", system-ui, sans-serif`;
  ctx.lineWidth = Math.max(5, size * 0.16);
  ctx.strokeStyle = "#121820";
  ctx.strokeText(label, 0, 0);
  ctx.fillStyle = BANNER_INK[fx.banner] ?? "#f4efe4";
  ctx.fillText(label, 0, 0);
  if (fx.banner === "robo") {
    const note = "Double jump activated";
    const noteSize = size * 0.38;
    ctx.font = `600 ${noteSize}px Outfit, "Avenir Next", system-ui, sans-serif`;
    ctx.lineWidth = Math.max(3, noteSize * 0.2);
    ctx.strokeStyle = "#121820";
    ctx.strokeText(note, 0, size * 0.78);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(note, 0, size * 0.78);
  }
  ctx.restore();
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
  const drawH = L.playerH * 1.05 * 0.8;
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

function clouds(ctx: CanvasRenderingContext2D, sim: Sim): void {
  const w = sim.layout.w;
  ctx.fillStyle = "rgba(255, 236, 214, 0.78)";
  for (const c of sim.clouds) {
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
      ctx.fillStyle = SHELL_LITE;
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
  const { sheet, frame } = spriteFor(sim);
  const img = isReady(sheet) ? sheet.img : null;
  const px = L.playerX + sim.shift;
  const h = L.playerH * 0.8;
  const frameW = img && img.height > 0 ? img.width / sheet.frames : sheet.fallbackW;
  const frameH = img && img.height > 0 ? img.height : sheet.fallbackH;
  const aspect = frameW / frameH;
  const w = h * aspect;
  const airborne = sim.phase !== "dead" && !sim.grounded;
  const shadowY = sim.grounded ? sim.y : L.groundY;
  const shadowW = w * (airborne ? 0.28 : 0.42);

  ctx.save();
  ctx.translate(px, shadowY + 3);
  ctx.scale(1, 0.28);
  ctx.fillStyle = airborne ? "rgba(12, 16, 24, 0.16)" : "rgba(12, 16, 24, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 0, shadowW, shadowW, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  let extraY = 0;
  if (sim.phase === "dead") {
    const t = Math.min(1, sim.deathT / 0.5);
    extraY = t * t * L.playerH * 0.55;
  }

  if (!img) {
    ctx.fillStyle = "#6d4cb8";
    ctx.beginPath();
    ctx.ellipse(px, sim.y - h * 0.45, w * 0.28, h * 0.32, 0, 0, Math.PI * 2);
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
  ctx.imageSmoothingEnabled = false;
  const pixelCtx = ctx as CanvasRenderingContext2D & { webkitImageSmoothingEnabled?: boolean };
  pixelCtx.webkitImageSmoothingEnabled = false;
  if (bitmap) ctx.drawImage(bitmap, left, top);
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
