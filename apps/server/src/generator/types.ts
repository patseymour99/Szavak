/**
 * Internal types for the v2 generator. Public Puzzle shape (in @szavak/shared)
 * is kept as-is so the database doesn't need a migration; we map between the
 * two at the boundary (see index.ts -> assemblePuzzle).
 */

export type CellKind = "open" | "block";

export interface Layout {
  id: string;
  size: number;
  /** size*size flat array, row-major: 'O' (open) or 'X' (block) */
  mask: CellKind[];
}

export interface Slot {
  id: string;
  number: number;
  direction: "across" | "down";
  /** ordered list of [row, col] cells */
  cells: Array<[number, number]>;
}

export interface BankClue {
  text: string;
  difficulty: 1 | 2 | 3;
}

export interface BankEntry {
  answer: string;
  frequency: number;
  clues: BankClue[];
}

export interface BuiltPuzzle {
  layout: Layout;
  slots: Slot[];
  /** slotId -> chosen answer */
  fills: Map<string, string>;
  /** slotId -> chosen clue text */
  cluesBySlot: Map<string, string>;
}
