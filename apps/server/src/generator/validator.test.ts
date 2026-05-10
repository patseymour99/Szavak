import { describe, it, expect } from "vitest";
import { parseLayout, assignNumbers, extractSlots } from "./layout.js";
import { validateLayout, validatePuzzle } from "./validator.js";
import { generatePuzzle, dateSeed } from "./index.js";

describe("layout", () => {
  it("numbers correctly when blocks split the top row (rule §7.3)", () => {
    // OXOOO across top => first cell numbered, third cell numbered.
    const layout = parseLayout("split", [
      "OXOOO",
      "OOOOO",
      "OOOOO",
      "OOOOO",
      "OOOOO",
    ]);
    const numbers = assignNumbers(layout);
    expect(numbers.get("0,0")).toBe(1);
    expect(numbers.get("0,2")).toBe(2);
  });

  it("numbers a 5x5 all-open grid 1..9 in standard order", () => {
    const layout = parseLayout("5x5", ["OOOOO", "OOOOO", "OOOOO", "OOOOO", "OOOOO"]);
    const numbers = assignNumbers(layout);
    // 1..5 across the top row (each starts an across slot AND a down slot),
    // then 6..9 down the left column (each starts an across slot only).
    expect(numbers.get("0,0")).toBe(1);
    expect(numbers.get("0,1")).toBe(2);
    expect(numbers.get("0,4")).toBe(5);
    expect(numbers.get("1,0")).toBe(6);
    expect(numbers.get("4,0")).toBe(9);
  });

  it("rejects layouts with length-1 or length-2 slots (rule 2)", () => {
    // Row 0 "OXOOO" gives a length-1 slot at (0,0).
    const layout = parseLayout("bad", ["OXOOO", "OOOOO", "OOOOO", "OOOOO", "OOOOO"]);
    const v = validateLayout(layout);
    expect(v.ok).toBe(false);
  });
});

describe("validatePuzzle (the IMG_0107 bug)", () => {
  it("rejects a puzzle with duplicate clue texts even when answers differ", () => {
    const layout = parseLayout("4x4", ["OOOO", "OOOO", "OOOO", "OOOO"]);
    const slots = extractSlots(layout);
    const fills = new Map(slots.map((s, i) => [s.id, "ABCD".slice(0, s.cells.length)]));
    // Two different slots assigned the same clue text.
    const cluesBySlot = new Map<string, string>();
    for (const [i, s] of slots.entries()) {
      cluesBySlot.set(s.id, i < 2 ? "Same clue" : `Other ${i}`);
    }
    const v = validatePuzzle({ layout, slots, fills, cluesBySlot });
    expect(v.errors.some((e) => e.includes("duplicate clue"))).toBe(true);
  });

  it("accepts a puzzle with duplicate answers when allowDuplicateAnswers is set", () => {
    const layout = parseLayout("4x4", ["OOOO", "OOOO", "OOOO", "OOOO"]);
    const slots = extractSlots(layout);
    const fills = new Map(slots.map((s) => [s.id, "ABCD"]));
    const cluesBySlot = new Map(slots.map((s, i) => [s.id, `clue ${i}`]));
    const ok = validatePuzzle({ layout, slots, fills, cluesBySlot, allowDuplicateAnswers: true });
    // Note: this still complains about cell-letter mismatches because we used
    // "ABCD" for all 8 slots without making them consistent at crossings; the
    // duplicate-answer rule itself is silenced.
    expect(ok.errors.some((e) => e.includes("duplicate answer"))).toBe(false);
  });
});

describe("generatePuzzle (end-to-end)", () => {
  it("produces 14 consecutive daily puzzles with no duplicate clue text", () => {
    const start = new Date("2026-05-10T00:00:00Z").getTime();
    for (let i = 0; i < 14; i++) {
      const date = new Date(start + i * 86400000).toISOString().slice(0, 10);
      const seed = dateSeed(`${date}:hu`);
      const p = generatePuzzle({ language: "hu", size: 4, kind: "daily", seed, date });
      const clueTexts = p.clues.map((c) => c.text);
      const unique = new Set(clueTexts);
      expect(unique.size).toBe(clueTexts.length);
    }
  });

  it("never emits an empty clue text", () => {
    for (const seed of [1, 42, 2026]) {
      const p = generatePuzzle({ language: "hu", size: 4, kind: "daily", seed });
      for (const c of p.clues) {
        expect(c.text.length).toBeGreaterThan(0);
      }
    }
  });
});
