import { useEffect, useRef, useState } from "react";
import { Music, SkipForward, Volume2, VolumeX } from "lucide-react";
import { createFx, draw, pumpFx, setActiveTrack, type View } from "@/game/draw";
import { createSfx, EFFECTS_PERCENT, MUSIC_PERCENT } from "@/game/sfx";
import { loadBoard, recordRun, saveBoard, stageOf, type Board } from "@/game/board";
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
  swipePopStrength,
  tick,
  type Cause,
  type Control,
  type Gear,
  type Phase,
  type Sim,
} from "@/game/sim";

const LOUI_FRAMES = [
  "/loui/1.png?v=1",
  "/loui/2.png?v=1",
  "/loui/3.png?v=1",
  "/loui/4.png?v=1",
  "/loui/5.png?v=1",
  "/loui/6.png?v=1",
  "/loui/7.png?v=1",
  "/loui/8.png?v=1",
  "/loui/9.png?v=1",
];

const MUTE_KEY = "monchel-muted";
const HUD_KEY = "monchel-hud";

type Hand = "left" | "right";

function readHand(): Hand {
  try {
    return localStorage.getItem(HUD_KEY) === "left" ? "left" : "right";
  } catch {
    return "right";
  }
}

function readBest(): number {
  return loadBoard().bestScore;
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function whenLabel(at: number): string {
  if (!at) return "";
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ScoreSheet({ board, onClose }: { board: Board; onClose: () => void }) {
  return (
    <div
      data-ui
      className="absolute inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        data-ui
        role="dialog"
        aria-label="Scores"
        className="max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-bg px-5 pt-5 pb-8 text-left shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-3xl leading-none">Scores</h2>
          <button
            type="button"
            data-ui
            className="min-h-11 rounded-full border border-border px-4 text-sm font-semibold"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface px-3 py-3">
            <p className="text-xs tracking-widest text-muted uppercase">Best score</p>
            <p className="mt-1 font-display text-4xl leading-none tabular-nums">{showScore(board.bestScore)}</p>
          </div>
          <div className="rounded-2xl bg-surface px-3 py-3">
            <p className="text-xs tracking-widest text-muted uppercase">Best distance</p>
            <p className="mt-1 font-display text-4xl leading-none tabular-nums">
              {board.bestMeters}
              <span className="ml-1 text-lg text-muted">m</span>
            </p>
          </div>
        </div>
        {bestFacts(board) && (
          <p className="mt-3 text-sm text-fg tabular-nums">Best run · {bestFacts(board)}</p>
        )}
        <p className="mt-5 text-xs tracking-widest text-muted uppercase">Recent runs</p>
        {board.runs.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No runs yet.</p>
        ) : (
          <ol className="mt-2 divide-y divide-border">
            {board.runs.map((run, i) => (
              <li key={`${run.at}-${i}`} className="py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-2xl leading-none tabular-nums">{showScore(run.score)}</span>
                  <span className="text-sm text-muted tabular-nums">{run.meters} m</span>
                </div>
                <p className="mt-1 text-sm text-fg tabular-nums">
                  {runFacts(run.meters, run.seconds, run.lettuces)}
                </p>
                <p className="mt-1 text-sm text-fg">
                  Stage {run.stage} · {GEAR_LABEL[run.gear]}
                </p>
                <p className="text-xs text-muted">{whenLabel(run.at)}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function causeLine(cause: Cause): string {
  if (cause === "gap") return "Missed the ground";
  if (cause === "air") return "A crow got you";
  if (cause === "seagull") return "A seagull got you";
  if (cause === "rock") return "You hit a rock";
  if (cause === "cone") return "You hit a cone";
  if (cause === "rat") return "A rat got you";
  if (cause === "coyote") return "A coyote got you";
  if (cause === "barrier") return "Hit a barrier";
  return "Wiped out";
}

/** Player-facing score. The sim still stores the raw total. */
function showScore(points: number): string {
  return (points / 100).toFixed(2);
}

function runFacts(meters: number, seconds: number, lettuces: number): string {
  return `${meters} m · ${seconds.toFixed(1)} s · 🥬 ${lettuces}`;
}

function bestFacts(board: Board): string {
  const meters = board.bestRunMeters || board.bestMeters;
  if (meters <= 0 && board.bestSeconds <= 0 && board.bestLettuces <= 0) return "";
  return runFacts(meters, board.bestSeconds, board.bestLettuces);
}

const TRACK_NAMES = ["Lush Lagoon", "Jazz the Dust Away", "Glass Heart", "Deep House Afro", "90s Retro", "Pipes of Wrath", "VJ Galaxy"];
const TRACK_KEY = "monchel-track";

function readDefaultTrack(): number {
  try {
    const n = Number(localStorage.getItem(TRACK_KEY));
    if (!Number.isInteger(n) || n < 0 || n >= TRACK_NAMES.length) return 0;
    return n;
  } catch {
    return 0;
  }
}

type OptionsPage = "menu" | "music" | "tracks" | "volume" | "controls" | "hud";

const CONTROLS_TOUCH = [
  "Tap anywhere to jump",
  "Tap and hold to jump higher",
  "Tap, hold and pull down to slide",
  "Flick up to jump out of the slide",
  "Tap, hold and move up/down to control Afterburner",
];

const CONTROLS_DESKTOP = [
  "Press Space, Up or Left click to jump",
  "Press and hold to jump higher",
  "Press S, Down or Right click to slide",
  "Use Mouse/Up & Down to Control Afterburner",
];

function OptionsWindow({
  page,
  track,
  defaultTrack,
  musicPercent,
  effectsPercent,
  onClose,
  onMusic,
  onTracks,
  onVolume,
  onControls,
  onHud,
  onHand,
  onBack,
  onPick,
  onSetDefault,
  onMusicPercent,
  onEffectsPercent,
  onMusicScrub,
  onEffectsSample,
  touch,
  hand,
}: {
  page: OptionsPage;
  track: number;
  defaultTrack: number;
  musicPercent: number;
  effectsPercent: number;
  onClose: () => void;
  onMusic: () => void;
  onTracks: () => void;
  onVolume: () => void;
  onControls: () => void;
  onHud: () => void;
  onHand: (hand: Hand) => void;
  onBack: () => void;
  onPick: (index: number) => void;
  onSetDefault: (index: number) => void;
  onMusicPercent: (percent: number) => void;
  onEffectsPercent: (percent: number) => void;
  onMusicScrub: (active: boolean) => void;
  onEffectsSample: () => void;
  touch: boolean;
  hand: Hand;
}) {
  const openedAt = useRef(0);
  const fxAt = useRef(0);
  const fxTimer = useRef(0);
  if (openedAt.current === 0) openedAt.current = performance.now();
  const nested = page !== "menu";
  const title =
    page === "tracks"
      ? "Tracks"
      : page === "volume"
        ? "Volume"
        : page === "controls"
          ? "Controls"
          : page === "hud"
            ? "HUD"
            : page === "music"
              ? "Music settings"
              : "Options";
  const sampleEffects = () => {
    const now = performance.now();
    const wait = 140 - (now - fxAt.current);
    if (wait > 0) {
      window.clearTimeout(fxTimer.current);
      fxTimer.current = window.setTimeout(() => {
        fxAt.current = performance.now();
        onEffectsSample();
      }, wait);
      return;
    }
    fxAt.current = now;
    onEffectsSample();
  };
  useEffect(() => {
    if (page === "volume") return;
    window.clearTimeout(fxTimer.current);
  }, [page]);
  return (
    <div
      data-ui
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 px-5"
      onClick={() => {
        if (performance.now() - openedAt.current < 400) return;
        onClose();
      }}
    >
      <div
        data-ui
        role="dialog"
        aria-label="Options"
        className="w-full max-w-sm rounded-3xl border-2 border-[#d8b4fe] bg-[#120816] px-5 pt-5 pb-6 text-left text-white shadow-[0_0_28px_rgba(192,132,252,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-3xl leading-none">{title}</h2>
          <button
            type="button"
            data-ui
            className="min-h-11 rounded-full border border-white/25 px-4 text-sm font-semibold"
            onClick={nested ? onBack : onClose}
          >
            {nested ? "Back" : "Close"}
          </button>
        </div>
        {page === "menu" ? (
          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              data-ui
              className="min-h-12 rounded-2xl border border-white/15 bg-white/5 px-4 text-left text-base font-semibold"
              onClick={onMusic}
            >
              Music settings
            </button>
            <button
              type="button"
              data-ui
              className="min-h-12 rounded-2xl border border-white/15 bg-white/5 px-4 text-left text-base font-semibold"
              onClick={onControls}
            >
              Controls
            </button>
            <button
              type="button"
              data-ui
              className="min-h-12 rounded-2xl border border-white/15 bg-white/5 px-4 text-left text-base font-semibold"
              onClick={onHud}
            >
              HUD
            </button>
          </div>
        ) : page === "music" ? (
          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              data-ui
              className="min-h-12 rounded-2xl border border-white/15 bg-white/5 px-4 text-left text-base font-semibold"
              onClick={onTracks}
            >
              Tracks
            </button>
            <button
              type="button"
              data-ui
              className="min-h-12 rounded-2xl border border-white/15 bg-white/5 px-4 text-left text-base font-semibold"
              onClick={onVolume}
            >
              Volume
            </button>
          </div>
        ) : page === "tracks" ? (
          <div className="mt-5 flex max-h-[58vh] flex-col gap-3 overflow-y-auto">
            {TRACK_NAMES.map((name, index) => {
              const on = track === index;
              const isDefault = index === defaultTrack;
              return (
                <div
                  key={name}
                  className={`flex items-center gap-2 rounded-2xl border px-3 ${
                    on
                      ? "border-[#d8b4fe] bg-white/10 shadow-[0_0_16px_rgba(192,132,252,0.45)]"
                      : "border-white/15 bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    data-ui
                    aria-pressed={on}
                    className="min-h-12 flex-1 py-2 text-left text-base font-semibold"
                    onClick={() => onPick(index)}
                  >
                    {name}
                    {isDefault ? (
                      <span className="mt-0.5 block text-xs font-medium text-white/60">Default</span>
                    ) : null}
                  </button>
                  {on && !isDefault ? (
                    <button
                      type="button"
                      data-ui
                      className="shrink-0 rounded-full px-2 py-1 text-[11px] font-medium tracking-wide text-white/55"
                      onClick={() => onSetDefault(index)}
                    >
                      Set as default
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : page === "volume" ? (
          <div className="mt-6 flex flex-col gap-6">
            <label className="block">
              <span className="text-base font-semibold">Music</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={musicPercent}
                aria-label="Music"
                className="mt-3 block w-full cursor-pointer accent-[#d8b4fe]"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onMusicScrub(true);
                }}
                onChange={(e) => onMusicPercent(Number(e.target.value))}
                onPointerUp={() => onMusicScrub(false)}
                onPointerCancel={() => onMusicScrub(false)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
                    onMusicScrub(true);
                  }
                }}
                onKeyUp={() => onMusicScrub(false)}
                onBlur={() => onMusicScrub(false)}
              />
            </label>
            <label className="block">
              <span className="text-base font-semibold">Effects</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={effectsPercent}
                aria-label="Effects"
                className="mt-3 block w-full cursor-pointer accent-[#d8b4fe]"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  sampleEffects();
                }}
                onChange={(e) => {
                  onEffectsPercent(Number(e.target.value));
                  sampleEffects();
                }}
              />
            </label>
          </div>
        ) : page === "controls" ? (
          <ul className="mt-5 flex max-h-[58vh] flex-col gap-3 overflow-y-auto">
            {(touch ? CONTROLS_TOUCH : CONTROLS_DESKTOP).map((line) => (
              <li
                key={line}
                className="rounded-2xl border border-[#d8b4fe]/40 bg-white/5 px-4 py-3 text-sm leading-snug font-medium shadow-[0_0_16px_rgba(192,132,252,0.18)]"
              >
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            {(
              [
                ["right", "Right-handed"],
                ["left", "Left-handed"],
              ] as const
            ).map(([id, label]) => {
              const on = hand === id;
              return (
                <button
                  key={id}
                  type="button"
                  data-ui
                  aria-pressed={on}
                  className={`min-h-12 rounded-2xl border px-4 text-left text-base font-semibold ${
                    on
                      ? "border-[#d8b4fe] bg-white/10 shadow-[0_0_16px_rgba(192,132,252,0.45)]"
                      : "border-white/15 bg-white/5"
                  }`}
                  onClick={() => onHand(id)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
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
  const shellRef = useRef<HTMLParagraphElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const jumpRef = useRef<() => void>(() => {});
  const dismissTitleRef = useRef<() => void>(() => {});
  const rerollRef = useRef<() => void>(() => {});
  const homeRef = useRef<() => void>(() => {});
  const seedRef = useRef(LAYOUT_SEED);
  const rootRef = useRef<HTMLDivElement>(null);
  const mutedRef = useRef(false);
  const musicMutedRef = useRef(false);
  const scoresOpenRef = useRef(false);
  const optionsOpenRef = useRef(false);
  const audioRef = useRef<{
    setMuted: (v: boolean) => void;
    setMusicMuted: (v: boolean) => void;
    setTrack: (index: number) => void;
    previewTrack: (index: number, hear?: boolean, loud?: boolean) => void;
    stopPreview: () => void;
    startMusic: () => void;
    setMusicPercent: (percent: number) => void;
    setEffectsPercent: (percent: number) => void;
    previewJump: () => void;
  } | null>(null);

  const [phase, setPhase] = useState<Phase>("title");
  const [finalScore, setFinalScore] = useState(0);
  const [finalMeters, setFinalMeters] = useState(0);
  const [finalLets, setFinalLets] = useState(0);
  const [finalSecs, setFinalSecs] = useState(0);
  const [board, setBoard] = useState<Board>(() => loadBoard());
  const [scoresOpen, setScoresOpen] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [cause, setCause] = useState<Cause>(null);
  const [muted, setMuted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [touchJump, setTouchJump] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionsPage, setOptionsPage] = useState<OptionsPage>("menu");
  const [track, setTrack] = useState(readDefaultTrack);
  const trackRef = useRef(readDefaultTrack());
  trackRef.current = track;
  const [defaultTrack, setDefaultTrack] = useState(readDefaultTrack);
  const [musicPercent, setMusicPercent] = useState(MUSIC_PERCENT);
  const [effectsPercent, setEffectsPercent] = useState(EFFECTS_PERCENT);
  const [hand, setHand] = useState(readHand);
  const [chogBanner, setChogBanner] = useState(0);
  scoresOpenRef.current = scoresOpen && (phase === "title" || phase === "dead");
  optionsOpenRef.current = optionsOpen;

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const noHover = window.matchMedia("(hover: none)");
    const sync = () => setTouchJump(coarse.matches || noHover.matches);
    sync();
    coarse.addEventListener("change", sync);
    noHover.addEventListener("change", sync);
    return () => {
      coarse.removeEventListener("change", sync);
      noHover.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const audio = createSfx();
    const openingTrack = readDefaultTrack();
    audio.setTrack(openingTrack);
    setActiveTrack(openingTrack);
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
    let lastTouchId = -1;
    let lastTouchAt = 0;
    let lastTouchStartAt = 0;
    let lastPointerTouchAt = 0;
    let touchGestureOpen = false;
    let touchRetry = false;
    let sawPointerJump = false;
    let titleTap = false;
    let scriptHold = 0;
    let suppress = false;
    let phaseMirror: Phase = "title";
    let shellExitUntil = 0;
    let slideLatch = false;
    let prevSlideHeld = false;
    const flickPts: { y: number; t: number }[] = [];
    let pullLow = 0;
    /** Space, up, or click pressed while the shell is still closing. */
    let desktopHop = false;
    let raf = 0;
    let last = performance.now();
    let padWas = false;
    let alive = true;
    mutedRef.current = readMuted();
    audio.setMuted(mutedRef.current);
    setMuted(mutedRef.current);

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
    const closeTouchLatch = () => {
      touchGestureOpen = false;
      lastPointerTouchAt = 0;
    };
    const beginTouchJump = (id: number, source: "touch" | "pointer") => {
      const now = performance.now();
      // touchstart and pointerdown are one gesture. A later tap, even a fast one, is not.
      if (source === "pointer" && now - lastTouchStartAt < 70) return;
      if (source === "touch" && touchGestureOpen && now - lastPointerTouchAt < 70 && lastPointerTouchAt > 0) return;
      if (touchGestureOpen && now - lastTouchAt < 70 && source === "pointer") return;
      if (source === "touch") lastTouchStartAt = now;
      else lastPointerTouchAt = now;
      touchGestureOpen = true;
      lastTouchId = id;
      lastTouchAt = now;
      lastSource = "touch";
      if (sim.phase === "title") return;
      if (sim.gear === "bluejet" && sim.phase === "run") return;
      unlock();
      suppress = false;
      jumpCooldown = 0;
      lastArmAt = 0;
      if (sim.phase !== "run") {
        presses += 1;
        jumpHeld = true;
        touchRetry = false;
        return;
      }
      const kind = jumpNow(sim);
      if (kind !== "blocked") {
        jumpHeld = true;
        sim.jumpWasDown = true;
        touchRetry = false;
        if (presses > 0) presses -= 1;
        if (sim.gear === "jet") audio.jetJump();
        else audio.jump();
        return;
      }
      presses += 1;
      jumpHeld = true;
      touchRetry = true;
    };
    const releaseTouchIfNone = () => {
      if (touches.size > 0 || lastSource !== "touch") return;
      jumpHeld = false;
      sim.jumpWasDown = false;
      jumpCooldown = 0;
      lastArmAt = 0;
      if (sim.grounded) sim.airJumps = maxAirJumps(sim.gear);
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
      // Down is already up, but the shell pose has not ticked off yet.
      // Queue a normal variable jump instead of the swipe-speed boost.
      if (sim.shelling && sim.gear !== "bluejet" && !steerKeys.has("ArrowDown") && !steerKeys.has("KeyS")) {
        desktopHop = true;
        return;
      }
      const kind = jumpNow(sim);
      if (kind === "blocked") return;
      if (sim.gear === "jet") audio.jetJump();
      else audio.jump();
    };
    const noteFlick = (y: number) => {
      const t = performance.now();
      const last = flickPts[flickPts.length - 1];
      if (last && t - last.t < 6) {
        last.y = y;
        return;
      }
      flickPts.push({ y, t });
      const cut = t - 220;
      while (flickPts.length > 2 && flickPts[0]!.t < cut) flickPts.shift();
      if (pullLow === 0 || y > pullLow) pullLow = y;
    };
    const readFlick = () => {
      const now = performance.now();
      const pts = flickPts.filter((p) => now - p.t <= 180);
      if (pts.length < 2) return 0;
      let upSpeed = 0;
      for (let i = 1; i < pts.length; i++) {
        const dt = (pts[i]!.t - pts[i - 1]!.t) / 1000;
        if (dt < 0.006) continue;
        const up = (pts[i - 1]!.y - pts[i]!.y) / dt;
        if (up > upSpeed) upSpeed = up;
      }
      const latest = pts[pts.length - 1]!.y;
      const upDist = pullLow > 0 ? pullLow - latest : 0;
      return swipePopStrength(upDist, upSpeed);
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
      beginReady();
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
    homeRef.current = () => {
      audio.stopMusic();
      clearHeld();
      titleTap = false;
      suppress = true;
      sim = bootSim(resetToRun(sim, seedRef.current));
      sim.phase = "title";
      setScoresOpen(false);
      setOptionsOpen(false);
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
      if (scoresOpenRef.current || optionsOpenRef.current) {
        if (isSpace(e)) e.preventDefault();
        return;
      }
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
          if (e.isTrusted) beginReady();
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
        if (e.isTrusted && jumpCode(e.code)) beginReady();
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
      desktopHop = false;
      jumpCooldown = 0;
      flightGrab = null;
    };
    const isUi = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest("[data-ui]");
    const beginReady = () => {
      if (sim.phase !== "title" || optionsOpenRef.current || scoresOpenRef.current) return;
      titleTap = true;
      audio.startMusic();
    };
    const noteTitle = (trusted: boolean) => {
      if (trusted) beginReady();
    };
    const onTouchStart = (e: TouchEvent) => {
      if (scoresOpenRef.current || optionsOpenRef.current) return;
      if (isUi(e.target)) return;
      noteTitle(e.isTrusted);
      if (e.cancelable) e.preventDefault();
      const live = new Set<number>();
      for (const t of Array.from(e.touches)) live.add(t.identifier);
      for (const id of touches.keys()) {
        if (live.has(id)) continue;
        touches.delete(id);
        if (id === lastTouchId) lastTouchId = -1;
      }
      let armed = false;
      for (const t of Array.from(e.changedTouches)) {
        touches.set(t.identifier, { x: t.clientX, y: t.clientY, cx: t.clientX, cy: t.clientY });
        if (!armed) {
          beginTouchJump(t.identifier, "touch");
          armed = true;
        }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      let tracked = false;
      for (const t of Array.from(e.changedTouches)) {
        const drag = touches.get(t.identifier);
        if (!drag) continue;
        tracked = true;
        drag.cx = t.clientX;
        drag.cy = t.clientY;
        noteFlick(t.clientY);
      }
      if (tracked && e.cancelable) e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        touches.delete(t.identifier);
        if (t.identifier === lastTouchId) lastTouchId = -1;
      }
      releaseTouchIfNone();
      if (touches.size === 0) closeTouchLatch();
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
      if (scoresOpenRef.current || optionsOpenRef.current) return;
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
      if (scoresOpenRef.current || optionsOpenRef.current) return;
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
        beginTouchJump(e.pointerId, "pointer");
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      const drag = drags.get(e.pointerId);
      if (!drag) return;
      drag.cx = e.clientX;
      drag.cy = e.clientY;
      noteFlick(e.clientY);
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      drags.delete(e.pointerId);
      touches.delete(e.pointerId);
      if (e.pointerType === "mouse") {
        mouseDown = false;
        sawPointerJump = false;
        releaseJump();
        return;
      }
      if (pointers.size === 0 && touches.size > 0) touches.clear();
      if (e.pointerId === lastTouchId) lastTouchId = -1;
      releaseTouchIfNone();
      if (touches.size === 0 && pointers.size === 0) closeTouchLatch();
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
      if (touchRetry && sim.phase === "run" && sim.gear !== "bluejet") {
        touchRetry = false;
        const kind = jumpNow(sim);
        if (kind !== "blocked") {
          if (touches.size > 0) jumpHeld = true;
          sim.jumpWasDown = true;
          if (presses > 0) presses -= 1;
          if (sim.gear === "jet") audio.jetJump();
          else audio.jump();
        }
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
          audio.startMusic();
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
      let slideHeld = false;
      if (sim.phase === "run" && sim.gear !== "bluejet") {
        if (down("ArrowDown") || down("KeyS")) slideHeld = true;
        if (pads) {
          for (const gp of pads) {
            if (!gp) continue;
            if ((gp.axes[1] ?? 0) > 0.55 || gp.buttons[13]?.pressed) slideHeld = true;
          }
        }
        const pulling = (dx: number, dy: number) => dy > 34 && dy > Math.abs(dx) * 0.7;
        for (const drag of drags.values()) {
          if (pulling(drag.cx - drag.x, drag.cy - drag.y)) slideHeld = true;
          noteFlick(drag.cy);
        }
        for (const drag of touches.values()) {
          if (pulling(drag.cx - drag.x, drag.cy - drag.y)) slideHeld = true;
          noteFlick(drag.cy);
        }
      }
      if (slideHeld && !prevSlideHeld) {
        flickPts.length = 0;
        pullLow = 0;
      }
      const flick = sim.phase === "run" && sim.gear !== "bluejet" ? readFlick() : 0;
      let slidePop = 0;
      const nowMs = performance.now();
      if (sim.shelling && sim.gear !== "bluejet") {
        const flickingOut = flick >= 0.55;
        if (!slideHeld || flickingOut) {
          if (flick > 0) slidePop = flick;
          if (flickingOut) slideHeld = false;
        }
      } else if (shellExitUntil > nowMs && sim.grounded && sim.phase === "run" && sim.gear !== "bluejet") {
        if (flick > 0) slidePop = flick;
      }
      if (slidePop > 0) {
        desktopHop = false;
        slideLatch = true;
        shellExitUntil = 0;
        slideHeld = false;
      }
      const hop = desktopHop && !slideHeld && slidePop <= 0;
      if (hop) desktopHop = false;
      const pullGone =
        !down("ArrowDown") &&
        !down("KeyS") &&
        touches.size === 0 &&
        drags.size === 0 &&
        !mouseDown;
      if (pullGone) slideLatch = false;
      if (slideLatch) slideHeld = false;
      prevSlideHeld = slideHeld;
      const wasShelling = sim.shelling;
      const control: Control = {
        held: !started && sim.phase === "run" && heldForJump && !slideHeld,
        edge: (edge || hop) && !started && sim.phase === "run" && !slideHeld && slidePop <= 0,
        flyX,
        flyY,
        slide: slideHeld,
        slidePop,
      };

      const events = tick(sim, dt, control);
      if (wasShelling && !sim.shelling && slidePop <= 0 && sim.phase === "run") shellExitUntil = nowMs + 190;
      if (sim.shelling) shellExitUntil = 0;
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
      if (events.chog) {
        audio.chog();
        setChogBanner((n) => n + 1);
      }
      if (events.chogFall) audio.chogFall();
      if (events.stomp === "rat" || events.stomp === "both") audio.stompRat();
      if (events.stomp === "coyote" || events.stomp === "both") audio.stompCoyote();
      if (events.slide) audio.slide();
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
      if (shellRef.current) {
        const flight = sim.gear === "bluejet";
        shellRef.current.hidden = flight;
        shellRef.current.textContent = flight ? "" : `Slides ${sim.shellsLeft}`;
      }

      if (sim.phase !== phaseMirror) {
        phaseMirror = sim.phase;
        if (sim.phase === "dead") {
          setChogBanner(0);
          const nextBoard = recordRun(loadBoard(), {
            score: sim.points,
            meters: sim.score,
            seconds: sim.runT,
            lettuces: sim.lettuces,
            stage: stageOf(sim.gear),
            gear: sim.gear,
            at: Date.now(),
          });
          saveBoard(nextBoard);
          setBoard(nextBoard);
          setFinalScore(sim.points);
          setFinalMeters(sim.score);
          setFinalLets(sim.lettuces);
          setFinalSecs(sim.runT);
          setNewBest(sim.newBest);
          setCause(sim.cause);
          sim.best = nextBoard.bestScore;
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
              <div className="pointer-events-auto mt-6 flex flex-col items-center gap-3">
                <button
                  type="button"
                  data-ui
                  className="min-h-12 min-w-36 rounded-full bg-accent px-8 py-3 text-lg font-semibold text-bg transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  onClick={() => dismissTitleRef.current()}
                >
                  Start
                </button>
                <button
                  type="button"
                  data-ui
                  className="min-h-12 min-w-36 rounded-full border border-white/40 bg-black/30 px-8 py-3 text-lg font-semibold text-white transition-transform active:scale-95"
                  onClick={() => setScoresOpen(true)}
                >
                  Scores
                </button>
                <button
                  type="button"
                  data-ui
                  className="min-h-9 rounded-full border border-white/30 bg-black/25 px-5 py-1.5 text-sm font-semibold text-white/85 transition-transform active:scale-95"
                  onClick={() => {
                    setScoresOpen(false);
                    setOptionsPage("menu");
                    setOptionsOpen(true);
                  }}
                >
                  Options
                </button>
              </div>
              <p className="mt-4 text-xs tracking-widest text-white/70 uppercase">@monchel_xyz</p>
            </div>
          </div>
        </div>
      )}

      {phase === "ready" && (
        <p className="pointer-events-none absolute inset-x-0 top-[22%] px-6 text-center font-display text-3xl text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] sm:text-5xl">
          {touchJump ? "Tap anywhere to jump" : "Space, arrows or mouse to jump"}
        </p>
      )}

      {phase === "dead" && (
        <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-bg/85 via-bg/35 to-transparent sm:bg-gradient-to-l" />
      )}

      {phase === "dead" && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col">
          <div className="death-copy">
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
              <button
                type="button"
                data-ui
                className="min-h-10 w-[88%] max-w-[17rem] rounded-full border border-border bg-surface px-6 py-2 text-base font-semibold text-fg transition-transform active:scale-95"
                onClick={() => homeRef.current()}
              >
                Home
              </button>
            </div>
            <p className="mt-3 text-base text-fg">{causeLine(cause)}</p>
            <p className="mt-1 text-sm text-muted tabular-nums">
              {runFacts(finalMeters, finalSecs, finalLets)}
            </p>
            <p className="mt-1 text-sm text-muted">
              Best {showScore(board.bestScore)}
              {bestFacts(board) ? ` · ${bestFacts(board)}` : ""}
            </p>
            </div>
          </div>
          {cause === "gap" && <div className="pointer-events-none shrink-0" style={{ height: "calc(7.5vh + 4.6rem)" }} aria-hidden="true" />}
        </div>
      )}

      {phase === "dead" && cause === "gap" && (
        <div className="loui-pop pointer-events-none absolute right-0 bottom-0 z-10 overflow-hidden" style={{ height: "23vh", width: "22vh" }} aria-hidden="true">
          {LOUI_FRAMES.map((src, i) => (
            <img key={src} src={src} alt="" className="loui-frame absolute top-0 max-w-none" style={{ height: "28.75vh", width: "28.75vh", right: "-8vh", animationDelay: `${i * 0.14}s` }} />
          ))}
        </div>
      )}

      {phase === "dead" && cause === "gap" && (
        <p className="purged loui-pop pointer-events-none absolute z-20" aria-hidden="true">
          <span>Purged!</span>
          Purged!
        </p>
      )}

      {scoresOpen && (phase === "title" || phase === "dead") && (
        <ScoreSheet board={board} onClose={() => setScoresOpen(false)} />
      )}

      {optionsOpen && phase === "title" && (
        <OptionsWindow
          page={optionsPage}
          track={track}
          defaultTrack={defaultTrack}
          musicPercent={musicPercent}
          effectsPercent={effectsPercent}
          onClose={() => {
            audioRef.current?.stopPreview();
            setOptionsOpen(false);
          }}
          onMusic={() => setOptionsPage("music")}
          onTracks={() => setOptionsPage("tracks")}
          onVolume={() => setOptionsPage("volume")}
          onControls={() => setOptionsPage("controls")}
          onHud={() => setOptionsPage("hud")}
          onHand={(next) => {
            setHand(next);
            try {
              localStorage.setItem(HUD_KEY, next);
            } catch {
              /* ignore */
            }
          }}
          touch={touchJump}
          hand={hand}
          onBack={() => {
            audioRef.current?.stopPreview();
            setOptionsPage((current) => (current === "tracks" || current === "volume" ? "music" : "menu"));
          }}
          onPick={(index) => {
            setTrack(index);
            setActiveTrack(index);
            audioRef.current?.previewTrack(index);
          }}
          onSetDefault={(index) => {
            setDefaultTrack(index);
            setTrack(index);
            setActiveTrack(index);
            audioRef.current?.setTrack(index);
            try {
              localStorage.setItem(TRACK_KEY, String(index));
            } catch {
              /* ignore */
            }
          }}
          onMusicPercent={(percent) => {
            setMusicPercent(percent);
            audioRef.current?.setMusicPercent(percent);
          }}
          onEffectsPercent={(percent) => {
            setEffectsPercent(percent);
            audioRef.current?.setEffectsPercent(percent);
          }}
          onMusicScrub={(active) => {
            if (active) audioRef.current?.previewTrack(track, true, false);
            else audioRef.current?.stopPreview();
          }}
          onEffectsSample={() => audioRef.current?.previewJump()}
        />
      )}

      {phase === "run" && (
        <>
          <div className="safe-pad ink-shadow pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between">
            <div>
              <p className="text-xs tracking-widest text-muted uppercase">Distance</p>
              <p className="font-bangers text-5xl leading-none tabular-nums">
                <span ref={scoreRef}>0</span>
                <span className="ml-1 text-lg text-muted">m</span>
              </p>
              <p className="mt-1 font-bangers text-2xl leading-none tabular-nums">
                <span ref={letRef}>0</span>
                <span className="ml-1 text-lg">🥬</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs tracking-widest text-muted uppercase">Best</p>
              <p className="font-bangers text-2xl leading-none tabular-nums">
                <span ref={bestRef}>0</span>
              </p>
              <p ref={gearRef} className="mt-2 text-sm font-medium text-primary">
                On foot
              </p>
              <p ref={shellRef} className="mt-1 text-xs tracking-widest text-muted uppercase">
                Slides 3
              </p>
            </div>
          </div>
          <p
            ref={hintRef}
            className="safe-bottom ink-shadow pointer-events-none absolute inset-x-0 z-20 px-16 text-center text-sm text-fg"
          >
            Tap to hop, hold to jump higher
          </p>
          {chogBanner > 0 && (
            <p
              key={chogBanner}
              className="chog-banner pointer-events-none absolute inset-x-0 z-20 text-center"
              onAnimationEnd={() => setChogBanner(0)}
            >
              <span aria-hidden="true">Get Chog to the club!</span>
              Get Chog to the club!
            </p>
          )}
        </>
      )}

      {(phase === "ready" || phase === "run" || phase === "dead") && (
        <>
          <button
            type="button"
            data-ui
            aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
            aria-pressed={muted}
            className={`absolute bottom-[max(0.7rem,env(safe-area-inset-bottom))] z-30 grid size-10 place-items-center rounded-full border border-border bg-surface text-fg focus-visible:ring-2 focus-visible:ring-fg ${hand === "left" ? "right-[0.55rem]" : "left-[0.55rem]"}`}
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
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <button
            type="button"
            data-ui
            aria-label={musicMuted ? "Unmute music" : "Mute music"}
            aria-pressed={musicMuted}
            className={`absolute bottom-[max(0.7rem,env(safe-area-inset-bottom))] z-30 grid size-10 place-items-center rounded-full border border-border bg-surface text-fg focus-visible:ring-2 focus-visible:ring-fg ${hand === "left" ? "right-[3.45rem]" : "left-[3.45rem]"}`}
            onClick={() => {
              const next = !musicMutedRef.current;
              musicMutedRef.current = next;
              audioRef.current?.setMusicMuted(next);
              setMusicMuted(next);
            }}
          >
            <span className="relative grid size-4 place-items-center">
              <Music className="size-4" />
              {musicMuted && <span className="absolute h-0.5 w-5 rotate-45 rounded-full bg-current" />}
            </span>
          </button>
          <button
            type="button"
            data-ui
            aria-label="Next track"
            className={`absolute bottom-[calc(max(0.7rem,env(safe-area-inset-bottom))+2.95rem)] z-30 grid size-10 place-items-center rounded-full border border-border bg-surface text-fg focus-visible:ring-2 focus-visible:ring-fg ${hand === "left" ? "right-[0.55rem]" : "left-[0.55rem]"}`}
            onClick={() => {
              const next = (trackRef.current + 1) % TRACK_NAMES.length;
              trackRef.current = next;
              setTrack(next);
              setActiveTrack(next);
              audioRef.current?.setTrack(next);
            }}
          >
            <SkipForward className="size-4" />
          </button>
        </>
      )}
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
