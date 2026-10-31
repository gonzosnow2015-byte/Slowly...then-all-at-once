import type { Gear } from "@/game/sim";

export const BOARD_KEY = "monchel-board";
export const BEST_KEY = "monchel-best";
export const BOARD_LIMIT = 8;

export type RunRow = {
  score: number;
  meters: number;
  seconds: number;
  lettuces: number;
  stage: number;
  gear: Gear;
  at: number;
};

export type Board = {
  bestScore: number;
  bestMeters: number;
  bestRunMeters: number;
  bestSeconds: number;
  bestLettuces: number;
  runs: RunRow[];
};

const GEARS: Gear[] = ["shell", "skates", "robo", "jet", "bluejet"];

export function emptyBoard(): Board {
  return { bestScore: 0, bestMeters: 0, bestRunMeters: 0, bestSeconds: 0, bestLettuces: 0, runs: [] };
}

export function stageOf(gear: Gear): number {
  if (gear === "skates") return 2;
  if (gear === "robo") return 3;
  if (gear === "jet") return 4;
  if (gear === "bluejet") return 5;
  return 1;
}

function whole(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

function tenth(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.round(v * 10) / 10);
}

function asGear(value: unknown): Gear {
  return GEARS.includes(value as Gear) ? (value as Gear) : "shell";
}

export function parseBoard(raw: string | null, legacyBest = 0): Board {
  const blank = emptyBoard();
  blank.bestScore = whole(legacyBest);
  if (!raw) return blank;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return blank;
  }
  if (!data || typeof data !== "object") return blank;
  const row = data as {
    bestScore?: unknown;
    bestMeters?: unknown;
    bestRunMeters?: unknown;
    bestSeconds?: unknown;
    bestLettuces?: unknown;
    runs?: unknown;
  };
  const runs: RunRow[] = [];
  if (Array.isArray(row.runs)) {
    for (const item of row.runs) {
      if (!item || typeof item !== "object") continue;
      const run = item as Partial<RunRow>;
      const gear = asGear(run.gear);
      const stage = whole(run.stage) || stageOf(gear);
      runs.push({
        score: whole(run.score),
        meters: whole(run.meters),
        seconds: tenth(run.seconds),
        lettuces: whole(run.lettuces),
        stage: Math.min(5, Math.max(1, stage)),
        gear,
        at: whole(run.at),
      });
    }
  }
  runs.sort((a, b) => b.at - a.at);
  const kept = runs.slice(0, BOARD_LIMIT);
  const bestScore = Math.max(whole(legacyBest), whole(row.bestScore), ...kept.map((r) => r.score), 0);
  const matched = kept.find((r) => r.score === bestScore && r.score > 0);
  return {
    bestScore,
    bestMeters: Math.max(whole(row.bestMeters), ...kept.map((r) => r.meters), 0),
    bestRunMeters:
      row.bestRunMeters != null ? whole(row.bestRunMeters) : (matched?.meters ?? whole(row.bestMeters)),
    bestSeconds: row.bestSeconds != null ? tenth(row.bestSeconds) : (matched?.seconds ?? 0),
    bestLettuces: row.bestLettuces != null ? whole(row.bestLettuces) : (matched?.lettuces ?? 0),
    runs: kept,
  };
}

export function recordRun(board: Board, run: RunRow): Board {
  const gear = asGear(run.gear);
  const row: RunRow = {
    score: whole(run.score),
    meters: whole(run.meters),
    seconds: tenth(run.seconds),
    lettuces: whole(run.lettuces),
    stage: Math.min(5, Math.max(1, whole(run.stage) || stageOf(gear))),
    gear,
    at: whole(run.at) || Date.now(),
  };
  const prevBest = whole(board.bestScore);
  const improves = row.score >= prevBest;
  return {
    bestScore: Math.max(prevBest, row.score),
    bestMeters: Math.max(whole(board.bestMeters), row.meters),
    bestRunMeters: improves ? row.meters : whole(board.bestRunMeters),
    bestSeconds: improves ? row.seconds : tenth(board.bestSeconds),
    bestLettuces: improves ? row.lettuces : whole(board.bestLettuces),
    runs: [row, ...board.runs].slice(0, BOARD_LIMIT),
  };
}

export function loadBoard(): Board {
  let legacy = 0;
  let raw: string | null = null;
  try {
    legacy = whole(localStorage.getItem(BEST_KEY));
    raw = localStorage.getItem(BOARD_KEY);
  } catch {
    return emptyBoard();
  }
  return parseBoard(raw, legacy);
}

export function saveBoard(board: Board): void {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify(board));
    localStorage.setItem(BEST_KEY, String(board.bestScore));
  } catch {
    /* private mode or a full disk */
  }
}
