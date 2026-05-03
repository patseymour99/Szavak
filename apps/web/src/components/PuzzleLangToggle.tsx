import { useTranslation } from "react-i18next";
import { usePuzzleLang } from "../store";

export function PuzzleLangToggle() {
  const { t } = useTranslation();
  const { puzzleLang, setPuzzleLang } = usePuzzleLang();
  return (
    <div className="inline-flex items-center gap-2 text-sm">
      <span className="text-slate-500">{t("puzzleLanguage.label")}:</span>
      <button
        onClick={() => setPuzzleLang("hu")}
        className={`px-2 py-0.5 rounded ${
          puzzleLang === "hu" ? "bg-emerald-600 text-white" : "bg-slate-200"
        }`}
      >
        HU
      </button>
      <button
        onClick={() => setPuzzleLang("en")}
        className={`px-2 py-0.5 rounded ${
          puzzleLang === "en" ? "bg-emerald-600 text-white" : "bg-slate-200"
        }`}
      >
        EN
      </button>
    </div>
  );
}
