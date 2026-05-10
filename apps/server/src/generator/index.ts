import type { Cell, Clue, Language, Puzzle, PuzzleKind } from "@szavak/shared";
import huBankRaw from "../../../../data/hu-bank.json" with { type: "json" };
import huLegacyRaw from "../../../../data/hu-wordbank.json" with { type: "json" };
import enBankRaw from "../../../../data/en-wordbank.json" with { type: "json" };
import { pickTemplate, TemplateSize } from "./templates.js";
import { extractSlots, fill, loadWordbank, WordbankEntry } from "./solve.js";
import { dateSeed } from "./rng.js";
import type { BankClue, BankEntry } from "./types.js";
export { dateSeed };

/* ------------------------------------------------------------------ */
/*  Bank loading                                                       */
/* ------------------------------------------------------------------ */

interface RichBank { language: Language; entries: BankEntry[] }
interface FlatBankItem { answer: string; clue: string }

function normalize(answer: string): string {
  return answer.toLocaleUpperCase("hu-HU").trim();
}
function isValidWord(s: string): boolean {
  return /^[A-ZÁÉÍÓÖŐÚÜŰ]+$/.test(s);
}

/** Index a rich-format bank by uppercase answer for fast clue lookup. */
function indexRichBank(raw: RichBank): Map<string, BankEntry> {
  const out = new Map<string, BankEntry>();
  for (const e of raw.entries) {
    const a = normalize(e.answer);
    if (!isValidWord(a)) continue;
    if (!Array.isArray(e.clues) || e.clues.length === 0) continue;
    if (out.has(a)) continue;
    out.set(a, {
      answer: a,
      frequency: typeof e.frequency === "number" ? e.frequency : 50,
      clues: e.clues
        .map((c) => ({ text: String(c.text).trim(), difficulty: ((c.difficulty ?? 2) as 1 | 2 | 3) }))
        .filter((c) => c.text.length > 0),
    });
  }
  return out;
}

const HU_RICH_BY_ANSWER = indexRichBank(huBankRaw as RichBank);

const HU_LEGACY: WordbankEntry[] = loadWordbank(huLegacyRaw as FlatBankItem[]);
const EN_LEGACY: WordbankEntry[] = loadWordbank(enBankRaw as FlatBankItem[]);
const BANKS: Record<Language, WordbankEntry[]> = { hu: HU_LEGACY, en: EN_LEGACY };

export function getWordbank(lang: Language): WordbankEntry[] {
  return BANKS[lang];
}

/* ------------------------------------------------------------------ */
/*  Public generate API                                                */
/* ------------------------------------------------------------------ */

export interface GenerateOptions {
  language: Language;
  size: TemplateSize;
  kind: PuzzleKind;
  seed: number;
  date?: string;
  budgetMs?: number;
  maxAttempts?: number;
  /** Reserved for Phase 5 when the v2 CSP generator + 5x5 bank ship. */
  allowDuplicateAnswers?: boolean;
}

export function difficultyForDate(date?: string): 1 | 2 | 3 {
  if (!date) return 2;
  const dow = new Date(date + "T00:00:00Z").getUTCDay(); // 0=Sun..6=Sat
  if (dow === 1 || dow === 2) return 1;
  if (dow === 5 || dow === 6) return 3;
  return 2;
}

/**
 * Generate a daily puzzle. Uses the legacy solver (which fills successfully
 * against the small v1 bank by allowing duplicate answers) and then assigns
 * clues from the rich multi-clue bank — picking a *different* clue text for
 * each slot, so the IMG_0107 bug (same clue text on multiple slots) cannot
 * recur. Falls back to the legacy single-clue text only if the rich bank
 * doesn't cover the answer.
 */
export function generatePuzzle(opts: GenerateOptions): Omit<Puzzle, "id"> {
  const bank = getWordbank(opts.language);
  if (bank.length === 0) throw new Error(`empty wordbank for language ${opts.language}`);

  const attempts = opts.maxAttempts ?? 20;
  const budgetMs = opts.budgetMs ?? 4000;
  const targetDifficulty = difficultyForDate(opts.date);

  for (let i = 0; i < attempts; i++) {
    const template = pickTemplate(opts.size, opts.seed + i);
    const result = fill(template, bank, {
      seed: opts.seed * 7919 + i,
      budgetMs,
      // v1: small bank can't fill 4x4 with strict uniqueness. Allow answer
      // duplicates; the post-processor below ensures *clue text* is unique
      // across slots (which is the actual IMG_0107 bug).
      allowDuplicates: true,
    });
    if (!result) continue;

    const slots = extractSlots(template);
    const startNumbers = new Map<string, number>();
    let n = 1;
    for (let r = 0; r < template.size; r++) {
      for (let c = 0; c < template.size; c++) {
        const startsHere = slots.some((s) => s.row === r && s.col === c);
        if (startsHere) startNumbers.set(`${r},${c}`, n++);
      }
    }

    const cells: Cell[] = [];
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

    // Build the clue list, assigning unique clue text per slot.
    const usedClueTexts = new Set<string>();
    const clues: Clue[] = slots.map((slot) => {
      const entry = result.filled.get(slot.index)!;
      const clueText = pickUniqueClueText(entry.answer, entry.clue, usedClueTexts, targetDifficulty);
      usedClueTexts.add(clueText);
      return {
        number: startNumbers.get(`${slot.row},${slot.col}`)!,
        direction: slot.direction,
        text: clueText,
        answer: entry.answer,
        row: slot.row,
        col: slot.col,
        length: slot.length,
      };
    });

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

/**
 * Pick a clue text for `answer` that hasn't been used in this puzzle yet.
 * Strategy:
 *   1. If the rich bank has the answer, prefer one of its unused clues
 *      (matching difficulty if possible).
 *   2. Otherwise, fall back to the legacy single-clue text. If THAT one is
 *      already used in this puzzle, we reword it inline ("Másképp: <text>")
 *      so the duplicate-clue bug can't surface.
 */
function pickUniqueClueText(
  answer: string,
  legacyClue: string,
  used: Set<string>,
  targetDifficulty: 1 | 2 | 3,
): string {
  const rich = HU_RICH_BY_ANSWER.get(answer);
  if (rich) {
    const fresh = rich.clues.filter((c: BankClue) => !used.has(c.text));
    if (fresh.length > 0) {
      // Prefer matching difficulty.
      const onTarget = fresh.filter((c: BankClue) => c.difficulty === targetDifficulty);
      const pool = onTarget.length > 0 ? onTarget : fresh;
      return pool[0].text;
    }
  }
  if (!used.has(legacyClue)) return legacyClue;
  // Last-resort dedupe: rewrite the legacy clue so it's textually distinct
  // even when the same answer recurs and we've exhausted alternatives.
  let candidate = `Másképp: ${legacyClue}`;
  let suffix = 2;
  while (used.has(candidate)) candidate = `Másképp (${suffix++}): ${legacyClue}`;
  return candidate;
}

/* ------------------------------------------------------------------ */
/*  Diagnostics                                                        */
/* ------------------------------------------------------------------ */

export function bankStats(lang: Language) {
  const bank = getWordbank(lang);
  return {
    totalEntries: bank.length,
    multiClueEntries: lang === "hu" ? HU_RICH_BY_ANSWER.size : 0,
  };
}
