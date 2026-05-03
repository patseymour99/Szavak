import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { CrosswordGrid } from "../components/CrosswordGrid";
import { ClueList } from "../components/ClueList";
import { Timer } from "../components/Timer";
import { api } from "../api";
import { usePuzzleLang } from "../store";
import type { Clue, Puzzle } from "@szavak/shared";
import { REVEAL_LETTER_PENALTY_MS, CHECK_PUZZLE_PENALTY_MS } from "@szavak/shared";
import { formatElapsed } from "../util";

export default function SoloPuzzle() {
  const { t } = useTranslation();
  const puzzleLang = usePuzzleLang((s) => s.puzzleLang);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [letters, setLetters] = useState<string[]>([]);
  const [active, setActive] = useState({ row: 0, col: 0 });
  const [direction, setDirection] = useState<"across" | "down">("across");
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [reveals, setReveals] = useState(0);
  const [checks, setChecks] = useState(0);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [finalTime, setFinalTime] = useState<number | null>(null);

  useEffect(() => {
    setPuzzle(null);
    api.daily(puzzleLang).then((r) => {
      setPuzzle(r.puzzle);
      setLetters(r.puzzle.cells.map(() => ""));
      setStartedAt(r.solve.startedAt);
      setCompletedAt(r.solve.completedAt);
      setReveals(r.solve.reveals);
      setChecks(r.solve.checks);
      setElapsedMs(r.solve.elapsedMs);
      const first = r.puzzle.cells.findIndex((c) => !c.isBlack);
      if (first >= 0) {
        setActive({
          row: Math.floor(first / r.puzzle.cols),
          col: first % r.puzzle.cols,
        });
      }
    });
  }, [puzzleLang]);

  const penaltyMs =
    reveals * REVEAL_LETTER_PENALTY_MS + checks * CHECK_PUZZLE_PENALTY_MS;

  const onPickClue = (clue: Clue) => {
    setActive({ row: clue.row, col: clue.col });
    setDirection(clue.direction);
  };

  const onReveal = async () => {
    if (!puzzle || completedAt) return;
    const r = await api.reveal(puzzle.id, active.row, active.col);
    const idx = active.row * puzzle.cols + active.col;
    setLetters((prev) => {
      const next = prev.slice();
      next[idx] = r.letter;
      return next;
    });
    setReveals((n) => n + 1);
  };

  const onSubmit = async () => {
    if (!puzzle || completedAt) return;
    setErrorMsg(null);
    const r = await api.submit(puzzle.id, letters, reveals, checks);
    if (!r.ok) {
      setChecks((n) => n + 1);
      setErrorMsg(t("puzzle.wrongAnswer"));
      return;
    }
    setFinalTime(r.elapsedMs ?? null);
    setCompletedAt(new Date().toISOString());
  };

  const onCheck = () => {
    if (!puzzle || completedAt) return;
    setChecks((n) => n + 1);
    setErrorMsg(null);
    let mismatch = false;
    for (let i = 0; i < puzzle.cells.length; i++) {
      const cell = puzzle.cells[i];
      if (cell.isBlack) continue;
      const have = letters[i];
      if (have && cell.solution && have !== cell.solution) mismatch = true;
    }
    setErrorMsg(mismatch ? t("puzzle.wrongAnswer") : null);
  };

  const remaining = useMemo(() => {
    if (!puzzle) return 0;
    let r = 0;
    for (let i = 0; i < puzzle.cells.length; i++) {
      if (!puzzle.cells[i].isBlack && !letters[i]) r++;
    }
    return r;
  }, [puzzle, letters]);

  if (!puzzle || !startedAt) {
    return (
      <Layout>
        <p>{t("puzzle.loading")}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <Timer
          startedAt={startedAt}
          completedAt={completedAt}
          penaltyMs={penaltyMs}
          paused={!!completedAt}
        />
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={onCheck} className="px-3 py-1.5 rounded bg-slate-200 text-sm">
            {t("puzzle.check")}
          </button>
          <button onClick={onReveal} className="px-3 py-1.5 rounded bg-amber-200 text-sm">
            {t("puzzle.reveal")}
          </button>
          <button
            onClick={onSubmit}
            disabled={remaining > 0}
            className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm disabled:opacity-50"
          >
            {t("puzzle.submit")}
          </button>
        </div>
      </div>
      {errorMsg && <div className="text-rose-600 text-sm mb-2">{errorMsg}</div>}
      {completedAt && (
        <div className="bg-emerald-50 border border-emerald-200 rounded p-3 mb-4 text-emerald-800">
          {t("puzzle.completed", {
            time: formatElapsed(finalTime ?? elapsedMs ?? 0),
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-6">
        <CrosswordGrid
          puzzle={puzzle}
          letters={letters}
          active={active}
          direction={direction}
          onChange={(r, c, letter) => {
            const idx = r * puzzle.cols + c;
            setLetters((prev) => {
              const next = prev.slice();
              next[idx] = letter;
              return next;
            });
          }}
          onMove={(r, c) => setActive({ row: r, col: c })}
          onDirectionToggle={() =>
            setDirection((d) => (d === "across" ? "down" : "across"))
          }
        />
        <div className="flex-1 min-w-[280px]">
          <ClueList
            clues={puzzle.clues}
            active={active}
            direction={direction}
            onPick={onPickClue}
          />
        </div>
      </div>
    </Layout>
  );
}
