import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AIR_TIME,
  BLUE_M,
  createSim,
  crowHitBox,
  crowMotionDrop,
  eachChunk,
  extendCourse,
  gearFor,
  holdAirTime,
  JET_M,
  JUMP_HOLD,
  LAYOUT_SEED,
  layoutFrom,
  LETTUCE_PER_STAGE,
  metersOf,
  METER_K,
  nextHazard,
  RAMP_METERS,
  resetToRun,
  ROBO_M,
  runScore,
  SKATES_M,
  speedAt,
  tick,
  type Sim,
} from "./sim.ts";

function audit(sim: Sim): void {
  eachChunk(sim, (c) => {
    if (c.gap) {
      const cover = speedAt(Math.max(0, c.x), sim.layout) * AIR_TIME;
      assert.ok(c.w <= cover * 0.78 + 0.5, `gap ${c.w} wider than cover ${cover}`);
    }
    if (c.barrierH > 0) {
      assert.ok(c.barrierH < sim.layout.playerH * 0.7, "barrier too tall");
    }
  });
  let prevEnd: number | null = null;
  eachChunk(sim, (c) => {
    if (prevEnd != null) assert.ok(Math.abs(c.x - prevEnd) < 0.01, "track seam");
    prevEnd = c.x + c.w;
  });
}

function ai() {
  let releaseAt = -1;
  return (sim: Sim, t: number): boolean => {
    if (t < releaseAt) return true;
    if (sim.phase !== "run") return false;
    if (sim.vy < 0) return false;
    if (!sim.grounded && sim.coyote <= 0) return false;
    const L = sim.layout;
    let crowDist = Infinity;
    eachChunk(sim, (c) => {
      if (c.airW <= 0 || c.airH <= 0 || c.air2W > 0) return;
      const box = crowHitBox(
        L,
        c.x + c.airOff,
        crowMotionDrop(c, sim.runT, L.playerH),
        c.airW,
        c.airH,
      );
      const head = L.groundY - L.playerH * 0.6;
      const knees = L.groundY - L.playerH * 0.1;
      if (!(knees > box.top && head < box.bottom)) return;
      const dist = (box.left + box.right) / 2 - sim.worldX;
      if (dist < crowDist) crowDist = dist;
    });
    const hazard = nextHazard(sim);
    const nose = L.playerW * 0.36;
    const lead = nose + sim.speed * 0.2;
    const crowLead = nose + sim.speed * 0.55;
    if ((crowDist < crowLead && crowDist > -L.playerW) || (hazard && hazard.dist < lead && hazard.dist > -6)) {
      releaseAt = t + JUMP_HOLD + 0.04;
      return true;
    }
    return false;
  };
}

function run(sim: Sim, seconds: number, heldAt: (s: Sim, t: number) => boolean): Sim {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  let t = 0;
  for (let i = 0; i < steps; i++) {
    tick(sim, dt, heldAt(sim, t));
    t += dt;
    if (i % 30 === 0) audit(sim);
    if (sim.phase === "dead") break;
  }
  return sim;
}

function peak(holdFrames: number): number {
  const layout = layoutFrom(800, 500);
  const sim = createSim(layout, { seed: 1, best: 0 });
  sim.phase = "run";
  let minY = sim.y;
  for (let i = 0; i < 150; i++) {
    tick(sim, 1 / 60, i < holdFrames);
    if (sim.y < minY) minY = sim.y;
  }
  return layout.groundY - minY;
}

