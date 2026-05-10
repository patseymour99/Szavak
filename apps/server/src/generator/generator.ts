import type { BankClue, BankEntry, Layout, Slot } from "./types.js";
import { extractSlots } from "./layout.js";
import { mulberry32, shuffleInPlace } from "./rng.js";
import { validatePuzzle } from "./validator.js";

export interface GenerateInput {
  layout: Layout;
  bank: BankEntry[];
  /** Avoid these answers (e.g. used in the last 30 days). */
  recentAnswers?: Set<string>;
  /** Avoid these clue texts (e.g. used in the last 90 days). Soft constraint. */
  recentClues?: Set<string>;
  /** 1=Mon, 7=Sun. Targets average clue difficulty. */
  difficultyTarget?: 1 | 2 | 3;
  seed: number;
  /** Backtracking budget. Default 1500. */
  budget?: number;
  /**
   * If true, the same answer string may appear in multiple slots (e.g.
   * a 4x4 word-square layout where 1A == 1D as a string). Each occurrence
   * still picks a distinct clue text from that entry's clue list, so the
   * IMG_0107 duplicate-clue bug is still prevented. Defaults to false (the
   * spec §7.2 rule 5 default). The route flips this on for the v1 4x4
   * fallback because the bank is too small for true distinct-answer fills.
   */
  allowDuplicateAnswers?: boolean;
}

export interface GenerateOutput {
  slots: Slot[];
  fills: Map<string, string>;
  cluesBySlot: Map<string, string>;
}

interface SlotState {
  slot: Slot;
  /** index into slot.cells */
  letters: Array<string | null>;
}

/**
 * Generate a filled puzzle from a layout and word bank. Enforces the
 * uniqueness invariants that v1 was missing: no answer or clue may repeat
 * inside a single puzzle.
 */
