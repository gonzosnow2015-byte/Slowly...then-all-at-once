import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { createFx, draw, pumpFx, type View } from "@/game/draw";
import { createSfx } from "@/game/sfx";
import {
  beginRun,
  createSim,
  applyTestStart,
  GEAR_LABEL,
  JUMP_HOLD,
  LAYOUT_SEED,
  layoutFrom,
  jumpNow,
  maxAirJumps,
  resetToRun,
  tick,
  type Cause,
  type Control,
  type Gear,
  type Phase,
  type Sim,
} from "@/game/sim";

const BEST_KEY = "monchel-best";
const MUTE_KEY = "monchel-muted";

function readBest(): number {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  } catch {
    return 0;
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function causeLine(cause: Cause): string {
  if (cause === "gap") return "Missed the ground";
  if (cause === "air") return "A crow got you";
  if (cause === "barrier") return "Hit a barrier";
  return "Wiped out";
}

/** Player-facing score. The sim still stores the raw total. */
function showScore(points: number): string {
  return (points / 100).toFixed(2);
}

const HINT: Record<Gear, string> = {
  shell: "Tap to hop, hold to jump higher",
  skates: "Tap to hop, hold to jump higher",
  robo: "Jump again in the air",
  jet: "Jump again in the air. Duck the floaters",
  bluejet: "Hold, then slide up or down",
};

export function MonchelRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const bestRef = useRef<HTMLSpanElement>(null);
  const letRef = useRef<HTMLSpanElement>(null);
  const gearRef = useRef<HTMLParagraphElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const jumpRef = useRef<() => void>(() => {});
  const dismissTitleRef = useRef<() => void>(() => {});
  const rerollRef = useRef<() => void>(() => {});
  const seedRef = useRef(LAYOUT_SEED);
  const rootRef = useRef<HTMLDivElement>(null);
  const mutedRef = useRef(false);
  const audioRef = useRef<{ setMuted: (v: boolean) => void } | null>(null);

  const [phase, setPhase] = useState<Phase>("title");
  const [finalScore, setFinalScore] = useState(0);
  const [finalMeters, setFinalMeters] = useState(0);
  const [finalLets, setFinalLets] = useState(0);
  const [finalSecs, setFinalSecs] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [cause, setCause] = useState<Cause>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const audio = createSfx();
    audioRef.current = audio;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fx = createFx(reduced);
    const view: View = { cssW: 360, cssH: 640, dpr: 1 };
    let lastGear: Gear = "shell";
    const bootSim = (next: Sim) => {
      applyTestStart(next);
      lastGear = next.gear;
      return next;
    };
    let sim: Sim = bootSim(createSim(layoutFrom(360, 640), { seed: LAYOUT_SEED, best: readBest() }));
    const jumpKeys = new Set<string>();
    const steerKeys = new Set<string>();
    const pointers = new Set<number>();
    const drags = new Map<number, { x: number; y: number; cx: number; cy: number; kind: string }>();
    const touches = new Map<number, { x: number; y: number; cx: number; cy: number }>();
    let mouseDown = false;
    let presses = 0;
    let lastArmAt = 0;
    let startPulse = false;
    let flightGrab: { id: number; py: number; y: number } | null = null;
    let spaceDown = false;
    let spaceSeenAt = 0;
    const seenKeys = new WeakSet<Event>();
    let jumpHeld = false;
    let jumpCooldown = 0;
    let lastSource: "touch" | "space" | "mouse" | "key" | "none" = "none";
    let sawPointerJump = false;
    let titleTap = false;
    let scriptHold = 0;
    let suppress = false;
    let phaseMirror: Phase = "title";
    let raf = 0;
    let last = performance.now();
    let padWas = false;
    let alive = true;
    mutedRef.current = readMuted();
    audio.setMuted(mutedRef.current);
    setMuted(mutedRef.current);
    setBestScore(sim.best);

    const unlock = () => {
      try {
        audio.unlock();
      } catch {
        /* audio must never eat the jump */
      }
    };
    const focusGame = () => {
      rootRef.current?.focus({ preventScroll: true });
    };
    const clearJumpLocks = (refill: boolean) => {
      jumpHeld = false;
      sim.jumpWasDown = false;
      suppress = false;
      jumpCooldown = 0;
      lastArmAt = 0;
      spaceDown = false;
      mouseDown = false;
      jumpKeys.delete("Space");
      jumpKeys.delete("ArrowUp");
      jumpKeys.delete("KeyW");
      for (const [id, drag] of drags) {
        if (drag.kind !== "mouse") continue;
        drags.delete(id);
        pointers.delete(id);
      }
      if (refill) sim.airJumps = maxAirJumps(sim.gear);
    };
    const releaseJump = () => {
      const still =
        touches.size > 0 || spaceDown || mouseDown || jumpKeys.has("Space") || jumpKeys.has("ArrowUp") || jumpKeys.has("KeyW");
      jumpHeld = still;
      sim.jumpWasDown = still;
      suppress = false;
      jumpCooldown = 0;
      lastArmAt = 0;
      if (!still && sim.grounded) sim.airJumps = maxAirJumps(sim.gear);
    };
    const tryJump = (isNewPress: boolean): boolean => {
      if (!isNewPress) return false;
      const now = performance.now();
      if (jumpCooldown > 0 || now - lastArmAt < 28) return false;
      lastArmAt = now;
      jumpCooldown = 0;
      unlock();
      if (lastSource === "touch") focusGame();
      if (sim.phase === "title") return false;
      if (sim.gear === "bluejet" && sim.phase === "run") return false;
      if (sim.phase === "run") suppress = false;
      sim.jumpWasDown = false;
      const nearGround =
        sim.grounded ||
        sim.coyote > 0 ||
        (sim.vy >= 0 && Math.abs(sim.y - sim.layout.groundY) <= Math.max(10, sim.layout.playerH * 0.08));
      if (sim.phase !== "run" || nearGround) {
        if (nearGround && sim.phase === "run") {
          sim.grounded = true;
          sim.airJumps = maxAirJumps(sim.gear);
        }
        presses += 1;
        jumpHeld = true;
        return true;
      }
      if (sim.airJumps > 0 && maxAirJumps(sim.gear) > 0) {
        presses += 1;
        jumpHeld = true;
        return true;
      }
      return false;
    };
    const desktopPress = (source: "space" | "mouse" | "key") => {
      lastSource = source;
      jumpHeld = true;
      suppress = false;
      unlock();
      if (sim.phase !== "run") {
        presses += 1;
        return;
      }
      const kind = jumpNow(sim);
      if (kind === "blocked") return;
      if (sim.gear === "jet") audio.jetJump();
      else audio.jump();
    };
    const notePress = () => {
      lastSource = "key";
      tryJump(true);
    };
    jumpRef.current = () => {
      unlock();
      startPulse = true;
    };
    dismissTitleRef.current = () => {
      if (sim.phase === "title") titleTap = true;
    };
    const usedSeeds = new Set<number>([LAYOUT_SEED]);
    let rollN = 0;
    const freshSeed = () => {
      const buf = new Uint32Array(1);
      rollN += 1;
      if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(buf);
      else buf[0] = (Math.random() * 0x100000000) >>> 0;
      let n = (buf[0]! ^ Math.imul(rollN, 0x9e3779b1)) >>> 0;
      while (n === 0 || usedSeeds.has(n)) n = (n + 1) >>> 0 || 1;
      usedSeeds.add(n);
      return n;
    };
    rerollRef.current = () => {
      unlock();
      const next = freshSeed();
      seedRef.current = next;
      audio.go();
      sim = bootSim(resetToRun(sim, next));
      if (hintRef.current) {
        hintRef.current.hidden = false;
        hintRef.current.textContent = HINT[sim.gear];
      }
      suppress = true;
      focusGame();
    };

    const jumpCode = (code: string) => code === "ArrowUp" || code === "KeyW";
    const isSpace = (e: KeyboardEvent) => e.code === "Space" || e.key === " ";
    const steerCode = (code: string) =>
      code === "Space" ||
      jumpCode(code) ||
      code === "ArrowDown" ||
      code === "ArrowLeft" ||
      code === "ArrowRight" ||
      code === "KeyA" ||
      code === "KeyS" ||
      code === "KeyD";
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isSpace(e) && !steerCode(e.code)) return;
      if (seenKeys.has(e)) return;
      seenKeys.add(e);
      if (isSpace(e)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        spaceDown = true;
        spaceSeenAt = performance.now();
        if (sim.phase === "title") {
          if (e.isTrusted) titleTap = true;
          return;
        }
        jumpKeys.add("Space");
        desktopPress("space");
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      if (sim.phase === "title") {
        if (e.isTrusted && jumpCode(e.code)) titleTap = true;
        return;
      }
      steerKeys.add(e.code);
      if (jumpCode(e.code)) {
        jumpKeys.add(e.code);
        desktopPress("key");
      }
      unlock();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!isSpace(e) && !steerCode(e.code)) return;
      if (seenKeys.has(e)) return;
      seenKeys.add(e);
      e.preventDefault();
      if (isSpace(e)) {
        spaceDown = false;
        jumpKeys.delete("Space");
        releaseJump();
        return;
      }
      steerKeys.delete(e.code);
      jumpKeys.delete(e.code);
      if (jumpCode(e.code)) releaseJump();
    };
    const clearHeld = () => {
      jumpKeys.clear();
      steerKeys.clear();
      pointers.clear();
      drags.clear();
      touches.clear();
      mouseDown = false;
      presses = 0;
      spaceDown = false;
      jumpHeld = false;
      jumpCooldown = 0;
      flightGrab = null;
    };
    const isUi = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest("[data-ui]");
    const noteTitle = (trusted: boolean) => {
      if (trusted && sim.phase === "title") titleTap = true;
    };
    const onTouchStart = (e: TouchEvent) => {
      if (isUi(e.target)) return;
      noteTitle(e.isTrusted);
      if (e.cancelable) e.preventDefault();
      const live = new Set<number>();
      for (const t of Array.from(e.touches)) live.add(t.identifier);
      for (const id of touches.keys()) if (!live.has(id)) touches.delete(id);
      for (const t of Array.from(e.changedTouches)) {
        touches.set(t.identifier, { x: t.clientX, y: t.clientY, cx: t.clientX, cy: t.clientY });
      }
      lastSource = "touch";
      tryJump(true);
    };
    const onTouchMove = (e: TouchEvent) => {
      let tracked = false;
      for (const t of Array.from(e.changedTouches)) {
        const drag = touches.get(t.identifier);
        if (!drag) continue;
        tracked = true;
        drag.cx = t.clientX;
        drag.cy = t.clientY;
      }
      if (tracked && e.cancelable) e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) touches.delete(t.identifier);
    };
    const releaseMouse = () => {
      mouseDown = false;
      for (const [id, drag] of drags) {
        if (drag.kind !== "mouse") continue;
        drags.delete(id);
        pointers.delete(id);
      }
      sawPointerJump = false;
      releaseJump();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (isUi(e.target)) return;
      if (e.button !== 0) return;
      noteTitle(e.isTrusted);
      if (e.cancelable) e.preventDefault();
      mouseDown = true;
      if (sawPointerJump) {
        sawPointerJump = false;
        return;
      }
      desktopPress("mouse");
    };
    const onPointerDown = (e: PointerEvent) => {
      if (isUi(e.target)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      noteTitle(e.isTrusted);
      if (e.cancelable) e.preventDefault();
      const seenTouch = e.pointerType === "touch" && touches.has(e.pointerId);
      pointers.add(e.pointerId);
      drags.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        cx: e.clientX,
        cy: e.clientY,
        kind: e.pointerType,
      });
      if (e.pointerType === "mouse") mouseDown = true;
      const cap = e.target instanceof Element ? e.target : canvas;
      try {
        cap.setPointerCapture(e.pointerId);
      } catch {
        /* capture is optional */
      }
      // touchstart already counted this contact when the ids match.
      if (e.pointerType === "mouse") {
        sawPointerJump = true;
        desktopPress("mouse");
      } else if (!seenTouch) {
        lastSource = "touch";
        tryJump(true);
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      const drag = drags.get(e.pointerId);
      if (!drag) return;
      drag.cx = e.clientX;
      drag.cy = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      drags.delete(e.pointerId);
      touches.delete(e.pointerId);
      if (e.pointerType === "mouse") {
        mouseDown = false;
        sawPointerJump = false;
        releaseJump();
      }
      if (pointers.size === 0 && touches.size > 0 && e.pointerType !== "mouse") touches.clear();
    };
    const onContextMenu = (e: Event) => {
      if (!isUi(e.target)) e.preventDefault();
    };

    const listen = { capture: true, passive: false } as const;
    const keyListen = true;
    window.addEventListener("keydown", onKeyDown, keyListen);
    window.addEventListener("keyup", onKeyUp, keyListen);
    document.addEventListener("keydown", onKeyDown, keyListen);
    document.addEventListener("keyup", onKeyUp, keyListen);
    rootRef.current?.addEventListener("keydown", onKeyDown, keyListen);
    rootRef.current?.addEventListener("keyup", onKeyUp, keyListen);
    window.addEventListener("touchstart", onTouchStart, listen);
    window.addEventListener("touchmove", onTouchMove, listen);
    window.addEventListener("touchend", onTouchEnd, listen);
    window.addEventListener("touchcancel", onTouchEnd, listen);
    window.addEventListener("mousedown", onMouseDown, listen);
    window.addEventListener("mouseup", releaseMouse, listen);
    window.addEventListener("pointerdown", onPointerDown, listen);
    window.addEventListener("pointermove", onPointerMove, listen);
    window.addEventListener("pointerup", onPointerUp, listen);
    window.addEventListener("pointercancel", onPointerUp, listen);
    window.addEventListener("contextmenu", onContextMenu, listen);
    window.addEventListener("blur", clearHeld);
    const prevTouch = document.body.style.touchAction;
    const prevHtmlTouch = document.documentElement.style.touchAction;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.touchAction = "none";
    document.documentElement.style.touchAction = "none";
    document.body.style.overscrollBehavior = "none";
    focusGame();

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const cssW = Math.max(1, Math.round(canvas.clientWidth || rect.width));
      const cssH = Math.max(1, Math.round(canvas.clientHeight || rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.max(1, Math.round(cssW * dpr));
      const bh = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      view.cssW = cssW;
      view.cssH = cssH;
      view.dpr = dpr;
      if (sim.phase === "title" && cssW >= 280 && cssH >= 280) {
        const next = layoutFrom(cssW, cssH);
        if (Math.abs(next.w - sim.layout.w) > 2 || Math.abs(next.h - sim.layout.h) > 2) {
          sim = bootSim(createSim(next, { seed: seedRef.current, best: sim.best }));
        }
      }
    };

    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    fit();

    window.__monchel = {
      get phase() {
        return sim.phase;
      },
      get score() {
        return sim.score;
      },
      get speed() {
        return sim.speed;
      },
      get grounded() {
        return sim.grounded;
      },
      get gear() {
        return sim.gear;
      },
      get y() {
        return sim.y;
      },
      get cause() {
        return sim.cause;
      },
      jump() {
        if (sim.phase === "title" || sim.phase === "ready") return;
        if (sim.phase !== "run") startPulse = true;
        else scriptHold = Math.max(scriptHold, JUMP_HOLD + 0.04);
      },
    };

    const frame = (now: number) => {
      if (!alive) return;
      if (document.hidden) {
        clearHeld();
        last = now;
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (scriptHold > 0) scriptHold = Math.max(0, scriptHold - dt);
      const pads = navigator.getGamepads?.();
      let pad = false;
      if (pads) {
        for (const gp of pads) {
          if (!gp) continue;
          if (gp.buttons[0]?.pressed || gp.buttons[12]?.pressed) pad = true;
        }
      }
      if (pad && !padWas) notePress();
      padWas = pad;
      let flyX = 0;
      let flyY = 0;
      const down = (code: string) => steerKeys.has(code);
      const flying = sim.phase === "run" && sim.gear === "bluejet";
      if (flying) {
        let py: number | null = null;
        let id = 0;
        if (touches.size > 0) {
          for (const [tid, t] of touches) {
            py = t.cy;
            id = tid + 1;
          }
        } else if (mouseDown || pointers.size > 0) {
          for (const [pid, d] of drags) {
            py = d.cy;
            id = pid + 1;
          }
        }
        if (py != null) {
          if (!flightGrab || flightGrab.id !== id) flightGrab = { id, py, y: sim.y };
          const target = flightGrab.y + (py - flightGrab.py);
          const fly = sim.layout.playerH * 6.6;
          const steps = Math.max(1, Math.min(5, Math.round(dt / (1 / 60))));
          const gain = fly * steps * (1 / 60);
          flyY = Math.max(-16, Math.min(16, (target - sim.y) / gain));
        } else {
          flightGrab = null;
          if (down("ArrowUp") || down("KeyW")) flyY -= 1;
          if (down("ArrowDown") || down("KeyS")) flyY += 1;
        }
      } else {
        flightGrab = null;
        if (down("ArrowLeft") || down("KeyA")) flyX -= 1;
        if (down("ArrowRight") || down("KeyD")) flyX += 1;
        if (down("ArrowUp") || down("KeyW") || down("Space")) flyY -= 1;
        if (down("ArrowDown") || down("KeyS")) flyY += 1;
        for (const drag of drags.values()) {
          const dx = drag.cx - drag.x;
          const dy = drag.cy - drag.y;
          if (dx * dx + dy * dy < 18 * 18) continue;
          flyX += Math.max(-1, Math.min(1, dx / 78));
          flyY += Math.max(-1, Math.min(1, dy / 78));
        }
        for (const drag of touches.values()) {
          const dx = drag.cx - drag.x;
          const dy = drag.cy - drag.y;
          if (dx * dx + dy * dy < 18 * 18) continue;
          flyX += Math.max(-1, Math.min(1, dx / 78));
          flyY += Math.max(-1, Math.min(1, dy / 78));
        }
        if (pads) {
          for (const gp of pads) {
            if (!gp) continue;
            const ax = gp.axes[0] ?? 0;
            const ay = gp.axes[1] ?? 0;
            if (Math.abs(ax) > 0.2) flyX += ax;
            if (Math.abs(ay) > 0.2) flyY += ay;
          }
        }
        const stick = Math.hypot(flyX, flyY);
        if (stick > 1) {
          flyX /= stick;
          flyY /= stick;
        }
      }
      if (spaceDown && performance.now() - spaceSeenAt > 700) spaceDown = false;
      if (touches.size === 0 && lastSource === "touch" && jumpHeld) {
        jumpHeld = false;
        sim.jumpWasDown = false;
        jumpCooldown = 0;
        lastArmAt = 0;
        if (sim.grounded) sim.airJumps = maxAirJumps(sim.gear);
      }
      const legacyPhysical =
        spaceDown || jumpKeys.size > 0 || pointers.size > 0 || touches.size > 0 || mouseDown || pad || scriptHold > 0 || jumpHeld;
      const physical = legacyPhysical;
      const edge = presses > 0 || startPulse;
      if (presses > 0) presses -= 1;
      let started = false;
      if (sim.phase === "title") {
        if (titleTap) {
          audio.go();
          sim.phase = "ready";
          titleTap = false;
          suppress = true;
        }
        presses = 0;
        startPulse = false;
      } else if ((edge || physical) && !suppress && (sim.phase === "ready" || sim.phase === "dead")) {
        audio.go();
        if (sim.phase === "dead") {
          sim = bootSim(resetToRun(sim, seedRef.current));
          if (hintRef.current) {
            hintRef.current.hidden = false;
            hintRef.current.textContent = HINT[sim.gear];
          }
        } else {
          beginRun(sim);
        }
        suppress = true;
        started = true;
        presses = 0;
        startPulse = false;
      }
      if (suppress && edge && !started) suppress = false;
      if (suppress && !physical && presses === 0 && !startPulse) suppress = false;
      const heldForJump = jumpHeld || scriptHold > 0;
      startPulse = false;
      const control: Control = {
        held: !started && sim.phase === "run" && heldForJump,
        edge: edge && !started && sim.phase === "run",
        flyX,
        flyY,
      };

      const events = tick(sim, dt, control);
      pumpFx(fx, dt, sim, events);
      if (events.jump) {
        if (sim.gear === "jet") audio.jetJump();
        else audio.jump();
      }
      if (events.land && !events.jump) audio.land();
      if (events.land && sim.gear !== "bluejet") {
        sim.airJumps = maxAirJumps(sim.gear);
        jumpCooldown = 0;
        lastArmAt = 0;
        if (!events.jump && touches.size === 0) clearJumpLocks(true);
      }
      if (events.die) {
        audio.die();
        suppress = true;
      }
      if (events.collect) audio.collect();
      if (events.gear && events.gear !== "shell") audio.gear();

      if (sim.gear !== lastGear) {
        lastGear = sim.gear;
        if (hintRef.current && (sim.gear === "robo" || sim.gear === "jet" || sim.gear === "bluejet")) {
          hintRef.current.textContent = HINT[sim.gear];
          hintRef.current.hidden = false;
        }
      }
      if (
        sim.jumpedOnce &&
        sim.gear !== "robo" &&
        sim.gear !== "jet" &&
        sim.gear !== "bluejet" &&
        hintRef.current &&
        !hintRef.current.hidden
      ) {
        hintRef.current.hidden = true;
      }

      if (scoreRef.current) scoreRef.current.textContent = String(sim.score);
      if (letRef.current) letRef.current.textContent = String(sim.lettuces);
      if (bestRef.current) bestRef.current.textContent = showScore(Math.max(sim.best, sim.points));
      if (gearRef.current) gearRef.current.textContent = GEAR_LABEL[sim.gear];

      if (sim.phase !== phaseMirror) {
        phaseMirror = sim.phase;
        if (sim.phase === "dead") {
          setFinalScore(sim.points);
          setFinalMeters(sim.score);
          setFinalLets(sim.lettuces);
          setFinalSecs(sim.runT);
          setBestScore(sim.best);
          setNewBest(sim.newBest);
          setCause(sim.cause);
          try {
            localStorage.setItem(BEST_KEY, String(sim.best));
          } catch {
            /* ignore quota / private mode */
          }
        }
        setPhase(sim.phase);
      }

      draw(ctx, view, sim, fx);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
      rootRef.current?.removeEventListener("keydown", onKeyDown, true);
      rootRef.current?.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("touchstart", onTouchStart, listen);
      window.removeEventListener("touchmove", onTouchMove, listen);
      window.removeEventListener("touchend", onTouchEnd, listen);
      window.removeEventListener("touchcancel", onTouchEnd, listen);
      window.removeEventListener("mousedown", onMouseDown, listen);
      window.removeEventListener("mouseup", releaseMouse, listen);
      window.removeEventListener("pointerdown", onPointerDown, listen);
      window.removeEventListener("pointermove", onPointerMove, listen);
      window.removeEventListener("pointerup", onPointerUp, listen);
      window.removeEventListener("pointercancel", onPointerUp, listen);
      window.removeEventListener("contextmenu", onContextMenu, listen);
      window.removeEventListener("blur", clearHeld);
      document.body.style.touchAction = prevTouch;
      document.documentElement.style.touchAction = prevHtmlTouch;
      document.body.style.overscrollBehavior = prevOverscroll;
      audio.close();
      audioRef.current = null;
      delete window.__monchel;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      role="application"
      aria-label="Slowly....then all at once"
      className="relative h-dvh w-full touch-none overscroll-none overflow-hidden bg-bg text-fg select-none outline-none"
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full touch-none ${phase === "title" ? "invisible" : ""}`}
        aria-hidden="true"
      />

      {phase === "title" && (
        <div className="absolute inset-0 z-30 bg-bg">
          <img src="/title-street.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/40" />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center px-6 pt-16 text-center sm:pt-20">
            <div className="max-w-md">
              <h1 className="font-display text-4xl leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:text-6xl">
                Slowly....then all at once
              </h1>
              <p className="mt-3 text-lg leading-snug text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
                How far can you get?
              </p>
              <div className="pointer-events-auto mt-6">
                <button
                  type="button"
                  data-ui
                  className="min-h-12 min-w-36 rounded-full bg-accent px-8 py-3 text-lg font-semibold text-bg transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  onClick={() => dismissTitleRef.current()}
                >
                  Start
                </button>
              </div>
              {bestScore > 0 && <p className="mt-4 text-sm text-white/80">Best {showScore(bestScore)}</p>}
              <p className="mt-4 text-xs tracking-widest text-white/70 uppercase">@monchel_xyz</p>
            </div>
          </div>
        </div>
      )}

      {phase === "ready" && (
        <p className="pointer-events-none absolute inset-x-0 top-[22%] px-6 text-center font-display text-3xl text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] sm:text-5xl">
          Tap anywhere to begin
        </p>
      )}

      {phase === "dead" && (
        <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-bg/85 via-bg/35 to-transparent sm:bg-gradient-to-l" />
      )}

      {phase === "dead" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center">
          <div aria-live="polite" className="max-w-sm">
            <p className="text-xs font-medium tracking-widest text-accent uppercase">
              {newBest ? "New best" : "Wiped out"}
            </p>
            <p className="mt-2 font-display text-6xl leading-none tabular-nums sm:text-7xl">{showScore(finalScore)}</p>
            <p className="mt-2 text-sm tracking-widest text-muted uppercase">score</p>
            <div className="pointer-events-auto mt-5 flex w-full flex-col items-center gap-3">
              <button
                type="button"
                data-ui
                className="min-h-12 w-full max-w-xs rounded-full bg-accent px-8 py-3 text-lg font-semibold text-bg transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                onClick={() => jumpRef.current()}
              >
                Run again
              </button>
              <button
                type="button"
                data-ui
                className="min-h-12 w-full max-w-xs rounded-full border border-accent bg-surface px-8 py-3 text-lg font-semibold text-fg transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                onClick={() => rerollRef.current()}
              >
                Re-roll terrain
              </button>
            </div>
            <p className="mt-3 text-base text-fg">{causeLine(cause)}</p>
            <p className="mt-1 text-sm text-muted tabular-nums">
              {finalMeters} m · {finalSecs.toFixed(1)} s · 🥬 {finalLets}
            </p>
            <p className="mt-1 text-sm text-muted">Best {showScore(bestScore)}</p>
            <p className="mt-3 text-sm text-muted">Tap or hold space</p>
          </div>
        </div>
      )}

      {phase === "run" && (
        <>
          <div className="safe-pad ink-shadow pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between">
            <div>
              <p className="text-xs tracking-widest text-muted uppercase">Distance</p>
              <p className="font-display text-5xl leading-none tabular-nums">
                <span ref={scoreRef}>0</span>
                <span className="ml-1 text-lg text-muted">m</span>
              </p>
              <p className="mt-1 font-display text-2xl leading-none tabular-nums">
                <span ref={letRef}>0</span>
                <span className="ml-1 text-lg">🥬</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs tracking-widest text-muted uppercase">Best</p>
              <p className="font-display text-2xl leading-none tabular-nums">
                <span ref={bestRef}>0</span>
              </p>
              <p ref={gearRef} className="mt-2 text-sm font-medium text-primary">
                On foot
              </p>
            </div>
          </div>
          <p
            ref={hintRef}
            className="safe-bottom ink-shadow pointer-events-none absolute inset-x-0 z-20 px-16 text-center text-sm text-fg"
          >
            Tap to hop, hold to jump higher
          </p>
        </>
      )}

      <button
        type="button"
        data-ui
        aria-label={muted ? "Unmute" : "Mute"}
        aria-pressed={muted}
        className="safe-bottom absolute left-4 z-30 grid size-11 place-items-center rounded-full border border-border bg-surface text-fg focus-visible:ring-2 focus-visible:ring-fg"
        onClick={() => {
          const next = !mutedRef.current;
          mutedRef.current = next;
          audioRef.current?.setMuted(next);
          setMuted(next);
          try {
            localStorage.setItem(MUTE_KEY, next ? "1" : "0");
          } catch {
            /* ignore */
          }
        }}
      >
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>
    </div>
  );
}

declare global {
  interface Window {
    __monchel?: {
      readonly phase: Phase;
      readonly score: number;
      readonly speed: number;
      readonly grounded: boolean;
      readonly gear: Gear;
      readonly y: number;
      readonly cause: Cause;
      jump: () => void;
    };
  }
}
