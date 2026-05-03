import { describe, expect, it } from "vitest";
import { generatePuzzle } from "./index.js";
import { extractSlots, loadWordbank } from "./solve.js";
import { MINI_4, validate } from "./templates.js";
import { computeElapsedMs, REVEAL_LETTER_PENALTY_MS } from "@szavak/shared";

describe("templates", () => {
  it("all templates pass symmetry + min-slot validation", () => {
    for (const t of MINI_4) {
      expect(() => validate(t)).not.toThrow();
    }
  });
  it("extractSlots returns 8 slots for 4x4 fully-open template", () => {
    const slots = extractSlots(MINI_4[0]);
    expect(slots.length).toBe(8);
    for (const s of slots) expect(s.length).toBeGreaterThanOrEqual(3);
  });
});

describe("loadWordbank", () => {
  it("dedupes and uppercases", () => {
    const out = loadWordbank([
      { answer: "alma", clue: "x" },
      { answer: "ALMA", clue: "y" },
      { answer: "BÉKA", clue: "frog" },
      { answer: "  ", clue: "junk" },
    ]);
    expect(out.map((e) => e.answer)).toEqual(["ALMA", "BÉKA"]);
  });
});

describe("generatePuzzle", () => {
  it("produces a valid 4x4 mini in HU", () => {
    const p = generatePuzzle({ language: "hu", size: 4, kind: "daily", seed: 42 });
    expect(p.rows).toBe(4);
    expect(p.cols).toBe(4);
    for (const cell of p.cells) {
      if (!cell.isBlack) {
        expect(cell.solution).toMatch(/^[A-ZÁÉÍÓÖŐÚÜŰ]$/);
      }
    }
    for (const clue of p.clues) {
      expect(clue.answer.length).toBe(clue.length);
      for (let i = 0; i < clue.length; i++) {
        const r = clue.direction === "across" ? clue.row : clue.row + i;
        const c = clue.direction === "across" ? clue.col + i : clue.col;
        const cell = p.cells[r * p.cols + c];
        expect(cell.solution).toBe([...clue.answer][i]);
      }
    }
  });

  it("is deterministic for a given seed", () => {
    const a = generatePuzzle({ language: "hu", size: 4, kind: "daily", seed: 7 });
    const b = generatePuzzle({ language: "hu", size: 4, kind: "daily", seed: 7 });
    expect(a.cells.map((c) => c.solution).join(",")).toBe(
      b.cells.map((c) => c.solution).join(","),
    );
  });

  it("succeeds across many random seeds in HU", () => {
    let successes = 0;
    for (let seed = 1; seed <= 30; seed++) {
      try {
        generatePuzzle({ language: "hu", size: 4, kind: "daily", seed });
        successes++;
      } catch {
        // acceptable rare failure
      }
    }
    expect(successes).toBeGreaterThan(25);
  });

  it("works with the English wordbank too", () => {
    let successes = 0;
    for (let seed = 1; seed <= 20; seed++) {
      try {
        generatePuzzle({ language: "en", size: 4, kind: "daily", seed });
        successes++;
      } catch {
        /* tolerate occasional failure */
      }
    }
    expect(successes).toBeGreaterThan(0);
  });
});

describe("computeElapsedMs", () => {
  it("adds reveal penalties", () => {
    const t0 = "2026-01-01T00:00:00.000Z";
    const t1 = "2026-01-01T00:01:00.000Z";
    expect(computeElapsedMs(t0, t1, 0, 0)).toBe(60_000);
    expect(computeElapsedMs(t0, t1, 1, 0)).toBe(60_000 + REVEAL_LETTER_PENALTY_MS);
  });
});
