import type { Cell, Clue, Language, Puzzle, PuzzleKind } from "@szavak/shared";
import { pickTemplate, TemplateSize } from "./templates.js";
import { extractSlots, fill, loadWordbank, WordbankEntry } from "./solve.js";

import huBank from "../../../../data/hu-wordbank.json" with { type: "json" };
import enBank from "../../../../data/en-wordbank.json" with { type: "json" };

const BANKS: Record<Language, WordbankEntry[]> = {
  hu: loadWordbank(huBank as WordbankEntry[]),
  en: loadWordbank(enBank as WordbankEntry[]),
};

export function getWordbank(lang: Language): WordbankEntry[] {
  return BANKS[lang];
}

export interface GenerateOptions {
  language: Language;
  size: TemplateSize;
  kind: PuzzleKind;
  /** seed for deterministic generation */
  seed: number;
  /** optional ISO date string for daily puzzles */
  date?: string;
  /** ms budget per attempt */
  budgetMs?: number;
  /** how many random attempts before giving up */
  maxAttempts?: number;
}

export function generatePuzzle(opts: GenerateOptions): Omit<Puzzle, "id"> {
  const bank = getWordbank(opts.language);
  if (bank.length === 0) {
    throw new Error(`empty wordbank for language ${opts.language}`);
  }

  const attempts = opts.maxAttempts ?? 20;
  const budgetMs = opts.budgetMs ?? 4000;

  for (let i = 0; i < attempts; i++) {
    const template = pickTemplate(opts.size, opts.seed + i);
    // v1 wordbank is small enough that the only achievable word squares re-use
    // an answer across an across+down pair, so we allow duplicates. Once the
    // wordbank is much larger this can be flipped.
    const result = fill(template, bank, {
      seed: opts.seed * 7919 + i,
      budgetMs,
      allowDuplicates: true,
    });
    if (!result) continue;

    const slots = extractSlots(template);
    const cells: Cell[] = [];
    // Number cells that start any slot, in standard left-to-right top-to-bottom order.
    const startNumbers = new Map<string, number>();
    let n = 1;
    for (let r = 0; r < template.size; r++) {
      for (let c = 0; c < template.size; c++) {
        const startsHere = slots.some((s) => s.row === r && s.col === c);
        if (startsHere) startNumbers.set(`${r},${c}`, n++);
      }
    }

    for (let r = 0; r < template.size; r++) {
      for (let c = 0; c < template.size; c++) {
        const isBlack = template.cells[r * template.size + c] === 1;
        const idx = r * template.size + c;
        cells.push({
          row: r,
          col: c,
          isBlack,
          solution: isBlack ? undefined : result.letters[idx],
          number: startNumbers.get(`${r},${c}`),
        });
      }
    }

    const clues: Clue[] = slots.map((slot) => {
      const entry = result.filled.get(slot.index)!;
      return {
        number: startNumbers.get(`${slot.row},${slot.col}`)!,
        direction: slot.direction,
        text: entry.clue,
        answer: entry.answer,
        row: slot.row,
        col: slot.col,
        length: slot.length,
      };
    });

    // Stable sort: across before down, by number.
    clues.sort((a, b) => {
      if (a.direction !== b.direction) return a.direction === "across" ? -1 : 1;
      return a.number - b.number;
    });

    return {
      kind: opts.kind,
      language: opts.language,
      date: opts.date,
      rows: template.size,
      cols: template.size,
      cells,
      clues,
    };
  }
  throw new Error("generator failed within attempt budget");
}

export function dateSeed(isoDate: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < isoDate.length; i++) {
    h ^= isoDate.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
