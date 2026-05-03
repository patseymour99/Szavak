import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { api } from "../api";
import { usePuzzleLang } from "../store";
import { formatElapsed } from "../util";
import type { Profile } from "@szavak/shared";

interface DailyEntry {
  profile: Profile;
  elapsedMs: number;
  errors: number;
  completedAt: string;
}

interface MonthlyEntry {
  profile: Profile;
  totalMs: number;
  solves: number;
}

export default function Leaderboard() {
  const { t } = useTranslation();
  const puzzleLang = usePuzzleLang((s) => s.puzzleLang);
  const [daily, setDaily] = useState<DailyEntry[]>([]);
  const [monthly, setMonthly] = useState<MonthlyEntry[]>([]);

  useEffect(() => {
    api.dailyLeaderboard(puzzleLang).then((r) => setDaily(r.entries));
    api.monthlyLeaderboard(puzzleLang).then((r) => setMonthly(r.entries));
  }, [puzzleLang]);

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4">{t("leaderboard.daily")}</h1>
      <Table
        empty={t("leaderboard.empty")}
        head={[t("leaderboard.rank"), t("leaderboard.name"), t("leaderboard.time"), t("leaderboard.errors")]}
        rows={daily.map((e, i) => [
          String(i + 1),
          <span key={e.profile.id}>
            <span
              className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
              style={{ backgroundColor: e.profile.color }}
            />
            {e.profile.name}
          </span>,
          formatElapsed(e.elapsedMs),
          String(e.errors),
        ])}
      />

      <h1 className="text-2xl font-bold mb-4 mt-8">{t("leaderboard.monthly")}</h1>
      <Table
        empty={t("leaderboard.empty")}
        head={[t("leaderboard.rank"), t("leaderboard.name"), t("leaderboard.solves"), t("leaderboard.totalTime")]}
        rows={monthly.map((e, i) => [
          String(i + 1),
          <span key={e.profile.id}>
            <span
              className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
              style={{ backgroundColor: e.profile.color }}
            />
            {e.profile.name}
          </span>,
          String(e.solves),
          formatElapsed(e.totalMs),
        ])}
      />
    </Layout>
  );
}

function Table({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: (string | JSX.Element)[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">{empty}</p>;
  }
  return (
    <table className="w-full bg-white shadow rounded overflow-hidden text-sm">
      <thead className="bg-slate-100 text-slate-600">
        <tr>
          {head.map((h, i) => (
            <th key={i} className="text-left px-3 py-2">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t">
            {r.map((cell, j) => (
              <td key={j} className="px-3 py-2">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
