import { useEffect, useRef } from "react";
import type { Cell, Profile, Puzzle } from "@szavak/shared";

export interface RemoteCursor {
  profile: Profile;
  row: number;
  col: number;
}

interface Props {
  puzzle: Puzzle;
  letters: string[];
  active: { row: number; col: number };
  direction: "across" | "down";
  remoteCursors?: RemoteCursor[];
  onChange: (row: number, col: number, letter: string) => void;
  onMove: (row: number, col: number) => void;
  onDirectionToggle: () => void;
}

export function CrosswordGrid({
  puzzle,
  letters,
  active,
  direction,
  remoteCursors = [],
  onChange,
  onMove,
  onDirectionToggle,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const { rows, cols, cells } = puzzle;

  const cellAt = (r: number, c: number): Cell | undefined =>
    r >= 0 && r < rows && c >= 0 && c < cols ? cells[r * cols + c] : undefined;

  const findNextCell = (
    fromR: number,
    fromC: number,
    dir: "across" | "down",
    delta: 1 | -1,
  ): [number, number] | null => {
    let r = fromR;
    let c = fromC;
    while (true) {
      if (dir === "across") c += delta;
      else r += delta;
      const cell = cellAt(r, c);
      if (!cell) return null;
      if (!cell.isBlack) return [r, c];
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    const cell = cellAt(active.row, active.col);
    if (!cell) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = findNextCell(active.row, active.col, "across", -1);
      if (next) onMove(next[0], next[1]);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = findNextCell(active.row, active.col, "across", 1);
      if (next) onMove(next[0], next[1]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = findNextCell(active.row, active.col, "down", -1);
      if (next) onMove(next[0], next[1]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = findNextCell(active.row, active.col, "down", 1);
      if (next) onMove(next[0], next[1]);
    } else if (e.key === " ") {
      e.preventDefault();
      onDirectionToggle();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      onChange(active.row, active.col, "");
      const next = findNextCell(active.row, active.col, direction, -1);
      if (next) onMove(next[0], next[1]);
    } else if (e.key.length === 1 && /[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/.test(e.key)) {
      e.preventDefault();
      onChange(active.row, active.col, e.key.toLocaleUpperCase("hu-HU"));
      const next = findNextCell(active.row, active.col, direction, 1);
      if (next) onMove(next[0], next[1]);
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKey}
      className="inline-block outline-none"
      role="grid"
    >
      <div
        className="grid bg-slate-900 gap-px p-px rounded-md shadow"
        style={{ gridTemplateColumns: `repeat(${cols}, 2.5rem)` }}
      >
        {cells.map((cell) => {
          const idx = cell.row * cols + cell.col;
          if (cell.isBlack) {
            return <div key={idx} className="w-10 h-10 bg-slate-900" />;
          }
          const isActive = cell.row === active.row && cell.col === active.col;
          const remoteHere = remoteCursors.find(
            (rc) => rc.row === cell.row && rc.col === cell.col,
          );
          const inActiveWord =
            !isActive &&
            (direction === "across"
              ? cell.row === active.row
              : cell.col === active.col);
          return (
            <button
              key={idx}
              onClick={() => {
                if (cell.row === active.row && cell.col === active.col) {
                  onDirectionToggle();
                } else {
                  onMove(cell.row, cell.col);
                }
              }}
              className={`relative w-10 h-10 text-lg font-semibold flex items-center justify-center
                ${isActive ? "bg-yellow-300" : inActiveWord ? "bg-yellow-100" : "bg-white"}
                hover:bg-yellow-50`}
              style={
                remoteHere && !isActive
                  ? { boxShadow: `inset 0 0 0 3px ${remoteHere.profile.color}` }
                  : undefined
              }
              aria-label={`row ${cell.row + 1} col ${cell.col + 1}`}
            >
              {cell.number !== undefined && (
                <span className="absolute top-0 left-0.5 text-[10px] font-normal text-slate-500">
                  {cell.number}
                </span>
              )}
              <span>{letters[idx] ?? ""}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
