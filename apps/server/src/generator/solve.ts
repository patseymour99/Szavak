import type { GridTemplate } from "./templates.js";

export interface WordbankEntry {
  answer: string; // already uppercase, single Unicode chars per cell
  clue: string;
}

export interface Slot {
  index: number;
  direction: "across" | "down";
  row: number;
  col: number;
  length: number;
  /** array of [row, col] cells in order */
  cells: Array<[number, number]>;
}

export interface FillResult {
  /** map slot.index -> chosen wordbank entry */
  filled: Map<number, WordbankEntry>;
  /** row-major filled letters, "" for black squares */
  letters: string[];
}

/* ---------- normalize wordbank ---------- */

export function normalize(s: string): string {
  return s.toLocaleUpperCase("hu-HU").trim();
}

export function isValidWord(s: string): boolean {
  return /^[A-ZÁÉÍÓÖŐÚÜŰ]+$/.test(s);
}

export function loadWordbank(entries: WordbankEntry[]): WordbankEntry[] {
  const out: WordbankEntry[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const a = normalize(e.answer);
    if (!isValidWord(a)) continue;
    if (seen.has(a)) continue;
    seen.add(a);
    out.push({ answer: a, clue: e.clue.trim() });
  }
  return out;
}

/* ---------- extract slots ---------- */

export function extractSlots(t: GridTemplate): Slot[] {
  const { size, cells } = t;
  const slots: Slot[] = [];
  let idx = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r * size + c] === 1) continue;
      const startsAcross =
        (c === 0 || cells[r * size + (c - 1)] === 1) &&
        c + 1 < size &&
        cells[r * size + (c + 1)] === 0;
      const startsDown =
        (r === 0 || cells[(r - 1) * size + c] === 1) &&
        r + 1 < size &&
        cells[(r + 1) * size + c] === 0;
      if (startsAcross) {
        const slotCells: Array<[number, number]> = [];
        let cc = c;
        while (cc < size && cells[r * size + cc] === 0) {
          slotCells.push([r, cc]);
          cc++;
        }
        slots.push({
          index: idx++,
          direction: "across",
          row: r,
          col: c,
          length: slotCells.length,
          cells: slotCells,
        });
      }
      if (startsDown) {
        const slotCells: Array<[number, number]> = [];
        let rr = r;
        while (rr < size && cells[rr * size + c] === 0) {
          slotCells.push([rr, c]);
          rr++;
        }
        slots.push({
          index: idx++,
          direction: "down",
          row: r,
          col: c,
          length: slotCells.length,
          cells: slotCells,
        });
      }
    }
  }
  return slots;
}

/* ---------- backtracking fill ---------- */

