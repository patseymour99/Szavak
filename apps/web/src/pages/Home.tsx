import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useSession } from "../store";
import { PuzzleLangToggle } from "../components/PuzzleLangToggle";

export default function Home() {
  const { t } = useTranslation();
  const profile = useSession((s) => s.profile);
  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-1">
        {t("home.welcome", { name: profile?.name ?? "" })}
      </h1>
      <div className="mb-4">
        <PuzzleLangToggle />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          title={t("home.todayCard")}
          description={t("home.todayDescription")}
          to="/daily"
          cta={t("home.playDaily")}
          color="bg-emerald-600"
        />
        <Card
          title={t("home.collabCard")}
          description={t("home.collabDescription")}
          to="/collab"
          cta={t("home.joinCollab")}
          color="bg-indigo-600"
        />
        <Card
          title={t("home.leaderboardCard")}
          description={t("home.leaderboardDescription")}
          to="/leaderboard"
          cta={t("home.viewLeaderboard")}
          color="bg-amber-600"
        />
      </div>
    </Layout>
  );
}

function Card({
  title,
  description,
  to,
  cta,
  color,
}: {
  title: string;
  description: string;
  to: string;
  cta: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-5 flex flex-col">
      <h2 className="font-semibold text-lg mb-1">{title}</h2>
      <p className="text-sm text-slate-600 mb-4 flex-1">{description}</p>
      <Link
        to={to}
        className={`text-sm font-medium text-white text-center px-3 py-2 rounded ${color}`}
      >
        {cta}
      </Link>
    </div>
  );
}
