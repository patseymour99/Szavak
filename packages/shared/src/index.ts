export type Language = "hu" | "en";

export type PuzzleKind = "daily" | "collab" | "freeplay";

export interface Cell {
  row: number;
  col: number;
  isBlack: boolean;
  /** answer letter (uppercase, single Unicode char) — undefined for black squares */
  solution?: string;
  /** clue number rendered in the corner of this cell, if it starts a word */
  number?: number;
}

export interface Clue {
  number: number;
  direction: "across" | "down";
  text: string;
  answer: string;
  row: number;
  col: number;
  length: number;
}

export interface Puzzle {
  id: string;
  kind: PuzzleKind;
  language: Language;
  /** ISO date (YYYY-MM-DD) for daily puzzles */
  date?: string;
  rows: number;
  cols: number;
  /** row-major flattened cell array of length rows*cols */
  cells: Cell[];
  clues: Clue[];
}

export interface Profile {
  id: string;
  name: string;
  /** hex color used for cursors / leaderboard chips */
  color: string;
}

export interface SoloLeaderboardEntry {
  profile: Profile;
  /** elapsed time in milliseconds, including penalties */
  elapsedMs: number;
  errors: number;
  completedAt: string;
}

export interface DailyLeaderboard {
  date: string;
  entries: SoloLeaderboardEntry[];
}

/* ========= Socket events for collab mode ========= */

export interface CellUpdateEvent {
  row: number;
  col: number;
  letter: string; // empty string = clear
  profileId: string;
}

export interface CursorMoveEvent {
  row: number;
  col: number;
  profileId: string;
}

export interface PresenceEvent {
  profile: Profile;
}

export interface CollabState {
  puzzleId: string;
  /** row-major filled letters, "" for empty */
  letters: string[];
  /** profileId -> { row, col } */
  cursors: Record<string, { row: number; col: number }>;
  /** currently connected profiles */
  members: Profile[];
}

export interface ServerToClientEvents {
  "collab:state": (state: CollabState) => void;
  "cell:update": (event: CellUpdateEvent) => void;
  "cursor:move": (event: CursorMoveEvent) => void;
  "presence:join": (event: PresenceEvent) => void;
  "presence:leave": (event: { profileId: string }) => void;
  "puzzle:complete": (event: { profileIds: string[]; finishedAt: string }) => void;
}

export interface ClientToServerEvents {
  "collab:join": (puzzleId: string, ack: (state: CollabState) => void) => void;
  "cell:update": (event: Omit<CellUpdateEvent, "profileId">) => void;
  "cursor:move": (event: Omit<CursorMoveEvent, "profileId">) => void;
}

/* ========= Penalty constants ========= */

export const REVEAL_LETTER_PENALTY_MS = 30_000;
export const CHECK_PUZZLE_PENALTY_MS = 60_000;

export function computeElapsedMs(
  startedAt: string,
  completedAt: string,
  reveals: number,
  checks: number,
): number {
  const base = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  return base + reveals * REVEAL_LETTER_PENALTY_MS + checks * CHECK_PUZZLE_PENALTY_MS;
}
