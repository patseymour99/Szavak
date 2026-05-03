/**
 * Crossword grid templates: '.' = white (fillable), '#' = black (blocker).
 * Templates must be square and 180° rotationally symmetric.
 *
 * v1 ships only 4x4 fully-open "mini" templates. American-style grids with
 * intersecting longer words require a much larger wordbank than the seed bank
 * we ship; rather than fail at generation time, we constrain v1 to mini grids
 * and grow once the bank has enough 5+ letter words. See docs in README.
 */

export interface GridTemplate {
  size: number;
  /** array of length size*size, row-major; 0 = white, 1 = black */
  cells: number[];
}

function parse(rows: string[]): GridTemplate {
  const size = rows.length;
  const cells: number[] = [];
  for (const row of rows) {
    if (row.length !== size) {
      throw new Error(`template row length ${row.length} != size ${size}: "${row}"`);
    }
    for (const ch of row) cells.push(ch === "#" ? 1 : 0);
  }
  validate({ size, cells });
  return { size, cells };
}

export function validate(t: GridTemplate): void {
  const { size, cells } = t;
  if (cells.length !== size * size) {
    throw new Error("cells length mismatch");
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const a = cells[r * size + c];
      const b = cells[(size - 1 - r) * size + (size - 1 - c)];
      if (a !== b) throw new Error(`template not 180° symmetric at (${r},${c})`);
    }
  }
  // Every white cell must lie in slots of length >= 3.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r * size + c] === 1) continue;
      let l = c;
      while (l > 0 && cells[r * size + (l - 1)] === 0) l--;
      let rt = c;
      while (rt < size - 1 && cells[r * size + (rt + 1)] === 0) rt++;
      if (rt - l + 1 < 3) {
        throw new Error(`across slot < 3 at row ${r} col ${c}`);
      }
      let t2 = r;
      while (t2 > 0 && cells[(t2 - 1) * size + c] === 0) t2--;
      let b = r;
      while (b < size - 1 && cells[(b + 1) * size + c] === 0) b++;
      if (b - t2 + 1 < 3) {
        throw new Error(`down slot < 3 at row ${r} col ${c}`);
      }
    }
  }
}

// 4x4 fully open — relies on duplicate answers being allowed (see solver).
export const MINI_4: GridTemplate[] = [
  parse([
    "....",
    "....",
    "....",
    "....",
  ]),
];

export type TemplateSize = 4;

export function pickTemplate(size: TemplateSize, seed: number): GridTemplate {
  // Only 4x4 templates exist in v1, but the parameter is here so that future
  // bigger grids slot in without API changes.
  void size;
  return MINI_4[seed % MINI_4.length];
}
