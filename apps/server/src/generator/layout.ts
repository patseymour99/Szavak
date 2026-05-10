import type { CellKind, Layout, Slot } from "./types.js";

/**
 * Parse a layout mask from string rows ("OOXOO" etc) into the internal
 * representation. Throws if the mask isn't square.
 */
export function parseLayout(id: string, rows: string[]): Layout {
  const size = rows.length;
  const mask: CellKind[] = [];
  for (const row of rows) {
    if (row.length !== size) {
      throw new Error(`layout ${id}: row length ${row.length} != size ${size}`);
    }
    for (const ch of row) {
      if (ch === "O") mask.push("open");
      else if (ch === "X") mask.push("block");
      else throw new Error(`layout ${id}: bad char "${ch}" (expect O or X)`);
    }
  }
  return { id, size, mask };
}

export function cellAt(layout: Layout, row: number, col: number): CellKind | null {
  if (row < 0 || row >= layout.size || col < 0 || col >= layout.size) return null;
  return layout.mask[row * layout.size + col];
}

/**
 * Standard crossword numbering: a cell gets a number iff it starts an across
 * or down slot (left/up neighbour is block-or-edge, right/down neighbour is
 * open). Returns the map (row,col) -> number, scanning row-major.
 */
export function assignNumbers(layout: Layout): Map<string, number> {
  const numbers = new Map<string, number>();
  let next = 1;
  for (let r = 0; r < layout.size; r++) {
    for (let c = 0; c < layout.size; c++) {
      if (cellAt(layout, r, c) !== "open") continue;
      const leftBlocked = c === 0 || cellAt(layout, r, c - 1) === "block";
      const rightOpen = cellAt(layout, r, c + 1) === "open";
      const startsAcross = leftBlocked && rightOpen;
      const upBlocked = r === 0 || cellAt(layout, r - 1, c) === "block";
      const downOpen = cellAt(layout, r + 1, c) === "open";
      const startsDown = upBlocked && downOpen;
      if (startsAcross || startsDown) {
        numbers.set(`${r},${c}`, next++);
      }
    }
  }
  return numbers;
}

/**
 * Walk every open run in both directions and emit Slot records.
 * Slots are returned in stable order: across before down, then by number.
 */
export function extractSlots(layout: Layout): Slot[] {
  const numbers = assignNumbers(layout);
  const slots: Slot[] = [];

  for (let r = 0; r < layout.size; r++) {
    for (let c = 0; c < layout.size; c++) {
      if (cellAt(layout, r, c) !== "open") continue;
      const leftBlocked = c === 0 || cellAt(layout, r, c - 1) === "block";
      if (leftBlocked && cellAt(layout, r, c + 1) === "open") {
        const cells: Array<[number, number]> = [];
        let cc = c;
        while (cc < layout.size && cellAt(layout, r, cc) === "open") {
          cells.push([r, cc]);
          cc++;
        }
        const number = numbers.get(`${r},${c}`)!;
        slots.push({ id: `${number}A`, number, direction: "across", cells });
      }
    }
  }
  for (let r = 0; r < layout.size; r++) {
    for (let c = 0; c < layout.size; c++) {
      if (cellAt(layout, r, c) !== "open") continue;
      const upBlocked = r === 0 || cellAt(layout, r - 1, c) === "block";
      if (upBlocked && cellAt(layout, r + 1, c) === "open") {
        const cells: Array<[number, number]> = [];
        let rr = r;
        while (rr < layout.size && cellAt(layout, rr, c) === "open") {
          cells.push([rr, c]);
          rr++;
        }
        const number = numbers.get(`${r},${c}`)!;
        slots.push({ id: `${number}D`, number, direction: "down", cells });
      }
    }
  }
  return slots;
}
