import { useTranslation } from "react-i18next";
import type { Clue } from "@szavak/shared";

interface Props {
  clues: Clue[];
  active: { row: number; col: number };
  direction: "across" | "down";
  onPick: (clue: Clue) => void;
}

export function ClueList({ clues, active, direction, onPick }: Props) {
  const { t } = useTranslation();
  const acrossClues = clues.filter((c) => c.direction === "across");
  const downClues = clues.filter((c) => c.direction === "down");

  const isActiveClue = (clue: Clue) => {
    if (clue.direction !== direction) return false;
    if (clue.direction === "across") {
      return (
        clue.row === active.row &&
        active.col >= clue.col &&
        active.col < clue.col + clue.length
      );
    }
    return (
      clue.col === active.col &&
      active.row >= clue.row &&
      active.row < clue.row + clue.length
    );
  };

  const renderList = (heading: string, list: Clue[]) => (
    <div>
      <h3 className="font-semibold mb-2">{heading}</h3>
      <ol className="space-y-1 text-sm">
        {list.map((clue) => (
          <li
            key={`${clue.direction}-${clue.number}`}
            onClick={() => onPick(clue)}
            className={`cursor-pointer p-1 rounded ${
              isActiveClue(clue) ? "bg-yellow-200" : "hover:bg-slate-100"
            }`}
          >
            <span className="font-semibold mr-2">{clue.number}.</span>
            {clue.text}
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {renderList(t("puzzle.across"), acrossClues)}
      {renderList(t("puzzle.down"), downClues)}
    </div>
  );
}
