import type { Puzzle } from "@szavak/shared";
import { prisma } from "./prisma.js";

export function rowToPuzzle(row: {
  id: string;
  kind: string;
  language: string;
  date: string | null;
  rows: number;
  cols: number;
  cellsJson: string;
  cluesJson: string;
}): Puzzle {
  return {
    id: row.id,
    kind: row.kind as Puzzle["kind"],
    language: row.language as Puzzle["language"],
    date: row.date ?? undefined,
    rows: row.rows,
    cols: row.cols,
    cells: JSON.parse(row.cellsJson),
    clues: JSON.parse(row.cluesJson),
  };
}

export async function findPuzzle(id: string): Promise<Puzzle | null> {
  const row = await prisma.puzzle.findUnique({ where: { id } });
  return row ? rowToPuzzle(row) : null;
}

export async function findDailyPuzzle(date: string, language: Puzzle["language"]) {
  const row = await prisma.puzzle.findUnique({
    where: { kind_language_date: { kind: "daily", language, date } },
  });
  return row ? rowToPuzzle(row) : null;
}

export async function savePuzzle(p: Omit<Puzzle, "id">): Promise<Puzzle> {
  const row = await prisma.puzzle.create({
    data: {
      kind: p.kind,
      language: p.language,
      date: p.date,
      rows: p.rows,
      cols: p.cols,
      cellsJson: JSON.stringify(p.cells),
      cluesJson: JSON.stringify(p.clues),
    },
  });
  return rowToPuzzle(row);
}

/** Strip solutions from cells and answers from clues — what we send to clients. */
export function strip(p: Puzzle): Puzzle {
  return {
    ...p,
    cells: p.cells.map((c) => ({ ...c, solution: undefined })),
    clues: p.clues.map((c) => ({ ...c, answer: "" })),
  };
}