export function generate(input: GenerateInput): GenerateOutput | null {
  const slots = extractSlots(input.layout);
  if (slots.length === 0) return null;

  const recentAnswers = input.recentAnswers ?? new Set<string>();
  const recentClues = input.recentClues ?? new Set<string>();
  const target = input.difficultyTarget ?? 2;
  const rng = mulberry32(input.seed);
  // Daily generation runs once per day, so we can afford a generous budget.
  // With 4x4 + corner-blocked layout the search converges in < 200ms when
  // a solution exists.
  const budget = { left: input.budget ?? 200_000 };
  const allowDuplicateAnswers = input.allowDuplicateAnswers ?? false;

  // Pre-compute which entries fit each length, sorted by frequency desc.
  const byLength = new Map<number, BankEntry[]>();
  for (const e of input.bank) {
    const len = [...e.answer].length;
    if (!byLength.has(len)) byLength.set(len, []);
    byLength.get(len)!.push(e);
  }
  for (const list of byLength.values()) {
    list.sort((a, b) => b.frequency - a.frequency);
  }

  // For each (length, position, letter), pre-compute the count of bank words
  // that have `letter` at position `position`. Used by forward-checking to
  // reject a candidate that would leave any crossing slot with zero options.
  const positionCount = new Map<string, number>();
  for (const e of input.bank) {
    const len = [...e.answer].length;
    const chars = [...e.answer];
    for (let i = 0; i < chars.length; i++) {
      const k = `${len}|${i}|${chars[i]}`;
      positionCount.set(k, (positionCount.get(k) ?? 0) + 1);
    }
  }
  function countWordsWith(len: number, pos: number, letter: string): number {
    return positionCount.get(`${len}|${pos}|${letter}`) ?? 0;
  }

  // Map cell -> list of (slot, position-within-slot) so we can forward-check
  // every slot affected when we commit a fill.
  const cellToSlots = new Map<string, Array<{ slot: Slot; pos: number }>>();
  for (const slot of slots) {
    for (let i = 0; i < slot.cells.length; i++) {
      const [r, c] = slot.cells[i];
      const k = `${r},${c}`;
      if (!cellToSlots.has(k)) cellToSlots.set(k, []);
      cellToSlots.get(k)!.push({ slot, pos: i });
    }
  }

  // Slot order: longest first, then most-crossed (a heuristic; for 5x5 with
  // small slot counts this doesn't matter much, but it scales to 15x15).
  const ordered = [...slots].sort((a, b) => {
    if (b.cells.length !== a.cells.length) return b.cells.length - a.cells.length;
    return a.id.localeCompare(b.id);
  });

  // Per-cell state, keyed by "r,c". Stores the assigned letter (or null).
  const grid = new Map<string, string | null>();
  for (const s of slots) {
    for (const [r, c] of s.cells) grid.set(`${r},${c}`, null);
  }

  const fills = new Map<string, string>();
  const usedAnswers = new Set<string>();
  const usedClues = new Set<string>();
  const cluesBySlot = new Map<string, string>();

  function fits(slot: Slot, answer: string): boolean {
    const chars = [...answer];
    if (chars.length !== slot.cells.length) return false;
    for (let i = 0; i < slot.cells.length; i++) {
      const [r, c] = slot.cells[i];
      const cur = grid.get(`${r},${c}`);
      if (cur != null && cur !== chars[i]) return false;
    }
    return true;
  }

  /**
   * Forward-check: simulate committing `answer` to `slot`, then verify every
   * unfilled crossing slot still has at least one bank word matching the
   * resulting pattern. If any crossing slot would have zero options, reject
   * this candidate before we waste time recursing.
   */
  function forwardCheck(slot: Slot, answer: string): boolean {
    const chars = [...answer];
    // Collect cells that this commit would newly fill.
    const newlyFilled = new Map<string, string>();
    for (let i = 0; i < slot.cells.length; i++) {
      const [r, c] = slot.cells[i];
      const k = `${r},${c}`;
      if (grid.get(k) == null) newlyFilled.set(k, chars[i]);
    }
    // For each cell newly filled, look at every other slot that contains it.
    const checked = new Set<string>();
    for (const k of newlyFilled.keys()) {
      const refs = cellToSlots.get(k) ?? [];
      for (const { slot: other } of refs) {
        if (other.id === slot.id) continue;
        if (checked.has(other.id)) continue;
        checked.add(other.id);
        if (fills.has(other.id)) continue; // already filled, skip
        // Build the pattern for `other` after our hypothetical commit.
        const pattern: Array<string | null> = other.cells.map(([r2, c2]) => {
          const ck = `${r2},${c2}`;
          return newlyFilled.get(ck) ?? grid.get(ck) ?? null;
        });
        // Cheap check: does at least one bank word of this length match?
        // We only check that each constrained position has >= 1 candidate
        // by intersecting per-position sets implicitly through scanning.
        const len = other.cells.length;
        const candidates = byLength.get(len) ?? [];
        let any = false;
        for (const e of candidates) {
          if (!allowDuplicateAnswers && usedAnswers.has(e.answer)) continue;
          if (recentAnswers.has(e.answer)) continue;
          // Also need a remaining clue text — even if the answer can repeat,
          // each occurrence must pick a distinct clue text. The candidate is
          // unfillable here if its clue list is exhausted.
          if (!e.clues.some((c) => !usedClues.has(c.text))) continue;
          const ec = [...e.answer];
          let ok = true;
          for (let i = 0; i < len; i++) {
            if (pattern[i] != null && pattern[i] !== ec[i]) { ok = false; break; }
          }
          if (ok) { any = true; break; }
        }
        if (!any) return false;
      }
    }
    return true;
  }

  // answer-use refcount, so allowDuplicateAnswers can let the same word
  // fill several slots without a single delete clearing all of them.
  const answerUses = new Map<string, number>();

  function commit(slot: Slot, answer: string): void {
    const chars = [...answer];
    for (let i = 0; i < slot.cells.length; i++) {
      const [r, c] = slot.cells[i];
      grid.set(`${r},${c}`, chars[i]);
    }
    fills.set(slot.id, answer);
    answerUses.set(answer, (answerUses.get(answer) ?? 0) + 1);
    usedAnswers.add(answer);
  }

  function rollback(slot: Slot, answer: string, prev: Array<string | null>): void {
    for (let i = 0; i < slot.cells.length; i++) {
      const [r, c] = slot.cells[i];
      grid.set(`${r},${c}`, prev[i]);
    }
    fills.delete(slot.id);
    const remaining = (answerUses.get(answer) ?? 1) - 1;
    if (remaining <= 0) {
      answerUses.delete(answer);
      usedAnswers.delete(answer);
    } else {
      answerUses.set(answer, remaining);
    }
  }

  function pickClue(entry: BankEntry): BankClue | null {
    const fresh = entry.clues.filter((c) => !usedClues.has(c.text));
    if (fresh.length === 0) return null;
    const preferRecent = fresh.filter((c) => !recentClues.has(c.text));
    const pool = preferRecent.length > 0 ? preferRecent : fresh;
    const onTarget = pool.filter((c) => c.difficulty === target);
    const final = onTarget.length > 0 ? onTarget : pool;
    return final[Math.floor(rng() * final.length)] ?? null;
  }

  function backtrack(i: number): boolean {
    if (i === ordered.length) return true;
    if (budget.left <= 0) return false;

    const slot = ordered[i];
    const candidates = (byLength.get(slot.cells.length) ?? [])
      .filter((e) => allowDuplicateAnswers || !usedAnswers.has(e.answer))
      .filter((e) => !recentAnswers.has(e.answer))
      // Even when duplicate answers are allowed, an entry with no remaining
      // unused clue text is unfillable here (no clue to assign).
      .filter((e) => e.clues.some((c) => !usedClues.has(c.text)))
      .filter((e) => fits(slot, e.answer))
      .filter((e) => forwardCheck(slot, e.answer));

    // Light shuffle of the top 16 by frequency so the same seed gives variety
    // without losing the high-frequency bias.
    const top = candidates.slice(0, 16);
    shuffleInPlace(top, rng);
    const ordered2 = [...top, ...candidates.slice(16)];
    candidates.length = 0;
    candidates.push(...ordered2);

    for (const entry of candidates) {
      const clue = pickClue(entry);
      if (!clue) continue; // every clue for this entry already used elsewhere

      const prev: Array<string | null> = slot.cells.map(([r, c]) =>
        grid.get(`${r},${c}`) ?? null,
      );
      commit(slot, entry.answer);
      cluesBySlot.set(slot.id, clue.text);
      usedClues.add(clue.text);

      if (backtrack(i + 1)) return true;

      rollback(slot, entry.answer, prev);
      cluesBySlot.delete(slot.id);
      usedClues.delete(clue.text);
      budget.left--;
      if (budget.left <= 0) return false;
    }
    return false;
  }

  if (!backtrack(0)) return null;

  const result = { slots, fills, cluesBySlot };

  // Defense-in-depth: reject any output that fails the validator. If this
  // ever fires the generator has a bug, not the bank.
  const v = validatePuzzle({ layout: input.layout, ...result, allowDuplicateAnswers });
  if (!v.ok) return null;

  return result;
}

/**
 * Try a sequence of layouts, returning the first one that fills successfully.
 * Caller passes them in priority order (e.g. shuffled by seed).
 */
export function generateFromPool(args: {
  layouts: Layout[];
  bank: BankEntry[];
  recentAnswers?: Set<string>;
  recentClues?: Set<string>;
  difficultyTarget?: 1 | 2 | 3;
  seed: number;
  allowDuplicateAnswers?: boolean;
}): { layout: Layout; result: GenerateOutput } | null {
  const rng = mulberry32(args.seed);
  const order = shuffleInPlace([...args.layouts], rng);
  for (let i = 0; i < order.length; i++) {
    const layout = order[i];
    const result = generate({
      layout,
      bank: args.bank,
      recentAnswers: args.recentAnswers,
      recentClues: args.recentClues,
      difficultyTarget: args.difficultyTarget,
      seed: args.seed + i * 7919,
      allowDuplicateAnswers: args.allowDuplicateAnswers,
    });
    if (result) return { layout, result };
  }
  return null;
}
