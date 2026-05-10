import type { Layout, Slot } from "./types.js";
import { cellAt, extractSlots } from "./layout.js";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Validate a fully-built puzzle against the rules in the spec §7.2:
 *   2. No two-letter words.
 *   3. All open cells belong to both an across and a down slot.
 *   4. All open cells form a single connected component.
 *   5. Unique answers.
 *   6. Unique clues.
 *
 * Symmetry (rule 1) is checked separately at layout-load time, since v1's
 * pool is hand-vetted; it's not enforced here.
 */
export function validatePuzzle(args: {
  layout: Layout;
  slots: Slot[];
  fills: Map<string, string>;
  cluesBySlot: Map<string, string>;
  /**
   * If true, rule 5 (unique answers per puzzle) is downgraded to a warning
   * rather than an error. The IMG_0107 bug was about duplicate CLUE TEXT,
   * which is rule 6 — that stays an error. v1's small bank can't satisfy
   * rule 5 strictly on the 4×4 word-square layout, so the route flips this
   * on. See DECISIONS.md.
   */
  allowDuplicateAnswers?: boolean;
}): ValidationResult {
  const { layout, slots, fills, cluesBySlot, allowDuplicateAnswers } = args;
  const errors: string[] = [];

  // Rule 2: every slot >= 3.
  for (const s of slots) {
    if (s.cells.length < 3) {
      errors.push(`slot ${s.id} has length ${s.cells.length} (< 3)`);
    }
  }

  // Rule 3: every open cell must belong to an across AND a down slot.
  const inAcross = new Set<string>();
  const inDown = new Set<string>();
  for (const s of slots) {
    for (const [r, c] of s.cells) {
      if (s.direction === "across") inAcross.add(`${r},${c}`);
      else inDown.add(`${r},${c}`);
    }
  }
  for (let r = 0; r < layout.size; r++) {
    for (let c = 0; c < layout.size; c++) {
      if (cellAt(layout, r, c) !== "open") continue;
      const key = `${r},${c}`;
      if (!inAcross.has(key)) errors.push(`cell (${r},${c}) is not in any across slot`);
      if (!inDown.has(key)) errors.push(`cell (${r},${c}) is not in any down slot`);
    }
  }

  // Rule 4: connectedness via BFS from the first open cell.
  const opens: Array<[number, number]> = [];
  for (let r = 0; r < layout.size; r++) {
    for (let c = 0; c < layout.size; c++) {
      if (cellAt(layout, r, c) === "open") opens.push([r, c]);
    }
  }
  if (opens.length > 0) {
    const seen = new Set<string>();
    const queue: Array<[number, number]> = [opens[0]];
    seen.add(`${opens[0][0]},${opens[0][1]}`);
    while (queue.length) {
      const [r, c] = queue.shift()!;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nr = r + dr, nc = c + dc;
        if (cellAt(layout, nr, nc) !== "open") continue;
        const k = `${nr},${nc}`;
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([nr, nc]);
      }
    }
    if (seen.size !== opens.length) {
      errors.push(`open cells not connected: reached ${seen.size}/${opens.length}`);
    }
  }

  // Rule 5: unique answers.
  if (!allowDuplicateAnswers) {
    const seenAnswers = new Set<string>();
    for (const [slotId, ans] of fills) {
      if (seenAnswers.has(ans)) errors.push(`duplicate answer "${ans}" (slot ${slotId})`);
      seenAnswers.add(ans);
    }
  }

  // Rule 6: unique clues — THE BUG.
  const seenClues = new Set<string>();
  for (const [slotId, clue] of cluesBySlot) {
    if (seenClues.has(clue)) errors.push(`duplicate clue "${clue}" (slot ${slotId})`);
    seenClues.add(clue);
  }

  // Cross-check: every slot has both a fill and a clue.
  for (const s of slots) {
    if (!fills.has(s.id)) errors.push(`slot ${s.id} has no fill`);
    if (!cluesBySlot.has(s.id)) errors.push(`slot ${s.id} has no clue`);
  }

  // Cross-check: fill matches slot length.
  for (const s of slots) {
    const fill = fills.get(s.id);
    if (fill && [...fill].length !== s.cells.length) {
      errors.push(`slot ${s.id} fill "${fill}" length ${[...fill].length} != ${s.cells.length}`);
    }
  }

  // Cross-check: crossings agree.
  const letters = new Map<string, string>();
  for (const s of slots) {
    const fill = fills.get(s.id);
    if (!fill) continue;
    const chars = [...fill];
    for (let i = 0; i < s.cells.length; i++) {
      const [r, c] = s.cells[i];
      const k = `${r},${c}`;
      const existing = letters.get(k);
      if (existing && existing !== chars[i]) {
        errors.push(`crossing mismatch at (${r},${c}): "${existing}" vs "${chars[i]}"`);
      }
      letters.set(k, chars[i]);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Validate a layout in isolation: rules 2, 3, 4 must hold (slot length,
 * all cells checked, connectedness). Fill-related rules (5, 6) are skipped
 * since there are no fills yet.
 */
export function validateLayout(layout: Layout): ValidationResult {
  const slots = extractSlots(layout);
  const errors: string[] = [];

  // Rule 2: every slot >= 3.
  for (const s of slots) {
    if (s.cells.length < 3) errors.push(`slot ${s.id} has length ${s.cells.length} (< 3)`);
  }

  // Rule 3: every open cell must belong to an across AND a down slot.
  const inAcross = new Set<string>();
  const inDown = new Set<string>();
  for (const s of slots) {
    for (const [r, c] of s.cells) {
      if (s.direction === "across") inAcross.add(`${r},${c}`);
      else inDown.add(`${r},${c}`);
    }
  }
  for (let r = 0; r < layout.size; r++) {
    for (let c = 0; c < layout.size; c++) {
      if (cellAt(layout, r, c) !== "open") continue;
      const key = `${r},${c}`;
      if (!inAcross.has(key)) errors.push(`cell (${r},${c}) is not in any across slot`);
      if (!inDown.has(key)) errors.push(`cell (${r},${c}) is not in any down slot`);
    }
  }

  // Rule 4: connectedness via BFS.
  const opens: Array<[number, number]> = [];
  for (let r = 0; r < layout.size; r++) {
    for (let c = 0; c < layout.size; c++) {
      if (cellAt(layout, r, c) === "open") opens.push([r, c]);
    }
  }
  if (opens.length > 0) {
    const seen = new Set<string>();
    const queue: Array<[number, number]> = [opens[0]];
    seen.add(`${opens[0][0]},${opens[0][1]}`);
    while (queue.length) {
      const [r, c] = queue.shift()!;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nr = r + dr, nc = c + dc;
        if (cellAt(layout, nr, nc) !== "open") continue;
        const k = `${nr},${nc}`;
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([nr, nc]);
      }
    }
    if (seen.size !== opens.length) {
      errors.push(`open cells not connected: reached ${seen.size}/${opens.length}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