export interface FillOptions {
  /** seed for deterministic shuffling */
  seed: number;
  /** ms budget; gives up if exceeded */
  budgetMs?: number;
  /** if true, the same answer can fill multiple slots (useful for tiny grids where
   *  the only valid fills are symmetric word squares). Default false. */
  allowDuplicates?: boolean;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(a: T[], rand: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fill(
  template: GridTemplate,
  bank: WordbankEntry[],
  opts: FillOptions,
): FillResult | null {
  const slots = extractSlots(template);
  const rand = mulberry32(opts.seed);
  const budgetMs = opts.budgetMs ?? 5000;
  const start = Date.now();

  // Bucket bank by length.
  const byLen = new Map<number, WordbankEntry[]>();
  for (const e of bank) {
    const L = [...e.answer].length;
    if (!byLen.has(L)) byLen.set(L, []);
    byLen.get(L)!.push(e);
  }

  // Letter grid: letters[r*size+c] = "" for unfilled
  const size = template.size;
  const letters: string[] = new Array(size * size).fill("");

  const usedAnswers = new Set<string>();
  const allowDuplicates = opts.allowDuplicates ?? false;
  const filled = new Map<number, WordbankEntry>();
  const placed: boolean[] = slots.map(() => false);

  function patternFor(slot: Slot): string {
    let p = "";
    for (const [r, c] of slot.cells) {
      const ch = letters[r * size + c];
      p += ch === "" ? "." : ch;
    }
    return p;
  }

  function matches(answer: string, pattern: string): boolean {
    const a = [...answer];
    const p = [...pattern];
    if (a.length !== p.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (p[i] !== "." && p[i] !== a[i]) return false;
    }
    return true;
  }

  function candidatesFor(slot: Slot): WordbankEntry[] {
    const pool = byLen.get(slot.length) ?? [];
    const pattern = patternFor(slot);
    const out: WordbankEntry[] = [];
    for (const e of pool) {
      if (!allowDuplicates && usedAnswers.has(e.answer)) continue;
      if (matches(e.answer, pattern)) out.push(e);
    }
    return out;
  }

  function pickNextSlot(): { slot: Slot; cands: WordbankEntry[] } | null {
    let best: Slot | null = null;
    let bestCands: WordbankEntry[] | null = null;
    let bestCount = Infinity;
    for (const s of slots) {
      if (placed[s.index]) continue;
      // Skip slots that are already fully determined (no "." in pattern) but not yet
      // marked as placed — that means a cross-fill completed them. We still need to
      // mark them as placed and verify the implied answer exists in the bank.
      const pat = patternFor(s);
      if (!pat.includes(".")) {
        // implied — accept if the implied word is a bank entry.
        const pool = byLen.get(s.length) ?? [];
        const found = pool.find(
          (e) => e.answer === pat && (allowDuplicates || !usedAnswers.has(e.answer)),
        );
        if (!found) {
          return { slot: s, cands: [] }; // dead end
        }
        return { slot: s, cands: [found] };
      }
      const cands = candidatesFor(s);
      if (cands.length < bestCount) {
        bestCount = cands.length;
        best = s;
        bestCands = cands;
        if (bestCount === 0) break;
      }
    }
    if (!best) return null;
    return { slot: best, cands: bestCands ?? [] };
  }

  /** Forward-check: after a tentative placement, ensure every unfilled crossing slot still has at least one candidate. */
  function forwardCheck(slot: Slot): boolean {
    // Look at slots that share a cell with this one.
    const myCells = new Set(slot.cells.map(([r, c]) => `${r},${c}`));
    for (const s of slots) {
      if (placed[s.index]) continue;
      if (s.index === slot.index) continue;
      let intersects = false;
      for (const [r, c] of s.cells) {
        if (myCells.has(`${r},${c}`)) {
          intersects = true;
          break;
        }
      }
      if (!intersects) continue;
      const pat = patternFor(s);
      if (!pat.includes(".")) {
        // fully determined; must exist in bank
        const pool = byLen.get(s.length) ?? [];
        if (
          !pool.some(
            (e) => e.answer === pat && (allowDuplicates || !usedAnswers.has(e.answer)),
          )
        )
          return false;
        continue;
      }
      const cands = candidatesFor(s);
      if (cands.length === 0) return false;
    }
    return true;
  }

  function recurse(): boolean {
    if (Date.now() - start > budgetMs) return false;
    const next = pickNextSlot();
    if (!next) return true; // all placed
    const { slot, cands } = next;
    if (cands.length === 0) return false;
    const order = shuffleInPlace(cands.slice(), rand);
    for (const cand of order) {
      const wchars = [...cand.answer];
      const snapshot: Array<{ idx: number; prev: string }> = [];
      for (let k = 0; k < slot.cells.length; k++) {
        const [r, c] = slot.cells[k];
        const idx = r * size + c;
        snapshot.push({ idx, prev: letters[idx] });
        letters[idx] = wchars[k];
      }
      usedAnswers.add(cand.answer);
      filled.set(slot.index, cand);
      placed[slot.index] = true;

      if (forwardCheck(slot) && recurse()) return true;

      // undo
      placed[slot.index] = false;
      filled.delete(slot.index);
      usedAnswers.delete(cand.answer);
      for (const { idx, prev } of snapshot) letters[idx] = prev;
    }
    return false;
  }

  if (!recurse()) return null;

  // Build row-major output (mark black squares as "")
  const out: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (template.cells[r * size + c] === 1) out.push("");
      else out.push(letters[r * size + c]);
    }
  }
  return { filled, letters: out };
}
