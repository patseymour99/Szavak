import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSession } from "../store";
import { api } from "../api";
import { LanguageToggle } from "./LanguageToggle";

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { profile, setProfile } = useSession();
  const nav = useNavigate();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-xl font-bold tracking-tight">
            {t("app.title")}
            <span className="text-sm font-normal text-slate-500 ml-2">
              {t("app.tagline")}
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-3">
            <LanguageToggle />
            {profile && (
              <>
                <span
                  className="text-sm font-medium px-2 py-0.5 rounded"
                  style={{ backgroundColor: profile.color, color: "white" }}
                >
                  {profile.name}
                </span>
                {profile.isAdmin && (
                  <Link to="/admin" className="text-sm text-slate-600 hover:text-slate-900">
                    {t("nav.admin")}
                  </Link>
                )}
                <button
                  onClick={async () => {
                    await api.logout();
                    setProfile(null);
                    nav("/login");
                  }}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  {t("nav.logout")}
                </button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">{children}</main>
    </div>
  );
}
