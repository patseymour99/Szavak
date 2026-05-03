import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatElapsed } from "../util";

interface Props {
  startedAt: string;
  completedAt?: string | null;
  /** extra ms to add to the displayed time (e.g. reveal penalties accrued). */
  penaltyMs?: number;
  paused?: boolean;
}

export function Timer({ startedAt, completedAt, penaltyMs = 0, paused }: Props) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (completedAt || paused) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [completedAt, paused]);
  const end = completedAt ? new Date(completedAt).getTime() : now;
  const elapsed = end - new Date(startedAt).getTime() + penaltyMs;
  return (
    <div className="text-sm text-slate-600">
      <span className="mr-1">{t("puzzle.elapsed")}:</span>
      <span className="font-mono font-semibold text-slate-900">
        {formatElapsed(elapsed)}
      </span>
    </div>
  );
}
