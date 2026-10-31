import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyBoard, parseBoard, recordRun, stageOf } from "./board.ts";

describe("local scoreboard", () => {
  it("keeps the newest runs first and caps the list", () => {
    let board = emptyBoard();
    for (let i = 1; i <= 10; i++) {
      board = recordRun(board, { score: i * 100, meters: i, seconds: i, lettuces: 0, stage: 1, gear: "shell", at: i });
    }
    assert.equal(board.runs.length, 8);
    assert.equal(board.runs[0]?.score, 1000);
    assert.equal(board.runs[7]?.score, 300);
    assert.equal(board.bestScore, 1000);
    assert.equal(board.bestMeters, 10);
    assert.equal(board.bestRunMeters, 10);
    assert.equal(board.bestLettuces, 0);
  });

  it("does not lower an existing best", () => {
    const board = recordRun(
      { bestScore: 5000, bestMeters: 90, bestRunMeters: 80, bestSeconds: 30, bestLettuces: 4, runs: [] },
      {
        score: 100,
        meters: 12,
        seconds: 6.2,
        lettuces: 1,
        stage: 2,
        gear: "skates",
        at: 5,
      },
    );
    assert.equal(board.bestScore, 5000);
    assert.equal(board.bestMeters, 90);
    assert.equal(board.bestRunMeters, 80);
    assert.equal(board.bestSeconds, 30);
    assert.equal(board.bestLettuces, 4);
    assert.equal(board.runs[0]?.meters, 12);
    assert.equal(board.runs[0]?.lettuces, 1);
  });

  it("keeps the lettuce count of the best run, not a later shorter one", () => {
    let board = emptyBoard();
    board = recordRun(board, {
      score: 840,
      meters: 20,
      seconds: 12.4,
      lettuces: 4,
      stage: 2,
      gear: "skates",
      at: 1,
    });
    board = recordRun(board, {
      score: 420,
      meters: 20,
      seconds: 6,
      lettuces: 1,
      stage: 1,
      gear: "shell",
      at: 2,
    });
    assert.equal(board.bestScore, 840);
    assert.equal(board.bestMeters, 20);
    assert.equal(board.bestRunMeters, 20);
    assert.equal(board.bestSeconds, 12.4);
    assert.equal(board.bestLettuces, 4);
    assert.equal(board.runs[0]?.lettuces, 1);
    assert.equal(board.runs[1]?.lettuces, 4);
    const again = parseBoard(JSON.stringify(board));
    assert.equal(again.bestLettuces, 4);
    assert.equal(again.bestSeconds, 12.4);
    assert.equal(again.runs[0]?.lettuces, 1);
  });

  it("reads a saved board and keeps a legacy best score", () => {
    const raw = JSON.stringify({
      bestScore: 200,
      bestMeters: 15,
      runs: [
        { score: 200, meters: 15, stage: 3, gear: "robo", at: 20 },
        { score: 50, meters: 4, stage: 1, gear: "shell", at: 10 },
      ],
    });
    const board = parseBoard(raw, 900);
    assert.equal(board.bestScore, 900);
    assert.equal(board.bestMeters, 15);
    assert.equal(board.runs[0]?.stage, 3);
    assert.equal(stageOf("bluejet"), 5);
  });

  it("drops a broken save without throwing", () => {
    const board = parseBoard("{nope", 40);
    assert.equal(board.bestScore, 40);
    assert.deepEqual(board.runs, []);
  });
});