describe("monchel runner", () => {
  it("starts slow and reaches a higher cap", () => {
    const layout = layoutFrom(1280, 800);
    const s0 = speedAt(0, layout);
    const s1 = speedAt(layout.playerH * METER_K * RAMP_METERS, layout);
    assert.ok(s1 > s0 * 1.8);
  });

  it("adds a fifth stage that is dramatically faster", () => {
    const layout = layoutFrom(1280, 800);
    const x = (m: number) => layout.playerH * METER_K * m;
    assert.equal(gearFor(SKATES_M - 1), "shell");
    assert.equal(gearFor(SKATES_M), "skates");
    assert.equal(gearFor(ROBO_M), "robo");
    assert.equal(gearFor(JET_M), "jet");
    assert.equal(gearFor(BLUE_M), "bluejet");
    const before = speedAt(x(BLUE_M - 1), layout);
    const after = speedAt(x(BLUE_M), layout);
    assert.ok(after / before > 1.35, `stage 5 jump ${after} vs ${before}`);
    assert.ok(after > speedAt(x(JET_M), layout) * 1.2);
  });

  it("scales jump height with how long the button is held", () => {
    const tap = peak(2);
    const mid = peak(Math.round(JUMP_HOLD * 30));
    const full = peak(Math.ceil(JUMP_HOLD * 60) + 2);
    assert.ok(tap > 6, `tap ${tap}`);
    assert.ok(mid > tap * 1.25, `mid ${mid} tap ${tap}`);
    assert.ok(full > mid * 1.2, `full ${full} mid ${mid}`);
    assert.ok(full > tap * 2.4, `full ${full} tap ${tap}`);
    assert.ok(holdAirTime(JUMP_HOLD) > holdAirTime(1 / 60) * 1.6);
  });

  it("dies if he never jumps", () => {
    for (const size of [
      [390, 700],
      [1280, 800],
    ] as const) {
      const sim = createSim(layoutFrom(size[0], size[1]), { seed: 3, best: 0 });
      sim.phase = "run";
      run(sim, 6, () => false);
      assert.equal(sim.phase, "dead");
      assert.ok(sim.score >= 1);
    }
  });

  it("an on-time jump survives the opening and speeds up", () => {
    for (const seed of [1, 2, 7, 11, 21, 42]) {
      for (const size of [
        [390, 844],
        [1280, 800],
        [360, 640],
      ] as const) {
        const sim = createSim(layoutFrom(size[0], size[1]), { seed, best: 0 });
        sim.phase = "run";
        const start = sim.speed;
        run(sim, 22, ai());
        assert.equal(sim.phase, "run", `died (${sim.cause}) seed ${seed} ${size.join("x")} score ${sim.score}`);
        assert.ok(sim.score > 12, `score ${sim.score}`);
        assert.ok(sim.speed > start);
        assert.ok(sim.count < 60, "pool grew too far");
      }
    }
  });

  it("keeps accepting new jump presses after landing", () => {
    const sim = createSim(layoutFrom(800, 500), { seed: 1, best: 0 });
    sim.phase = "run";
    sim.worldX = layoutFrom(800, 500).playerH * METER_K * (JET_M + 8);
    sim.gear = "jet";
    const chunk = sim.slots[0]!;
    chunk.x = -200;
    chunk.w = 100000;
    chunk.gap = false;
    chunk.barrierH = 0;
    chunk.airW = 0;
    chunk.air2W = 0;
    chunk.platW = 0;
    chunk.letN = 0;
    sim.head = 0;
    sim.count = 1;
    sim.cursor = chunk.x + chunk.w;
    sim.y = sim.layout.groundY;
    sim.grounded = true;
    const tap = (held: boolean, edge: boolean) => tick(sim, 1 / 60, { held, edge, flyX: 0, flyY: 0 });
    for (let n = 0; n < 12; n++) {
      assert.equal(sim.grounded, true, `not grounded before press ${n}`);
      const y = sim.y;
      const ev = tap(true, true);
      assert.equal(ev.jump, true, `press ${n} did not jump`);
      assert.ok(sim.y < y, `press ${n} did not rise`);
      tap(false, false);
      for (let i = 0; i < 120 && sim.phase === "run" && !sim.grounded; i++) tap(false, false);
      assert.equal(sim.phase, "run", `died on cycle ${n} (${sim.cause})`);
      assert.equal(sim.grounded, true, `did not land after jump ${n}`);
    }
    const y0 = sim.y;
    let rises = 0;
    for (let n = 0; n < 3; n++) {
      const ev = tap(true, true);
      if (ev.jump) rises++;
      tap(false, false);
    }
    assert.equal(rises, 3, "triple jump did not take three presses");
    for (let i = 0; i < 20 && sim.y >= y0; i++) tap(false, false);
    assert.ok(sim.y < y0, "triple jump did not rise");
    tap(false, false);
    for (let i = 0; i < 120 && !sim.grounded; i++) tap(false, false);
    assert.equal(sim.grounded, true);
    const ev = tap(true, true);
    assert.equal(ev.jump, true, "jump after triple did not register");
  });

  it("restart clears the course and keeps the best", () => {
    const sim = createSim(layoutFrom(800, 500), { seed: 4, best: 0 });
    sim.phase = "run";
    run(sim, 6, () => false);
    assert.equal(sim.phase, "dead");
    const best = sim.best;
    const next = resetToRun(sim);
    assert.equal(next.phase, "run");
    assert.equal(next.score, 0);
    assert.equal(next.worldX, 0);
    assert.equal(next.best, best);
    assert.equal(next.grounded, true);
  });

  it("robo stage can jump again in the air", () => {
    const layout = layoutFrom(800, 500);
    const sim = createSim(layout, { seed: 1, best: 0 });
    sim.phase = "run";
    sim.gear = "robo";
    sim.airJumps = 1;
    sim.grounded = false;
    sim.coyote = 0;
    sim.y = layout.groundY - 36;
    sim.vy = 40;
    const y0 = sim.y;
    tick(sim, 1 / 60, true);
    for (let i = 0; i < 6; i++) tick(sim, 1 / 60, true);
    assert.ok(sim.y < y0 - 8, `air jump rose to ${sim.y} from ${y0}`);

    const shell = createSim(layout, { seed: 1, best: 0 });
    shell.phase = "run";
    shell.airJumps = 1;
    shell.grounded = false;
    shell.coyote = 0;
    shell.y = layout.groundY - 36;
    shell.vy = 40;
    const shellY = shell.y;
    tick(shell, 1 / 60, true);
    assert.ok(shell.y >= shellY - 2, "shell should not double jump");
  });

  it("blue jet flies with the stick instead of jumping", () => {
    const layout = layoutFrom(900, 600);
    const sim = createSim(layout, { seed: 2, best: 0 });
    sim.phase = "run";
    sim.worldX = layout.playerH * METER_K * BLUE_M;
    sim.gear = "bluejet";
    sim.y = layout.groundY - layout.playerH * 1.2;
    sim.grounded = false;
    const y0 = sim.y;
    tick(sim, 1 / 30, { held: true, flyX: 0, flyY: 0 });
    assert.ok(Math.abs(sim.y - y0) < 1, "holding jump does not hop in stage 5");
    tick(sim, 1 / 30, { held: true, flyX: 0, flyY: -1 });
    assert.equal(sim.gear, "bluejet");
    assert.ok(sim.y < y0 - 4, `fly up ${sim.y} vs ${y0}`);
    assert.equal(sim.phase, "run");
    const shift = sim.shift;
    tick(sim, 1 / 30, { held: false, flyX: 1, flyY: 0 });
    assert.ok(sim.shift > shift + 2, `fly right ${sim.shift}`);
  });

  it("second jump works in robo and jet and still scales with the hold", () => {
    const layout = layoutFrom(800, 500);
    const rise = (holdFrames: number, gear: "robo" | "jet" | "shell" | "skates") => {
      const sim = createSim(layout, { seed: 3, best: 0 });
      sim.phase = "run";
      sim.gear = gear;
      sim.airJumps = 1;
      sim.grounded = false;
      sim.coyote = 0;
      sim.y = layout.groundY - 30;
      sim.vy = 80;
      const start = sim.y;
      let minY = sim.y;
      for (let i = 0; i < 50; i++) {
        tick(sim, 1 / 60, i < holdFrames);
        if (sim.y < minY) minY = sim.y;
      }
      return start - minY;
    };
    const tap = rise(2, "robo");
    const full = rise(Math.ceil(JUMP_HOLD * 60) + 2, "robo");
    const jet = rise(Math.ceil(JUMP_HOLD * 60) + 2, "jet");
    assert.ok(full > tap * 1.4, `full ${full} tap ${tap}`);
    assert.ok(jet > tap * 1.4, `jet air jump rose ${jet}`);
    assert.ok(rise(8, "shell") < 8, "shell should not double jump");
    assert.ok(rise(8, "skates") < 8, "skates should not double jump");
  });

  it("jet stage can jump three times and robo still stops at two", () => {
    const layout = layoutFrom(800, 500);
    const hops = (gear: "jet" | "robo") => {
      const sim = createSim(layout, { seed: 1, best: 0 });
      sim.phase = "run";
      const spot = layout.playerH * METER_K * ((gear === "jet" ? JET_M : ROBO_M) + 2);
      extendCourse(sim, spot + layout.w * 2);
      sim.gear = gear;
      sim.grounded = true;
      sim.y = layout.groundY;
      sim.vy = 0;
      sim.phase = "run";
      eachChunk(sim, (c) => {
        if (c.air2H <= 0) c.airW = 0;
      });
      let stand = spot;
      let bestW = 0;
      eachChunk(sim, (c) => {
        if (c.x + c.w < spot || c.gap || c.barrierH > 0 || c.platW > 0 || c.plat2W > 0 || c.w <= bestW) return;
        bestW = c.w;
        stand = c.x + Math.min(layout.playerW * 0.4, c.w * 0.2);
      });
      sim.worldX = stand;
      const rises: number[] = [];
      for (let jump = 0; jump < 4; jump++) {
        for (let i = 0; i < 12; i++) tick(sim, 1 / 60, false);
        const before = sim.y;
        tick(sim, 1 / 60, true);
        for (let i = 0; i < 6; i++) tick(sim, 1 / 60, true);
        rises.push(before - sim.y);
        for (let i = 0; i < 4; i++) tick(sim, 1 / 60, false);
      }
      return rises;
    };
    const jet = hops("jet");
    assert.ok(jet[0]! > 8 && jet[1]! > 8 && jet[2]! > 8, `jet rises ${jet.join(",")}`);
    assert.ok(jet[3]! < 8, `jet fourth rise ${jet[3]}`);
    const robo = hops("robo");
    assert.ok(robo[0]! > 8 && robo[1]! > 8, `robo rises ${robo.join(",")}`);
    assert.ok(robo[2]! < 8, `robo third rise ${robo[2]}`);
  });

  it("stages 3 and 4 grow platforms and floaters, stage 5 opens a gate", () => {
    const layout = layoutFrom(900, 640);
    const sim = createSim(layout, { seed: 9, best: 0 });
    sim.phase = "run";
    const seen = new Set<number>();
    let roboPlat = 0;
    let roboAir = 0;
    let jetPlat = 0;
    let jetAir = 0;
    let jetN = 0;
    let roboN = 0;
    let shellHaz = 0;
    let shellPlat = 0;
    let shellDeck = 0;
    let skatesPlat = 0;
    let skatesAir = 0;
    let skatesN = 0;
    let shellAir = 0;
    let shellLow = 0;
    let shellHigh = 0;
    let moving = 0;
    let stillLate = 0;
    let crowLow = 0;
    let crowHigh = 0;
    let lettuces = 0;
    const jetX = layout.playerH * METER_K * JET_M;
    let firstJetX = Infinity;
    let firstJetW = 0;
    let firstJetBad = false;
    const dt = 1 / 60;
    for (let i = 0; i < 70 * 60 && sim.gear !== "bluejet"; i++) {
      sim.phase = "run";
      sim.y = layout.playerH * 0.5;
      sim.vy = 0;
      sim.grounded = false;
      sim.lifting = false;
      tick(sim, dt, false);
      eachChunk(sim, (c) => {
        if (seen.has(c.x)) return;
        seen.add(c.x);
        const meters = Math.max(0, c.x) / (layout.playerH * METER_K);
        if (c.letN > 0) lettuces++;
        if (c.x >= jetX - 0.5 && c.x < firstJetX) {
          firstJetX = c.x;
          firstJetW = c.w;
          firstJetBad = c.gap || c.barrierH > 0 || c.airW > 0 || c.air2W > 0;
        }
        if (meters < SKATES_M) {
          if (c.gap || c.barrierH > 0) shellHaz++;
          if (c.platW > 0) shellPlat++;
          if (c.plat2W > 0) shellDeck++;
          if (c.airW > 0 && c.air2W <= 0) {
            shellAir++;
            const center = (c.airDrop + c.airH / 2) / layout.playerH;
            if (center < 0.85) shellLow++;
            else shellHigh++;
          }
        } else if (meters < ROBO_M) {
          skatesN++;
          if (c.platW > 0) skatesPlat++;
          if (c.airW > 0 && c.air2W <= 0) skatesAir++;
        } else if (meters >= ROBO_M && meters < JET_M) {
          roboN++;
          if (c.platW > 0) roboPlat++;
          if (c.airW > 0 && c.air2W <= 0) roboAir++;
        } else if (meters >= JET_M && meters < BLUE_M) {
          jetN++;
          if (c.platW > 0) jetPlat++;
          if (c.airW > 0) jetAir++;
        }
        if (meters >= ROBO_M && meters < BLUE_M && c.airW > 0 && c.air2W <= 0) {
          if (c.airBob > 0) moving++;
          else stillLate++;
        }
        if (meters >= SKATES_M && meters < BLUE_M && c.airW > 0 && c.air2W <= 0) {
          const box = crowHitBox(layout, c.x + c.airOff, c.airDrop, c.airW, c.airH);
          const head = layout.groundY - layout.playerH * 0.6;
          const knees = layout.groundY - layout.playerH * 0.1;
          if (knees > box.top && head < box.bottom) crowLow++;
          else crowHigh++;
        }
      });
    }
    assert.equal(sim.gear, "bluejet");
    assert.ok(shellHaz >= 5, `shell hazards ${shellHaz}`);
    assert.ok(shellPlat >= 2, `stage 1 platforms ${shellPlat}`);
    assert.ok(shellAir >= 2 && shellAir <= 3, `stage 1 crows ${shellAir}`);
    assert.ok(shellLow > 0 && shellHigh > 0, `stage 1 heights low ${shellLow} high ${shellHigh}`);
    assert.equal(shellDeck, 0, "stage 1 stays a single deck");
    assert.ok(skatesN > 4, `skates chunks ${skatesN}`);
    assert.ok(skatesPlat > 0, "stage 2 platforms");
    assert.ok(skatesAir > 0, "stage 2 floaters");
    assert.ok(roboN > 4, `robo chunks ${roboN}`);
    assert.ok(roboPlat > 0, "stage 3 platforms");
    assert.ok(roboAir > 0, "stage 3 floaters");
    assert.ok(jetN > 4, `jet chunks ${jetN}`);
    assert.ok(jetPlat > 0, "stage 4 platforms");
    assert.ok(jetAir > 0, "stage 4 floaters");
    assert.ok(crowLow > 0 && crowHigh > 0, `crow heights low ${crowLow} high ${crowHigh}`);
    assert.ok(moving > 0 && stillLate > 0, `moving crows ${moving} still ${stillLate}`);
    assert.ok(lettuces > 3, `lettuce rows ${lettuces}`);
    assert.ok(firstJetW >= layout.w * 0.9, `jet clear width ${firstJetW}`);
    assert.equal(firstJetBad, false, "stage 4 should open on a clear stretch");

    const gateSeen = new Set<number>();
    let gates = 0;
    let plats = 0;
    for (let i = 0; i < 160; i++) {
      sim.phase = "run";
      sim.grace = 1;
      sim.y = layout.groundY - layout.playerH * 1.2;
      tick(sim, dt, { held: false, flyX: 0, flyY: 0 });
      eachChunk(sim, (c) => {
        if (c.platW > layout.playerW && !gateSeen.has(c.x + 0.1)) {
          gateSeen.add(c.x + 0.1);
          plats++;
        }
        if (gateSeen.has(c.x) || c.airH <= 0 || c.air2H <= 0) return;
        const ceilBottom = layout.groundY - c.airDrop;
        const floorTop = layout.groundY - c.air2Drop - c.air2H;
        const opening = floorTop - ceilBottom;
        if (opening < layout.playerH * 0.9) return;
        gateSeen.add(c.x);
        gates++;
      });
    }
    assert.ok(gates >= 2, `stage 5 gates ${gates}`);
    assert.ok(plats >= 1, `stage 5 platform ${plats}`);
  });

  it("can perch on a platform while flying", () => {
    const layout = layoutFrom(800, 500);
    const sim = createSim(layout, { seed: 1, best: 0 });
    sim.phase = "run";
    sim.gear = "bluejet";
    sim.grace = 2;
    sim.grounded = false;
    sim.worldX = layout.playerH * METER_K * BLUE_M;
    const chunk = sim.slots[0]!;
    chunk.x = sim.worldX - 40;
    chunk.w = 420;
    chunk.gap = false;
    chunk.barrierH = 0;
    chunk.airW = 0;
    chunk.airH = 0;
    chunk.air2W = 0;
    chunk.air2H = 0;
    chunk.platOff = 0;
    chunk.platW = 320;
    chunk.platDrop = layout.playerH * 0.9;
    sim.head = 0;
    sim.count = 1;
    sim.cursor = chunk.x + chunk.w;
    const top = layout.groundY - chunk.platDrop;
    sim.y = top - 14;
    for (let i = 0; i < 4; i++) tick(sim, 1 / 60, { held: false, flyX: 0, flyY: 1 });
    assert.ok(Math.abs(sim.y - top) < 2, `perch ${sim.y} top ${top}`);
    tick(sim, 1 / 60, { held: false, flyX: 0, flyY: 1 });
    assert.ok(Math.abs(sim.y - top) < 2, "stays on the platform while holding down");
    const y = sim.y;
    tick(sim, 1 / 60, { held: false, flyX: 0, flyY: -1 });
    assert.ok(sim.y < y - 2, "steering up leaves the platform");
  });

  it("scores a run from time, distance, and lettuces", () => {
    assert.equal(runScore(0, 0, 0), 0);
    assert.equal(runScore(50, 10, 3), 50 * 10 + 10 * 20 + 3 * 100);
    assert.ok(runScore(40, 8, 0) > runScore(20, 8, 0));
    assert.ok(runScore(20, 12, 0) > runScore(20, 4, 0));
    assert.ok(runScore(20, 4, 2) > runScore(20, 4, 0));
    const layout = layoutFrom(800, 500);
    const sim = createSim(layout, { seed: 5, best: 0 });
    sim.phase = "run";
    sim.lettuces = 4;
    run(sim, 8, () => false);
    assert.equal(sim.phase, "dead");
    assert.equal(sim.points, runScore(sim.score, sim.runT, sim.lettuces));
    assert.equal(sim.best, sim.points);
    assert.ok(sim.points > runScore(sim.score, sim.runT, 0));
  });

  it("collects a lettuce the shell runs through", () => {
    const layout = layoutFrom(800, 500);
    const sim = createSim(layout, { seed: 1, best: 0 });
    sim.phase = "run";
    eachChunk(sim, (c) => {
      c.letN = 0;
    });
    const chunk = sim.slots[sim.head]!;
    chunk.letN = 1;
    chunk.letOff = sim.worldX - chunk.x + 4;
    chunk.letGap = layout.playerW;
    chunk.letDrop = layout.playerH * 0.4;
    chunk.letStagger = 0;
    chunk.letGot = 0;
    tick(sim, 1 / 60, false);
    assert.equal(sim.lettuces, 1);
    assert.equal(chunk.letGot, 1);
    tick(sim, 1 / 60, false);
    assert.equal(sim.lettuces, 1);
  });

  it("puts the same lettuce count in every stage and repeats the course", () => {
    const layout = layoutFrom(1280, 800);
    const endM = BLUE_M + (BLUE_M - JET_M) + 5;
    const tally = (seed: number) => {
      const sim = createSim(layout, { seed, best: 0 });
      sim.phase = "run";
      const seen = new Map<number, number>();
      const dt = 1 / 60;
      for (let i = 0; i < 180 * 60 && metersOf(sim) < endM; i++) {
        sim.phase = "run";
        sim.grace = 1;
        sim.y = layout.playerH * 0.4;
        sim.vy = 0;
        sim.grounded = false;
        sim.lifting = false;
        tick(sim, dt, false);
        eachChunk(sim, (c) => {
          for (let k = 0; k < c.letN; k++) {
            const x = Math.round(c.x + c.letOff + k * c.letGap);
            if (seen.has(x)) continue;
            const m = Math.max(0, x) / (layout.playerH * METER_K);
            const stage = m >= BLUE_M ? 4 : m >= JET_M ? 3 : m >= ROBO_M ? 2 : m >= SKATES_M ? 1 : 0;
            seen.set(x, (stage << 1) | ((c.letLow & (1 << k)) !== 0 ? 1 : 0));
          }
        });
      }
      const totals = [0, 0, 0, 0, 0];
      const ground = [0, 0, 0, 0, 0];
      for (const packed of seen.values()) {
        const stage = packed >> 1;
        totals[stage]!++;
        if (packed & 1) ground[stage]!++;
      }
      return { totals, ground };
    };
    const plan = tally(LAYOUT_SEED);
    assert.deepEqual(plan.totals, Array(5).fill(LETTUCE_PER_STAGE), `lettuce per stage ${plan.totals.join(",")}`);
    for (let s = 0; s < 5; s++) {
      assert.ok(plan.ground[s]! > 0 && plan.ground[s]! < LETTUCE_PER_STAGE, `stage ${s} ground ${plan.ground[s]}`);
    }
    assert.deepEqual(tally(4).totals, Array(5).fill(LETTUCE_PER_STAGE), "a re-roll still has 10 per stage");

    const course = (seed: number) => {
      const sim = createSim(layout, { seed, best: 0 });
      sim.phase = "run";
      const bits: string[] = [];
      for (let i = 0; i < 8 * 60; i++) tick(sim, 1 / 60, false);
      eachChunk(sim, (c) => {
        bits.push([c.x, c.w, c.gap ? 1 : 0, Math.round(c.barrierH), c.letN, Math.round(c.letOff)].join(":"));
      });
      return bits.join("|");
    };
    assert.equal(course(LAYOUT_SEED), course(LAYOUT_SEED));
    assert.notEqual(course(4), course(LAYOUT_SEED));
    const again = resetToRun(createSim(layout, { seed: 99, best: 0 }));
    assert.equal(course(LAYOUT_SEED), courseFrom(again));
    const rolled = resetToRun(createSim(layout, { seed: 99, best: 0 }), 4);
    assert.equal(course(4), courseFrom(rolled));

    function courseFrom(sim: Sim): string {
      const bits: string[] = [];
      for (let i = 0; i < 8 * 60; i++) tick(sim, 1 / 60, false);
      eachChunk(sim, (c) => {
        bits.push([c.x, c.w, c.gap ? 1 : 0, Math.round(c.barrierH), c.letN, Math.round(c.letOff)].join(":"));
      });
      return bits.join("|");
    }
  });

  it("re-roll changes lettuce positions and crow placement", () => {
    const layout = layoutFrom(900, 640);
    const marks = (seed: number) => createSim(layout, { seed, best: 0 }).letMarks.map((m) => Math.round(m));
    const base = marks(LAYOUT_SEED);
    const rolledA = marks(4);
    const rolledB = marks(99);
    const rolledC = marks(123456789);
    assert.notDeepEqual(rolledA, base);
    assert.notDeepEqual(rolledA, rolledB);
    assert.notDeepEqual(rolledB, rolledC);
    const crows = (seed: number) => {
      const sim = createSim(layout, { seed, best: 0 });
      extendCourse(sim, layout.playerH * METER_K * (ROBO_M + 30));
      const drops: string[] = [];
      eachChunk(sim, (c) => {
        if (c.airH > 0 && c.air2H <= 0) drops.push(`${Math.round(c.x + c.airOff)}:${Math.round(c.airDrop)}`);
      });
      return drops;
    };
    const crowsA = crows(4);
    const crowsB = crows(99);
    assert.ok(crowsA.length >= 1 && crowsB.length >= 1, `crows ${crowsA.length}, ${crowsB.length}`);
    assert.notDeepEqual(crowsA, crowsB);

    const terrain = (seed: number) => {
      const sim = createSim(layout, { seed, best: 0 });
      extendCourse(sim, layout.playerH * METER_K * (SKATES_M + 20));
      const bits: string[] = [];
      eachChunk(sim, (c) => {
        const kind = c.gap ? "H" : c.barrierH > 0 ? "B" : ".";
        const plat = c.platW > 0 ? "p" + Math.round(c.platDrop) : "";
        bits.push(kind + Math.round(c.x) + plat);
      });
      return bits.join("|");
    };
    const layoutA = terrain(4);
    const layoutB = terrain(99);
    const layoutC = terrain(123456789);
    assert.notEqual(layoutA, terrain(LAYOUT_SEED));
    assert.notEqual(layoutA, layoutB);
    assert.notEqual(layoutB, layoutC);
    assert.equal(terrain(LAYOUT_SEED), terrain(LAYOUT_SEED));
  });

  it("gives every crow the smallest floater hitbox", () => {
    const layout = layoutFrom(900, 600);
    const wide = crowHitBox(layout, 0, layout.playerH, layout.playerH, layout.playerH * 0.46);
    const narrow = crowHitBox(layout, 40, layout.playerH * 0.9, layout.playerH * 0.34, layout.playerH * 0.18);
    const width = (b: { left: number; right: number }) => b.right - b.left;
    const height = (b: { top: number; bottom: number }) => b.bottom - b.top;
    assert.ok(Math.abs(width(wide) - width(narrow)) < 0.01);
    assert.ok(Math.abs(height(wide) - height(narrow)) < 0.01);
    assert.ok(Math.abs(width(wide) - layout.playerH * (0.34 - 0.08)) < 0.01);
    assert.ok(Math.abs(height(wide) - layout.playerH * (0.18 - 0.08)) < 0.01);
  });
});
